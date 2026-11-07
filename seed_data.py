"""Synthetic demo only; no real customer records."""
import json
from database import get_connection

SAMPLE_DIALOGUES = [{'conversation_id': 'synthetic-demo-ru', 'channel': 'agent chat', 'language': 'RU', 'audio_url': None, 'transcript': [{'timestamp': '00:00', 'speaker': 'client', 'text': 'Здравствуйте! Где найти справочный раздел приложения?'}, {'timestamp': '00:04', 'speaker': 'operator', 'text': 'Здравствуйте! Меня зовут Демонстрационный оператор. Откройте меню приложения и выберите раздел «Помощь».'}, {'timestamp': '00:10', 'speaker': 'client', 'text': 'Нашёл, спасибо.'}, {'timestamp': '00:15', 'speaker': 'operator', 'text': 'Рад помочь. Остались ли ещё вопросы? Хорошего дня!'}]}]

def seed_dialogues():
    conn = get_connection()
    cursor = conn.cursor()
    
    for d in SAMPLE_DIALOGUES:
        cursor.execute("""
        INSERT OR REPLACE INTO dialogues (conversation_id, channel, language, transcript, audio_url)
        VALUES (?, ?, ?, ?, ?)
        """, (
            d["conversation_id"],
            d["channel"],
            d["language"],
            json.dumps(d["transcript"], ensure_ascii=False),
            d["audio_url"]
        ))
    
    conn.commit()
    conn.close()
    print(f"Seeded {len(SAMPLE_DIALOGUES)} sample dialogues.")

if __name__ == "__main__":
    from database import init_db, seed_initial_criteria
    init_db()
    seed_initial_criteria()
    seed_dialogues()
