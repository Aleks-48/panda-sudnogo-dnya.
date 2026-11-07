// ==========================================================================
// FREEDOM BROKER CQA v2.0 — CLEAN TELEGRAM-STYLE SPECIALIST INTERFACE
// Client Left / Operator Right + Hidden IVR Noise + Real MP3 Sync + Dual Theme
// ==========================================================================

let currentDialogueId = null;
let currentDialogueData = null;
let currentEvaluationData = null;
let activeAppealCriterion = null;
let allCachedDialogues = [];
let currentTranscriptOffsets = [];
let showSystemMessages = false;

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initTabs();
    initFilters();
    initActionButtons();
    initDropdownAndHotkeys();
    initAudioSyncListener();
    loadStats();
    loadDialogues();
    loadCriteria();
    loadAppeals();
});

// 0. Переключатель темы (Темная / Светлая)
function initTheme() {
    const saved = localStorage.getItem("cqa_theme") || "light";
    applyTheme(saved);

    const btn = document.getElementById("btn-theme-toggle");
    if (btn) {
        btn.addEventListener("click", () => {
            const isLight = document.documentElement.classList.contains("light");
            applyTheme(isLight ? "dark" : "light");
        });
    }
}

function applyTheme(mode) {
    const html = document.documentElement;
    const icon = document.getElementById("theme-icon");
    const label = document.getElementById("theme-label");
    const logo = document.getElementById("brand-logo-img");

    if (mode === "light") {
        html.classList.remove("dark");
        html.classList.add("light");
        if (icon) icon.textContent = "☾";
        if (label) label.textContent = "Темная тема";
        if (logo) logo.src = "/static/freedom_logo.svg";
    } else {
        html.classList.remove("light");
        html.classList.add("dark");
        if (icon) icon.textContent = "☀";
        if (label) label.textContent = "Светлая тема";
        if (logo) logo.src = "/static/freedom_logo_light.svg";
    }
    localStorage.setItem("cqa_theme", mode);
}

// 1. Вкладки навигации
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

// 2. Кнопки действий и тумблер служебных логов
function initActionButtons() {
    document.getElementById("btn-run-eval").addEventListener("click", () => {
        if (currentDialogueId) runEvaluation(currentDialogueId);
    });

    document.getElementById("btn-batch-eval").addEventListener("click", () => {
        closeDropdowns();
        runBatchEvaluation();
    });

    document.getElementById("btn-import-dev").addEventListener("click", () => {
        closeDropdowns();
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

    const headerAppealBtn = document.getElementById("btn-header-appeal");
    if (headerAppealBtn) {
        headerAppealBtn.addEventListener("click", () => {
            openAppealModal(null, null);
        });
    }

    const sysToggle = document.getElementById("toggle-system-msgs");
    if (sysToggle) {
        sysToggle.addEventListener("change", () => {
            showSystemMessages = sysToggle.checked;
            document.querySelectorAll(".msg-tech-item").forEach(el => {
                el.classList.toggle("hidden-tech-msg", !showSystemMessages);
            });
        });
    }
}

// 3. Сервисное меню и горячие клавиши
function initDropdownAndHotkeys() {
    const opsBtn = document.getElementById("btn-ops-menu");
    const opsMenu = document.getElementById("ops-dropdown");
    if (opsBtn && opsMenu) {
        opsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            opsMenu.classList.toggle("open");
        });
        document.addEventListener("click", () => {
            opsMenu.classList.remove("open");
        });
    }

    const cmdkBtn = document.getElementById("btn-cmdk");
    const cmdkInput = document.getElementById("cmdk-input");
    if (cmdkBtn) {
        cmdkBtn.addEventListener("click", () => {
            closeDropdowns();
            openCmdkModal();
        });
    }
    if (cmdkInput) {
        cmdkInput.addEventListener("input", () => renderCmdkResults(cmdkInput.value));
    }

    document.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            openCmdkModal();
            return;
        }
        if (e.key === "Escape") {
            ["cmdk-modal", "appeal-modal", "decision-modal", "criterion-modal"].forEach(closeModal);
            closeDropdowns();
        }
    });
}

function closeDropdowns() {
    const opsMenu = document.getElementById("ops-dropdown");
    if (opsMenu) opsMenu.classList.remove("open");
}

