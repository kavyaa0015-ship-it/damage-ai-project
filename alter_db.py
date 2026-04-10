import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports.db')

def update_schema():
    if not os.path.exists(DB_PATH):
        print("Database does not exist yet. Please run app.py first.")
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    try:
        c.execute('ALTER TABLE reports ADD COLUMN size TEXT')
        print("Added size column to reports table.")
    except sqlite3.OperationalError as e:
        print(f"Column size might already exist: {e}")
        
    try:
        c.execute('ALTER TABLE reports ADD COLUMN estimated_cost INTEGER')
        print("Added estimated_cost column to reports table.")
    except sqlite3.OperationalError as e:
        print(f"Column estimated_cost might already exist: {e}")

    conn.commit()
    conn.close()

if __name__ == '__main__':
    update_schema()
