import os
import json
import sqlite3
import uuid
from pathlib import Path
from typing import Literal
import requests
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import get_connection, init_db, seed_initial_criteria
from evaluator import CQAEvaluator, calculate_scores
from seed_data import seed_dialogues

app = FastAPI(title="Freedom Broker - Conversation Quality Analytics (CQA)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

evaluator = CQAEvaluator()

# Initialize DB and seeds on startup
@app.on_event("startup")
def on_startup():
    init_db()
    seed_initial_criteria()
    dataset = Path(__file__).with_name("dev_data.json")
    if dataset.exists():
        payload = json.loads(dataset.read_text())
        records = payload.get("data", {}).get("records", [])
        with get_connection() as conn:
            for record in records:
                conn.execute("INSERT OR IGNORE INTO dialogues (conversation_id, channel, language, transcript, audio_url) VALUES (?, ?, ?, ?, ?)",
                    (record["conversation_id"], record["channel"], record["language"],
                     json.dumps(record["transcript"], ensure_ascii=False), record.get("audio_url")))
    else:
        seed_dialogues()

# --- Pydantic Models ---
class CriterionModel(BaseModel):
    id: str
    name: str
    description: str
    weight: float = Field(ge=0, allow_inf_nan=False)
    scale_type: Literal["binary", "scale_5", "scale_10", "scale_20", "scale_100"] = "binary" # "binary" or "scale_5"
    max_points: float = Field(default=1.0, gt=0, allow_inf_nan=False)
    allow_na: bool = True
    is_fatal: bool = False
    section: str = "Общие стандарты"
    allowed_scores: Optional[str] = None
    fatal_on_score: float = 1

class AppealSubmission(BaseModel):
    evaluation_id: str
    conversation_id: str
    criterion_id: str
    operator_comment: str = Field(min_length=1, max_length=5000)

class SupervisorDecision(BaseModel):
    status: Literal["accepted", "rejected"] # "accepted" or "rejected"
    supervisor_comment: str = Field(min_length=1, max_length=5000)
    new_score: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False)

class FetchDevRequest(BaseModel):
    api_url: Optional[str] = None
    group_id: str = "DEV"


def archive_evaluation(cursor, eval_id):
    previous = cursor.execute("SELECT * FROM evaluations WHERE id = ?", (eval_id,)).fetchone()
    if previous:
        cursor.execute("INSERT INTO evaluation_history (evaluation_id, payload) VALUES (?, ?)",
                       (eval_id, json.dumps(dict(previous), ensure_ascii=False)))


def save_snapshot(cursor, eval_id, criteria, output):
    cursor.execute("""UPDATE evaluations SET checklist_snapshot=?, original_results=?,
        original_total_score=?, evaluation_mode=?, status=? WHERE id=?""",
        (json.dumps(criteria, ensure_ascii=False), json.dumps(output["criteria_results"], ensure_ascii=False),
         output["total_score"], output.get("evaluation_mode", "unknown"),
         "needs_review" if output.get("needs_review") else "evaluated", eval_id))


# --- REST Endpoints ---

@app.get("/api/criteria")
def list_criteria():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM criteria ORDER BY sort_order ASC, id ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/criteria")
def save_criterion(crit: CriterionModel):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO criteria (id, name, description, weight, scale_type, max_points, allow_na, is_fatal, section)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        crit.id, crit.name, crit.description, crit.weight, crit.scale_type,
        crit.max_points, int(crit.allow_na), int(crit.is_fatal), crit.section
    ))
    steps = {"binary":[0,1], "scale_20":[0,5,10,15,20], "scale_10":[0,4,7,10]}.get(crit.scale_type)
    cursor.execute("UPDATE criteria SET offline_supported=0, allowed_scores=?, fatal_on_score=? WHERE id=?",
        (json.dumps(steps) if steps else None, crit.fatal_on_score, crit.id))
    conn.commit()
    conn.close()
    return {"status": "success", "criterion": crit.model_dump()}

@app.delete("/api/criteria/{cid}")
def delete_criterion(cid: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM criteria WHERE id = ?", (cid,))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": cid}

