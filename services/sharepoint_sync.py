"""SharePoint integration for Power Apps and Power BI data synchronization.

This module provides bidirectional sync between SharePoint lists and the local
SQLite database. It reads employee data from SharePoint lists and can also
push data back for Power Apps consumption.

Configuration (environment variables):
    SHAREPOINT_USERNAME         - SharePoint username (e.g., user@company.com)
    SHAREPOINT_PASSWORD         - SharePoint password
    SHAREPOINT_SITE_URL         - SharePoint site URL
    SHAREPOINT_EMPLOYEE_LIST    - SharePoint list name for employees (default: "Employees")
    SHAREPOINT_SYNC_INTERVAL    - Sync interval in seconds (default: 300)
    SHAREPOINT_AUTO_SYNC        - Set to "true" to enable automatic periodic sync
"""

import os
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class SharePointSync:
    """Handles synchronization between SharePoint lists and local database."""

    def __init__(self):
        self.username = os.environ.get("SHAREPOINT_USERNAME", "")
        self.password = os.environ.get("SHAREPOINT_PASSWORD", "")
        self.site_url = os.environ.get("SHAREPOINT_SITE_URL", "")
        self.employee_list_name = os.environ.get("SHAREPOINT_EMPLOYEE_LIST", "Employees")
        self.enabled = bool(self.username and self.password and self.site_url)
        self._ctx: Optional[object] = None

    def _get_context(self) -> Optional[object]:
        """Authenticate and return a SharePoint client context."""
        if not self.enabled:
            return None

        if self._ctx is not None:
            return self._ctx

        try:
            from office365.sharepoint.client_context import ClientContext
            from office365.runtime.auth.authentication_context import AuthenticationContext

            auth_ctx = AuthenticationContext(url=self.site_url)
            if auth_ctx.acquire_token_for_user(username=self.username, password=self.password):
                self._ctx = ClientContext(self.site_url, auth_ctx)
                logger.info("SharePoint authentication successful")
                return self._ctx
            else:
                logger.error("SharePoint authentication failed")
                return None
        except Exception as e:
            logger.error(f"SharePoint authentication error: {e}")
            return None

    def sync_employees_from_sharepoint(self) -> dict:
        """Fetch employee data from SharePoint and sync to local database.

        Returns:
            dict with keys: 'success', 'added', 'updated', 'errors'
        """
        if not self.enabled:
            return {"success": False, "added": 0, "updated": 0, "errors": ["SharePoint not configured"]}

        ctx = self._get_context()
        if not ctx:
            return {"success": False, "added": 0, "updated": 0, "errors": ["Failed to authenticate with SharePoint"]}

        try:
            from database import db_session
            from models import Employee

            # Fetch all items from the SharePoint list
            sp_list = ctx.web.lists.get_by_title(self.employee_list_name)
            items = sp_list.items.get().execute_query()

            added = 0
            updated = 0
            errors = []

            for item in items:
                try:
                    # Map SharePoint fields to our Employee model
                    emp_code = item.properties.get("Title", "")
                    first_name = item.properties.get("FirstName", "")
                    last_name = item.properties.get("LastName", "")
                    job_title = item.properties.get("JobTitle", "")

                    if not emp_code:
                        errors.append(f"Skipped item with no Title/emp_code: {item.properties}")
                        continue

                    # Check if employee already exists
                    existing = db_session.query(Employee).filter_by(emp_code=emp_code).first()

                    if existing:
                        # Update existing employee
                        existing.first_name = first_name
                        existing.surname = last_name
                        existing.job_title = job_title
                        existing.initials = (first_name[:1] + last_name[:1]).upper() if first_name and last_name else ""
                        updated += 1
                    else:
                        # Create new employee
                        employee = Employee(
                            emp_code=emp_code,
                            initials=(first_name[:1] + last_name[:1]).upper() if first_name and last_name else "",
                            first_name=first_name,
                            surname=last_name,
                            job_title=job_title,
                            status="Active",
                        )
                        db_session.add(employee)
                        added += 1

                except Exception as e:
                    errors.append(f"Error processing SharePoint item {item.id}: {str(e)}")
                    continue

            db_session.commit()
            logger.info(f"SharePoint sync complete: {added} added, {updated} updated, {len(errors)} errors")
            return {"success": True, "added": added, "updated": updated, "errors": errors}

        except Exception as e:
            logger.error(f"SharePoint sync error: {e}")
            return {"success": False, "added": 0, "updated": 0, "errors": [str(e)]}

    def push_employee_to_sharepoint(self, employee) -> bool:
        """Push an employee record to SharePoint (for Power Apps consumption).

        Args:
            employee: Employee model instance

        Returns:
            bool: True if successful
        """
        if not self.enabled:
            return False

        ctx = self._get_context()
        if not ctx:
            return False

        try:
            sp_list = ctx.web.lists.get_by_title(self.employee_list_name)

            # Check if employee exists in SharePoint
            existing_items = sp_list.items.filter(f"Title eq '{employee.emp_code}'").get().execute_query()

            employee_data = {
                "Title": employee.emp_code,
                "FirstName": employee.first_name,
                "LastName": employee.surname,
                "JobTitle": employee.job_title,
                "Status": employee.status,
            }

            if existing_items:
                # Update existing item
                item_id = existing_items[0].id
                item = sp_list.get_item_by_id(item_id)
                item.set_properties(employee_data)
                item.update().execute_query()
                logger.info(f"Updated SharePoint employee: {employee.emp_code}")
            else:
                # Create new item
                sp_list.add_item(employee_data).execute_query()
                logger.info(f"Created SharePoint employee: {employee.emp_code}")

            return True

        except Exception as e:
            logger.error(f"Failed to push employee to SharePoint: {e}")
            return False

    def get_sharepoint_list_schema(self) -> list:
        """Get the schema/fields of the configured SharePoint list.

        Returns:
            List of field names in the SharePoint list
        """
        if not self.enabled:
            return []

        ctx = self._get_context()
        if not ctx:
            return []

        try:
            sp_list = ctx.web.lists.get_by_title(self.employee_list_name)
            fields = sp_list.fields.get().execute_query()
            return [f.properties.get("Title", "") for f in fields]
        except Exception as e:
            logger.error(f"Failed to get SharePoint list schema: {e}")
            return []


