// State variables
let currentDialogueId = null;
let currentDialogueData = null;
let currentEvaluationData = null;
let activeAppealCriterion = null;

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initFilters();
    initActionButtons();
    loadStats();
    loadDialogues();
    loadCriteria();
    loadAppeals();
});

// Tab Navigation
function initTabs() {
    const tabs = document.querySelectorAll(".nav-tab");
    const slideInd = document.getElementById("pres-slide-indicator");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
            
            tab.classList.add("active");
            const target = tab.getAttribute("data-tab");
            document.getElementById(target).classList.add("active");
            if (slideInd && tab.getAttribute("data-slide")) {
                slideInd.textContent = tab.getAttribute("data-slide");
            }

            if (target === "appeals-tab") loadAppeals();
            if (target === "checklist-tab") loadCriteria();
        });
    });
}

// Action Buttons
function initActionButtons() {
    document.getElementById("btn-run-eval").addEventListener("click", () => {
        if (currentDialogueId) runEvaluation(currentDialogueId);
    });

    document.getElementById("btn-batch-eval").addEventListener("click", () => {
        runBatchEvaluation();
    });

    document.getElementById("btn-import-dev").addEventListener("click", () => {
        importDevData();
    });

    document.getElementById("btn-add-criterion").addEventListener("click", () => {
        openCriterionModal();
    });

    document.getElementById("btn-save-criterion").addEventListener("click", () => {
        saveCriterion();
    });

    document.getElementById("btn-confirm-appeal").addEventListener("click", () => {
        submitAppeal();
    });

    document.getElementById("btn-save-decision").addEventListener("click", () => {
        saveSupervisorDecision();
    });
}

// Filters
function initFilters() {
    document.getElementById("filter-lang").addEventListener("change", loadDialogues);
    document.getElementById("filter-channel").addEventListener("change", loadDialogues);
    const filterStatus = document.getElementById("filter-status");
    if (filterStatus) filterStatus.addEventListener("change", loadDialogues);

    // Clickable KPI cards
    const kpiFatal = document.getElementById("kpi-card-fatal");
    if (kpiFatal) {
        kpiFatal.addEventListener("click", () => {
            if (filterStatus) {
                filterStatus.value = filterStatus.value === "fatal" ? "" : "fatal";
                loadDialogues();
            }
        });
    }

    const kpiEval = document.getElementById("kpi-card-evaluated");
    if (kpiEval) {
        kpiEval.addEventListener("click", () => {
            if (filterStatus) {
                filterStatus.value = filterStatus.value === "evaluated" ? "" : "evaluated";
                loadDialogues();
            }
        });
    }

    const kpiTotal = document.getElementById("kpi-card-total");
    if (kpiTotal) {
        kpiTotal.addEventListener("click", () => {
            document.getElementById("filter-lang").value = "";
            document.getElementById("filter-channel").value = "";
            if (filterStatus) filterStatus.value = "";
            loadDialogues();
        });
    }

    const kpiAppeals = document.getElementById("kpi-card-appeals");
    if (kpiAppeals) {
        kpiAppeals.addEventListener("click", () => {
            const appealsTabBtn = document.querySelector('[data-tab="appeals-tab"]');
            if (appealsTabBtn) appealsTabBtn.click();
        });
    }
}

// Load KPI Stats
async function loadStats() {
    try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        document.getElementById("kpi-total").textContent = data.total_dialogues;
        document.getElementById("kpi-evaluated").textContent = data.evaluated_count;
        document.getElementById("kpi-avg").textContent = `${data.average_score}%`;
        document.getElementById("kpi-fatal").textContent = data.fatal_flaws_count;
        document.getElementById("kpi-appeals").textContent = data.pending_appeals;

        const badge = document.getElementById("appeals-badge");
        if (data.pending_appeals > 0) {
            badge.style.display = "inline-block";
            badge.textContent = data.pending_appeals;
        } else {
            badge.style.display = "none";
        }
    } catch (e) {
        console.error("Failed to load stats", e);
    }
}

