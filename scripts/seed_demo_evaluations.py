"""Seeds realistic demonstration evaluations and an active appeal for live presentation."""
import json
import uuid
from pathlib import Path
import sqlite3

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "cqa.db"
CHECKLIST_PATH = BASE_DIR / "official_checklist.json"

criteria = json.loads(CHECKLIST_PATH.read_text(encoding="utf-8"))

DEMO_EVALS = [
    # 1. 100% clean dialogue with N/A on c3 (General Navigation)
    {
        "conversation_id": "p1-ru-001",
        "rows": [
            {"criterion_id": "c1", "score": 1, "is_na": False, "explanation": "Оператор поприветствовал клиента и представился в первом ответе.", "quote": "Здравствуйте! Меня зовут Алина.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c2", "score": 1, "is_na": False, "explanation": "Потребность понятна из контекста, оператор дал точный ответ.", "quote": "В веб-версии откройте вкладку «Кабинет».", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c3", "score": 0, "is_na": True, "na_reason": "Общий вопрос о навигации в кабинете, идентификация не требуется.", "explanation": "Запрос не требует раскрытия персональных или счётных данных.", "quote": "Где посмотреть мой тариф?", "timestamp": "00:00", "needs_review": False},
            {"criterion_id": "c4", "score": 20, "is_na": False, "explanation": "Предоставлена полная и корректная консультация по расположению тарифа.", "quote": "Название тарифа будет под вашим ФИО.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c5", "score": 1, "is_na": False, "explanation": "Вежливый и профессиональный тон общения.", "quote": "Пожалуйста. Хорошего вечера!", "timestamp": "02:04", "needs_review": False},
            {"criterion_id": "c6", "score": 10, "is_na": False, "explanation": "Грамотный ответ без ошибок и задержек.", "quote": "В веб-версии откройте вкладку «Кабинет». Название тарифа будет под вашим ФИО.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c7", "score": 1, "is_na": False, "explanation": "Вежливое завершение диалога.", "quote": "Хорошего вечера!", "timestamp": "02:04", "needs_review": False},
            {"criterion_id": "c8", "score": 0, "is_na": False, "explanation": "Грубых нарушений не выявлено.", "quote": "", "timestamp": "", "needs_review": False},
        ]
    },
    # 2. 100% Kazakh dialogue with N/A on c3
    {
        "conversation_id": "p1-kz-001",
        "rows": [
            {"criterion_id": "c1", "score": 1, "is_na": False, "explanation": "Оператор клиент тілінде амандасып, өзін таныстырды.", "quote": "Сәлеметсіз бе, менің атым Аружан.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c2", "score": 1, "is_na": False, "explanation": "Клиенттің сұрағы анықталды.", "quote": "Веб-нұсқада «Кабинет» бөлімін ашыңыз.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c3", "score": 0, "is_na": True, "na_reason": "Жалпы навигациялық сұрақ, сәйкестендіруді талап етпейді.", "explanation": "Шот бойынша құпия ақпарат сұралмаған.", "quote": "Қазір қай тарифте тұрғанымды қайдан көремін?", "timestamp": "00:00", "needs_review": False},
            {"criterion_id": "c4", "score": 20, "is_na": False, "explanation": "Тарифті қайдан көруге болатыны толық түсіндірілді.", "quote": "Тариф аты-жөніңіздің астында жазылады.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c5", "score": 1, "is_na": False, "explanation": "Сыпайы және сауатты қарым-қатынас.", "quote": "Оқасы жоқ. Сау болыңыз!", "timestamp": "02:04", "needs_review": False},
            {"criterion_id": "c6", "score": 10, "is_na": False, "explanation": "Қазақ тілінде сауатты жауап берілді.", "quote": "Веб-нұсқада «Кабинет» бөлімін ашыңыз. Тариф аты-жөніңіздің астында жазылады.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c7", "score": 1, "is_na": False, "explanation": "Диалог дұрыс аяқталды.", "quote": "Сау болыңыз!", "timestamp": "02:04", "needs_review": False},
            {"criterion_id": "c8", "score": 0, "is_na": False, "explanation": "Дөрекі қателіктер анықталған жоқ.", "quote": "", "timestamp": "", "needs_review": False},
        ]
    },
    # 3. 100% English dialogue
    {
        "conversation_id": "p1-en-001",
        "rows": [
            {"criterion_id": "c1", "score": 1, "is_na": False, "explanation": "Operator greeted the customer and introduced themselves in the first reply.", "quote": "Hi, I'm Maya from support.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c2", "score": 1, "is_na": False, "explanation": "Understood the issue regarding login conflict.", "quote": "A login stays on record after the account is closed.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c3", "score": 0, "is_na": True, "na_reason": "Registration question, no personal account access needed.", "explanation": "General guidance on creating a new profile.", "quote": "I'm opening a new account and the app says my login is taken.", "timestamp": "00:00", "needs_review": False},
            {"criterion_id": "c4", "score": 20, "is_na": False, "explanation": "Provided clear instructions to use a different login.", "quote": "Use a different login for the new registration.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c5", "score": 1, "is_na": False, "explanation": "Polite and helpful tone.", "quote": "You're welcome. Take care!", "timestamp": "02:04", "needs_review": False},
            {"criterion_id": "c6", "score": 10, "is_na": False, "explanation": "Accurate, concise and grammatically correct English.", "quote": "A login stays on record after the account is closed. Use a different login for the new registration.", "timestamp": "01:15", "needs_review": False},
            {"criterion_id": "c7", "score": 1, "is_na": False, "explanation": "Polite sign-off.", "quote": "Take care!", "timestamp": "02:04", "needs_review": False},
            {"criterion_id": "c8", "score": 0, "is_na": False, "explanation": "No fatal violations detected.", "quote": "", "timestamp": "", "needs_review": False},
        ]
    },
    # 4. FATAL ERROR RU: Offering card transfer to operator (p1-ru-022)
    {
        "conversation_id": "p1-ru-022",
        "rows": [
            {"criterion_id": "c1", "score": 1, "is_na": False, "explanation": "Приветствие и представление присутствуют.", "quote": "Здравствуйте, я Кирилл.", "timestamp": "01:23", "needs_review": False},
            {"criterion_id": "c2", "score": 0, "is_na": False, "explanation": "Потребность клиента проигнорирована ради личной выгоды.", "quote": "Скиньте деньги мне на карту", "timestamp": "01:23", "needs_review": False},
            {"criterion_id": "c3", "score": 0, "is_na": True, "na_reason": "Общий вопрос о выборе бумаг.", "explanation": "Идентификация не проводилась.", "quote": "Хочу выбрать облигации.", "timestamp": "00:00", "needs_review": False},
            {"criterion_id": "c4", "score": 0, "is_na": False, "explanation": "Консультация по продуктам компании не предоставлена.", "quote": "я сам их вложу с выгодой.", "timestamp": "01:23", "needs_review": False},
            {"criterion_id": "c5", "score": 0, "is_na": False, "explanation": "Недобросовестное поведение сотрудника.", "quote": "через компанию оформлять не надо.", "timestamp": "01:56", "needs_review": False},
            {"criterion_id": "c6", "score": 4, "is_na": False, "explanation": "Нарушение корпоративных стандартов общения.", "quote": "Да, это я лично предлагаю", "timestamp": "01:56", "needs_review": False},
            {"criterion_id": "c7", "score": 0, "is_na": False, "explanation": "Оператор прервал диалог без прощания.", "quote": "Здравствуйте, я Кирилл.", "timestamp": "01:23", "needs_review": False},
            {"criterion_id": "c8", "score": 1, "is_na": False, "explanation": "ГРУБАЯ ОШИБКА: Предложение перевода денег на личную карту оператора в обход компании Freedom Broker.", "quote": "Скиньте деньги мне на карту, я сам их вложу с выгодой.", "timestamp": "01:23", "needs_review": False},
        ]
    },
    # 5. FATAL ERROR RU: Offering paid private advice (p1-ru-023)
    {
        "conversation_id": "p1-ru-023",
        "rows": [
            {"criterion_id": "c1", "score": 1, "is_na": False, "explanation": "Приветствие и представление в первом ответе.", "quote": "Здравствуйте, я Марк.", "timestamp": "02:01", "needs_review": False},
            {"criterion_id": "c2", "score": 1, "is_na": False, "explanation": "Показан раздел котировок.", "quote": "Откройте «Котировки».", "timestamp": "02:01", "needs_review": False},
            {"criterion_id": "c3", "score": 0, "is_na": True, "na_reason": "Общий вопрос навигации.", "explanation": "Идентификация не требовалась.", "quote": "Как найти облигации в приложении?", "timestamp": "00:00", "needs_review": False},
            {"criterion_id": "c4", "score": 5, "is_na": False, "explanation": "Минимальная навигация, попытка увести клиента на платную основу.", "quote": "введите его в строку поиска.", "timestamp": "02:01", "needs_review": False},
            {"criterion_id": "c5", "score": 0, "is_na": False, "explanation": "Навязывание платных услуг в обход регламента.", "quote": "за плату объясню, какие бумаги взять.", "timestamp": "03:03", "needs_review": False},
            {"criterion_id": "c6", "score": 4, "is_na": False, "explanation": "Нарушение регламента взаимодействия.", "quote": "Это будет моя частная консультация.", "timestamp": "03:03", "needs_review": False},
            {"criterion_id": "c7", "score": 1, "is_na": False, "explanation": "Прощание присутствует.", "quote": "Всего доброго.", "timestamp": "03:51", "needs_review": False},
            {"criterion_id": "c8", "score": 1, "is_na": False, "explanation": "ГРУБАЯ ОШИБКА: Предложение платной частной консультации в обход компании.", "quote": "Можете дать личный номер? Вечером созвонюсь с вами и за плату объясню, какие бумаги взять. Это будет моя частная консультация.", "timestamp": "03:03", "needs_review": False},
        ]
    },
    # 6. FATAL ERROR KZ: Private paid consultation in Kazakh (p1-kz-013)
    {
        "conversation_id": "p1-kz-013",
        "rows": [
            {"criterion_id": "c1", "score": 1, "is_na": False, "explanation": "Амандасу және танысу бар.", "quote": "Сәлеметсіз бе, мен Айданамын.", "timestamp": "03:30", "needs_review": False},
            {"criterion_id": "c2", "score": 1, "is_na": False, "explanation": "Бөлімді көрсетті.", "quote": "«Котировки» бөлімін ашсаңыз", "timestamp": "03:30", "needs_review": False},
            {"criterion_id": "c3", "score": 0, "is_na": True, "na_reason": "Жалпы навигациялық сұрақ.", "explanation": "Сәйкестендіру қажет емес.", "quote": "Облигацияларды қайдан қараймын?", "timestamp": "00:00", "needs_review": False},
            {"criterion_id": "c4", "score": 5, "is_na": False, "explanation": "Толық кеңес берілмеді.", "quote": "атауы бойынша іздей аласыз.", "timestamp": "03:30", "needs_review": False},
            {"criterion_id": "c5", "score": 0, "is_na": False, "explanation": "Клиентке ақылы жеке кеңес ұсыну.", "quote": "ақылы түрде айтып беремін.", "timestamp": "04:36", "needs_review": False},
            {"criterion_id": "c6", "score": 4, "is_na": False, "explanation": "Регламентті бұзу.", "quote": "Жеке нөміріңізді қалдырсаңыз", "timestamp": "04:36", "needs_review": False},
            {"criterion_id": "c7", "score": 0, "is_na": False, "explanation": "Оператор чатты қоштасусыз жапты.", "quote": "Сәлеметсіз бе, мен Айданамын.", "timestamp": "03:30", "needs_review": False},
            {"criterion_id": "c8", "score": 1, "is_na": False, "explanation": "ДӨРЕКІ ҚАТЕЛІК: Компанияны айналып өтіп, жеке ақылы кеңес ұсыну.", "quote": "Жеке нөміріңізді қалдырсаңыз, жұмыстан кейін хабарласып, қандай қағаз алу керегін ақылы түрде айтып беремін.", "timestamp": "04:36", "needs_review": False},
        ]
    },
    # 7. FATAL ERROR EN: Private paid consultation in English (p1-en-013)
    {
        "conversation_id": "p1-en-013",
        "rows": [
            {"criterion_id": "c1", "score": 1, "is_na": False, "explanation": "Greeting and introduction present.", "quote": "Hi, I'm Adrian.", "timestamp": "03:30", "needs_review": False},
            {"criterion_id": "c2", "score": 1, "is_na": False, "explanation": "Directed to Quotes section.", "quote": "Open Quotes and search by the bond's name or ticker.", "timestamp": "03:30", "needs_review": False},
            {"criterion_id": "c3", "score": 0, "is_na": True, "na_reason": "General navigation question.", "explanation": "No account access needed.", "quote": "I'm trying to figure out how to find bonds in the app.", "timestamp": "00:00", "needs_review": False},
            {"criterion_id": "c4", "score": 5, "is_na": False, "explanation": "Minimal help, diverted to private payment.", "quote": "Open Quotes", "timestamp": "03:30", "needs_review": False},
            {"criterion_id": "c5", "score": 0, "is_na": False, "explanation": "Unethical offering of outside advisory.", "quote": "I charge for private advice", "timestamp": "04:36", "needs_review": False},
            {"criterion_id": "c6", "score": 4, "is_na": False, "explanation": "Violation of corporate guidelines.", "quote": "Send me your personal number", "timestamp": "04:36", "needs_review": False},
            {"criterion_id": "c7", "score": 0, "is_na": False, "explanation": "Chat abruptly closed without farewell.", "quote": "Hi, I'm Adrian.", "timestamp": "03:30", "needs_review": False},
            {"criterion_id": "c8", "score": 1, "is_na": False, "explanation": "FATAL FLAW: Soliciting private paid advice circumventing Freedom Broker.", "quote": "Send me your personal number and I'll call you after work. I charge for private advice and can tell you which bonds to buy.", "timestamp": "04:36", "needs_review": False},
        ]
    },
    # 8. DIALOGUE WITH ACTIVE APPEAL (p1-ru-003): Incomplete consultation (score=55), ready for supervisor review
    {
        "conversation_id": "p1-ru-003",
        "rows": [
            {"criterion_id": "c1", "score": 1, "is_na": False, "explanation": "Приветствие и представление присутствуют.", "quote": "Добрый день! Я Лера из поддержки.", "timestamp": "02:49", "needs_review": False},
            {"criterion_id": "c2", "score": 1, "is_na": False, "explanation": "Уточнён канал входа.", "quote": "Вы через приложение или веб-версию смотрите?", "timestamp": "02:49", "needs_review": False},
            {"criterion_id": "c3", "score": 0, "is_na": True, "na_reason": "Общий вопрос о комиссии и тарифе.", "explanation": "Идентификация не требовалась.", "quote": "Какая комиссия на тарифе инвестор?", "timestamp": "00:00", "needs_review": False},
            {"criterion_id": "c4", "score": 5, "is_na": False, "explanation": "Неполная консультация: клиент дважды спросил про комиссию на покупку, но оператор повторно ответил только про название тарифа.", "quote": "Название тарифа смотрите там же.", "timestamp": "05:07", "needs_review": False},
            {"criterion_id": "c5", "score": 1, "is_na": False, "explanation": "Вежливый тон.", "quote": "Хорошего дня!", "timestamp": "05:07", "needs_review": False},
            {"criterion_id": "c6", "score": 4, "is_na": False, "explanation": "Низкое управление диалогом: вопрос клиента о комиссии остался без ответа.", "quote": "Название тарифа смотрите там же.", "timestamp": "05:07", "needs_review": False},
            {"criterion_id": "c7", "score": 1, "is_na": False, "explanation": "Прощание оформлено.", "quote": "Хорошего дня!", "timestamp": "05:07", "needs_review": False},
            {"criterion_id": "c8", "score": 0, "is_na": False, "explanation": "Грубых нарушений нет.", "quote": "", "timestamp": "", "needs_review": False},
        ],
        "appeal": {
            "criterion_id": "c4",
            "operator_comment": "Я подсказала клиенту раздел «Кабинет», где размещена вся тарифная сетка со ставками комиссий. Прошу пересмотреть балл по критерию c4 до 15."
        }
    }
]

def run():
    import sys
    sys.path.insert(0, str(BASE_DIR))
    import evaluator

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Clear previous evaluations to seed clean set
    cursor.execute("DELETE FROM evaluations")
    cursor.execute("DELETE FROM appeals")

    for item in DEMO_EVALS:
        cid = item["conversation_id"]
        rows = item["rows"]
        total, fatal, processed = evaluator.calculate_scores(criteria, rows)
        eval_id = "eval_" + str(uuid.uuid4())[:12]

        cursor.execute("""
        INSERT INTO evaluations (id, conversation_id, checklist_version, total_score, has_fatal_flaw,
                                criteria_results, status, checklist_snapshot, original_results, original_total_score, evaluation_mode)
        VALUES (?, ?, 1, ?, ?, ?, 'evaluated', ?, ?, ?, 'calibrated_benchmark')
        """, (
            eval_id, cid, total, 1 if fatal else 0,
            json.dumps(processed, ensure_ascii=False),
            json.dumps(criteria, ensure_ascii=False),
            json.dumps(processed, ensure_ascii=False),
            total
        ))

        if "appeal" in item:
            app_id = "app_" + str(uuid.uuid4())[:8]
            crit_id = item["appeal"]["criterion_id"]
            orig_score = [r["score"] for r in rows if r["criterion_id"] == crit_id][0]
            cursor.execute("""
            INSERT INTO appeals (id, evaluation_id, conversation_id, criterion_id, operator_comment, status, original_score, new_score)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL)
            """, (
                app_id, eval_id, cid, crit_id, item["appeal"]["operator_comment"], orig_score
            ))

    conn.commit()
    cursor.execute("SELECT COUNT(*) FROM evaluations")
    print(f"Evaluated dialogues seeded: {cursor.fetchone()[0]}")
    cursor.execute("SELECT COUNT(*) FROM evaluations WHERE has_fatal_flaw = 1")
    print(f"Fatal flaw dialogues: {cursor.fetchone()[0]}")
    cursor.execute("SELECT COUNT(*) FROM appeals")
    print(f"Pending appeals: {cursor.fetchone()[0]}")
    conn.close()

if __name__ == "__main__":
    run()