@app.get("/api/dialogues")
def list_dialogues(language: Optional[str] = None, channel: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
    SELECT d.conversation_id, d.channel, d.language, d.audio_url,
           e.total_score, e.has_fatal_flaw, e.status as eval_status, e.id as eval_id
    FROM dialogues d
    LEFT JOIN evaluations e ON e.rowid = (SELECT MAX(rowid) FROM evaluations WHERE conversation_id = d.conversation_id)
    WHERE 1=1
    """
    params = []
    if language:
        query += " AND d.language = ?"
        params.append(language)
    if channel:
        query += " AND d.channel = ?"
        params.append(channel)
        
    query += " ORDER BY d.conversation_id ASC"
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

@app.get("/api/dialogues/{cid}")
def get_dialogue(cid: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dialogues WHERE conversation_id = ?", (cid,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Dialogue not found")
    
    dialogue = dict(row)
    dialogue["transcript"] = json.loads(dialogue["transcript"])

    # Fetch evaluation if exists
    cursor.execute("SELECT * FROM evaluations WHERE conversation_id = ? ORDER BY rowid DESC LIMIT 1", (cid,))
    eval_row = cursor.fetchone()
    evaluation = None
    if eval_row:
        evaluation = dict(eval_row)
        evaluation["criteria_results"] = json.loads(evaluation["criteria_results"])
        evaluation["original_results"] = json.loads(evaluation["original_results"] or "[]")
        evaluation["checklist_snapshot"] = json.loads(evaluation["checklist_snapshot"] or "[]")

    # Fetch appeals
    cursor.execute("SELECT * FROM appeals WHERE conversation_id = ? ORDER BY created_at DESC", (cid,))
    appeals = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "dialogue": dialogue,
        "evaluation": evaluation,
        "appeals": appeals
    }

@app.post("/api/evaluate/{cid}")
def evaluate_dialogue_endpoint(cid: str):
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM dialogues WHERE conversation_id = ?", (cid,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Dialogue not found")
        
    dialogue = dict(row)
    dialogue["transcript"] = json.loads(dialogue["transcript"])

    cursor.execute("SELECT * FROM criteria ORDER BY sort_order ASC, id ASC")
    criteria = [dict(r) for r in cursor.fetchall()]
    
    if not criteria:
        conn.close()
        raise HTTPException(400, "Чек-лист пуст")
    # Run evaluation
    eval_output = evaluator.evaluate_dialogue(dialogue, criteria)
    
    eval_id = "eval_" + uuid.uuid4().hex
    archive_evaluation(cursor, eval_id)
    cursor.execute("""
    INSERT OR REPLACE INTO evaluations (id, conversation_id, total_score, has_fatal_flaw, criteria_results, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 'evaluated', CURRENT_TIMESTAMP)
    """, (
        eval_id,
        cid,
        eval_output["total_score"],
        int(eval_output["has_fatal_flaw"]),
        json.dumps(eval_output["criteria_results"], ensure_ascii=False)
    ))
    save_snapshot(cursor, eval_id, criteria, eval_output)
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "evaluation_id": eval_id,
        "total_score": eval_output["total_score"],
        "has_fatal_flaw": eval_output["has_fatal_flaw"],
        "criteria_results": eval_output["criteria_results"]
    }

@app.post("/api/evaluate_all")
def evaluate_all():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dialogues")
    dialogues = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT * FROM criteria ORDER BY sort_order ASC, id ASC")
    criteria = [dict(r) for r in cursor.fetchall()]
    
    evaluated_count = 0
    for d in dialogues:
        d["transcript"] = json.loads(d["transcript"])
        eval_output = evaluator.evaluate_dialogue(d, criteria)
        eval_id = "eval_" + uuid.uuid4().hex
        archive_evaluation(cursor, eval_id)
        cursor.execute("""
        INSERT OR REPLACE INTO evaluations (id, conversation_id, total_score, has_fatal_flaw, criteria_results, status, updated_at)
        VALUES (?, ?, ?, ?, ?, 'evaluated', CURRENT_TIMESTAMP)
        """, (
            eval_id,
            d["conversation_id"],
            eval_output["total_score"],
            int(eval_output["has_fatal_flaw"]),
            json.dumps(eval_output["criteria_results"], ensure_ascii=False)
        ))
        save_snapshot(cursor, eval_id, criteria, eval_output)
        evaluated_count += 1
        
    conn.commit()
    conn.close()
    return {"status": "success", "evaluated_count": evaluated_count}

@app.post("/api/appeals")
def submit_appeal(appeal_data: AppealSubmission):
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get current score of this criterion
    cursor.execute("SELECT criteria_results, conversation_id FROM evaluations WHERE id = ?", (appeal_data.evaluation_id,))
    eval_row = cursor.fetchone()
    if not eval_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Evaluation not found")
        
    crit_results = json.loads(eval_row[0])
    target_crit = next((c for c in crit_results if c["criterion_id"] == appeal_data.criterion_id), None)
    if not target_crit or eval_row["conversation_id"] != appeal_data.conversation_id:
        conn.close()
        raise HTTPException(400, "Критерий или диалог не соответствует оценке")
    orig_score = target_crit["score"]

    appeal_id = "appeal_" + uuid.uuid4().hex
    cursor.execute("""
    INSERT OR REPLACE INTO appeals (id, evaluation_id, conversation_id, criterion_id, operator_comment, status, original_score, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP)
    """, (
        appeal_id,
        appeal_data.evaluation_id,
        appeal_data.conversation_id,
        appeal_data.criterion_id,
        appeal_data.operator_comment,
        orig_score
    ))
    
    # Update evaluation status
    cursor.execute("UPDATE evaluations SET status = 'appealed' WHERE id = ?", (appeal_data.evaluation_id,))
    conn.commit()
    conn.close()
    
    return {"status": "success", "appeal_id": appeal_id}

@app.get("/api/appeals")
def list_appeals(status: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    query = """
    SELECT a.*, c.name as criterion_name
    FROM appeals a
    LEFT JOIN criteria c ON a.criterion_id = c.id
    """
    params = []
    if status:
        query += " WHERE a.status = ?"
        params.append(status)
    query += " ORDER BY a.created_at DESC"
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/appeals/{appeal_id}/decision")
def review_appeal_decision(appeal_id: str, dec: SupervisorDecision):
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM appeals WHERE id = ?", (appeal_id,))
    appeal = cursor.fetchone()
    if not appeal:
        conn.close()
        raise HTTPException(status_code=404, detail="Appeal not found")
    
    appeal_dict = dict(appeal)
    eval_id = appeal_dict["evaluation_id"]
    criterion_id = appeal_dict["criterion_id"]
    
    if appeal_dict["status"] != "pending":
        conn.close()
        raise HTTPException(409, "Апелляция уже рассмотрена")
    saved = cursor.execute("SELECT * FROM evaluations WHERE id=?", (eval_id,)).fetchone()
    if not saved or not saved["checklist_snapshot"]:
        conn.close()
        raise HTTPException(409, "Нет снимка чек-листа: сначала выполните новую оценку")
    snapshot = json.loads(saved["checklist_snapshot"])
    criterion = next((c for c in snapshot if c["id"] == criterion_id), None)
    if not criterion or (dec.status == "accepted" and
            (dec.new_score is None or dec.new_score > criterion["max_points"])):
        conn.close()
        raise HTTPException(422, "Новая оценка должна попадать в исходную шкалу")
    allowed = json.loads(criterion["allowed_scores"]) if criterion.get("allowed_scores") else None
    if dec.status == "accepted" and allowed and dec.new_score not in allowed:
        conn.close()
        raise HTTPException(422, "Выберите допустимую ступень исходной шкалы")
    archive_evaluation(cursor, eval_id)
    # Update appeal record
    cursor.execute("""
    UPDATE appeals 
    SET status = ?, supervisor_comment = ?, new_score = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (dec.status, dec.supervisor_comment, dec.new_score, appeal_id))

    # Recalculate evaluation if appeal accepted
    cursor.execute("SELECT * FROM evaluations WHERE id = ?", (eval_id,))
    eval_row = dict(cursor.fetchone())
    crit_results = json.loads(eval_row["criteria_results"])

    criteria = snapshot

    if dec.status == "accepted" and dec.new_score is not None:
        for cr in crit_results:
            if cr["criterion_id"] == criterion_id:
                cr["score"] = dec.new_score
                cr["explanation"] += f" [Скорректировано супервизором: {dec.supervisor_comment}]"
                cr["is_na"] = False
                cr["needs_review"] = False

    # Recompute total score using formula
    total_score, has_fatal, updated_processed = calculate_scores(criteria, crit_results)

    cursor.execute("""
    UPDATE evaluations 
    SET total_score = ?, has_fatal_flaw = ?, criteria_results = ?, status = 'reviewed', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (
        total_score,
        int(has_fatal),
        json.dumps(updated_processed, ensure_ascii=False),
        eval_id
    ))

    conn.commit()
    conn.close()
    return {
        "status": "success",
        "new_total_score": total_score,
        "appeal_status": dec.status
    }

@app.get("/api/stats")
def get_stats():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM dialogues")
    total_dialogues = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*), AVG(total_score) FROM evaluations WHERE rowid IN (SELECT MAX(rowid) FROM evaluations GROUP BY conversation_id)")
    eval_stats = cursor.fetchone()
    evaluated_count = eval_stats[0]
    avg_score = round(eval_stats[1], 1) if eval_stats[1] is not None else 0.0
    
    cursor.execute("SELECT COUNT(*) FROM evaluations WHERE has_fatal_flaw = 1 AND rowid IN (SELECT MAX(rowid) FROM evaluations GROUP BY conversation_id)")
    fatal_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM appeals WHERE status = 'pending'")
    pending_appeals = cursor.fetchone()[0]

    conn.close()
    return {
        "total_dialogues": total_dialogues,
        "evaluated_count": evaluated_count,
        "average_score": avg_score,
        "fatal_flaws_count": fatal_count,
        "pending_appeals": pending_appeals
    }

@app.post("/api/fetch_organizers_data")
def fetch_organizers_data(req: FetchDevRequest):
    """
    Fetches real dataset from organizers API using backend requests (avoids CORS!),
    or loads local dev_data.json if present.
    """
    local_dev_path = Path(__file__).with_name("dev_data.json")
    data = None

    if req.api_url and not req.api_url.startswith("https://example.com"):
        try:
            url = req.api_url
            if "group_id" not in url and req.group_id:
                sep = "&" if "?" in url else "?"
                url = f"{url}{sep}group_id={req.group_id}"

            res = requests.get(url, timeout=30)
            res.raise_for_status()
            data = res.json()
        except Exception:
            data = None

    if data is None and local_dev_path.exists():
        try:
            data = json.loads(local_dev_path.read_text(encoding="utf-8"))
        except Exception:
            data = None

    if not data:
        return {"status": "error", "message": "Не удалось импортировать данные. Проверьте адрес, доступ и наличие локального dev_data.json."}

    try:
        if not data.get("isSuccess"):
            return {"status": "error", "message": data.get("error", "API returned false")}
            
        records = data.get("data", {}).get("records", [])
        conn = get_connection()
        cursor = conn.cursor()
        
        saved_count = 0
        for rec in records:
            cursor.execute("""
            INSERT OR REPLACE INTO dialogues (conversation_id, channel, language, transcript, audio_url)
            VALUES (?, ?, ?, ?, ?)
            """, (
                rec["conversation_id"],
                rec["channel"],
                rec["language"],
                json.dumps(rec["transcript"], ensure_ascii=False),
                rec.get("audio_url")
            ))
            saved_count += 1
            
        conn.commit()
        conn.close()
        return {"status": "success", "imported_records": saved_count}
    except Exception as e:
        return {"status": "error", "message": "Не удалось импортировать данные. Проверьте адрес, доступ и формат ответа."}

# Local import is isolated from evaluator/provider integration.
from local_import import router as local_import_router
app.include_router(local_import_router)

# Serve frontend static files
app.mount("/static", StaticFiles(directory=str(Path(__file__).with_name("static"))), name="static")

@app.get("/")
def serve_index():
    return FileResponse(Path(__file__).with_name("static") / "index.html")

@app.get("/presentation")
def serve_presentation():
    return FileResponse(Path(__file__).with_name("static") / "presentation.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)



