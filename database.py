import sqlite3
import math
import time
from datetime import datetime, timedelta
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports.db')

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    """Initialize the SQLite database with the required tables."""
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            damage_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            size TEXT,
            estimated_cost INTEGER,
            image_path TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in meters between two points 
    on the earth (specified in decimal degrees)
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return float('inf')

    # Convert decimal degrees to radians 
    lon1, lat1, lon2, lat2 = map(math.radians, [float(lon1), float(lat1), float(lon2), float(lat2)])

    # Haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371000 # Radius of earth in meters
    return c * r

def check_rate_limit(device_id):
    """
    Spam prevention: limit each user (device_id) to 3 reports per hour.
    Returns True if allowed, False if limit exceeded.
    """
    conn = get_connection()
    c = conn.cursor()
    
    one_hour_ago = datetime.now() - timedelta(hours=1)
    
    c.execute(
        "SELECT COUNT(*) FROM reports WHERE device_id = ? AND timestamp > ?", 
        (device_id, one_hour_ago.strftime("%Y-%m-%d %H:%M:%S"))
    )
    count = c.fetchone()[0]
    conn.close()
    
    return count < 3

def record_and_verify_report(device_id, latitude, longitude, damage_type, severity, size, estimated_cost, image_path):
    """
    Records a new report and returns the current verification status.
    Returns: (status_string, unique_user_count, total_reports)
    """
    # 1. Spam check
    if not check_rate_limit(device_id):
        return "RATE_LIMITED", 0, 0

    conn = get_connection()
    c = conn.cursor()

    # 2. Prevent duplicate nearby reports from the same user (within 50 meters, last 24h)
    twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
    c.execute(
        "SELECT latitude, longitude FROM reports WHERE device_id = ? AND timestamp > ?",
        (device_id, twenty_four_hours_ago.strftime("%Y-%m-%d %H:%M:%S"))
    )
    user_recent_reports = c.fetchall()
    
    for r_lat, r_lon in user_recent_reports:
        dist = haversine(latitude, longitude, r_lat, r_lon)
        if dist < 50:  # 50 meters
            conn.close()
            return "DUPLICATE_LOCATION", 0, 0

    # 3. Add new report
    c.execute('''
        INSERT INTO reports (device_id, latitude, longitude, damage_type, severity, size, estimated_cost, image_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (device_id, latitude, longitude, damage_type, severity, size, estimated_cost, image_path))
    conn.commit()

    # 4. Verify cross-user reports within a 50 meter radius
    # We bring recent reports into memory to calculate exact haversine distances
    thirty_days_ago = datetime.now() - timedelta(days=30)
    c.execute(
        "SELECT device_id, latitude, longitude FROM reports WHERE timestamp > ?",
        (thirty_days_ago.strftime("%Y-%m-%d %H:%M:%S"),)
    )
    all_recent = c.fetchall()
    conn.close()

    nearby_reports = []
    unique_devices = set()

    for r_device_id, r_lat, r_lon in all_recent:
        dist = haversine(latitude, longitude, r_lat, r_lon)
        if dist < 50: # Within 50 meters
            nearby_reports.append((r_device_id, r_lat, r_lon))
            unique_devices.add(r_device_id)

    unique_count = len(unique_devices)

    # 5. Determine status
    if unique_count >= 5:
        # Trigger critical email alert
        return "CRITICAL_ALERT", unique_count, len(nearby_reports)
    elif unique_count >= 3:
        return "VERIFIED", unique_count, len(nearby_reports)
    else:
        return "PENDING", unique_count, len(nearby_reports)

# Run init on import
init_db()