# Global instance
sharepoint_sync = SharePointSync()


def init_sharepoint_sync():
    """Initialize SharePoint sync if configured."""
    if sharepoint_sync.enabled:
        logger.info("SharePoint sync enabled")
        # Perform initial sync
        result = sharepoint_sync.sync_employees_from_sharepoint()
        if result["success"]:
            logger.info(f"Initial SharePoint sync: {result['added']} added, {result['updated']} updated")
        else:
            logger.warning(f"Initial SharePoint sync failed: {result['errors']}")
    else:
        logger.info("SharePoint sync not configured (missing env vars)")


def schedule_sharepoint_sync(app, interval: int = 300):
    """Schedule periodic SharePoint sync using Flask-APScheduler.

    Args:
        app: Flask app instance
        interval: Sync interval in seconds (default: 300)
    """
    if not sharepoint_sync.enabled:
        return

    auto_sync = os.environ.get("SHAREPOINT_AUTO_SYNC", "false").lower() == "true"
    if not auto_sync:
        return

    try:
        from flask_apscheduler import BackgroundScheduler

        scheduler = BackgroundScheduler()
        scheduler.add_job(
            func=sharepoint_sync.sync_employees_from_sharepoint,
            trigger="interval",
            seconds=interval,
            id="sharepoint_sync",
        )
        scheduler.start()
        logger.info(f"Scheduled SharePoint sync every {interval} seconds")
    except ImportError:
        logger.warning("Flask-APScheduler not installed, cannot schedule SharePoint sync")
    except Exception as e:
        logger.error(f"Failed to schedule SharePoint sync: {e}")


__all__ = [
    "SharePointSync",
    "sharepoint_sync",
    "init_sharepoint_sync",
    "schedule_sharepoint_sync",
]
