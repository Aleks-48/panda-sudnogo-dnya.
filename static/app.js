// ==========================================================================
// FREEDOM BROKER CQA v2.0 — FRONTEND CONTROLLER
// Real Audio Sync + Speech Synthesis + Dark/Light Theme + Step-by-Step UX
// ==========================================================================

let currentDialogueId = null;
let currentDialogueData = null;
let currentEvaluationData = null;
let activeAppealCriterion = null;
let allCachedDialogues = [];
let currentTranscriptOffsets = [];

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

// 0. Theme Switcher (Dark Latverian Titanium <-> Light Executive Daylight)
function initTheme() {
    const saved = localStorage.getItem("cqa_theme") || "dark";
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
        if (label) label.textContent = "Темная";
        if (logo) logo.src = "/static/freedom_logo.svg";
    } else {
        html.classList.remove("light");
        html.classList.add("dark");
        if (icon) icon.textContent = "☀";
        if (label) label.textContent = "Светлая";
        if (logo) logo.src = "/static/freedom_logo_light.svg";
    }
    localStorage.setItem("cqa_theme", mode);
}

// 1. Tab Navigation & Keyboard Shortcuts (1, 2, 3)
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

// 2. Action Buttons & Unified Appeal Trigger
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

    const speakBtn = document.getElementById("btn-speak-selection");
    if (speakBtn) {
        speakBtn.addEventListener("click", () => {
            speakCurrentDialogueExcerpt();
        });
    }
}