// Load Dialogue List
async function loadDialogues() {
    const lang = document.getElementById("filter-lang").value;
    const channel = document.getElementById("filter-channel").value;
    const filterStatus = document.getElementById("filter-status");
    const status = filterStatus ? filterStatus.value : "";
    
    let url = "/api/dialogues?";
    if (lang) url += `language=${encodeURIComponent(lang)}&`;
    if (channel) url += `channel=${encodeURIComponent(channel)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;

    try {
        const res = await fetch(url);
        const dialogues = await res.json();
        renderDialoguesList(dialogues);
    } catch (e) {
        console.error("Failed to load dialogues", e);
    }
}

function renderDialoguesList(dialogues) {
    const container = document.getElementById("dialogues-container");
    container.innerHTML = "";

    if (dialogues.length === 0) {
        container.innerHTML = `<div style="padding:16px;text-align:center;color:#605e5c;">Диалоги не найдены</div>`;
        return;
    }

    dialogues.forEach(d => {
        const item = document.createElement("div");
        item.className = `dialogue-item ${currentDialogueId === d.conversation_id ? 'active' : ''}`;
        
        let scoreHtml = `<span class="diag-score">--</span>`;
        if (d.total_score !== null) {
            let scoreClass = d.total_score >= 80 ? "score-good" : (d.total_score >= 50 ? "score-mid" : "score-bad");
            if (d.has_fatal_flaw) {
                scoreClass = "score-bad";
                scoreHtml = `<span class="diag-score ${scoreClass}">FATAL</span>`;
            } else {
                scoreHtml = `<span class="diag-score ${scoreClass}">${Number(d.total_score).toFixed(2)}%</span>`;
            }
        }

        item.innerHTML = `
            <div>
                <div class="diag-title">${d.conversation_id}</div>
                <div class="diag-meta">
                    <span class="badge badge-${d.language.toLowerCase()}">${d.language}</span>
                    <span class="badge ${d.channel === 'agent chat' ? 'badge-chat' : 'badge-call'}">${d.channel === 'agent chat' ? 'Чат' : 'Звонок'}</span>
                </div>
            </div>
            ${scoreHtml}
        `;

        item.addEventListener("click", () => {
            selectDialogue(d.conversation_id);
        });

        container.appendChild(item);
    });
}

// Select and Load Single Dialogue
async function selectDialogue(cid) {
    currentDialogueId = cid;
    loadDialogues(); // Update active highlight

    try {
        const res = await fetch(`/api/dialogues/${cid}`);
        const data = await res.json();
        currentDialogueData = data.dialogue;
        currentEvaluationData = data.evaluation;

        renderDialogueDetails(data.dialogue);
        renderScorecard(data.evaluation);
    } catch (e) {
        console.error("Failed to select dialogue", e);
    }
}

function renderDialogueDetails(dialogue) {
    document.getElementById("current-dialogue-title").textContent = `Диалог: ${dialogue.conversation_id}`;
    document.getElementById("btn-run-eval").style.display = "inline-flex";

    const badgesContainer = document.getElementById("current-dialogue-badges");
    badgesContainer.innerHTML = `
        <span class="badge badge-${dialogue.language.toLowerCase()}">${dialogue.language}</span>
        <span class="badge ${dialogue.channel === 'agent chat' ? 'badge-chat' : 'badge-call'}">${dialogue.channel}</span>
    `;

    // Audio player handling
    const audioContainer = document.getElementById("audio-player-container");
    const audioPlayer = document.getElementById("voice-audio-player");
    if (dialogue.audio_url) {
        audioContainer.style.display = "flex";
        audioPlayer.src = dialogue.audio_url;
    } else {
        audioContainer.style.display = "none";
        audioPlayer.src = "";
    }

    // Render transcript lines
    const transcriptBody = document.getElementById("transcript-body");
    transcriptBody.innerHTML = "";

    dialogue.transcript.forEach((msg, idx) => {
        const row = document.createElement("div");
        row.className = `msg-row msg-${msg.speaker}`;
        row.id = `msg-line-${idx}`;
        row.setAttribute("data-ts", msg.timestamp);
        row.setAttribute("data-text", msg.text);

        let speakerName = "Клиент";
        if (msg.speaker === "operator") speakerName = "Оператор Freedom Broker";
        if (msg.speaker === "bot") speakerName = "Чат-бот";
        if (msg.speaker === "system") speakerName = "Системное событие";

        row.innerHTML = `
            <div class="msg-header">
                <span class="speaker-${msg.speaker}">${speakerName}</span>
                <span class="msg-time">${msg.timestamp}</span>
            </div>
            <div class="msg-text">${msg.text}</div>
        `;
        transcriptBody.appendChild(row);
    });
}

// Render Evaluation Scorecard
function renderScorecard(evalData) {
    const totalBadge = document.getElementById("scorecard-total-badge");
    const fatalAlert = document.getElementById("fatal-alert");
    const naNotice = document.getElementById("na-rebalance-notice");
    const container = document.getElementById("scorecard-body");

    container.innerHTML = "";

    if (!evalData) {
        totalBadge.textContent = "--%";
        totalBadge.style.background = "#605e5c";
        fatalAlert.style.display = "none";
        naNotice.style.display = "none";
        container.innerHTML = `
            <div class="empty-placeholder">
                <p>Оценка еще не выполнена.<br>Нажмите кнопку <strong>«Оценить диалог»</strong> вверху.</p>
            </div>
        `;
        return;
    }

    totalBadge.textContent = evalData.criteria_results.some(c => c.needs_review) ? "Требуется проверка" : (evalData.total_score === null ? "Не рассчитывается" : `${Number(evalData.total_score).toFixed(2)}%`);
    if (evalData.total_score >= 80) totalBadge.style.background = "var(--success)";
    else if (evalData.total_score >= 50) totalBadge.style.background = "#d83b01";
    else totalBadge.style.background = "var(--danger)";

    fatalAlert.style.display = evalData.has_fatal_flaw ? "block" : "none";

    const hasNA = evalData.criteria_results.some(c => c.is_na);
    naNotice.style.display = hasNA ? "block" : "none";

    evalData.criteria_results.forEach(crit => {
        const card = document.createElement("div");
        card.className = `crit-card ${crit.is_fatal && crit.score === 0 ? 'fatal-active' : ''} ${crit.is_na ? 'na-active' : ''}`;

        let scoreBadgeClass = crit.score === crit.max_points ? "score-good" : (crit.score > 0 ? "score-mid" : "score-bad");
        let scoreText = crit.is_fatal ? (crit.score === 1 ? "Да · нарушение" : "Нет") : `${crit.score} / ${crit.max_points}`;
        
        if (crit.is_na) {
            scoreBadgeClass = "badge-chat";
            scoreText = "N/A (Исключен)";
        }

        if (crit.needs_review) scoreText = "Требует проверки";

        let weightText = `Вес: ${crit.original_weight}%`;
        if (crit.is_na) {
            weightText += ` ➔ Перераспределен`;
        } else if (crit.effective_weight && crit.effective_weight !== crit.original_weight) {
            weightText += ` ➔ Скорректирован: ${crit.effective_weight}%`;
        }

        let quoteBtnHtml = "";
        if (crit.quote) {
            quoteBtnHtml = `
                <button class="crit-quote-btn" onclick="scrollToQuote('${encodeURIComponent(crit.quote)}', '${crit.timestamp}')">
                    <span>🎯</span>
                    <span><strong>Цитата:</strong> "${crit.quote}" ${crit.timestamp ? `(${crit.timestamp})` : ''}</span>
                </button>
            `;
        }

        card.innerHTML = `
            <div class="crit-header">
                <div>
                    <div class="crit-name">${crit.name}</div>
                    <div class="crit-weight-tag">${weightText}</div>
                </div>
                <span class="crit-score-badge ${scoreBadgeClass}">${scoreText}</span>
            </div>
            <div class="crit-explanation">${crit.is_na ? `<em>Причина N/A: ${crit.na_reason}</em>` : crit.explanation}</div>
            ${quoteBtnHtml}
            <div class="crit-actions">
                <button class="btn-appeal" onclick="openAppealModal('${crit.criterion_id}', '${encodeURIComponent(crit.name)}')">⚖️ Оспорить критерий</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// Scroll and Highlight Evidence in Transcript
window.scrollToQuote = function(encodedQuote, timestamp) {
    const quote = decodeURIComponent(encodedQuote).toLowerCase();
    const rows = document.querySelectorAll(".msg-row");
    let targetRow = null;

    rows.forEach(r => {
        r.classList.remove("msg-highlight");
        const text = (r.getAttribute("data-text") || "").toLowerCase();
        const ts = r.getAttribute("data-ts") || "";

        if (timestamp && ts === timestamp) {
            targetRow = r;
        } else if (!targetRow && (text.includes(quote) || quote.includes(text))) {
            targetRow = r;
        }
    });

    if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetRow.classList.add("msg-highlight");
        setTimeout(() => {
            targetRow.classList.remove("msg-highlight");
        }, 3500);
    }
};

