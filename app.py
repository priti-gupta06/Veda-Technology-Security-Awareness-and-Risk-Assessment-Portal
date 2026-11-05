
from flask import Flask, render_template, request, jsonify, send_file
import sqlite3
import csv
import io
from datetime import datetime

app = Flask(__name__)
DATABASE = "veda_security.db"


# DATABASE CONNECTION
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# CREATE DATABASE TABLES
def initialize_database():
    with get_db() as db:

        db.execute("""
        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            owner TEXT NOT NULL,
            sensitivity TEXT NOT NULL,
            notes TEXT,
            created_at TEXT
        )
        """)

        db.execute("""
        CREATE TABLE IF NOT EXISTS risks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            asset TEXT NOT NULL,
            likelihood INTEGER NOT NULL,
            impact INTEGER NOT NULL,
            score INTEGER NOT NULL,
            level TEXT NOT NULL,
            mitigation TEXT NOT NULL,
            created_at TEXT
        )
        """)

        db.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter TEXT NOT NULL,
            incident_type TEXT NOT NULL,
            description TEXT NOT NULL,
            urgency TEXT NOT NULL,
            status TEXT DEFAULT 'Open',
            created_at TEXT
        )
        """)

        # Add fictional demonstration assets
        count = db.execute(
            "SELECT COUNT(*) FROM assets"
        ).fetchone()[0]

        if count == 0:
            sample_assets = [
                ("Employee Laptops", "Hardware", "IT Team", "High", "Sample asset"),
                ("Company Website", "Application", "Web Team", "High", "Sample asset"),
                ("Training Documents", "Data", "HR Team", "Medium", "Sample asset"),
                ("Office Wi-Fi", "Network", "IT Team", "Medium", "Sample asset")
            ]

            now = datetime.now().isoformat(timespec="minutes")

            db.executemany("""
                INSERT INTO assets
                (name, category, owner, sensitivity, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, [(*asset, now) for asset in sample_assets])


# HOME PAGE
@app.route("/")
def home():
    return render_template("index.html")


# DASHBOARD DATA
@app.route("/api/dashboard")
def dashboard():

    with get_db() as db:

        assets = db.execute(
            "SELECT COUNT(*) FROM assets"
        ).fetchone()[0]

        risks = db.execute(
            "SELECT COUNT(*) FROM risks"
        ).fetchone()[0]

        incidents = db.execute(
            "SELECT COUNT(*) FROM incidents"
        ).fetchone()[0]

        open_incidents = db.execute(
            "SELECT COUNT(*) FROM incidents WHERE status='Open'"
        ).fetchone()[0]

        high = db.execute(
            "SELECT COUNT(*) FROM risks WHERE level='High'"
        ).fetchone()[0]

        distribution = {}

        for level in ["Low", "Medium", "High"]:
            distribution[level] = db.execute(
                "SELECT COUNT(*) FROM risks WHERE level=?",
                (level,)
            ).fetchone()[0]

        recent = db.execute(
            "SELECT * FROM risks ORDER BY id DESC LIMIT 5"
        ).fetchall()

    return jsonify({
        "assets": assets,
        "risks": risks,
        "incidents": incidents,
        "open_incidents": open_incidents,
        "high": high,
        "distribution": distribution,
        "recent": [dict(row) for row in recent]
    })