// 3. System Dropdown & Cmd+K Command Palette
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
        cmdkBtn.addEventListener("click", openCmdkModal);
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
            if ("speechSynthesis" in window) window.speechSynthesis.cancel();
            return;
        }
        const tag = (document.activeElement && document.activeElement.tagName) || "";
        if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
            if (e.key === "1") document.querySelector('[data-tab="dialogues-tab"]')?.click();
            if (e.key === "2") document.querySelector('[data-tab="appeals-tab"]')?.click();
            if (e.key === "3") document.querySelector('[data-tab="checklist-tab"]')?.click();
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

    const quickCommands = [
        { label: "🎙 Показать только Звонки с реальной аудиозаписью (5)", hint: "Аудио MP3", action: () => { setChannelQuickFilter("voice call"); closeModal("cmdk-modal"); } },
        { label: "⚠️ Фильтр: Показать только фатальные ошибки (FATAL)", hint: "Критерий №8", action: () => { setKpiFilter("fatal"); closeModal("cmdk-modal"); } },
        { label: "☀/☾ Переключить тему (Темная / Светлая)", hint: "Тема UI", action: () => { document.getElementById("btn-theme-toggle")?.click(); closeModal("cmdk-modal"); } },
        { label: "Сбросить все фильтры диалогов", hint: "Все 65", action: () => { setChannelQuickFilter(""); setKpiFilter(""); closeModal("cmdk-modal"); } }
    ];

    quickCommands.filter(c => !q || c.label.toLowerCase().includes(q)).forEach(cmd => {
        const div = document.createElement("div");
        div.className = "cmdk-item";
        div.innerHTML = `<span>${cmd.label}</span><span class="mono-hint">${cmd.hint}</span>`;
        div.addEventListener("click", cmd.action);
        container.appendChild(div);
    });

    const matches = allCachedDialogues
        .filter(d => !q || d.conversation_id.toLowerCase().includes(q) || d.language.toLowerCase().includes(q) || d.channel.toLowerCase().includes(q))
        .slice(0, 12);

    matches.forEach(d => {
        const div = document.createElement("div");
        div.className = "cmdk-item";
        const scoreStr = d.has_fatal_flaw ? "FATAL" : (d.total_score !== null ? `${Number(d.total_score).toFixed(1)}%` : "--");
        const chIcon = d.channel === "voice call" ? "🎙 Звонок (MP3)" : "💬 Чат";
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

// 4. Filters, Channel Quick Pills & Interactive Tremor KPI Cards
function initFilters() {
    const filterLang = document.getElementById("filter-lang");
    const filterChannel = document.getElementById("filter-channel");
    const filterStatus = document.getElementById("filter-status");

    filterLang.addEventListener("change", loadDialogues);
    filterChannel.addEventListener("change", () => {
        syncChannelPills(filterChannel.value);
        loadDialogues();
    });

    if (filterStatus) filterStatus.addEventListener("change", () => {
        syncKpiActiveCards(filterStatus.value);
        loadDialogues();
    });

    // Quick Channel Segmented Pills (Все / Звонки с аудио / Чаты)
    document.querySelectorAll(".channel-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            const ch = pill.getAttribute("data-channel") || "";
            setChannelQuickFilter(ch);
        });
    });

    const searchInput = document.getElementById("filter-search");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            renderDialoguesList(allCachedDialogues);
        });
    }

    const kpiFatal = document.getElementById("kpi-card-fatal");
    if (kpiFatal) {
        kpiFatal.addEventListener("click", () => {
            document.querySelector('[data-tab="dialogues-tab"]')?.click();
            const nextVal = filterStatus && filterStatus.value === "fatal" ? "" : "fatal";
            setKpiFilter(nextVal);
        });
    }

    const kpiEval = document.getElementById("kpi-card-evaluated");
    if (kpiEval) {
        kpiEval.addEventListener("click", () => {
            document.querySelector('[data-tab="dialogues-tab"]')?.click();
            const nextVal = filterStatus && filterStatus.value === "evaluated" ? "" : "evaluated";
            setKpiFilter(nextVal);
        });
    }

    const kpiTotal = document.getElementById("kpi-card-total");
    if (kpiTotal) {
        kpiTotal.addEventListener("click", () => {
            document.querySelector('[data-tab="dialogues-tab"]')?.click();
            filterLang.value = "";
            filterChannel.value = "";
            syncChannelPills("");
            if (searchInput) searchInput.value = "";
            setKpiFilter("");
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

function setChannelQuickFilter(channelVal) {
    const filterChannel = document.getElementById("filter-channel");
    if (filterChannel) filterChannel.value = channelVal;
    syncChannelPills(channelVal);
    loadDialogues(true);
}

function syncChannelPills(channelVal) {
    document.querySelectorAll(".channel-pill").forEach(pill => {
        const val = pill.getAttribute("data-channel") || "";
        pill.classList.toggle("active", val === channelVal);
    });
}

function setKpiFilter(statusValue) {
    const filterStatus = document.getElementById("filter-status");
    if (filterStatus) filterStatus.value = statusValue;
    syncKpiActiveCards(statusValue);
    loadDialogues();
}

function syncKpiActiveCards(statusValue) {
    document.querySelectorAll(".kpi-item").forEach(el => el.classList.remove("active-filter"));
    if (statusValue === "fatal") {
        document.getElementById("kpi-card-fatal")?.classList.add("active-filter");
    } else if (statusValue === "evaluated") {
        document.getElementById("kpi-card-evaluated")?.classList.add("active-filter");
    } else {
        document.getElementById("kpi-card-total")?.classList.add("active-filter");
    }
}

// 5. Load KPI Stats
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

// 6. Load & Render High-Density Dialogue Table (Voice Calls Prioritized First!)
async function loadDialogues(autoSelectFirst = false) {
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

        // Sort so voice calls with real audio appear at the very top when viewing all
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

    const countBadge = document.getElementById("visible-count-badge");
    if (countBadge) countBadge.textContent = `${filtered.length} зап.`;

    container.innerHTML = "";

    if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">Диалоги по фильтру не найдены</div>`;
        return;
    }

    filtered.forEach(d => {
        const item = document.createElement("div");
        item.className = `dialogue-item ${currentDialogueId === d.conversation_id ? 'active' : ''}`;

        let scoreHtml = `<span class="diag-score tabular-nums">N/A</span>`;
        if (d.total_score !== null) {
            let scoreClass = d.total_score >= 80 ? "score-good" : (d.total_score >= 50 ? "score-mid" : "score-bad");
            if (d.has_fatal_flaw) {
                scoreHtml = `<span class="diag-score score-bad tabular-nums">FATAL · ${Number(d.total_score).toFixed(0)}%</span>`;
            } else {
                scoreHtml = `<span class="diag-score ${scoreClass} tabular-nums">${Number(d.total_score).toFixed(1)}%</span>`;
            }
        }

        const isVoice = d.channel === "voice call";
        const channelLabel = isVoice
            ? `<span class="voice-call-tag">🎙 Звонок · Реальное аудио</span>`
            : `💬 Чат поддержки`;

        item.innerHTML = `
            <div class="diag-id-cell">
                <div class="diag-title tabular-nums">${d.conversation_id}</div>
                <div class="diag-channel-sub">${channelLabel}</div>
            </div>
            <div class="diag-lang-cell">
                <span class="badge badge-${d.language.toLowerCase()}">${d.language}</span>
            </div>
            <div class="diag-score-cell">
                ${scoreHtml}
            </div>
        `;

        item.addEventListener("click", () => {
            selectDialogue(d.conversation_id);
        });

        container.appendChild(item);
    });
}

// 7. Select Single Dialogue & Render Split-Screen Inspector with Audio Sync
async function selectDialogue(cid) {
    currentDialogueId = cid;
    renderDialoguesList(allCachedDialogues);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

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
    const speakBtn = document.getElementById("btn-speak-selection");
    if (speakBtn) {
        speakBtn.style.display = isVoice ? "none" : "inline-flex";
    }

    const badgesContainer = document.getElementById("current-dialogue-badges");
    badgesContainer.innerHTML = `
        <span class="badge badge-${dialogue.language.toLowerCase()}">${dialogue.language}</span>
        <span class="badge ${isVoice ? 'badge-call' : 'badge-chat'}">${isVoice ? '🎙 Голосовой звонок (MP3)' : '💬 Чат'}</span>
    `;

    // Real MP3 Audio player via our backend proxy /api/audio/{cid}
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

    // Calculate relative audio offset (in seconds) for each transcript message
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

    dialogue.transcript.forEach((msg, idx) => {
        const row = document.createElement("div");
        const ms = parseTimestampMs(msg.timestamp);
        const offsetSec = (firstMs !== null && ms !== null) ? Math.max(0, (ms - firstMs) / 1000) : idx * 4;
        currentTranscriptOffsets.push({ idx, offsetSec, element: row });

        row.className = `msg-row msg-${msg.speaker} ${isVoice ? 'clickable-audio-row' : ''}`;
        row.id = `msg-line-${idx}`;
        row.setAttribute("data-ts", msg.timestamp || "");
        row.setAttribute("data-offset", String(offsetSec));
        row.setAttribute("data-text", msg.text || "");

        let speakerName = "Клиент";
        if (msg.speaker === "operator") speakerName = "Оператор Freedom Broker";
        if (msg.speaker === "bot") speakerName = "Автоинформатор IVR";
        if (msg.speaker === "system") speakerName = "Система";

        const lineNum = String(idx + 1).padStart(2, "0");
        const relTimeStr = formatSec(offsetSec);

        const rightControlHtml = isVoice
            ? `<span class="msg-seek-pill tabular-nums" title="Кликните, чтобы перемотать реальную запись на ${relTimeStr}">▶ ${relTimeStr}</span>`
            : `<button type="button" class="msg-tts-btn" onclick="speakSingleLine(event, '${encodeURIComponent(msg.text)}', '${dialogue.language}')" title="Озвучить эту реплику">🔊</button>`;

        row.innerHTML = `
            <div class="msg-header">
                <div class="msg-header-left">
                    <span class="msg-index tabular-nums">#${lineNum}</span>
                    <span class="speaker-${msg.speaker}">${speakerName}</span>
                </div>
                <div class="msg-header-right">
                    ${rightControlHtml}
                </div>
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
}

// Sync Audio Player with Transcript Rows
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

        // Highlight active transcript line matching current audio second
        let activeItem = null;
        for (let i = 0; i < currentTranscriptOffsets.length; i++) {
            if (currentTranscriptOffsets[i].offsetSec <= cur + 0.5) {
                activeItem = currentTranscriptOffsets[i];
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

// Web Speech Synthesis for Chat Dialogues (when user wants text spoken aloud)
window.speakSingleLine = function(e, encodedText, lang) {
    e.stopPropagation();
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(decodeURIComponent(encodedText));
    utter.lang = lang === "EN" ? "en-US" : (lang === "KZ" ? "kk-KZ" : "ru-RU");
    utter.rate = 1.05;
    window.speechSynthesis.speak(utter);
};

function speakCurrentDialogueExcerpt() {
    if (!currentDialogueData || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        return;
    }
    const text = currentDialogueData.transcript
        .filter(m => m.speaker !== "system")
        .slice(0, 6)
        .map(m => m.text)
        .join(". ");
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = currentDialogueData.language === "EN" ? "en-US" : "ru-RU";
    window.speechSynthesis.speak(utter);
}

// 8. Render 8-Criteria Scorecard
function renderScorecard(evalData) {
    const totalBadge = document.getElementById("scorecard-total-badge");
    const fatalAlert = document.getElementById("fatal-alert");
    const naNotice = document.getElementById("na-rebalance-notice");
    const headerAppealBtn = document.getElementById("btn-header-appeal");
    const container = document.getElementById("scorecard-body");

    container.innerHTML = "";

    if (!evalData) {
        totalBadge.textContent = "--%";
        totalBadge.style.borderColor = "var(--border-subtle)";
        totalBadge.style.color = "var(--text-secondary)";
        fatalAlert.style.display = "none";
        naNotice.style.display = "none";
        if (headerAppealBtn) headerAppealBtn.style.display = "none";
        container.innerHTML = `
            <div class="empty-placeholder">
                <div class="placeholder-eyebrow">ОЖИДАЕТ ОЦЕНКИ</div>
                <p>Нажмите <strong>«↻ Переоценить»</strong> в заголовке стенограммы для расчета баллов.</p>
            </div>
        `;
        return;
    }

    if (headerAppealBtn) headerAppealBtn.style.display = "inline-flex";

    const needsReview = evalData.criteria_results.some(c => c.needs_review);
    totalBadge.textContent = needsReview
        ? "ПРОВЕРКА"
        : (evalData.total_score === null ? "N/A" : `${Number(evalData.total_score).toFixed(2)}%`);

    if (evalData.has_fatal_flaw || evalData.total_score < 50) {
        totalBadge.style.borderColor = "var(--status-fatal-border)";
        totalBadge.style.color = "var(--status-fatal-text)";
    } else if (evalData.total_score >= 80) {
        totalBadge.style.borderColor = "var(--border-emerald)";
        totalBadge.style.color = "var(--status-success-text)";
    } else {
        totalBadge.style.borderColor = "var(--status-warning-border)";
        totalBadge.style.color = "var(--status-warning-text)";
    }

    fatalAlert.style.display = evalData.has_fatal_flaw ? "block" : "none";

    const hasNA = evalData.criteria_results.some(c => c.is_na);
    naNotice.style.display = hasNA ? "block" : "none";

    evalData.criteria_results.forEach(crit => {
        const card = document.createElement("div");
        const isFatalTriggered = crit.is_fatal && crit.score === 1;
        card.className = `crit-card ${isFatalTriggered ? 'fatal-active' : ''} ${crit.is_na ? 'na-active' : ''}`;

        let scoreBadgeClass = crit.score === crit.max_points ? "score-good" : (crit.score > 0 ? "score-mid" : "score-bad");
        let scoreText = crit.is_fatal ? (crit.score === 1 ? "FATAL · ДА" : "0 · НЕТ") : `${crit.score} / ${crit.max_points}`;

        if (crit.is_fatal && crit.score === 0) {
            scoreBadgeClass = "score-good";
        } else if (crit.is_fatal && crit.score === 1) {
            scoreBadgeClass = "score-bad";
        }

        if (crit.is_na) {
            scoreBadgeClass = "badge-chat";
            scoreText = "N/A";
        }

        if (crit.needs_review) scoreText = "ПРОВЕРКА";

        let weightText = `Вес: ${crit.original_weight}%`;
        if (crit.is_na) {
            weightText += ` → N/A (перераспределен)`;
        } else if (crit.effective_weight && crit.effective_weight !== crit.original_weight) {
            weightText += ` → Эфф. вес: ${crit.effective_weight}%`;
        }

        let quoteBtnHtml = "";
        if (crit.quote) {
            quoteBtnHtml = `
                <button class="crit-quote-btn" onclick="scrollToQuote('${encodeURIComponent(crit.quote)}', '${crit.timestamp || ""}')">
                    <span class="mono-hint">ЦИТАТА:</span>
                    <span>«${crit.quote}»</span>
                </button>
            `;
        }

        card.innerHTML = `
            <div class="crit-header">
                <div>
                    <div class="crit-name">${crit.name}</div>
                    <div class="crit-weight-tag tabular-nums">${weightText}</div>
                </div>
                <span class="crit-score-badge ${scoreBadgeClass} tabular-nums">${scoreText}</span>
            </div>
            <div class="crit-explanation">${crit.is_na ? `<em>Неприменимо (N/A): ${crit.na_reason}</em>` : crit.explanation}</div>
            ${quoteBtnHtml}
            <div class="crit-actions">
                <button class="btn-appeal-inline" onclick="openAppealModal('${crit.criterion_id}', '${encodeURIComponent(crit.name)}')">Оспорить пункт →</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// 9. Scroll & Highlight Verbatim Quote in Transcript (+ Auto-Seek Audio if Voice Call!)
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

// 10. Evaluation Actions
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
        alert(`Пакетная проверка завершена. Оценено диалогов: ${data.evaluated_count}`);
        loadStats();
        loadDialogues();
        if (currentDialogueId) selectDialogue(currentDialogueId);
    } catch (e) {
        alert("Ошибка пакетной оценки: " + e);
    }
}

async function importDevData() {
    const url = prompt("Введите URL GET API DEV или оставьте по умолчанию для локальной синхронизации:", "https://example.com/api/get_dataset?group_id=DEV");
    if (!url) return;

    try {
        const res = await fetch("/api/fetch_organizers_data", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ api_url: url, group_id: "DEV" })
        });
        const data = await res.json();
        if (data.status === "success") {
            alert(`Синхронизировано записей: ${data.imported_records}`);
            loadStats();
            loadDialogues();
        } else {
            alert("Статус: " + (data.message || "Использован локальный набор DEV"));
        }
    } catch (e) {
        alert("Ошибка запроса к API: " + e);
    }
}