// Run Single Evaluation
async function runEvaluation(cid) {
    const btn = document.getElementById("btn-run-eval");
    btn.disabled = true;
    btn.textContent = "⏳ Оценка...";

    try {
        const res = await fetch(`/api/evaluate/${cid}`, { method: "POST" });
        const result = await res.json();
        await selectDialogue(cid);
        loadStats();
    } catch (e) {
        alert("Ошибка оценки диалога: " + e);
    } finally {
        btn.disabled = false;
        btn.textContent = "▶ Оценить диалог";
    }
}

// Run Batch Evaluation
async function runBatchEvaluation() {
    const btn = document.getElementById("btn-batch-eval");
    btn.disabled = true;
    btn.textContent = "⏳ Пакетная обработка...";

    try {
        const res = await fetch("/api/evaluate_all", { method: "POST" });
        const data = await res.json();
        alert(`Успешно оценено диалогов: ${data.evaluated_count}`);
        loadStats();
        loadDialogues();
        if (currentDialogueId) selectDialogue(currentDialogueId);
    } catch (e) {
        alert("Ошибка пакетной оценки: " + e);
    } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Оценить все";
    }
}

// Import DEV API
async function importDevData() {
    const url = prompt("Введите ссылку на GET API DEV или контрольного набора:", "https://example.com/api/get_dataset?group_id=DEV");
    if (!url) return;

    try {
        const res = await fetch("/api/fetch_organizers_data", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ api_url: url, group_id: "DEV" })
        });
        const data = await res.json();
        if (data.status === "success") {
            alert(`Импортировано записей: ${data.imported_records}`);
            loadStats();
            loadDialogues();
        } else {
            alert("Информация: " + (data.message || "Использован локальный набор DEV"));
        }
    } catch (e) {
        alert("Ошибка запроса к API: " + e);
    }
}

