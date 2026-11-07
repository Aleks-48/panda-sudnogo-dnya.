# Руководство для участников команды (Team Onboarding Guide)
### Проект: Freedom Broker · CQA Hackathon

Добро пожаловать в команду разработки! Этот гайд поможет быстро развернуть проект локально и начать совместную разработку.

---

## 👥 Как подключиться к репозиторию

1. **Клонирование проекта:**
   ```bash
   git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ>
   cd cqa_project
   ```

2. **Создание и активация виртуального окружения:**
   ```bash
   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate

   # Windows
   python -m venv venv
   venv\Scripts\activate
   ```

3. **Установка зависимостей:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Запуск сервиса:**
   ```bash
   python app.py
   ```
   Сервер запустится на `http://localhost:8000`. При первом запуске автоматически создастся база `cqa.db` и загрузятся стартовые диалоги на русском, казахском и английском языках.

---

## 🌿 Правила совместной работы с Git

Чтобы не затирать код друг друга и не ломать `main`:

1. **Создавайте отдельную ветку под свою задачу:**
   ```bash
   git checkout -b feature/ваша-задача
   ```
   *Например:* `feature/improve-kz-prompts` или `feature/export-excel` или `feature/ui-tweaks`.

2. **Фиксация изменений:**
   ```bash
   git add .
   git commit -m "feat: краткое описание изменений"
   ```

3. **Отправка ветки в удаленный репозиторий:**
   ```bash
   git push origin feature/ваша-задача
   ```

4. **Создание Pull Request (PR):**
   Создайте Pull Request в ветку `main`, чтобы тиммейты могли проверить код перед слиянием.

---

## 🎯 Распределение ролей и зон ответственности

* **ML / Prompt Engineer:**
  * Файл: `evaluator.py`
  * Задачи: тюнинг промптов для казахского языка (KZ), калибровка правил N/A, тестирование с бесплатными API (Gemini / Groq / Ollama).
* **Backend Engineer:**
  * Файлы: `app.py`, `database.py`
  * Задачи: подключение реального эндпоинта организаторов на 23-м часу (`fetch_organizers_data`), оптимизация базы SQLite, аналитика.
* **Frontend Engineer:**
  * Файлы: `static/index.html`, `static/styles.css`, `static/app.js`
  * Задачи: полировка стилей под Microsoft Dynamics 365, улучшение визуализации таймлайна звонков и карточек апелляций.
* **Team Lead / Pitcher:**
  * Файл: `docs/DEFENSE_SCRIPT_5MIN.md`
  * Задачи: прогон 5-минутного выступления перед жюри по секундомеру, контроль регламента.
