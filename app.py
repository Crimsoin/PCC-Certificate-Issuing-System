from flask import Flask, jsonify, render_template, send_from_directory, request
import gspread
from google.oauth2.service_account import Credentials
from flask_cors import CORS
import smtplib
from email.message import EmailMessage
import base64
import logging
from dotenv import load_dotenv
import os
import json

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for API calls

# Load Google Sheets credentials
SCOPE = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]

# Load Google Sheets credentials from environment variable
service_account_json = os.getenv("SERVICE_ACCOUNT_JSON")
if not service_account_json:
    logging.error("SERVICE_ACCOUNT_JSON is not set in the environment variables")
    raise ValueError("SERVICE_ACCOUNT_JSON is missing")

try:
    creds_data = json.loads(service_account_json)
except json.JSONDecodeError as e:
    logging.error("Invalid JSON in SERVICE_ACCOUNT_JSON: %s", str(e))
    raise

CREDS = Credentials.from_service_account_info(json.loads(service_account_json), scopes=SCOPE)
client = gspread.authorize(CREDS)

# Google Sheets ID
SHEET_ID = os.getenv("SHEET_ID")
if not SHEET_ID:
    logging.error("SHEET_ID is not set in the environment variables")
else:
    logging.info(f"SHEET_ID loaded: {SHEET_ID}")

try:
    sheet = client.open_by_key(SHEET_ID).sheet1  # Access the first sheet
except gspread.exceptions.APIError as e:
    logging.error("Error accessing Google Sheets: %s", str(e))
    raise

# ✅ Email Configuration (Replace with your credentials)
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
    logging.error("Email credentials are not set in the environment variables")
else:
    logging.info(f"EMAIL_ADDRESS loaded: {EMAIL_ADDRESS}")

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Route to serve index.html
@app.route("/")
def home():
    return render_template("index.html")

# Route to fetch data from Google Sheets
@app.route("/get-certificate-data", methods=["GET"])
def get_certificate_data():
    data = sheet.get_all_records()  # Fetch all rows as a list of dictionaries
    return jsonify(data)

# Route to serve static files (for images, CSS, etc.)
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

# ✅ Route to Send Certificate via Email
@app.route("/send-certificate", methods=["POST"])
def send_certificate():
    data = request.json
    student_email = data.get("email")
    student_name = data.get("name")
    certificate_data = data.get("certificate")

    if not student_email or not certificate_data:
        return jsonify({"error": "Missing email or certificate"}), 400

    try:
        # Prepare the email
        msg = EmailMessage()
        msg["Subject"] = "Your Certificate of Completion"
        msg["From"] = EMAIL_ADDRESS
        msg["To"] = student_email
        msg.set_content(f"Dear {student_name},\n\nCongratulations! Your certificate is attached.\n\nBest,\nYour Training Team")

        # Attach the Certificate (Base64 Decoded)
        certificate_bytes = base64.b64decode(certificate_data)
        msg.add_attachment(certificate_bytes, maintype="application", subtype="pdf", filename="certificate.pdf")

        # Send Email using SMTP
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.send_message(msg)

        return jsonify({"message": "Certificate sent successfully!"})

    except Exception as e:
        logging.error("Error sending email: %s", str(e))
        return jsonify({"error": str(e)}), 500

# Run the app (should always be at the bottom)
if __name__ == "__main__":
    app.run(debug=True)