// --- TAB 2: APPEALS ---

window.openAppealModal = function(criterionId, encodedName) {
    if (!currentEvaluationData) {
        alert("Сначала оцените диалог!");
        return;
    }
    activeAppealCriterion = criterionId;
    document.getElementById("appeal-criterion-name").textContent = `Критерий: ${decodeURIComponent(encodedName)}`;
    document.getElementById("appeal-comment").value = "";
    document.getElementById("appeal-modal").style.display = "flex";
};

async function submitAppeal() {
    const comment = document.getElementById("appeal-comment").value.trim();
    if (!comment) {
        alert("Пожалуйста, введите комментарий с причиной апелляции!");
        return;
    }

    try {
        const res = await fetch("/api/appeals", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                evaluation_id: currentEvaluationData.id,
                conversation_id: currentDialogueId,
                criterion_id: activeAppealCriterion,
                operator_comment: comment
            })
        });
        await res.json();
        closeModal("appeal-modal");
        alert("Апелляция успешно подана и передана проверяющему!");
        loadStats();
        loadAppeals();
    } catch (e) {
        alert("Ошибка при подаче апелляции: " + e);
    }
}

async function loadAppeals() {
    try {
        const res = await fetch("/api/appeals");
        const appeals = await res.json();
        const tbody = document.getElementById("appeals-table-body");
        tbody.innerHTML = "";

        if (appeals.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#605e5c;">Нет поданных апелляций</td></tr>`;
            return;
        }

        appeals.forEach(a => {
            const tr = document.createElement("tr");
            let statusBadge = `<span class="badge" style="background:#fff4ce;color:#797673;">На рассмотрении</span>`;
            let actionHtml = `<button class="btn btn-primary" onclick="openDecisionModal('${a.id}', '${a.conversation_id}', '${encodeURIComponent(a.criterion_name || a.criterion_id)}', '${encodeURIComponent(a.operator_comment)}', ${a.original_score})">Рассмотреть</button>`;

            if (a.status === "accepted") {
                statusBadge = `<span class="badge" style="background:#dff6dd;color:#107c10;">Удовлетворена (+${a.new_score}б)</span>`;
                actionHtml = `<span style="font-size:11px;color:#605e5c;">${a.supervisor_comment || 'Решено'}</span>`;
            } else if (a.status === "rejected") {
                statusBadge = `<span class="badge" style="background:#fdf3f2;color:#a80000;">Отклонена</span>`;
                actionHtml = `<span style="font-size:11px;color:#605e5c;">${a.supervisor_comment || 'Решено'}</span>`;
            }

            tr.innerHTML = `
                <td><strong>${a.conversation_id}</strong></td>
                <td>${a.criterion_name || a.criterion_id}</td>
                <td>${a.original_score}</td>
                <td><em>"${a.operator_comment}"</em></td>
                <td>${statusBadge}</td>
                <td>${actionHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Failed to load appeals", e);
    }
}

let activeReviewAppealId = null;
window.openDecisionModal = function(appealId, convId, encCritName, encComment, origScore) {
    activeReviewAppealId = appealId;
    document.getElementById("review-conv-id").textContent = convId;
    document.getElementById("review-crit-name").textContent = decodeURIComponent(encCritName);
    document.getElementById("review-op-comment").textContent = decodeURIComponent(encComment);
    document.getElementById("review-new-score").value = (origScore === 0 ? 1.0 : origScore + 1.0);
    document.getElementById("review-comment").value = "Обоснование оператора принято, оценка пересмотрена в пользу сотрудника.";
    document.getElementById("decision-modal").style.display = "flex";
};

async function saveSupervisorDecision() {
    const action = document.getElementById("review-action").value;
    const comment = document.getElementById("review-comment").value.trim();
    const newScore = action === "accepted" ? parseFloat(document.getElementById("review-new-score").value) : null;

    try {
        const res = await fetch(`/api/appeals/${activeReviewAppealId}/decision`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                status: action,
                supervisor_comment: comment,
                new_score: newScore
            })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result.detail));
        closeModal("decision-modal");
        alert(`Решение сохранено! Новый итоговый балл диалога: ${result.new_total_score}%`);
        loadStats();
        loadAppeals();
        if (currentDialogueId) selectDialogue(currentDialogueId);
    } catch (e) {
        alert("Ошибка сохранения решения: " + e);
    }
}

// --- TAB 3: CHECKLIST BUILDER ---

async function loadCriteria() {
    try {
        const res = await fetch("/api/criteria");
        const criteria = await res.json();
        const container = document.getElementById("criteria-editor-list");
        container.innerHTML = "";

        criteria.forEach(c => {
            const card = document.createElement("div");
            card.className = "criteria-edit-card";
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div style="font-weight:700;font-size:14px;color:var(--fb-green);">${c.name}</div>
                    <span class="badge badge-ru">${c.weight}%</span>
                </div>
                <div style="font-size:12px;color:#605e5c;">${c.description}</div>
                <div style="font-size:11px;display:flex;gap:8px;margin-top:4px;">
                    <span>Шкала: <strong>${c.scale_type} (макс ${c.max_points})</strong></span>
                    <span>N/A: <strong>${c.allow_na ? 'Да' : 'Нет'}</strong></span>
                    ${c.is_fatal ? '<span style="color:var(--danger);font-weight:700;">Критическая ошибка</span>' : ''}
                </div>
                <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px;">
                    <button class="btn btn-secondary" onclick="editCriterion('${c.id}', '${encodeURIComponent(c.name)}', '${encodeURIComponent(c.description)}', ${c.weight}, '${c.scale_type}', ${c.allow_na}, ${c.is_fatal})">Редактировать</button>
                    <button class="btn btn-secondary" style="color:var(--danger);" onclick="deleteCriterion('${c.id}')">Удалить</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Failed to load criteria", e);
    }
}

window.openCriterionModal = function() {
    document.getElementById("crit-modal-title").textContent = "Новый критерий оценки (23-й час)";
    document.getElementById("edit-crit-id").value = "c_new_" + Date.now();
    document.getElementById("edit-crit-name").value = "";
    document.getElementById("edit-crit-desc").value = "";
    document.getElementById("edit-crit-weight").value = "10";
    document.getElementById("edit-crit-scale").value = "binary";
    document.getElementById("edit-crit-na").checked = true;
    document.getElementById("edit-crit-fatal").checked = false;
    document.getElementById("criterion-modal").style.display = "flex";
};

window.editCriterion = function(id, encName, encDesc, weight, scale, allowNa, isFatal) {
    document.getElementById("crit-modal-title").textContent = "Редактирование критерия";
    document.getElementById("edit-crit-id").value = id;
    document.getElementById("edit-crit-name").value = decodeURIComponent(encName);
    document.getElementById("edit-crit-desc").value = decodeURIComponent(encDesc);
    document.getElementById("edit-crit-weight").value = weight;
    document.getElementById("edit-crit-scale").value = scale;
    document.getElementById("edit-crit-na").checked = !!allowNa;
    document.getElementById("edit-crit-fatal").checked = !!isFatal;
    document.getElementById("criterion-modal").style.display = "flex";
};

async function saveCriterion() {
    const id = document.getElementById("edit-crit-id").value;
    const name = document.getElementById("edit-crit-name").value.trim();
    const desc = document.getElementById("edit-crit-desc").value.trim();
    const weight = parseFloat(document.getElementById("edit-crit-weight").value);
    const scale = document.getElementById("edit-crit-scale").value;
    const allowNa = document.getElementById("edit-crit-na").checked;
    const isFatal = document.getElementById("edit-crit-fatal").checked;

    if (!name) {
        alert("Укажите название критерия!");
        return;
    }

    try {
        const res = await fetch("/api/criteria", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                id: id,
                name: name,
                description: desc,
                weight: weight,
                scale_type: scale,
                max_points: scale === "binary" ? 1 : Number(scale.split("_")[1]),
                allow_na: allowNa,
                is_fatal: isFatal,
                section: "Пользовательские критерии"
            })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result.detail));
        closeModal("criterion-modal");
        alert("Критерий сохранен! Чек-лист обновлен и готов к применению на диалогах.");
        loadCriteria();
    } catch (e) {
        alert("Ошибка сохранения критерия: " + e);
    }
}

window.deleteCriterion = async function(id) {
    if (!confirm("Удалить этот критерий из чек-листа?")) return;
    try {
        await fetch(`/api/criteria/${id}`, { method: "DELETE" });
        loadCriteria();
    } catch (e) {
        alert("Ошибка удаления критерия: " + e);
    }
};

// Modal helpers
window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = "none";
};
