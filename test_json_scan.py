import requests
import json
from database import db_session
from models import Employee

emp = db_session.query(Employee).filter(Employee.status == 'Active').first()
emp.qr_code = "OLD_HASH_123"
db_session.commit()

json_qr = json.dumps({"type": "employee", "employee_id": emp.employee_id, "name": emp.name})

import app
with app.app.test_request_context(
    '/api/scan_qr', 
    method='POST', 
    json={"qr_code": json_qr, "direction": "IN", "gate_location": "Main Gate"},
    headers={"X-API-Key": "your-secret-hardware-key"}
):
    print("Testing internally...")
    res = app.scan_qr_code()
    print(res.get_json())
