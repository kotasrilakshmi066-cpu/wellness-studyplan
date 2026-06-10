// ==========================================================================
// 30-Day Wellness & Study Plan - Application Logic
// ==========================================================================

// CONSTANTS & CONFIGURATION
const STORAGE_KEY = "wellness_study_planner_state";
const TOTAL_DAYS = 30;

// Daily habits list definition
const DAILY_HABITS = [
    { id: "study_ml", text: "💻 Study ML & Math (4 hours)", category: "study" },
    { id: "study_ai", text: "🤖 Study Deep Learning & AI (3 hours)", category: "study" },
    { id: "study_compiler", text: "🖥️ Study Compiler Design (2 hours)", category: "study" },
    { id: "study_dsa", text: "💡 DSA Practice - LeetCode/StriverSheet (3 hours)", category: "study" },
    { id: "fit_cardio", text: "🏃 Cardio Workout (45 min)", category: "fitness" },
    { id: "fit_strength", text: "💪 Strength Work (1.5h - Mon/Wed/Fri focus)", category: "fitness" },
    { id: "fit_yoga", text: "🧘 Yoga Flow for Circulation & Stress (45 min)", category: "fitness" },
    { id: "hair_scalp", text: "💆 Scalp Massage + Neck Poses (10 min)", category: "hair" },
    { id: "health_water", text: "💧 Log 3.5 Liters of Water", category: "health" },
    { id: "health_sleep", text: "💤 Sleep Hygiene (7-8 hours, 10 PM Bed)", category: "health" },
    { id: "health_nutrition", text: "🥗 Balanced Diet & Deficit (1500-1800 cal)", category: "health" }
];

// Default clean state
const defaultState = {
    completedGlobalTasks: {}, // Syllabus tasks: { "task_ml_1": true, ... }
    daysAdherence: {},        // Daily plan checklist: { "1": ["study_ml", "fit_cardio"], ... }
    weightLogs: [
        { week: 0, weight: 72.0 }
    ],
    hydration: {
        amount: 0,
        date: "" // Date string: YYYY-MM-DD
    },
    cycleTracker: {
        lastPeriodDate: "",
        cycleLength: 28
    },
    settings: {
        studyTarget: 12,
        waterTarget: 3500,
        startWeight: 72.0,
        targetWeight: 69.0
    },
    activeDay: 1,
    completedPomodoros: 0,
    theme: "light"
};

// Main state variable
let state = {};

// Pomodoro Timer state variables
let pomodoroTimer = null;
let timerSecondsRemaining = 3000; // 50 mins in seconds
let timerTotalSeconds = 3000;
let isTimerRunning = false;
let currentTimerMode = "work"; // "work" or "break"
let isSoundEnabled = true;

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Load app state
    loadState();
    
    // Initialize theme
    applyTheme();

    // Render components
    renderTabs();
    renderCalendarGrid();
    renderDailyChecklist();
    renderWeightChart();
    renderWeightHistory();
    renderCycleCalculations();
    
    // Bind Event Listeners
    setupEventListeners();
    
    // Start interval to monitor day transitions for hydration resetting
    checkHydrationDateReset();
    setInterval(checkHydrationDateReset, 60000); // Check every minute
    
    // Initialize icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

// Load state from localStorage or load default
function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            state = JSON.parse(saved);
            // Ensure compatibility with defaultState keys
            state = { ...defaultState, ...state };
            state.settings = { ...defaultState.settings, ...state.settings };
            state.cycleTracker = { ...defaultState.cycleTracker, ...state.cycleTracker };
        } catch (e) {
            console.error("Failed to parse saved state, loading default.", e);
            state = JSON.parse(JSON.stringify(defaultState));
        }
    } else {
        state = JSON.parse(JSON.stringify(defaultState));
    }
    
    // Make sure date for hydration is set to today if empty
    const todayStr = getTodayDateString();
    if (!state.hydration.date) {
        state.hydration.date = todayStr;
        state.hydration.amount = 0;
    }
}

// Save state to localStorage
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateGlobalMetrics();
}

// Get YYYY-MM-DD local date string
function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Reset hydration daily
function checkHydrationDateReset() {
    const todayStr = getTodayDateString();
    if (state.hydration.date !== todayStr) {
        state.hydration.date = todayStr;
        state.hydration.amount = 0;
        
        // Reset daily nutrition checklist logs too
        const nutritionChecks = ["nutr_breakfast", "nutr_snack1", "nutr_snack2", "nutr_lunch", "nutr_dinner"];
        nutritionChecks.forEach(id => {
            state.completedGlobalTasks[id] = false;
            const el = document.getElementById(id);
            if (el) el.checked = false;
        });
        
        saveState();
        updateWaterUI();
    }
}