function openCmdkModal() {
    const modal = document.getElementById("cmdk-modal");
    const input = document.getElementById("cmdk-input");
    if (!modal || !input) return;
    modal.style.display = "flex";
    input.value = "";
    renderCmdkResults("");
    setTimeout(() => input.focus(), 20);
}

function renderCmdkResults(query) {
    const container = document.getElementById("cmdk-results");
    if (!container) return;
    const q = (query || "").trim().toLowerCase();
    container.innerHTML = "";

    const matches = allCachedDialogues
        .filter(d => !q || d.conversation_id.toLowerCase().includes(q) || d.language.toLowerCase().includes(q))
        .slice(0, 15);

    matches.forEach(d => {
        const div = document.createElement("div");
        div.className = "cmdk-item";
        const scoreStr = d.has_fatal_flaw ? "⚠️ ОШИБКА" : (d.total_score !== null ? `${Number(d.total_score).toFixed(0)}%` : "--");
        const chIcon = d.channel === "voice call" ? "🎙 Звонок" : "💬 Чат";
        div.innerHTML = `
            <span class="tabular-nums"><strong>${d.conversation_id}</strong> · ${d.language} · ${chIcon}</span>
            <span class="mono-hint tabular-nums">${scoreStr}</span>
        `;
        div.addEventListener("click", () => {
            document.querySelector('[data-tab="dialogues-tab"]')?.click();
            selectDialogue(d.conversation_id);
            closeModal("cmdk-modal");
        });
        container.appendChild(div);
    });
}

// 4. Простые фильтры в 1 клик (Все / Звонки / Чаты / Ошибки)
function initFilters() {
    const filterLang = document.getElementById("filter-lang");
    const filterChannel = document.getElementById("filter-channel");
    const filterStatus = document.getElementById("filter-status");
    const searchInput = document.getElementById("filter-search");

    filterLang.addEventListener("change", () => loadDialogues(true));

    document.querySelectorAll(".channel-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            const mode = pill.getAttribute("data-mode") || "all";
            applyQuickMode(mode);
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            renderDialoguesList(allCachedDialogues);
        });
    }

    document.getElementById("kpi-card-total")?.addEventListener("click", () => {
        document.querySelector('[data-tab="dialogues-tab"]')?.click();
        filterLang.value = "";
        if (searchInput) searchInput.value = "";
        applyQuickMode("all");
    });

    document.getElementById("kpi-card-evaluated")?.addEventListener("click", () => {
        document.querySelector('[data-tab="dialogues-tab"]')?.click();
        applyQuickMode("all");
    });

    document.getElementById("kpi-card-fatal")?.addEventListener("click", () => {
        document.querySelector('[data-tab="dialogues-tab"]')?.click();
        const isAlreadyFatal = filterStatus.value === "fatal";
        applyQuickMode(isAlreadyFatal ? "all" : "fatal");
    });

    document.getElementById("kpi-card-appeals")?.addEventListener("click", () => {
        document.querySelector('[data-tab="appeals-tab"]')?.click();
    });
}

function applyQuickMode(mode) {
    const filterChannel = document.getElementById("filter-channel");
    const filterStatus = document.getElementById("filter-status");

    document.querySelectorAll(".channel-pill").forEach(p => {
        p.classList.toggle("active", p.getAttribute("data-mode") === mode);
    });
    document.querySelectorAll(".kpi-item").forEach(el => el.classList.remove("active-filter"));

    if (mode === "voice") {
        filterChannel.value = "voice call";
        filterStatus.value = "";
        document.getElementById("kpi-card-total")?.classList.add("active-filter");
    } else if (mode === "chat") {
        filterChannel.value = "agent chat";
        filterStatus.value = "";
        document.getElementById("kpi-card-total")?.classList.add("active-filter");
    } else if (mode === "fatal") {
        filterChannel.value = "";
        filterStatus.value = "fatal";
        document.getElementById("kpi-card-fatal")?.classList.add("active-filter");
    } else {
        filterChannel.value = "";
        filterStatus.value = "";
        document.getElementById("kpi-card-total")?.classList.add("active-filter");
    }

    loadDialogues(true);
}

