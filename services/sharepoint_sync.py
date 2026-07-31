"""SharePoint integration for Power Apps and Power BI data synchronization.

This module provides read-only sync from SharePoint lists to the local
SQLite database. Data flows only one way: SharePoint -> local DB -> Power Apps.
We never write data back to SharePoint.

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


def _parse_date(date_str: str) -> Optional[datetime]:
    """Parse a date string from SharePoint into a datetime object.

    Handles ISO format, common SharePoint date formats, and null/empty values.
    """
    if not date_str or not date_str.strip():
        return None

    date_str = date_str.strip().replace("Z", "+00:00")

    # List of formats to try, in order of preference
    formats = [
        None,  # ISO format (fromisoformat)
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
    ]

    for fmt in formats:
        if fmt is None:
            try:
                dt = datetime.fromisoformat(date_str)
                return dt.replace(tzinfo=None) if dt.tzinfo else dt
            except (ValueError, TypeError):
                continue
        else:
            try:
                return datetime.strptime(date_str, fmt)
            except (ValueError, TypeError):
                continue

    logger.warning(f"Could not parse date string '{date_str}'")
    return None


class SharePointSync:
    """Handles synchronization between SharePoint lists and local database."""

    def __init__(self):
        self.username = os.environ.get("SHAREPOINT_USERNAME", "")
        self.password = os.environ.get("SHAREPOINT_PASSWORD", "")
        self.site_url = os.environ.get("SHAREPOINT_SITE_URL", "")
        self.employee_list_name = os.environ.get("SHAREPOINT_EMPLOYEE_LIST", "Employees")
        # App-only (client credentials) auth - required for MFA-enabled accounts
        self.client_id = os.environ.get("SHAREPOINT_CLIENT_ID", "")
        self.client_secret = os.environ.get("SHAREPOINT_CLIENT_SECRET", "")
        self.tenant_id = os.environ.get("SHAREPOINT_TENANT_ID", "")
        self.enabled = bool(self.site_url and (
            (self.username and self.password) or
            (self.client_id and self.client_secret and self.tenant_id)
        ))
        self._ctx: Optional[object] = None

    def _get_context(self) -> Optional[object]:
        """Authenticate and return a SharePoint client context.

        Supports two authentication methods:
        1. Username/password (may fail with MFA-enabled accounts)
        2. App-only (client credentials) - recommended for MFA

        Returns the first working method.
        """
        if not self.enabled:
            return None

        if self._ctx is not None:
            return self._ctx

        from office365.sharepoint.client_context import ClientContext

        # Try app-only (client credentials) auth first if configured
        if self.client_id and self.client_secret and self.tenant_id:
            try:
                from office365.runtime.auth.client_credential import ClientCredential

                credentials = ClientCredential(
                    client_id=self.client_id,
                    client_secret=self.client_secret,
                )
                # For app-only auth, need tenant-level authority
                authority = f"https://login.microsoftonline.com/{self.tenant_id}"
                client = ClientContext(self.site_url, credentials)
                # Test connection
                client.web.ensure_property("Title")
                self._ctx = client
                logger.info("SharePoint app-only authentication successful")
                return self._ctx
            except Exception as e:
                logger.warning(f"SharePoint app-only auth failed: {e}")

        # Fall back to username/password auth
        if self.username and self.password:
            try:
                from office365.runtime.auth.authentication_context import AuthenticationContext

                auth_ctx = AuthenticationContext(url=self.site_url)
                if auth_ctx.acquire_token_for_user(username=self.username, password=self.password):
                    self._ctx = ClientContext(self.site_url, auth_ctx)
                    logger.info("SharePoint username/password authentication successful")
                    return self._ctx
                else:
                    logger.error("SharePoint username/password authentication failed")
                    return None
            except Exception as e:
                logger.error(f"SharePoint username/password auth error: {e}")
                return None

        logger.error("No valid SharePoint credentials configured")
        return None

    def sync_employees_from_sharepoint(self) -> dict:
        """Fetch employee data from SharePoint and sync to local database.

        This is a READ-ONLY sync. Data is pulled from SharePoint lists into
        the local SQLite database. We never push data back to SharePoint.

        Fields pulled from SharePoint:
        - Title -> emp_code (Employee Number)
        - FirstName -> first_name
        - LastName -> surname
        - IdNumber/IDNumber -> id_number (encrypted at rest)
        - JobTitle -> job_title
        - Area -> area
        - MedicalExpiry -> medical_expiry (datetime)
        - InductionExpiry -> induction_expiry (datetime)

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

            # Fetch all items from the SharePoint list (read-only)
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
                    area = item.properties.get("Area", "")
                    id_number = item.properties.get("IDNumber", "") or item.properties.get("IdNumber", "")
                    medical_expiry = item.properties.get("MedicalExpiry", "")
                    induction_expiry = item.properties.get("InductionExpiry", "")

                    if not emp_code:
                        errors.append(f"Skipped item with no Title/emp_code: {item.properties}")
                        continue

                    # Parse date strings
                    medical_expiry_date = _parse_date(medical_expiry)
                    induction_expiry_date = _parse_date(induction_expiry)

                    # Check if employee already exists
                    existing = db_session.query(Employee).filter_by(emp_code=emp_code).first()

                    if existing:
                        # Update existing employee with SharePoint data (read-only pull)
                        existing.first_name = first_name
                        existing.surname = last_name
                        existing.job_title = job_title
                        existing.area = area
                        existing.initials = (first_name[:1] + last_name[:1]).upper() if first_name and last_name else ""
                        if medical_expiry_date:
                            existing.medical_expiry = medical_expiry_date
                        if induction_expiry_date:
                            existing.induction_expiry = induction_expiry_date
                        # Store ID number using the model's encrypted field
                        if id_number:
                            existing.set_id_number(id_number)
                        updated += 1
                    else:
                        # Create new employee from SharePoint data (read-only pull)
                        employee = Employee(
                            emp_code=emp_code,
                            initials=(first_name[:1] + last_name[:1]).upper() if first_name and last_name else "",
                            first_name=first_name,
                            surname=last_name,
                            job_title=job_title,
                            area=area,
                            status="Active",
                        )
                        if id_number:
                            employee.set_id_number(id_number)
                        if medical_expiry_date:
                            employee.medical_expiry = medical_expiry_date
                        if induction_expiry_date:
                            employee.induction_expiry = induction_expiry_date
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
        logger.info("SharePoint sync enabled (read-only: SharePoint -> DB)")
        # Perform initial sync
        result = sharepoint_sync.sync_employees_from_sharepoint()
        if result["success"]:
            logger.info(f"Initial SharePoint sync: {result['added']} added, {result['updated']} updated")
        else:
            logger.warning(f"Initial SharePoint sync failed: {result['errors']}")
    else:
        logger.info("SharePoint sync not configured (missing env vars)")


def schedule_sharepoint_sync(app, sync_hours=None):
    """Schedule periodic SharePoint sync using APScheduler.

    Data is pulled from SharePoint at the specified hours (read-only).
    
    Args:
        app: Flask app instance
        sync_hours: List of hours (0-23) for sync schedule.
                    Default: [0, 6, 12, 18] (midnight, 6am, noon, 6pm)
    """
    if not sharepoint_sync.enabled:
        return

    auto_sync = os.environ.get("SHAREPOINT_AUTO_SYNC", "false").lower() == "true"
    if not auto_sync:
        return

    if sync_hours is None:
        sync_hours = [int(h) for h in os.environ.get("SHAREPOINT_SYNC_HOURS", "0,6,12,18").split(",")]

    try:
        from apscheduler.schedulers.background import BackgroundScheduler

        scheduler = BackgroundScheduler()
        
        # Schedule sync at specific hours
        for hour in sync_hours:
            scheduler.add_job(
                func=sharepoint_sync.sync_employees_from_sharepoint,
                trigger="cron",
                hour=hour,
                minute=0,
                id=f"sharepoint_sync_{hour}",
            )
            logger.info(f"Scheduled SharePoint sync at {hour:02d}:00 daily")

        scheduler.start()
        logger.info(f"SharePoint auto-sync scheduled at hours: {sync_hours}")
    except ImportError:
        logger.warning("APScheduler not installed, cannot schedule SharePoint sync")
    except Exception as e:
        logger.error(f"Failed to schedule SharePoint sync: {e}")


__all__ = [
    "SharePointSync",
    "sharepoint_sync",
    "init_sharepoint_sync",
    "schedule_sharepoint_sync",
]