// ==========================================================================
// TAB ROUTING & NAVIGATION
// ==========================================================================

function setupEventListeners() {
    // Tab switching
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            switchTab(tabId);
        });
    });

    // Theme toggler
    document.getElementById("themeToggle").addEventListener("click", toggleTheme);

    // Syllabus checkboxes change
    const syllabusChecklists = document.querySelectorAll(".checklist[data-category]");
    syllabusChecklists.forEach(list => {
        list.addEventListener("change", (e) => {
            if (e.target.type === "checkbox") {
                state.completedGlobalTasks[e.target.id] = e.target.checked;
                saveState();
            }
        });
    });

    // Daily nutrition checklist change
    const nutritionList = document.getElementById("nutritionChecklist");
    if (nutritionList) {
        nutritionList.addEventListener("change", (e) => {
            if (e.target.type === "checkbox") {
                state.completedGlobalTasks[e.target.id] = e.target.checked;
                saveState();
            }
        });
    }

    // Pomodoro controls
    document.getElementById("timerToggleBtn").addEventListener("click", toggleTimer);
    document.getElementById("timerResetBtn").addEventListener("click", resetTimer);
    document.getElementById("modeWork").addEventListener("click", () => setTimerMode("work"));
    document.getElementById("modeBreak").addEventListener("click", () => setTimerMode("break"));
    
    // Pomodoro Sound toggle
    const soundBtn = document.getElementById("timerSoundToggle");
    soundBtn.addEventListener("click", () => {
        isSoundEnabled = !isSoundEnabled;
        soundBtn.classList.toggle("active", isSoundEnabled);
        soundBtn.innerHTML = isSoundEnabled ? '<i data-lucide="volume-2"></i>' : '<i data-lucide="volume-x"></i>';
        if (window.lucide) window.lucide.createIcons();
    });

    // Log Weight button
    document.getElementById("logWeightBtn").addEventListener("click", logWeight);

    // Save Settings button
    document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
    document.getElementById("resetDataBtn").addEventListener("click", resetAllData);
    document.getElementById("loadMockDataBtn").addEventListener("click", loadMockProgressData);

    // Save cycle button
    document.getElementById("saveCycleBtn").addEventListener("click", saveCycleData);
}

// Switch between panels
function switchTab(tabId) {
    const panels = document.querySelectorAll(".panel");
    const tabButtons = document.querySelectorAll(".tab-btn");

    panels.forEach(panel => panel.classList.remove("active"));
    tabButtons.forEach(btn => {
        btn.classList.remove("active");
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        }
    });

    const activePanel = document.getElementById(tabId);
    if (activePanel) {
        activePanel.classList.add("active");
    }
}

// Make globally accessible
window.switchTab = switchTab;

// ==========================================================================
// THEME SWITCHER
// ==========================================================================

function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
    saveState();
}

function applyTheme() {
    const body = document.documentElement;
    body.setAttribute("data-theme", state.theme);
}

// ==========================================================================
// STATE PRESENTATION & UPDATES
// ==========================================================================

// Hydrate checkboxes on screen from saved state
function renderTabs() {
    // Populate check state of all global checkboxes
    for (const [id, checked] of Object.entries(state.completedGlobalTasks)) {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = checked;
        }
    }
    
    // Hydrate Settings Inputs
    document.getElementById("setStudyTarget").value = state.settings.studyTarget;
    document.getElementById("setWaterTarget").value = state.settings.waterTarget;
    document.getElementById("setStartWeight").value = state.settings.startWeight;
    document.getElementById("setTargetWeight").value = state.settings.targetWeight;
    document.getElementById("waterTargetText").innerText = state.settings.waterTarget;
    
    // Hydrate Cycle Tracker Inputs
    document.getElementById("lastPeriodDate").value = state.cycleTracker.lastPeriodDate;
    document.getElementById("cycleLengthInput").value = state.cycleTracker.cycleLength;

    // Load Pomodoro counts
    document.getElementById("completedPomodoros").innerText = state.completedPomodoros;

    updateGlobalMetrics();
    updateWaterUI();
}

// Calculate progress and streaks
function updateGlobalMetrics() {
    // 1. Calculate Daily Adherence counts
    let adheredDaysCount = 0;
    let totalAdherencePoints = 0; // Cumulative habits checked
    let maxPossibleAdherencePoints = TOTAL_DAYS * DAILY_HABITS.length;
    
    for (let day = 1; day <= TOTAL_DAYS; day++) {
        const dayChecks = state.daysAdherence[day] || [];
        totalAdherencePoints += dayChecks.length;
        
        // Calculate day percentage
        const dayPct = dayChecks.length / DAILY_HABITS.length;
        if (dayPct >= 0.8) {
            adheredDaysCount++;
        }
    }

    // 2. Syllabus / Checklist items progress
    // Count checked checkboxes under syllabus
    const syllabusIds = [
        // ML & Math
        "task_ml_1", "task_ml_2", "task_ml_3", "task_ml_4", "task_ml_5",
        // DL & AI
        "task_ai_1", "task_ai_2", "task_ai_3", "task_ai_4",
        // Compiler
        "task_comp_1", "task_comp_2", "task_comp_3",
        // DSA
        "task_dsa_1", "task_dsa_2", "task_dsa_3", "task_dsa_4",
        // Sleep & Stress
        "sleep_1", "sleep_2", "sleep_3", "sleep_4",
        "stress_1", "stress_2", "stress_3",
        // Hair habits
        "hair_hab_1", "hair_hab_2", "hair_hab_3", "hair_hab_4", "hair_hab_5"
    ];
    
    let syllabusChecked = 0;
    syllabusIds.forEach(id => {
        if (state.completedGlobalTasks[id]) syllabusChecked++;
    });

    const syllabusMax = syllabusIds.length;
    
    // 3. Combined Progress Score
    const globalProgressPct = Math.round(
        ((totalAdherencePoints + syllabusChecked) / (maxPossibleAdherencePoints + syllabusMax)) * 100
    );

    // 4. Calculate Current Streak
    let currentStreak = 0;
    for (let day = 1; day <= TOTAL_DAYS; day++) {
        const dayChecks = state.daysAdherence[day] || [];
        const dayPct = dayChecks.length / DAILY_HABITS.length;
        
        if (dayPct >= 0.8) {
            currentStreak++;
        } else if (dayChecks.length > 0) {
            // Broken streak if some habits logged but didn't reach 80%
            break;
        } else {
            // Stop counting streak if day has no habits logged
            break;
        }
    }

    // 5. Update DOM elements
    document.getElementById("daysCompleted").innerText = `${adheredDaysCount} / ${TOTAL_DAYS}`;
    document.getElementById("overallProgress").innerText = `${globalProgressPct}%`;
    document.getElementById("streakDays").innerText = `${currentStreak} Day${currentStreak === 1 ? "" : "s"}`;
    document.getElementById("globalProgressText").innerText = `${globalProgressPct}%`;
    document.getElementById("globalProgressFill").style.width = `${globalProgressPct}%`;

    // Today's circular progress ring
    const todayChecks = state.daysAdherence[state.activeDay] || [];
    const todayPct = Math.round((todayChecks.length / DAILY_HABITS.length) * 100);
    document.getElementById("todayProgressPercent").innerText = `${todayPct}%`;
    
    const circle = document.getElementById("todayProgressRing");
    if (circle) {
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius; // 314.15
        const offset = circumference - (todayPct / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }

    // Display current weight stat
    if (state.weightLogs && state.weightLogs.length > 0) {
        // Find latest weight log
        const latestLog = state.weightLogs.reduce((prev, current) => {
            return (prev.week > current.week) ? prev : current;
        });
        document.getElementById("weightStats").innerText = `${latestLog.weight.toFixed(1)} kg`;
    } else {
        document.getElementById("weightStats").innerText = `${state.settings.startWeight.toFixed(1)} kg`;
    }
}

// ==========================================================================
// DAILY 30-DAY JOURNEY PLANNER
// ==========================================================================

function renderCalendarGrid() {
    const grid = document.getElementById("calendarGrid");
    if (!grid) return;
    grid.innerHTML = "";

    for (let day = 1; day <= TOTAL_DAYS; day++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.classList.add("calendar-day-btn");
        
        // Calculate status classes
        const dayChecks = state.daysAdherence[day] || [];
        const compliance = dayChecks.length / DAILY_HABITS.length;
        
        if (compliance >= 0.8) {
            btn.classList.add("adhered");
        } else if (compliance > 0) {
            btn.classList.add("missed");
        }
        
        if (day === state.activeDay) {
            btn.classList.add("active");
        }

        btn.innerHTML = `<span>Day</span><strong>${day}</strong>`;
        
        btn.addEventListener("click", () => {
            setActiveDay(day);
        });

        grid.appendChild(btn);
    }
}

function setActiveDay(dayNum) {
    state.activeDay = dayNum;
    
    // Save state
    saveState();
    
    // Update Calendar display
    const buttons = document.querySelectorAll(".calendar-day-btn");
    buttons.forEach((btn, index) => {
        btn.classList.remove("active");
        if (index + 1 === dayNum) {
            btn.classList.add("active");
        }
    });

    // Update daily editor header
    document.getElementById("activeDayTitle").innerText = `Day ${dayNum} Details`;
    document.getElementById("activeDayLabel").innerText = `Day ${dayNum}`;
    
    // Render the checklist for this specific day
    renderDailyChecklist();
    
    // Update Ring widget
    updateGlobalMetrics();
}

function renderDailyChecklist() {
    const list = document.getElementById("dailyHabitsList");
    if (!list) return;
    list.innerHTML = "";

    const activeChecked = state.daysAdherence[state.activeDay] || [];

    DAILY_HABITS.forEach(habit => {
        const li = document.createElement("li");
        li.classList.add("check-item");

        const isChecked = activeChecked.includes(habit.id);

        li.innerHTML = `
            <label class="custom-checkbox">
                <input type="checkbox" id="habit_${habit.id}" ${isChecked ? "checked" : ""}>
                <span class="checkmark"></span>
                <span class="task-title-text">${habit.text}</span>
            </label>
        `;

        // Listen for change events on checklist
        li.querySelector("input").addEventListener("change", (e) => {
            toggleDailyHabit(habit.id, e.target.checked);
        });

        list.appendChild(li);
    });

    // Update daily adherence badge
    const pct = Math.round((activeChecked.length / DAILY_HABITS.length) * 100);
    const badge = document.getElementById("dayAdherenceBadge");
    badge.innerText = `${pct}% Compliance`;
    if (pct >= 80) {
        badge.style.background = "rgba(16, 185, 129, 0.15)";
        badge.style.color = "var(--accent)";
    } else {
        badge.style.background = "rgba(99, 102, 241, 0.08)";
        badge.style.color = "var(--primary)";
    }
}

function toggleDailyHabit(habitId, isChecked) {
    if (!state.daysAdherence[state.activeDay]) {
        state.daysAdherence[state.activeDay] = [];
    }

    const currentList = state.daysAdherence[state.activeDay];

    if (isChecked) {
        if (!currentList.includes(habitId)) {
            currentList.push(habitId);
        }
    } else {
        const index = currentList.indexOf(habitId);
        if (index > -1) {
            currentList.splice(index, 1);
        }
    }

    // Save and redraw
    saveState();
    
    // Update daily adherence badge
    const pct = Math.round((currentList.length / DAILY_HABITS.length) * 100);
    const badge = document.getElementById("dayAdherenceBadge");
    badge.innerText = `${pct}% Compliance`;
    
    if (pct >= 80) {
        badge.style.background = "rgba(16, 185, 129, 0.15)";
        badge.style.color = "var(--accent)";
    } else {
        badge.style.background = "rgba(99, 102, 241, 0.08)";
        badge.style.color = "var(--primary)";
    }

    // Update calendar button checkmark indicators instantly
    const buttons = document.querySelectorAll(".calendar-day-btn");
    const btn = buttons[state.activeDay - 1];
    if (btn) {
        if (pct >= 80) {
            btn.classList.add("adhered");
            btn.classList.remove("missed");
        } else if (pct > 0) {
            btn.classList.add("missed");
            btn.classList.remove("adhered");
        } else {
            btn.classList.remove("adhered", "missed");
        }
    }
}

// ==========================================================================
// POMODORO TIMER
// ==========================================================================

function toggleTimer() {
    const btn = document.getElementById("timerToggleBtn");
    if (isTimerRunning) {
        // Pause timer
        clearInterval(pomodoroTimer);
        isTimerRunning = false;
        btn.innerHTML = '<i data-lucide="play"></i> Start';
    } else {
        // Start timer
        isTimerRunning = true;
        btn.innerHTML = '<i data-lucide="pause"></i> Pause';
        
        pomodoroTimer = setInterval(() => {
            timerSecondsRemaining--;
            updateTimerDisplay();
            
            if (timerSecondsRemaining <= 0) {
                clearInterval(pomodoroTimer);
                isTimerRunning = false;
                btn.innerHTML = '<i data-lucide="play"></i> Start';
                
                // Trigger alarm sound
                playAlarmSound();
                
                // Handle mode transition
                if (currentTimerMode === "work") {
                    state.completedPomodoros++;
                    document.getElementById("completedPomodoros").innerText = state.completedPomodoros;
                    saveState();
                    
                    alert("🎯 Focus Session Complete! Time for a 10 minute break.");
                    setTimerMode("break");
                } else {
                    alert("⏰ Break is over! Let's get back to deep focus.");
                    setTimerMode("work");
                }
            }
        }, 1000);
    }
    if (window.lucide) window.lucide.createIcons();
}

function resetTimer() {
    clearInterval(pomodoroTimer);
    isTimerRunning = false;
    document.getElementById("timerToggleBtn").innerHTML = '<i data-lucide="play"></i> Start';
    if (window.lucide) window.lucide.createIcons();
    
    // Restore default seconds for current mode
    timerSecondsRemaining = currentTimerMode === "work" ? 3000 : 600;
    timerTotalSeconds = timerSecondsRemaining;
    updateTimerDisplay();
}

function setTimerMode(mode) {
    currentTimerMode = mode;
    
    // Update active class on buttons
    document.getElementById("modeWork").classList.toggle("active", mode === "work");
    document.getElementById("modeBreak").classList.toggle("active", mode === "break");
    
    // Set timing durations (50m Focus vs 10m Break)
    timerSecondsRemaining = mode === "work" ? 3000 : 600;
    timerTotalSeconds = timerSecondsRemaining;
    
    document.getElementById("timerStatus").innerText = mode === "work" ? "Deep Work Block" : "System Rest Break";
    document.getElementById("timerStatus").style.color = mode === "work" ? "var(--primary)" : "var(--accent)";
    
    resetTimer();
}

function updateTimerDisplay() {
    const mins = Math.floor(timerSecondsRemaining / 60);
    const secs = timerSecondsRemaining % 60;
    
    // Format: MM:SS
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById("timerDisplay").innerText = formatted;
    
    // Update circular progress ring
    const ring = document.getElementById("timerRingBar");
    if (ring) {
        const circumference = 534; // 2 * Math.PI * 85
        const progress = timerSecondsRemaining / timerTotalSeconds;
        const offset = circumference * (1 - progress);
        ring.style.strokeDashoffset = offset;
    }
}

// Play synthesizer alert tone using Web Audio API
function playAlarmSound() {
    if (!isSoundEnabled) return;
    
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        
        const ctx = new AudioCtx();
        
        // Play 3 beeps
        for (let i = 0; i < 3; i++) {
            const time = ctx.currentTime + (i * 0.4);
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, time); // A5 note
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(time);
            osc.stop(time + 0.35);
        }
    } catch (e) {
        console.error("Web Audio API not supported or context blocked.", e);
    }
}

// ==========================================================================
// HYDRATION (WATER TRACKER)
// ==========================================================================

function addWater(amountMl) {
    state.hydration.amount += amountMl;
    if (state.hydration.amount > 6000) state.hydration.amount = 6000; // Cap
    
    saveState();
    updateWaterUI();
}

function resetWater() {
    state.hydration.amount = 0;
    saveState();
    updateWaterUI();
}

function updateWaterUI() {
    const current = state.hydration.amount;
    const target = state.settings.waterTarget;
    const pct = Math.round((current / target) * 100);
    
    document.getElementById("waterLogged").innerText = current;
    document.getElementById("waterPercent").innerText = `${pct}%`;
    
    // Scale water wave filling height (capped at 100%)
    const fillHeight = Math.min(pct, 100);
    document.getElementById("waterLevel").style.height = `${fillHeight}%`;
    
    // Auto check daily habit checkmark once target hydration is hit!
    const targetChecked = current >= target;
    const dailyHabitCheckbox = document.getElementById("habit_health_water");
    
    if (dailyHabitCheckbox && dailyHabitCheckbox.checked !== targetChecked) {
        // Toggle the habit in data
        toggleDailyHabit("health_water", targetChecked);
        // Refresh editor UI list
        renderDailyChecklist();
    }
}

// Expose water helpers to window
window.addWater = addWater;
window.resetWater = resetWater;

// ==========================================================================
// WEIGHT LOG & CUSTOM SVG LINE CHART
// ==========================================================================

function logWeight() {
    const weightVal = parseFloat(document.getElementById("newWeightInput").value);
    const weekSelect = parseInt(document.getElementById("weightWeekSelect").value);
    
    if (isNaN(weightVal) || weightVal <= 0) {
        alert("Please enter a valid weight (e.g. 71.5).");
        return;
    }

    // Check if week already exists, override or push new
    const existingIndex = state.weightLogs.findIndex(log => log.week === weekSelect);
    if (existingIndex > -1) {
        state.weightLogs[existingIndex].weight = weightVal;
    } else {
        state.weightLogs.push({ week: weekSelect, weight: weightVal });
    }

    // Sort logs by week index
    state.weightLogs.sort((a, b) => a.week - b.week);
    
    // Save state
    saveState();
    
    // Redraw graphs and logs
    renderWeightChart();
    renderWeightHistory();
    
    // Reset weight input
    document.getElementById("newWeightInput").value = "";
}

function removeWeightLog(weekNum) {
    state.weightLogs = state.weightLogs.filter(log => log.week !== weekNum);
    saveState();
    renderWeightChart();
    renderWeightHistory();
}

