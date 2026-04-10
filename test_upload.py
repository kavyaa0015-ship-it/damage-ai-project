import requests
import os

URL = "http://localhost:8080/api/upload"
IMAGE_PATH = "test.jpg"

# Create a dummy image for testing if it doesn't exist
if not os.path.exists(IMAGE_PATH):
    import numpy as np
    import cv2
    img = np.zeros((500, 500, 3), dtype=np.uint8)
    cv2.circle(img, (250, 250), 100, (255, 255, 255), -1)  # Draw a "pothole"
    cv2.imwrite(IMAGE_PATH, img)

def upload_report(device_id, lat=12.0, lon=80.0):
    with open(IMAGE_PATH, 'rb') as f:
        files = {'image': f}
        data = {
            'device_id': device_id,
            'latitude': lat,
            'longitude': lon
        }
        r = requests.post(URL, files=files, data=data)
        print(f"Device: {device_id} | Status: {r.status_code}")
        if r.status_code == 200:
            res = r.json()
            print(f"Verification: {res.get('verification_status')}, Count: {res.get('verifying_users')}")
            print(f"Size: {res.get('size')}, Cost: {res.get('estimated_cost')}")
            print("-" * 30)

# Simulate 5 unique users reporting the same pothole
for i in range(1, 6):
    upload_report(f"user_device_{i}")

# Simulate spam from user 1 (should hit rate limit after 3 total requests, but user 1 only did 1 so far)
upload_report("user_device_1")
upload_report("user_device_1") # This is the 3rd, should be RATE_LIMITED since we count current day
upload_report("user_device_1") # Should definitely be RATE_LIMITED