// 5. Загрузка статистики KPI
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

// 6. Загрузка списка диалогов
async function loadDialogues(autoSelectFirst = false) {
    const lang = document.getElementById("filter-lang").value;
    const channel = document.getElementById("filter-channel").value;
    const status = document.getElementById("filter-status").value;

    let url = "/api/dialogues?";
    if (lang) url += `language=${encodeURIComponent(lang)}&`;
    if (channel) url += `channel=${encodeURIComponent(channel)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;

    try {
        const res = await fetch(url);
        const dialogues = await res.json();

        // Звонки с реальной записью показываем сверху, чтобы специалист сразу их видел
        dialogues.sort((a, b) => {
            const aVoice = a.channel === "voice call" ? 0 : 1;
            const bVoice = b.channel === "voice call" ? 0 : 1;
            if (aVoice !== bVoice) return aVoice - bVoice;
            return a.conversation_id.localeCompare(b.conversation_id);
        });

        allCachedDialogues = dialogues;
        renderDialoguesList(dialogues);

        if ((!currentDialogueId || autoSelectFirst) && dialogues.length > 0) {
            selectDialogue(dialogues[0].conversation_id);
        }
    } catch (e) {
        console.error("Failed to load dialogues", e);
    }
}

function renderDialoguesList(dialogues) {
    const container = document.getElementById("dialogues-container");
    const searchInput = document.getElementById("filter-search");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const filtered = query
        ? dialogues.filter(d => d.conversation_id.toLowerCase().includes(query) || d.language.toLowerCase().includes(query))
        : dialogues;

    container.innerHTML = "";

    if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:12.5px;">Диалоги не найдены</div>`;
        return;
    }

    filtered.forEach(d => {
        const item = document.createElement("div");
        item.className = `dialogue-item ${currentDialogueId === d.conversation_id ? 'active' : ''}`;

        let scoreHtml = `<span class="diag-score tabular-nums">--</span>`;
        if (d.total_score !== null) {
            let scoreClass = d.total_score >= 80 ? "score-good" : (d.total_score >= 50 ? "score-mid" : "score-bad");
            if (d.has_fatal_flaw) {
                scoreHtml = `<span class="diag-score score-bad tabular-nums">⚠️ ОШИБКА · ${Number(d.total_score).toFixed(0)}%</span>`;
            } else {
                scoreHtml = `<span class="diag-score ${scoreClass} tabular-nums">${Number(d.total_score).toFixed(0)}%</span>`;
            }
        }

        const isVoice = d.channel === "voice call";
        const channelLabel = isVoice
            ? `<span class="voice-call-tag">🎙 Голосовой звонок (Аудио)</span>`
            : `💬 Текстовый чат`;

        item.innerHTML = `
            <div class="diag-id-cell">
                <div class="diag-title-row">
                    <span class="diag-title tabular-nums">${d.conversation_id}</span>
                    <span class="badge badge-${d.language.toLowerCase()}">${d.language}</span>
                </div>
                <div class="diag-channel-sub">${channelLabel}</div>
            </div>
            <div>${scoreHtml}</div>
        `;

        item.addEventListener("click", () => {
            selectDialogue(d.conversation_id);
        });

        container.appendChild(item);
    });
}