function renderWeightHistory() {
    const list = document.getElementById("weightHistoryList");
    if (!list) return;
    list.innerHTML = "";

    if (state.weightLogs.length === 0) {
        list.innerHTML = `<div class="text-center p-2 text-muted">No logged weight details.</div>`;
        return;
    }

    state.weightLogs.forEach(log => {
        const item = document.createElement("div");
        item.classList.add("weight-history-item");
        
        const label = log.week === 0 ? "Start Point" : `Week ${log.week}`;
        
        item.innerHTML = `
            <span><strong>${label}:</strong> ${log.weight.toFixed(1)} kg</span>
            <button onclick="removeWeightLog(${log.week})" title="Delete entry">&times;</button>
        `;
        list.appendChild(item);
    });
}

// Custom SVG Chart generator
function renderWeightChart() {
    const svg = document.getElementById("weightChart");
    if (!svg) return;
    svg.innerHTML = "";

    const logs = state.weightLogs;
    if (logs.length === 0) {
        svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="var(--text-muted)">Log a weight entry to visualize progress chart</text>`;
        return;
    }

    // Chart margins
    const margin = { top: 20, right: 30, bottom: 25, left: 40 };
    const width = 400;
    const height = 180;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate Y scale range (min-max weight limits)
    let minW = Math.min(...logs.map(l => l.weight), state.settings.targetWeight) - 1.0;
    let maxW = Math.max(...logs.map(l => l.weight), state.settings.startWeight) + 1.0;
    
    if (minW === maxW) {
        minW -= 2;
        maxW += 2;
    }

    // Gridlines (Y axes)
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
        const yVal = minW + (i / gridCount) * (maxW - minW);
        const yPos = height - margin.bottom - (i / gridCount) * chartHeight;
        
        // Draw grid horizontal line
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", margin.left);
        line.setAttribute("y1", yPos);
        line.setAttribute("x2", width - margin.right);
        line.setAttribute("y2", yPos);
        line.setAttribute("class", "chart-grid");
        svg.appendChild(line);

        // Draw grid label text
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", margin.left - 8);
        text.setAttribute("y", yPos + 3);
        text.setAttribute("text-anchor", "end");
        text.setAttribute("class", "chart-text");
        text.textContent = `${yVal.toFixed(1)}`;
        svg.appendChild(text);
    }

    // Draw X-axis grid headers (Weeks 0 to 4)
    const maxWeek = 4;
    const points = [];

    for (let w = 0; w <= maxWeek; w++) {
        const xPos = margin.left + (w / maxWeek) * chartWidth;

        // Draw vertical gridline
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", xPos);
        line.setAttribute("y1", margin.top);
        line.setAttribute("x2", xPos);
        line.setAttribute("y2", height - margin.bottom);
        line.setAttribute("class", "chart-grid");
        svg.appendChild(line);

        // Draw week label
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", xPos);
        text.setAttribute("y", height - 6);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("class", "chart-text");
        text.textContent = w === 0 ? "Start" : `W${w}`;
        svg.appendChild(text);

        // Find logged value if it exists
        const logMatch = logs.find(l => l.week === w);
        if (logMatch) {
            const yPos = height - margin.bottom - ((logMatch.weight - minW) / (maxW - minW)) * chartHeight;
            points.push({ x: xPos, y: yPos, weight: logMatch.weight });
        }
    }

    // Draw connection line path
    if (points.length > 1) {
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("class", "chart-line");
        svg.appendChild(path);
    }

    // Draw point dots and values
    points.forEach(pt => {
        // Draw circle dot
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", pt.x);
        circle.setAttribute("cy", pt.y);
        circle.setAttribute("r", "4");
        circle.setAttribute("class", "chart-point");
        
        // Add tooltip
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${pt.weight.toFixed(1)} kg`;
        circle.appendChild(title);
        
        svg.appendChild(circle);

        // Weight text tag above point
        const textVal = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textVal.setAttribute("x", pt.x);
        textVal.setAttribute("y", pt.y - 8);
        textVal.setAttribute("text-anchor", "middle");
        textVal.setAttribute("class", "chart-label-val");
        textVal.textContent = `${pt.weight.toFixed(1)}`;
        svg.appendChild(textVal);
    });

    // Draw main axes boundaries
    const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xAxis.setAttribute("x1", margin.left);
    xAxis.setAttribute("y1", height - margin.bottom);
    xAxis.setAttribute("x2", width - margin.right);
    xAxis.setAttribute("y2", height - margin.bottom);
    xAxis.setAttribute("class", "chart-axis");
    svg.appendChild(xAxis);

    const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    yAxis.setAttribute("x1", margin.left);
    yAxis.setAttribute("y1", margin.top);
    yAxis.setAttribute("x2", margin.left);
    yAxis.setAttribute("y2", height - margin.bottom);
    yAxis.setAttribute("class", "chart-axis");
    svg.appendChild(yAxis);
}

