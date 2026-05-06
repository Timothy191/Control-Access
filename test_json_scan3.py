import json

json_qr = json.dumps({"type": "employee", "employee_id": "EMP10330", "name": "Jan Molefe"})

qr_hash_raw = json_qr.strip()

print(f"qr_hash_raw = {repr(qr_hash_raw)}")
print(f"startswith: {qr_hash_raw.startswith('{')}")
print(f"endswith: {qr_hash_raw.endswith('}')}")
