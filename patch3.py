import sys
import os

file_path = "/home/tim/Desktop/01.mine-management-system/app.py"
with open(file_path, "r") as f:
    content = f.read()

target1 = """    # Build config URL
    config_url = f"http://{server_ip}:{server_port}/api/config/infowedge"
    
    # Generate QR code
    qr = qrcode.QRCode(version=4, box_size=10, border=4)
    qr.add_data(config_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to bytes
    img_buffer = io.BytesIO()
    img.save(img_buffer, format="PNG")
    img_buffer.seek(0)
    qr_image = f"data:image/png;base64,{base64.b64encode(img_buffer.getvalue()).decode()}"""

replacement1 = """    # Build config URL
    config_url = f"http://{server_ip}:{server_port}/api/config/infowedge"
    
    # Build App Download URL
    app_download_url = f"http://{server_ip}:{server_port}/static/downloads/QrMobile.apk"
    
    # Generate Config QR code
    qr_config = qrcode.QRCode(version=4, box_size=10, border=4)
    qr_config.add_data(config_url)
    qr_config.make(fit=True)
    img_config = qr_config.make_image(fill_color="black", back_color="white")
    
    img_buffer_config = io.BytesIO()
    img_config.save(img_buffer_config, format="PNG")
    img_buffer_config.seek(0)
    config_qr_image = f"data:image/png;base64,{base64.b64encode(img_buffer_config.getvalue()).decode()}"

    # Generate App Download QR code
    qr_app = qrcode.QRCode(version=4, box_size=10, border=4)
    qr_app.add_data(app_download_url)
    qr_app.make(fit=True)
    img_app = qr_app.make_image(fill_color="black", back_color="white")
    
    img_buffer_app = io.BytesIO()
    img_app.save(img_buffer_app, format="PNG")
    img_buffer_app.seek(0)
    app_qr_image = f"data:image/png;base64,{base64.b64encode(img_buffer_app.getvalue()).decode()}"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Target 1 patched.")
else:
    print("Target 1 not found.")

target2 = """    return render_template(
        "onboard.html",
        qr_image=qr_image,
        config_url=config_url,
        server_ip=server_ip,
        server_port=server_port,
        stats=stats,
        recent_devices=recent
    )"""

replacement2 = """    return render_template(
        "onboard.html",
        config_qr_image=config_qr_image,
        app_qr_image=app_qr_image,
        config_url=config_url,
        app_download_url=app_download_url,
        server_ip=server_ip,
        server_port=server_port,
        stats=stats,
        recent_devices=recent
    )"""

if target2 in content:
    content = content.replace(target2, replacement2)
    print("Target 2 patched.")
else:
    print("Target 2 not found.")

with open(file_path, "w") as f:
    f.write(content)
print("app.py patched!")
