"""Versioned workspace snapshots for the local analyst and reviewer browsers."""
import json
import os
import sqlite3
from pathlib import Path

def connect():
    folder = Path(os.getenv("LOCALAPPDATA") or Path.home()) / "AnaisCQA"
    folder.mkdir(exist_ok=True)
    conn = sqlite3.connect(folder / "workspace.sqlite3", timeout=8)
    conn.execute("CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY, version INTEGER, body TEXT)")
    return conn

def read_workspace():
    conn = connect()
    try:
        row = conn.execute("SELECT version, body FROM workspace WHERE id=1").fetchone()
        return {"version": row[0], "workspace": json.loads(row[1])} if row else {"version": 0, "workspace": None}
    finally:
        conn.close()

def write_workspace(data):
    state = data["workspace"]
    if not isinstance(state, dict) or not isinstance(state.get("records"), list) or not state["records"]:
        raise ValueError("Рабочее пространство повреждено.")
    for key, kind in (("criteria", list), ("runs", dict), ("appeals", list)):
        if not isinstance(state.get(key), kind):
            raise ValueError("Некорректный формат рабочего пространства.")
    conn = connect()
    try:
        with conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT version FROM workspace WHERE id=1").fetchone()
            version = row[0] if row else 0
            if version != data["version"]:
                return 409, {"error":"Другой сотрудник сохранил изменения. Обновите страницу и повторите действие."}
            conn.execute("INSERT OR REPLACE INTO workspace VALUES (1,?,?)",
                         (version+1, json.dumps(state, ensure_ascii=False)))
            return 200, {"version": version+1}
    finally:
        conn.close()