# ASSET INVENTORY
@app.route("/api/assets", methods=["GET", "POST"])
def assets():

    if request.method == "GET":

        with get_db() as db:
            rows = db.execute(
                "SELECT * FROM assets ORDER BY id DESC"
            ).fetchall()

        return jsonify([dict(row) for row in rows])

    data = request.get_json()

    required = ["name", "category", "owner", "sensitivity"]

    if not all(data.get(field) for field in required):
        return jsonify({"error": "Please complete all required fields."}), 400

    with get_db() as db:

        db.execute("""
            INSERT INTO assets
            (name, category, owner, sensitivity, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            data["name"],
            data["category"],
            data["owner"],
            data["sensitivity"],
            data.get("notes", ""),
            datetime.now().isoformat(timespec="minutes")
        ))

    return jsonify({"message": "Asset added successfully!"})


# DELETE ASSET
@app.route("/api/assets/<int:asset_id>", methods=["DELETE"])
def delete_asset(asset_id):

    with get_db() as db:
        db.execute(
            "DELETE FROM assets WHERE id=?",
            (asset_id,)
        )

    return jsonify({"message": "Asset deleted successfully!"})


# RISK ASSESSMENT
@app.route("/api/risks", methods=["GET", "POST"])
def risks():

    if request.method == "GET":

        with get_db() as db:
            rows = db.execute(
                "SELECT * FROM risks ORDER BY id DESC"
            ).fetchall()

        return jsonify([dict(row) for row in rows])

    data = request.get_json()

    try:
        likelihood = int(data["likelihood"])
        impact = int(data["impact"])

        if not (1 <= likelihood <= 5 and 1 <= impact <= 5):
            raise ValueError()

    except (KeyError, ValueError, TypeError):
        return jsonify({
            "error": "Likelihood and impact must be between 1 and 5."
        }), 400

    if not all(data.get(k) for k in ["title", "asset", "mitigation"]):
        return jsonify({"error": "Complete all risk fields."}), 400

    score = likelihood * impact

    if score <= 5:
        level = "Low"
    elif score <= 12:
        level = "Medium"
    else:
        level = "High"

    with get_db() as db:

        db.execute("""
            INSERT INTO risks
            (title, asset, likelihood, impact, score, level, mitigation, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data["title"],
            data["asset"],
            likelihood,
            impact,
            score,
            level,
            data["mitigation"],
            datetime.now().isoformat(timespec="minutes")
        ))

    return jsonify({
        "message": "Risk assessment saved!",
        "score": score,
        "level": level
    })


# INCIDENT REPORTING
@app.route("/api/incidents", methods=["GET", "POST"])
def incidents():

    if request.method == "GET":

        with get_db() as db:
            rows = db.execute(
                "SELECT * FROM incidents ORDER BY id DESC"
            ).fetchall()

        return jsonify([dict(row) for row in rows])

    data = request.get_json()

    required = [
        "reporter",
        "incident_type",
        "description",
        "urgency"
    ]

    if not all(data.get(field) for field in required):
        return jsonify({"error": "Please complete all incident fields."}), 400

    with get_db() as db:

        db.execute("""
            INSERT INTO incidents
            (reporter, incident_type, description, urgency, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            data["reporter"],
            data["incident_type"],
            data["description"],
            data["urgency"],
            datetime.now().isoformat(timespec="minutes")
        ))

    return jsonify({
        "message": "Incident recorded successfully!"
    })


# DOWNLOAD CSV REPORT
@app.route("/api/report.csv")
def download_report():

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["VEDA TECHNOLOGY SECURITY REPORT"])
    writer.writerow(["Generated:", datetime.now().strftime("%Y-%m-%d %H:%M")])
    writer.writerow([])

    with get_db() as db:

        writer.writerow(["ASSET INVENTORY"])
        writer.writerow([
            "ID", "Name", "Category", "Owner", "Sensitivity", "Notes"
        ])

        for row in db.execute("SELECT * FROM assets"):
            writer.writerow([
                row["id"], row["name"], row["category"],
                row["owner"], row["sensitivity"], row["notes"]
            ])

        writer.writerow([])
        writer.writerow(["RISK REGISTER"])
        writer.writerow([
            "ID", "Risk", "Asset", "Likelihood",
            "Impact", "Score", "Level", "Mitigation"
        ])

        for row in db.execute("SELECT * FROM risks"):
            writer.writerow([
                row["id"], row["title"], row["asset"],
                row["likelihood"], row["impact"],
                row["score"], row["level"], row["mitigation"]
            ])

        writer.writerow([])
        writer.writerow(["INCIDENT REGISTER"])
        writer.writerow([
            "ID", "Reporter", "Type", "Description",
            "Urgency", "Status"
        ])

        for row in db.execute("SELECT * FROM incidents"):
            writer.writerow([
                row["id"], row["reporter"], row["incident_type"],
                row["description"], row["urgency"], row["status"]
            ])

    memory_file = io.BytesIO(
        output.getvalue().encode("utf-8-sig")
    )

    memory_file.seek(0)

    return send_file(
        memory_file,
        mimetype="text/csv",
        as_attachment=True,
        download_name="Veda_Security_Report.csv"
    )


# START APPLICATION
if __name__ == "__main__":
    initialize_database()

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )
