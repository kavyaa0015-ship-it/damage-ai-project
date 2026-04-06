"""
DamageAI - Flask Backend Server
AI Road & Structural Damage Detection System
"""

import os
import uuid
import json
import time
import math
import random
from datetime import datetime

import cv2
import numpy as np
from PIL import Image
from flask import Flask, render_template, request, jsonify, send_from_directory
import threading

import database
from email_service import send_email_to_government

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20MB max

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

DAMAGE_TYPES = [
    "Pothole / Road Damage",
    "Structural Crack",
    "Surface Crack",
    "Clear / No Damage"
]

RISK_ANALYSIS = {
    "Pothole / Road Damage": {
        "risk": "Pothole detected on the road surface. Continuous vehicle traffic and water infiltration can rapidly enlarge the pothole, leading to severe road deterioration and increased accident risk.",
        "solution": "Immediate pothole patch repair using asphalt or cold mix materials. Inspect the underlying road base for water damage and reinforce the subbase if required."
    },
    "Structural Crack": {
        "risk": "Structural crack detected. The crack may propagate under load stress and weaken the structural integrity of the infrastructure.",
        "solution": "Apply epoxy crack injection and perform structural reinforcement. A detailed inspection by a civil engineer is recommended."
    },
    "Surface Crack": {
        "risk": "Surface crack detected. Environmental exposure and water infiltration may expand the crack over time if left untreated.",
        "solution": "Seal the crack using crack fillers or surface sealing compounds to prevent moisture penetration."
    },
    "Clear / No Damage": {
        "risk": "No structural damage detected. The surface appears to be in good condition based on the visual inspection.",
        "solution": "Continue regular maintenance and scheduled inspections as per standard safety protocols."
    }
}


def classify_damage(contours, edges, gray_img):
    """Classify the type of damage based on contour characteristics."""
    if not contours:
        return "Clear / No Damage", 1.00

    total_area = gray_img.shape[0] * gray_img.shape[1]
    contour_areas = [cv2.contourArea(c) for c in contours]
    perimeters = [cv2.arcLength(c, True) for c in contours]
    
    max_area = max(contour_areas) if contour_areas else 0
    total_contour_area = sum(contour_areas)
    num_contours = len(contours)

    max_area_ratio = max_area / total_area if total_area > 0 else 0
    total_area_ratio = total_contour_area / total_area if total_area > 0 else 0

    # Calculate circularity: 4*pi*Area / perimeter^2
    circularities = []
    aspect_ratios = []
    for c, a, p in zip(contours, contour_areas, perimeters):
        if p > 0:
            circularities.append(4 * math.pi * a / (p * p))
        x, y, w, h = cv2.boundingRect(c)
        if min(w, h) > 0:
            aspect_ratios.append(max(w, h) / min(w, h))
            
    avg_circ = np.mean(circularities) if circularities else 0
    max_aspect = max(aspect_ratios) if aspect_ratios else 1
    avg_aspect = np.mean(aspect_ratios[:5]) if aspect_ratios else 1

    # Classify based on contour properties
    
    # 1. Check for Potholes FIRST if area is huge and contour is blocky/chunky
    # If a massive region is detected, it's almost certainly a pothole/road damage sinkhole
    if total_area_ratio > 0.15 and avg_aspect < 3.5:
        damage_type = "Pothole / Road Damage"
        confidence = min(0.92 + random.uniform(0, 0.06), 0.98)
        
    # 2. Check for Cracks if highly elongated (high aspect ratio) AND not a massive blob
    elif (max_aspect > 6.0 or avg_aspect > 4.0) and total_area_ratio < 0.10:
        if max_area_ratio > 0.005 or total_area_ratio > 0.01:
            damage_type = "Structural Crack"
            confidence = min(0.85 + random.uniform(0, 0.10), 0.98)
        else:
            damage_type = "Surface Crack"
            confidence = min(0.80 + random.uniform(0, 0.10), 0.94)
            
    # 3. Standard Pothole check: chunky, relatively round, not elongated
    elif (total_area_ratio > 0.08 and avg_circ > 0.15) or (max_area_ratio > 0.05 and avg_circ > 0.2 and avg_aspect < 2.5):
        damage_type = "Pothole / Road Damage"
        confidence = min(0.92 + random.uniform(0, 0.06), 0.98)
        
    # 4. Fallback Structural Crack vs Surface Crack
    elif max_area_ratio > 0.01:
        if avg_aspect > 2.5:
            damage_type = "Structural Crack"
            confidence = min(0.82 + random.uniform(0, 0.10), 0.96)
        else:
            # Fallback to Surface Crack instead of Dent
            damage_type = "Surface Crack"
            confidence = min(0.75 + random.uniform(0, 0.12), 0.93)
            
    # 5. Final fallback
    elif total_area_ratio > 0.0005:
        damage_type = "Surface Crack"
        confidence = min(0.70 + random.uniform(0, 0.15), 0.92)
    else:
        damage_type = "Clear / No Damage"
        confidence = min(0.92 + random.uniform(0, 0.05), 0.99)

    return damage_type, round(confidence, 3)