// 11. TAB 2: APPEALS WORKFLOW
window.openAppealModal = function(criterionId, encodedName) {
    if (!currentEvaluationData) {
        alert("Сначала выберите оцененный диалог.");
        return;
    }

    const selectGroup = document.getElementById("appeal-criterion-select-group");
    const selectEl = document.getElementById("appeal-criterion-select");
    const titleEl = document.getElementById("appeal-criterion-name");

    if (criterionId && encodedName) {
        activeAppealCriterion = criterionId;
        titleEl.style.display = "block";
        titleEl.textContent = `Диалог ${currentDialogueId} · ${decodeURIComponent(encodedName)}`;
        if (selectGroup) selectGroup.style.display = "none";
    } else {
        titleEl.style.display = "block";
        titleEl.textContent = `Диалог: ${currentDialogueId}`;
        if (selectGroup && selectEl) {
            selectGroup.style.display = "block";
            selectEl.innerHTML = "";
            currentEvaluationData.criteria_results.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.criterion_id;
                opt.textContent = `${c.name} (текущий балл: ${c.score}/${c.max_points})`;
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
        alert("Укажите аргументацию оператора для подачи апелляции.");
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
            let statusBadge = `<span class="diag-score score-mid">На рассмотрении</span>`;
            let actionHtml = `<button class="btn btn-primary btn-sm" onclick="openDecisionModal('${a.id}', '${a.conversation_id}', '${encodeURIComponent(a.criterion_name || a.criterion_id)}', '${encodeURIComponent(a.operator_comment)}', ${a.original_score})">Рассмотреть</button>`;

            if (a.status === "accepted") {
                statusBadge = `<span class="diag-score score-good tabular-nums">Удовлетворена (${a.new_score} б.)</span>`;
                actionHtml = `<span class="mono-hint">${a.supervisor_comment || 'Пересчитано'}</span>`;
            } else if (a.status === "rejected") {
                statusBadge = `<span class="diag-score score-bad">Отклонена</span>`;
                actionHtml = `<span class="mono-hint">${a.supervisor_comment || 'Отказано'}</span>`;
            }

            tr.innerHTML = `
                <td class="tabular-nums"><strong>${a.conversation_id}</strong></td>
                <td>${a.criterion_name || a.criterion_id}</td>
                <td class="tabular-nums">${a.original_score}</td>
                <td><em>«${a.operator_comment}»</em></td>
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
    document.getElementById("review-new-score").value = (origScore === 0 ? 1 : origScore + 1);
    document.getElementById("review-comment").value = "Аргументация оператора подтверждена по стенограмме, балл пересмотрен.";
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

// 12. TAB 3: CHECKLIST MATRIX BUILDER
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
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div style="font-weight:600;font-size:13px;color:var(--text-primary);">${c.name}</div>
                    <span class="badge badge-kz tabular-nums">Вес ${c.weight}%</span>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);line-height:1.45;">${c.description}</div>
                <div class="tabular-nums" style="font-size:11px;display:flex;gap:10px;margin-top:4px;color:var(--text-muted);font-family:var(--font-mono);">
                    <span>Шкала: <strong style="color:var(--text-primary);">${c.scale_type} (max ${c.max_points})</strong></span>
                    <span>N/A: <strong style="color:var(--text-primary);">${c.allow_na ? 'Да' : 'Нет'}</strong></span>
                    ${c.is_fatal ? '<span style="color:var(--status-fatal-text);font-weight:600;">FATAL FLAG</span>' : ''}
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
    document.getElementById("crit-modal-title").textContent = "Новый критерий регламента";
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
    if (!confirm("Удалить этот критерий из матрицы регламента?")) return;
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