// 7. Выбор диалога и отрисовка чата в стиле Telegram
async function selectDialogue(cid) {
    currentDialogueId = cid;
    renderDialoguesList(allCachedDialogues);

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

function parseTimestampMs(ts) {
    if (!ts) return null;
    const d = Date.parse(ts);
    if (!isNaN(d)) return d;
    return null;
}

function formatSec(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function renderDialogueDetails(dialogue) {
    document.getElementById("current-dialogue-title").textContent = dialogue.conversation_id;
    document.getElementById("btn-run-eval").style.display = "inline-flex";

    const isVoice = dialogue.channel === "voice call" || Boolean(dialogue.audio_url);

    const badgesContainer = document.getElementById("current-dialogue-badges");
    badgesContainer.innerHTML = `
        <span class="badge badge-${dialogue.language.toLowerCase()}">${dialogue.language}</span>
        <span class="badge ${isVoice ? 'badge-call' : 'badge-chat'}">${isVoice ? '🎙 Звонок с аудиозаписью' : '💬 Чат поддержки'}</span>
    `;

    // Реальный MP3 аудиоплеер
    const audioContainer = document.getElementById("audio-player-container");
    const audioPlayer = document.getElementById("voice-audio-player");
    if (isVoice) {
        audioContainer.style.display = "flex";
        audioPlayer.src = `/api/audio/${encodeURIComponent(dialogue.conversation_id)}`;
    } else {
        audioContainer.style.display = "none";
        audioPlayer.pause();
        audioPlayer.src = "";
    }

    const transcriptBody = document.getElementById("transcript-body");
    transcriptBody.innerHTML = "";
    currentTranscriptOffsets = [];

    let firstMs = null;
    dialogue.transcript.forEach(msg => {
        const ms = parseTimestampMs(msg.timestamp);
        if (ms !== null && (firstMs === null || ms < firstMs)) {
            firstMs = ms;
        }
    });

    let techCount = 0;

    dialogue.transcript.forEach((msg, idx) => {
        const spk = msg.speaker;
        const isTech = spk === "system" || spk === "bot";
        if (isTech) techCount++;

        const row = document.createElement("div");
        const ms = parseTimestampMs(msg.timestamp);
        const offsetSec = (firstMs !== null && ms !== null) ? Math.max(0, (ms - firstMs) / 1000) : idx * 4;
        currentTranscriptOffsets.push({ idx, offsetSec, element: row, isTech });

        const hideClass = (isTech && !showSystemMessages) ? "hidden-tech-msg" : "";
        row.className = `msg-row msg-${spk} ${isTech ? 'msg-tech-item' : ''} ${hideClass} ${isVoice ? 'clickable-audio-row' : ''}`;
        row.id = `msg-line-${idx}`;
        row.setAttribute("data-ts", msg.timestamp || "");
        row.setAttribute("data-offset", String(offsetSec));
        row.setAttribute("data-text", msg.text || "");

        let speakerName = "👤 Клиент";
        if (spk === "operator") speakerName = "🎧 Оператор Freedom Broker";
        if (spk === "bot") speakerName = "🤖 Автоинформатор IVR";
        if (spk === "system") speakerName = "⚙️ Системное событие";

        const relTimeStr = isVoice ? formatSec(offsetSec) : (msg.timestamp || "");
        const rightBadge = isVoice
            ? `<span class="msg-seek-pill tabular-nums" title="Перемотать звонок на ${relTimeStr}">▶ ${relTimeStr}</span>`
            : `<span class="msg-time tabular-nums">${relTimeStr}</span>`;

        row.innerHTML = `
            <div class="msg-header">
                <span class="speaker-${spk}">${speakerName}</span>
                ${rightBadge}
            </div>
            <div class="msg-text">${msg.text}</div>
        `;

        if (isVoice) {
            row.addEventListener("click", () => {
                seekAudioToSecond(offsetSec, row);
            });
        }

        transcriptBody.appendChild(row);
    });

    const sysCountEl = document.getElementById("sys-msg-count");
    if (sysCountEl) sysCountEl.textContent = String(techCount);
}

// Перемотка реального звонка при клике на сообщение
function seekAudioToSecond(offsetSec, rowElement) {
    const audioPlayer = document.getElementById("voice-audio-player");
    if (!audioPlayer || !audioPlayer.src) return;

    document.querySelectorAll(".msg-row").forEach(r => r.classList.remove("playing-now"));
    if (rowElement) rowElement.classList.add("playing-now");

    const applySeek = () => {
        if (audioPlayer.duration && offsetSec < audioPlayer.duration) {
            audioPlayer.currentTime = offsetSec;
        } else {
            audioPlayer.currentTime = 0;
        }
        audioPlayer.play().catch(() => {});
    };

    if (audioPlayer.readyState >= 1) {
        applySeek();
    } else {
        audioPlayer.addEventListener("loadedmetadata", applySeek, { once: true });
        audioPlayer.load();
    }
}

function initAudioSyncListener() {
    const audioPlayer = document.getElementById("voice-audio-player");
    const timeInd = document.getElementById("audio-time-indicator");
    if (!audioPlayer) return;

    audioPlayer.addEventListener("timeupdate", () => {
        const cur = audioPlayer.currentTime || 0;
        if (timeInd) timeInd.textContent = formatSec(cur);

        let activeItem = null;
        for (let i = 0; i < currentTranscriptOffsets.length; i++) {
            const item = currentTranscriptOffsets[i];
            if (item.isTech && !showSystemMessages) continue;
            if (item.offsetSec <= cur + 0.5) {
                activeItem = item;
            } else {
                break;
            }
        }
        document.querySelectorAll(".msg-row.playing-now").forEach(el => el.classList.remove("playing-now"));
        if (activeItem && activeItem.element) {
            activeItem.element.classList.add("playing-now");
        }
    });
}

// 8. Отрисовка карточки оценки (8 критериев)
function renderScorecard(evalData) {
    const totalBadge = document.getElementById("scorecard-total-badge");
    const fatalAlert = document.getElementById("fatal-alert");
    const naNotice = document.getElementById("na-rebalance-notice");
    const headerAppealBtn = document.getElementById("btn-header-appeal");
    const container = document.getElementById("scorecard-body");

    container.innerHTML = "";

    if (!evalData) {
        totalBadge.textContent = "--%";
        fatalAlert.style.display = "none";
        naNotice.style.display = "none";
        if (headerAppealBtn) headerAppealBtn.style.display = "none";
        container.innerHTML = `<div class="empty-placeholder"><p>Нажмите «↻ Переоценить» для расчета баллов</p></div>`;
        return;
    }

    if (headerAppealBtn) headerAppealBtn.style.display = "inline-flex";

    const needsReview = evalData.criteria_results.some(c => c.needs_review);
    totalBadge.textContent = needsReview
        ? "На проверке"
        : (evalData.total_score === null ? "N/A" : `${Number(evalData.total_score).toFixed(1)}%`);

    if (evalData.has_fatal_flaw || evalData.total_score < 50) {
        totalBadge.className = "total-score-pill score-bad tabular-nums";
    } else if (evalData.total_score >= 80) {
        totalBadge.className = "total-score-pill score-good tabular-nums";
    } else {
        totalBadge.className = "total-score-pill score-mid tabular-nums";
    }

    fatalAlert.style.display = evalData.has_fatal_flaw ? "block" : "none";

    const hasNA = evalData.criteria_results.some(c => c.is_na);
    naNotice.style.display = hasNA ? "block" : "none";

    evalData.criteria_results.forEach((crit, index) => {
        const card = document.createElement("div");
        const isFatalTriggered = crit.is_fatal && crit.score === 1;
        card.className = `crit-card ${isFatalTriggered ? 'fatal-active' : ''}`;

        let scoreBadgeClass = crit.score === crit.max_points ? "score-good" : (crit.score > 0 ? "score-mid" : "score-bad");
        let scoreText = crit.is_fatal
            ? (crit.score === 1 ? "⚠️ Грубая ошибка" : "✓ Без нарушений")
            : `${crit.score} из ${crit.max_points} б.`;

        if (crit.is_fatal && crit.score === 0) scoreBadgeClass = "score-good";
        if (crit.is_fatal && crit.score === 1) scoreBadgeClass = "score-bad";

        if (crit.is_na) {
            scoreBadgeClass = "badge-chat";
            scoreText = "Неприменимо (N/A)";
        }

        let weightText = `Вес: ${crit.original_weight}%`;
        if (crit.is_na) {
            weightText += ` → Не учитывается (перераспределен)`;
        } else if (crit.effective_weight && crit.effective_weight !== crit.original_weight) {
            weightText += ` → С учетом N/A: ${crit.effective_weight}%`;
        }

        let quoteBtnHtml = "";
        if (crit.quote) {
            quoteBtnHtml = `
                <button class="crit-quote-btn" onclick="scrollToQuote('${encodeURIComponent(crit.quote)}', '${crit.timestamp || ""}')">
                    <span class="mono-hint">💬 Цитата:</span>
                    <span>«${crit.quote}»</span>
                </button>
            `;
        }

        card.innerHTML = `
            <div class="crit-header">
                <div>
                    <div class="crit-name">${index + 1}. ${crit.name}</div>
                    <div class="crit-weight-tag tabular-nums">${weightText}</div>
                </div>
                <span class="crit-score-badge ${scoreBadgeClass} tabular-nums">${scoreText}</span>
            </div>
            <div class="crit-explanation">${crit.is_na ? `<em>Причина N/A: ${crit.na_reason}</em>` : crit.explanation}</div>
            ${quoteBtnHtml}
            <div class="crit-actions">
                <button class="btn-appeal-inline" onclick="openAppealModal('${crit.criterion_id}', '${encodeURIComponent(crit.name)}')">Оспорить пункт →</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// 9. Переход к цитате в чате + перемотка звонка
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
        if (targetRow.classList.contains("hidden-tech-msg")) {
            targetRow.classList.remove("hidden-tech-msg");
        }
        targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
        targetRow.classList.add("msg-highlight");
        const offsetSec = parseFloat(targetRow.getAttribute("data-offset") || "0");
        if (currentDialogueData && currentDialogueData.channel === "voice call") {
            seekAudioToSecond(offsetSec, targetRow);
        }
        setTimeout(() => {
            targetRow.classList.remove("msg-highlight");
        }, 3500);
    }
};

// 10. Оценка и синхронизация
async function runEvaluation(cid) {
    const btn = document.getElementById("btn-run-eval");
    btn.disabled = true;
    btn.textContent = "Оценка...";

    try {
        await fetch(`/api/evaluate/${cid}`, { method: "POST" });
        await selectDialogue(cid);
        loadStats();
    } catch (e) {
        alert("Ошибка оценки диалога: " + e);
    } finally {
        btn.disabled = false;
        btn.textContent = "↻ Переоценить";
    }
}

async function runBatchEvaluation() {
    try {
        const res = await fetch("/api/evaluate_all", { method: "POST" });
        const data = await res.json();
        alert(`Проверено диалогов: ${data.evaluated_count}`);
        loadStats();
        loadDialogues();
        if (currentDialogueId) selectDialogue(currentDialogueId);
    } catch (e) {
        alert("Ошибка пакетной оценки: " + e);
    }
}

async function importDevData() {
    const url = prompt("Введите URL GET API DEV:", "https://example.com/api/get_dataset?group_id=DEV");
    if (!url) return;

    try {
        const res = await fetch("/api/fetch_organizers_data", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ api_url: url, group_id: "DEV" })
        });
        const data = await res.json();
        if (data.status === "success") {
            alert(`Загружено диалогов: ${data.imported_records}`);
            loadStats();
            loadDialogues();
        } else {
            alert("Статус: " + (data.message || "Использован локальный набор DEV"));
        }
    } catch (e) {
        alert("Ошибка запроса к API: " + e);
    }
}

// 11. Вкладка 2: Апелляции
window.openAppealModal = function(criterionId, encodedName) {
    if (!currentEvaluationData) return;

    const selectGroup = document.getElementById("appeal-criterion-select-group");
    const selectEl = document.getElementById("appeal-criterion-select");
    const titleEl = document.getElementById("appeal-criterion-name");

    if (criterionId && encodedName) {
        activeAppealCriterion = criterionId;
        titleEl.textContent = `Диалог ${currentDialogueId} · ${decodeURIComponent(encodedName)}`;
        if (selectGroup) selectGroup.style.display = "none";
    } else {
        titleEl.textContent = `Диалог: ${currentDialogueId}`;
        if (selectGroup && selectEl) {
            selectGroup.style.display = "block";
            selectEl.innerHTML = "";
            currentEvaluationData.criteria_results.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.criterion_id;
                opt.textContent = `${c.name} (сейчас: ${c.score}/${c.max_points})`;
                selectEl.appendChild(opt);
            });
            activeAppealCriterion = selectEl.value;
            selectEl.onchange = () => { activeAppealCriterion = selectEl.value; };
        }
    }

    document.getElementById("appeal-comment").value = "";
    document.getElementById("appeal-modal").style.display = "flex";
};

async function submitAppeal() {
    const comment = document.getElementById("appeal-comment").value.trim();
    if (!comment) {
        alert("Укажите комментарий оператора.");
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
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Активных апелляций нет</td></tr>`;
            return;
        }

        appeals.forEach(a => {
            const tr = document.createElement("tr");
            let statusBadge = `<span class="diag-score score-mid">Ожидает решения</span>`;
            let actionHtml = `<button class="btn btn-primary btn-sm" onclick="openDecisionModal('${a.id}', '${a.conversation_id}', '${encodeURIComponent(a.criterion_name || a.criterion_id)}', '${encodeURIComponent(a.operator_comment)}', ${a.original_score})">Рассмотреть</button>`;

            if (a.status === "accepted") {
                statusBadge = `<span class="diag-score score-good tabular-nums">Принята (${a.new_score} б.)</span>`;
                actionHtml = `<span class="mono-hint">${a.supervisor_comment || 'Пересчитано'}</span>`;
            } else if (a.status === "rejected") {
                statusBadge = `<span class="diag-score score-bad">Отклонена</span>`;
                actionHtml = `<span class="mono-hint">${a.supervisor_comment || 'Отказано'}</span>`;
            }

            tr.innerHTML = `
                <td class="tabular-nums"><strong>${a.conversation_id}</strong></td>
                <td>${a.criterion_name || a.criterion_id}</td>
                <td class="tabular-nums">${a.original_score} б.</td>
                <td>«${a.operator_comment}»</td>
                <td>${statusBadge}</td>
                <td style="text-align:right;">${actionHtml}</td>
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
    document.getElementById("review-new-score").value = (origScore === 5 ? 15 : 1);
    document.getElementById("review-comment").value = "Аргументация оператора подтверждена по тексту переписки, оценка пересмотрена.";
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
        loadStats();
        loadAppeals();
        loadDialogues();
        if (currentDialogueId) selectDialogue(currentDialogueId);
    } catch (e) {
        alert("Ошибка сохранения решения: " + e);
    }
}

// 12. Вкладка 3: Редактор критериев
async function loadCriteria() {
    try {
        const res = await fetch("/api/criteria");
        const criteria = await res.json();
        const container = document.getElementById("criteria-editor-list");
        container.innerHTML = "";

        criteria.forEach((c, idx) => {
            const card = document.createElement("div");
            card.className = "criteria-edit-card";
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div style="font-weight:600;font-size:13px;color:var(--text-primary);">${idx + 1}. ${c.name}</div>
                    <span class="badge badge-kz tabular-nums">Вес ${c.weight}%</span>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);line-height:1.45;">${c.description}</div>
                <div class="tabular-nums" style="font-size:11px;display:flex;gap:10px;margin-top:4px;color:var(--text-muted);font-family:var(--font-mono);">
                    <span>Макс. балл: <strong style="color:var(--text-primary);">${c.max_points}</strong></span>
                    <span>N/A: <strong style="color:var(--text-primary);">${c.allow_na ? 'Разрешен' : 'Нет'}</strong></span>
                    ${c.is_fatal ? '<span style="color:var(--status-fatal-text);font-weight:600;">Грубая ошибка</span>' : ''}
                </div>
                <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px;">
                    <button class="btn btn-secondary btn-sm" onclick="editCriterion('${c.id}', '${encodeURIComponent(c.name)}', '${encodeURIComponent(c.description)}', ${c.weight}, '${c.scale_type}', ${c.allow_na}, ${c.is_fatal})">Изменить</button>
                    <button class="btn btn-secondary btn-sm" style="color:var(--status-fatal-text);" onclick="deleteCriterion('${c.id}')">Удалить</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Failed to load criteria", e);
    }
}

window.openCriterionModal = function() {
    document.getElementById("crit-modal-title").textContent = "Новый критерий";
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
    document.getElementById("crit-modal-title").textContent = "Настройка критерия";
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
        alert("Укажите название критерия.");
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
        loadCriteria();
    } catch (e) {
        alert("Ошибка сохранения критерия: " + e);
    }
}

window.deleteCriterion = async function(id) {
    if (!confirm("Удалить этот критерий?")) return;
    try {
        await fetch(`/api/criteria/${id}`, { method: "DELETE" });
        loadCriteria();
    } catch (e) {
        alert("Ошибка удаления критерия: " + e);
    }
};

window.closeModal = function(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = "none";
};
