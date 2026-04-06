import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from datetime import datetime

# Email configuration
GOVERNMENT_EMAIL = "deviammu9507@gmail.com"

# For a real application, these should be loaded from secure environment variables.
# Using a fallback generic address if environment vars are not set
SENDER_EMAIL = os.environ.get("SMTP_EMAIL", "damage.ai.system@gmail.com")
SENDER_PASSWORD = os.environ.get("SMTP_PASSWORD", "dummy_password")
SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))

def send_email_to_government(damage_type, severity, latitude, longitude, report_count, image_path):
    """
    Sends an automated HTML email alert to the governing authority with damage details.
    Includes a map link and an attached evidence image.
    """
    print(f"[*] Preparing critical email alert for {GOVERNMENT_EMAIL}...")
    
    # 1. Map Link Construction
    map_link = f"https://maps.google.com/?q={latitude},{longitude}"
    date_str = datetime.now().strftime("%d %B %Y")
    
    # 2. HTML Email Template Construction
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="background-color: #f87171; padding: 15px; border-radius: 8px 8px 0 0; color: white;">
            <h2 style="margin: 0; font-size: 22px;">⚠️ Road Damage Alert Detected</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; background-color: #ffffff;">
            <p><strong>Damage Type:</strong> {damage_type}</p>
            <p><strong>Severity:</strong> <span style="color: #dc2626; font-weight: bold;">{severity}</span></p>
            <p><strong>Location:</strong> {latitude:.6f}, {longitude:.6f}</p>
            <p><strong>Reports Received:</strong> {report_count} verified unique users</p>
            <p><strong>Date:</strong> {date_str}</p>
            <br>
            <a href="{map_link}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">📍 View Location on Map</a>
            <p style="margin-top: 20px; font-size: 13px; color: #6b7280;">See the attached evidence image from the most recent reporter.</p>
        </div>
      </body>
    </html>
    """
    
    # 3. Message Assembly
    msg = MIMEMultipart('related')
    msg['Subject'] = f"CRITICAL ROAD DAMAGE ALERT: {damage_type}"
    msg['From'] = f"DamageAI System <{SENDER_EMAIL}>"
    msg['To'] = GOVERNMENT_EMAIL

    # Attach text body
    text_part = MIMEText(html_content, 'html')
    msg.attach(text_part)

    # 4. Attach Image
    if image_path and os.path.exists(image_path):
        try:
            with open(image_path, 'rb') as img:
                img_data = img.read()
            image_mime = MIMEImage(img_data, name=os.path.basename(image_path))
            image_mime.add_header('Content-ID', '<image1>')
            msg.attach(image_mime)
        except Exception as e:
            print(f"[!] Error attaching image to email: {e}")

    # 5. Send Email via SMTP
    # If the user hasn't configured SMTP credentials locally, we will skip the actual network 
    # sending call to prevent an app crash, but print the output to console for demo tracking.
    if SENDER_PASSWORD == "dummy_password":
        print(f"[!] SMTP credentials not set. Simulating email send to {GOVERNMENT_EMAIL}.")
        print("--- EMAIL CONTENT PREVIEW ---")
        print(f"Subject: {msg['Subject']}")
        print(f"Damage: {damage_type} | Severity: {severity} | GPS: {latitude},{longitude}")
        print(f"Verified by: {report_count} users")
        print("----------------------------")
        return True
        
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
        server.quit()
        print("[*] Alert email specifically sent successfully to deviammu9507@gmail.com")
        return True
    except Exception as e:
        print(f"[!] Failed to send email: {e}")
        return False