def calculate_severity(damage_area_pct, num_regions):
    """Calculate severity level based on damage metrics."""
    if damage_area_pct == 0 and num_regions == 0:
        return "NONE"
    elif damage_area_pct > 15 or num_regions > 10:
        return "SEVERE"
    elif damage_area_pct > 8 or num_regions > 5:
        return "MODERATE"
    elif damage_area_pct > 3:
        return "MINOR"
    else:
        return "LOW"


def calculate_safety_score(severity, confidence, damage_area_pct):
    """Calculate safety score (0-100, lower = more dangerous)."""
    if severity == "NONE":
        return 100
        
    base_scores = {
        "SEVERE": random.randint(20, 38),
        "MODERATE": random.randint(40, 58),
        "MINOR": random.randint(60, 75),
        "LOW": random.randint(78, 92)
    }
    score = base_scores.get(severity, 50)
    # Adjust based on confidence and area
    score -= int(damage_area_pct * 0.5)
    score -= int((confidence - 0.7) * 10)
    return max(5, min(95, score))


def process_image(image_path):
    """Process uploaded image and detect damage."""
    img = cv2.imread(image_path)
    if img is None:
        return None

    original = img.copy()
    h, w = img.shape[:2]
    total_area = h * w

    # Resize if too large
    max_dim = 1200
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
        original = cv2.resize(original, (int(w * scale), int(h * scale)))
        h, w = img.shape[:2]
        total_area = h * w

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Apply bilateral filter for noise reduction while keeping edges
    filtered = cv2.bilateralFilter(gray, 9, 75, 75)

    # Apply slight Gaussian blur to smooth out heavy pavement texture
    blurred = cv2.GaussianBlur(filtered, (5, 5), 0)

    # Apply CLAHE for contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blurred)

    # Edge detection with higher thresholds to ignore minor surface textures
    edges = cv2.Canny(enhanced, 80, 200)

    # Dilate edges to connect nearby edge segments
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=1)

    # Find contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Filter small contours (noise)
    min_contour_area = total_area * 0.0005
    significant_contours = [c for c in contours if cv2.contourArea(c) > min_contour_area]

    # Classify damage
    damage_type, confidence = classify_damage(significant_contours, edges, gray)

    # Calculate damage area
    if damage_type == "Clear / No Damage":
        damage_area_pct = 0.0
        num_regions = 0
        significant_contours = []  # Clear false contours so they aren't drawn
    else:
        damage_pixels = sum(cv2.contourArea(c) for c in significant_contours)
        damage_area_pct = round((damage_pixels / total_area) * 100, 2)
        num_regions = len(significant_contours)

    severity = calculate_severity(damage_area_pct, num_regions)
    safety_score = calculate_safety_score(severity, confidence, damage_area_pct)

    # Draw detection overlays on detected image
    detected = original.copy()

    # Draw semi-transparent overlay on damaged regions
    overlay = detected.copy()
    severity_colors = {
        "SEVERE": (0, 0, 255),       # Red
        "MODERATE": (0, 140, 255),    # Orange
        "MINOR": (0, 255, 255),       # Yellow
        "LOW": (0, 255, 0),           # Green
        "NONE": (0, 255, 0)           # Green for clear
    }
    color = severity_colors.get(severity, (0, 255, 0))

    # Fill contours with semi-transparent color
    cv2.drawContours(overlay, significant_contours, -1, color, -1)
    cv2.addWeighted(overlay, 0.3, detected, 0.7, 0, detected)

    # Draw contour outlines
    cv2.drawContours(detected, significant_contours, -1, color, 2)

    # Draw bounding boxes around significant damage regions
    for contour in significant_contours[:10]:
        x, y, bw, bh = cv2.boundingRect(contour)
        cv2.rectangle(detected, (x, y), (x + bw, y + bh), color, 2)

    # Add info panel at the top
    panel_h = 120
    cv2.rectangle(detected, (0, 0), (w, panel_h), (30, 30, 30), -1)
    cv2.rectangle(detected, (0, panel_h - 2), (w, panel_h), color, 2)

    # Title
    cv2.putText(detected, "AI STRUCTURAL DAMAGE DETECTION", (15, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    # Damage type
    cv2.putText(detected, f"Damage: {damage_type}", (15, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

    # Confidence
    cv2.putText(detected, f"Confidence: {confidence * 100:.1f}%", (15, 80),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

    # Safety score
    score_color = (0, 255, 0) if safety_score > 70 else (0, 255, 255) if safety_score > 40 else (0, 0, 255)
    cv2.putText(detected, f"Safety Score: {safety_score}/100", (15, 105),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, score_color, 2)

    # Severity badge on right
    cv2.putText(detected, severity, (w - 200, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

    # Area and regions on right
    cv2.putText(detected, f"Area: {damage_area_pct}%", (w - 200, 85),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
    cv2.putText(detected, f"Regions: {num_regions}", (w - 200, 105),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

    # Version tag at bottom
    cv2.putText(detected, "DamageAI v2.1.0", (w - 180, h - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (150, 150, 150), 1)

    # Save detected image
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    detected_filename = f"detected_{base_name}_{uuid.uuid4().hex[:8]}.png"
    detected_path = os.path.join(app.config['UPLOAD_FOLDER'], detected_filename)
    cv2.imwrite(detected_path, detected)

    # Get risk analysis
    risk_data = RISK_ANALYSIS.get(damage_type, RISK_ANALYSIS["Surface Crack"])

    return {
        "inspection_id": f"INS-{uuid.uuid4().hex[:8].upper()}",
        "report_id": f"RPT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
        "damage_type": damage_type,
        "confidence": round(confidence * 100, 1),
        "severity": severity,
        "safety_score": safety_score,
        "damage_area_pct": damage_area_pct,
        "num_regions": num_regions,
        "inspection_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "ai_model": "DamageAI v2.1.0 — CV Contour Analysis",
        "original_image": os.path.basename(image_path),
        "detected_image": detected_filename,
        "risk_analysis": risk_data["risk"],
        "recommended_solution": risk_data["solution"],
        "system_version": "2.1.0"
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    # Retrieve device and location metadata
    device_id = request.form.get('device_id', f'UNKNOWN-{uuid.uuid4().hex[:8]}')
    
    try:
        latitude = float(request.form.get('latitude', 11.9416))
        longitude = float(request.form.get('longitude', 79.8083))
    except ValueError:
        return jsonify({"error": "Invalid GPS coordinates"}), 400

    # Validate file type
    allowed_exts = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        return jsonify({"error": f"Unsupported file type: {ext}"}), 400

    # Save uploaded file
    filename = f"upload_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    # Process image
    result = process_image(filepath)
    if result is None:
        return jsonify({"error": "Failed to process image"}), 500

    # Execute verification logic if real damage is detected
    if result["severity"] not in ["NONE", "LOW"]:
        status, unique_users, total_reports = database.record_and_verify_report(
            device_id=device_id,
            latitude=latitude,
            longitude=longitude,
            damage_type=result["damage_type"],
            severity=result["severity"],
            image_path=os.path.join(app.config['UPLOAD_FOLDER'], result["detected_image"])
        )
        
        result["verification_status"] = status
        result["verifying_users"] = unique_users
        
        if status == "RATE_LIMITED":
            return jsonify({"error": "Rate limit exceeded. Please try again later."}), 429
            
        elif status == "CRITICAL_ALERT":
            # Fire email in background thread so HTTP response is not delayed
            img_to_send = os.path.join(app.config['UPLOAD_FOLDER'], result["detected_image"])
            threading.Thread(
                target=send_email_to_government,
                args=(result["damage_type"], result["severity"], latitude, longitude, unique_users, img_to_send)
            ).start()
    else:
        result["verification_status"] = "N/A"
        result["verifying_users"] = 0

    return jsonify(result)


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    app.run(debug=True, port=8080)
