import sqlite3
import os
from pathlib import Path
import json
from typing import List, Dict, Any, Optional

DB_PATH = os.getenv("CQA_DB_PATH", str(Path(__file__).with_name("cqa.db")))

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Checklist criteria
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS criteria (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        weight REAL NOT NULL,
        scale_type TEXT NOT NULL, -- 'binary' or 'scale_5' or 'scale_100'
        max_points REAL NOT NULL,
        allow_na INTEGER NOT NULL DEFAULT 1,
        is_fatal INTEGER NOT NULL DEFAULT 0,
        section TEXT NOT NULL DEFAULT 'Общие стандарты',
        sort_order INTEGER NOT NULL DEFAULT 0
    )
    """)

    # Dialogues
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dialogues (
        conversation_id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        language TEXT NOT NULL,
        transcript TEXT NOT NULL,
        audio_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Evaluations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        checklist_version INTEGER NOT NULL DEFAULT 1,
        total_score REAL,
        has_fatal_flaw INTEGER NOT NULL DEFAULT 0,
        criteria_results TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'evaluated', -- 'evaluated', 'appealed', 'reviewed'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES dialogues(conversation_id)
    )
    """)

    # Appeals
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS appeals (
        id TEXT PRIMARY KEY,
        evaluation_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        criterion_id TEXT NOT NULL,
        operator_comment TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
        supervisor_comment TEXT,
        original_score REAL NOT NULL,
        new_score REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
    )
    """)

    if "offline_supported" not in {row[1] for row in cursor.execute("PRAGMA table_info(criteria)")}:
        cursor.execute("ALTER TABLE criteria ADD COLUMN offline_supported INTEGER NOT NULL DEFAULT 1")
    for name, kind in [("allowed_scores", "TEXT"), ("fatal_on_score", "REAL DEFAULT 0")]:
        if name not in {row[1] for row in cursor.execute("PRAGMA table_info(criteria)")}:
            cursor.execute(f"ALTER TABLE criteria ADD COLUMN {name} {kind}")
    # Older versions required a score even when no criterion applies. Rebuild without that constraint.
    if any(row[1] == "total_score" and row[3] for row in cursor.execute("PRAGMA table_info(evaluations)")):
        sql = cursor.execute("SELECT sql FROM sqlite_master WHERE name='evaluations'").fetchone()[0]
        sql = sql.replace("CREATE TABLE evaluations", "CREATE TABLE evaluations_new", 1).replace("total_score REAL NOT NULL", "total_score REAL")
        cursor.execute(sql)
        cursor.execute("INSERT INTO evaluations_new SELECT * FROM evaluations")
        cursor.execute("DROP TABLE evaluations")
        cursor.execute("ALTER TABLE evaluations_new RENAME TO evaluations")
    # Additive migration: preserve previous databases and immutable audit data.
    columns = {row[1] for row in cursor.execute("PRAGMA table_info(evaluations)")}
    for name, kind in [("checklist_snapshot", "TEXT"), ("original_results", "TEXT"),
                       ("original_total_score", "REAL"), ("evaluation_mode", "TEXT")]:
        if name not in columns:
            cursor.execute(f"ALTER TABLE evaluations ADD COLUMN {name} {kind}")
    cursor.execute("CREATE TABLE IF NOT EXISTS evaluation_history (id INTEGER PRIMARY KEY, evaluation_id TEXT, payload TEXT NOT NULL, archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    conn.commit()
    conn.close()

def seed_initial_criteria():
    """One-time migration to the supplied official PDF; preserve later user edits."""
    conn = get_connection()
    conn.execute("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT)")
    if not conn.execute("SELECT 1 FROM app_meta WHERE key='official_chat_checklist_v1'").fetchone():
        criteria = json.loads(Path(__file__).with_name("official_checklist.json").read_text())
        # Evaluation snapshots retain historical criteria; migrate only initial c1..c8.
        for c in criteria:
            columns = list(c)
            conn.execute(f"INSERT OR REPLACE INTO criteria ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})", [c[k] for k in columns])
        conn.execute("INSERT INTO app_meta VALUES ('official_chat_checklist_v1','installed')")
        conn.commit()
    conn.close()
