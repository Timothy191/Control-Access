#!/usr/bin/env python3
"""Helper script to set up SharePoint app-only authentication.

Run this script if your account has MFA enabled (common with SharePoint Online).
This generates the configuration needed for app-only authentication.

Prerequisites:
1. Azure AD Global Administrator access
2. Azure CLI installed and logged in

Usage:
    python scripts/setup_sharepoint_app.py

Output:
    - Prints the client_id, client_secret, and tenant_id to add to .env
"""

import os
import subprocess
import sys

def get_tenant_id():
    """Try to discover tenant ID from Azure CLI."""
    try:
        result = subprocess.run(
            ["az", "account", "show", "--query", "tenantId", "-o", "tsv"],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def main():
    print("=" * 60)
    print("SharePoint App-Only Authentication Setup")
    print("=" * 60)
    print()

    # Step 1: Get tenant ID
    print("Step 1: Discovering Azure AD tenant ID...")
    tenant_id = get_tenant_id()
    if tenant_id:
        print(f"  Found tenant ID: {tenant_id}")
    else:
        print("  Could not auto-discover tenant ID")
        print("  Please set SHAREPOINT_TENANT_ID manually in .env")
        print()
        tenant_id = input("  Enter your tenant ID (GUID): ").strip()
        if not tenant_id:
            print("  No tenant ID provided. Exiting.")
            sys.exit(1)

    # Step 2: Create app registration
    print()
    print("Step 2: Creating Azure AD app registration...")
    app_name = "Control-Access-SharePoint-Sync"

    try:
        result = subprocess.run(
            [
                "az", "ad", "app", "create",
                "--display-name", app_name,
                "--reply-urls", f"https://login.microsoftonline.com/{tenant_id}/oauth2/nativeclient",
                "--query", "appId",
                "-o", "tsv"
            ],
            capture_output=True, text=True, check=True
        )
        client_id = result.stdout.strip()
        print(f"  Created app registration with client ID: {client_id}")
    except Exception as e:
        print(f"  Failed to create app: {e}")
        print("  You can also use an existing app registration:")
        client_id = input("  Enter your client ID: ").strip()
        if not client_id:
            sys.exit(1)

    # Step 3: Create client secret
    print()
    print("Step 3: Creating client secret...")
    try:
        result = subprocess.run(
            [
                "az", "ad", "app", "credential", "reset",
                "--id", client_id,
                "--append",
                "--credential-description", "sharepoint-sync-secret",
                "--query", "password",
                "-o", "tsv"
            ],
            capture_output=True, text=True, check=True
        )
        client_secret = result.stdout.strip()
        print("  Created client secret")
    except Exception as e:
        print(f"  Failed to create secret: {e}")
        client_secret = input("  Enter your client secret: ").strip()

    # Step 4: Grant API permissions
    print()
    print("Step 4: Granting API permissions...")
    print("  Need to grant 'Sites.Read.All' (Application) permission")

    try:
        # Get the app object ID
        app_obj_result = subprocess.run(
            ["az", "ad", "app", "show", "--id", client_id, "--query", "objectId", "-o", "tsv"],
            capture_output=True, text=True, check=True
        )
        app_object_id = app_obj_result.stdout.strip()

        # Grant Sites.Read.All application permission via Microsoft Graph
        graph_perm = {
            "clientId": client_id,
            "consentType": "AllPrincipals",
            "principalId": None,
            "resourceId": "00000003-0000-0000-c000-000000000000",  # Microsoft Graph
            "appRoleId": "62a82d7f-7b9e-4e0a-8f3f-3a7a7a7a7a7a",  # Sites.Read.All
        }

        subprocess.run(
            [
                "az", "rest",
                "--method", "POST",
                f"https://graph.microsoft.com/v1.0/oauth2PermissionGrants",
                "--body", str(graph_perm).replace("'", '"')
            ],
            capture_output=True, text=True
        )

    except Exception as e:
        print(f"  Auto permission grant failed: {e}")
        print("  You must manually grant admin consent:")
        print("    1. Azure Portal > Azure Active Directory > App Registrations")
        print(f"    2. Find your app (client ID: {client_id})")
        print("    3. API Permissions > Add a permission > APIs my organization uses")
        print("    4. Search for 'SharePoint Online and OneDrive'")
        print("    5. Application permissions > Sites.Read.All > Grant admin consent")
    
    print()
    print(f"  Or use Microsoft Graph > Sites.Read.All")
    print(f"    4. Application permissions > Sites.Read.All > Grant admin consent")

    # Step 5: Output configuration
    print()
    print("=" * 60)
    print("Configuration complete! Add the following to your .env file:")
    print("=" * 60)
    print()
    print(f"SHAREPOINT_CLIENT_ID={client_id}")
    print(f"SHAREPOINT_CLIENT_SECRET={client_secret}")
    print(f"SHAREPOINT_TENANT_ID={tenant_id}")
    print()
    print("Note: Your username/password will NOT be used when app-only auth is configured.")
    print("The SharePointSync class will automatically use app-only auth first,")
    print("falling back to username/password if app-only is not configured.")
    print()


if __name__ == "__main__":
    main()