// Expose chart deletion
window.removeWeightLog = removeWeightLog;

// ==========================================================================
// MENSTRUAL CYCLE TRACKING & SCIENCE PHASES
// ==========================================================================

function saveCycleData() {
    const dateInput = document.getElementById("lastPeriodDate").value;
    const lengthInput = parseInt(document.getElementById("cycleLengthInput").value);
    
    if (!dateInput) {
        alert("Please select a valid period start date.");
        return;
    }
    
    if (isNaN(lengthInput) || lengthInput < 20 || lengthInput > 45) {
        alert("Cycle length should range logically between 20 and 45 days.");
        return;
    }

    state.cycleTracker.lastPeriodDate = dateInput;
    state.cycleTracker.cycleLength = lengthInput;
    
    saveState();
    renderCycleCalculations();
}

function renderCycleCalculations() {
    const lPeriod = state.cycleTracker.lastPeriodDate;
    const cLength = state.cycleTracker.cycleLength;
    
    const container = document.getElementById("cycleResults");
    if (!container) return;

    if (!lPeriod) {
        container.style.display = "none";
        return;
    }

    container.style.display = "block";

    // 1. Calculate Estimated Next Period
    const lastDate = new Date(lPeriod);
    const nextDate = new Date(lastDate.getTime() + cLength * 24 * 60 * 60 * 1000);
    
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    document.getElementById("nextPeriodText").innerText = nextDate.toLocaleDateString("en-US", options);

    // 2. Estimate Current Hormonal Phase
    const today = new Date();
    
    // Clear hours for accurate day counts
    today.setHours(0,0,0,0);
    lastDate.setHours(0,0,0,0);
    
    const timeDiff = today.getTime() - lastDate.getTime();
    let currentDayOfCycle = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    if (currentDayOfCycle < 0) {
        // Handle input dates set in the future
        document.getElementById("currentPhaseText").innerText = "Not Started";
        document.getElementById("phaseExplanationText").innerText = "Your entered period date is set in the future. The tracker will activate once that date is reached.";
        return;
    }
    
    // Modulo cycle length to get current relative day
    currentDayOfCycle = (currentDayOfCycle % cLength) + 1;

    let phaseName = "";
    let explanation = "";

    if (currentDayOfCycle >= 1 && currentDayOfCycle <= 5) {
        phaseName = "🩸 Menstrual Phase";
        explanation = `<strong>Cycle Day ${currentDayOfCycle}:</strong> Estrogen and progesterone are at their lowest. You may experience lower physical energy. Focus on iron-rich foods, deep rest, and gentle yin yoga flows. Avoid extreme HIIT workouts today.`;
    } else if (currentDayOfCycle >= 6 && currentDayOfCycle <= 13) {
        phaseName = "🌱 Follicular Phase";
        explanation = `<strong>Cycle Day ${currentDayOfCycle}:</strong> Estrogen is rising, promoting neural plasticity, positive mood, and high cellular energy. Optimal window for heavy strength training, learning complex ML/AI concepts, and solving intense DSA problems.`;
    } else if (currentDayOfCycle === 14) {
        phaseName = "🌸 Ovulatory Phase";
        explanation = `<strong>Cycle Day ${currentDayOfCycle}:</strong> Peak estrogen and surge in luteinizing hormone. Stamina, confidence, and verbal fluency are at their monthly maximums. Take advantage of this window for deep focus and heavy cardio blocks.`;
    } else {
        phaseName = "🍂 Luteal Phase";
        explanation = `<strong>Cycle Day ${currentDayOfCycle}:</strong> Progesterone increases. Energy levels will taper off, and stress tolerance decreases. Switch from intense workouts to walking/yoga. Focus on blood sugar stability and magnesium supplementation to protect sleep quality.`;
    }

    document.getElementById("currentPhaseText").innerText = phaseName;
    document.getElementById("phaseExplanationText").innerHTML = explanation;
}

// ==========================================================================
// SYSTEM SETTINGS & SAMPLE DATA POPULATOR
// ==========================================================================

