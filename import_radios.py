#!/usr/bin/env python3
import os
import sys
import csv
import hashlib
from datetime import datetime

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

from database import db_session, init_db
from models import Equipment

def main():
    csv_file = "/home/tim/Desktop/01.mine-management-system/RADIO QR.csv"
    output_dir = os.path.join(PROJECT_ROOT, "radio_qrcodes")
    os.makedirs(output_dir, exist_ok=True)

    print(f"Initializing Database...")
    init_db()

    print(f"Reading radios from {csv_file}...")
    if not os.path.exists(csv_file):
        print(f"Error: CSV file not found at {csv_file}")
        sys.exit(1)

    # Read CSV
    radios = []
    with open(csv_file, mode='r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter=';')
        # Skip header
        header = next(reader, None)
        for row in reader:
            if not row:
                continue
            radio_id = row[0].strip()
            if radio_id and radio_id != 'nan':
                radios.append(radio_id)

    # Remove duplicates but preserve order
    seen = set()
    unique_radios = [r for r in radios if not (r in seen or seen.add(r))]

    print(f"Found {len(unique_radios)} unique radio IDs to process.")

    imported = 0
    skipped = 0
    qr_generated = 0

    # Import dependencies for QR generation and image drawing
    import qrcode
    from PIL import Image as PilImage, ImageDraw, ImageFont

    for idx, radio_id in enumerate(unique_radios):
        # Check if already exists in DB
        item = db_session.query(Equipment).filter_by(radio_id=radio_id).first()
        created = False
        
        if not item:
            item = Equipment(
                radio_id=radio_id,
                status='Active'
            )
            db_session.add(item)
            db_session.flush()  # Get the ID
            created = True
            imported += 1
        else:
            skipped += 1

        # Generate QR code hash if not set
        if not item.qr_code:
            qr_data = f"EQP:{item.id}:{item.radio_id}:{datetime.now().timestamp()}"
            item.qr_code = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
            db_session.commit()

        # Generate visual QR code card
        qr_hash = item.qr_code
        # Standard format for redirection / scanning
        qr_url = f"http://localhost:8080/s/{qr_hash}"

        # Generate QR code image
        qr = qrcode.QRCode(version=4, box_size=20, border=4)
        qr.add_data(qr_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

        # Visual styling and layout
        label_text = f"Radio ID: {item.radio_id}"
        id_text = "Equipment"

        # Font resolution
        try:
            font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        except:
            try:
                font_large = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 20)
                font_small = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 16)
            except:
                font_large = ImageFont.load_default()
                font_small = ImageFont.load_default()

        # Create canvas with text padding below
        text_padding = 65
        canvas = PilImage.new("RGB", (qr_img.width, qr_img.height + text_padding), "white")
        canvas.paste(qr_img, (0, 0))

        draw = ImageDraw.Draw(canvas)
        img_width = canvas.width

        # Draw label line
        try:
            bbox = draw.textbbox((0, 0), label_text, font=font_large)
            text_width = bbox[2] - bbox[0]
        except AttributeError:
            text_width = len(label_text) * 10
        x = (img_width - text_width) // 2
        draw.text((x, qr_img.height + 8), label_text, fill="black", font=font_large)

        # Draw subtitle line
        try:
            bbox2 = draw.textbbox((0, 0), id_text, font=font_small)
            text_width2 = bbox2[2] - bbox2[0]
        except AttributeError:
            text_width2 = len(id_text) * 8
        x2 = (img_width - text_width2) // 2
        draw.text((x2, qr_img.height + 34), id_text, fill="#444444", font=font_small)

        # Save to disk
        filename = f"equipment_{item.radio_id}.png"
        filepath = os.path.join(output_dir, filename)
        canvas.save(filepath, format="PNG")
        qr_generated += 1

        if created:
            print(f"[{idx+1}/{len(unique_radios)}] Imported & Created QR: {radio_id} -> {filename}")
        else:
            print(f"[{idx+1}/{len(unique_radios)}] Radio {radio_id} already exists. Generated QR: {filename}")

    db_session.commit()
    print("\n" + "="*50)
    print(f"Import process completed successfully.")
    print(f"Unique records processed: {len(unique_radios)}")
    print(f"New radios imported:      {imported}")
    print(f"Existing radios skipped:  {skipped}")
    print(f"QR images generated:      {qr_generated}")
    print(f"QR codes saved directory: {output_dir}")
    print("="*50)

if __name__ == "__main__":
    main()
