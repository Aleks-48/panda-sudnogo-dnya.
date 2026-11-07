"""Bounded, atomic local JSON import. Never fetches URLs or overwrites records."""
import json
from typing import List, Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError
from database import get_connection

router = APIRouter()
MAX_BYTES = 5 * 1024 * 1024

class Message(BaseModel):
    timestamp: str = Field(max_length=50)
    speaker: Literal['operator', 'client', 'bot', 'system']
    text: str = Field(min_length=1, max_length=50000)

class Record(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=150, pattern=r'^[\w.-]+$')
    channel: Literal['agent chat', 'voice']
    language: Literal['RU', 'KZ']
    transcript: List[Message] = Field(min_length=1, max_length=5000)

@router.post('/api/import_local')
async def import_local(request: Request):
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > MAX_BYTES:
            raise HTTPException(413, 'JSON не должен превышать 5 МБ')
    try:
        payload = json.loads(raw)
        records = payload if isinstance(payload, list) else payload.get('data', payload).get('records')
        if not isinstance(records, list) or not 1 <= len(records) <= 1000:
            raise ValueError('Нужен массив от 1 до 1000 диалогов')
        validated = [Record.model_validate(r) for r in records]
    except (ValueError, TypeError, AttributeError, ValidationError) as exc:
        # Do not echo submitted transcript/secrets in validation responses.
        raise HTTPException(422, 'Некорректный JSON: проверьте формат диалогов, RU/KZ, agent chat/voice и непустые сообщения') from exc
    inserted = 0
    with get_connection() as conn:
        for r in validated:
            result = conn.execute('INSERT OR IGNORE INTO dialogues (conversation_id, channel, language, transcript, audio_url) VALUES (?, ?, ?, ?, NULL)',
                (r.conversation_id, r.channel, r.language, json.dumps([m.model_dump() for m in r.transcript], ensure_ascii=False)))
            inserted += result.rowcount
    return {'imported_records': inserted, 'skipped_records': len(validated) - inserted}