function saveSettings() {
    const targetStudy = parseInt(document.getElementById("setStudyTarget").value);
    const targetWater = parseInt(document.getElementById("setWaterTarget").value);
    const startW = parseFloat(document.getElementById("setStartWeight").value);
    const targetW = parseFloat(document.getElementById("setTargetWeight").value);

    if (isNaN(targetStudy) || targetStudy < 4 || targetStudy > 18) {
        alert("Daily study hours target should be set between 4 and 18 hours.");
        return;
    }
    
    if (isNaN(targetWater) || targetWater < 1500 || targetWater > 6000) {
        alert("Daily hydration target should range between 1500ml and 6000ml.");
        return;
    }

    if (isNaN(startW) || isNaN(targetW) || startW < 40 || targetW < 40) {
        alert("Please specify realistic weight values in kg.");
        return;
    }

    state.settings.studyTarget = targetStudy;
    state.settings.waterTarget = targetWater;
    state.settings.startWeight = startW;
    state.settings.targetWeight = targetW;

    // Sync water targets on other pages
    document.getElementById("waterTargetText").innerText = targetWater;

    // Modify base week 0 weight if changed and it is the only log
    if (state.weightLogs.length === 1 && state.weightLogs[0].week === 0) {
        state.weightLogs[0].weight = startW;
    }

    saveState();
    renderWeightChart();
    renderWeightHistory();
    updateWaterUI();
    
    alert("Configurations saved successfully!");
}

function resetAllData() {
    if (confirm("🚨 WARNING: This will permanently wipe all checklists, logs, custom weight progress, and cycle calendars. Are you sure you want to proceed?")) {
        state = JSON.parse(JSON.stringify(defaultState));
        
        // Reset local storage
        localStorage.removeItem(STORAGE_KEY);
        
        // Re-initialize state
        loadState();
        
        // Uncheck all check boxes manually in active UI view
        const checkboxes = document.querySelectorAll("input[type='checkbox']");
        checkboxes.forEach(c => c.checked = false);
        
        renderTabs();
        renderCalendarGrid();
        renderDailyChecklist();
        renderWeightChart();
        renderWeightHistory();
        renderCycleCalculations();
        
        alert("Application reset to factory default.");
    }
}

// Populate sample progress data so the user can see what a fully tracked app looks like!
function loadMockProgressData() {
    if (confirm("This will overwrite your current logs with mock demo data showing Day 1-12 completed. Proceed?")) {
        // Clear state
        state = JSON.parse(JSON.stringify(defaultState));

        // Syllabus completions
        state.completedGlobalTasks["task_ml_1"] = true;
        state.completedGlobalTasks["task_ml_2"] = true;
        state.completedGlobalTasks["task_ai_1"] = true;
        state.completedGlobalTasks["task_comp_1"] = true;
        state.completedGlobalTasks["task_dsa_1"] = true;
        state.completedGlobalTasks["sleep_1"] = true;
        state.completedGlobalTasks["sleep_2"] = true;
        state.completedGlobalTasks["stress_1"] = true;
        state.completedGlobalTasks["hair_hab_1"] = true;
        state.completedGlobalTasks["hair_hab_2"] = true;
        state.completedGlobalTasks["hair_hab_4"] = true;

        // Daily adherence history: simulate 12 days of checkmarks
        for (let d = 1; d <= 12; d++) {
            // Check off 9 random habits for each day (enough for 80%+ adherence)
            state.daysAdherence[d] = ["study_ml", "study_ai", "study_compiler", "study_dsa", "fit_cardio", "fit_yoga", "hair_scalp", "health_water", "health_sleep"];
            
            // Randomly slip in strength on odd days
            if (d % 2 !== 0) {
                state.daysAdherence[d].push("fit_strength");
            }
        }

        // Simulating some partial checklist progress for Day 13
        state.daysAdherence[13] = ["study_ml", "fit_cardio", "hair_scalp", "health_water"];

        // Weight entries
        state.weightLogs = [
            { week: 0, weight: 72.0 },
            { week: 1, weight: 71.4 },
            { week: 2, weight: 70.8 },
            { week: 3, weight: 70.2 }
        ];

        // Hydration today
        state.hydration.amount = 3500;
        state.hydration.date = getTodayDateString();

        // Cycle data
        const cycleStart = new Date();
        cycleStart.setDate(cycleStart.getDate() - 10); // 10 days ago
        const year = cycleStart.getFullYear();
        const month = String(cycleStart.getMonth() + 1).padStart(2, '0');
        const day = String(cycleStart.getDate()).padStart(2, '0');
        state.cycleTracker.lastPeriodDate = `${year}-${month}-${day}`;
        state.cycleTracker.cycleLength = 28;

        state.completedPomodoros = 18;
        state.activeDay = 13;

        saveState();
        
        // Refresh everything
        renderTabs();
        renderCalendarGrid();
        renderDailyChecklist();
        renderWeightChart();
        renderWeightHistory();
        renderCycleCalculations();
        
        alert("Mock demo data loaded successfully! Explore the tabs to see visual charts, streak metrics, and calendar markings.");
    }
}
