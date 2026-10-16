// ==========================================================================
// TaskFlow Android Mobile App Logic
// ==========================================================================

const STORAGE_KEYS = {
  TASKS: 'taskflow_android_tasks_v2',
  WELCOME_COMPLETED: 'taskflow_welcome_seen_v2',
  THEME: 'taskflow_theme_mode_v2'
};

// DOM Elements
const taskList = document.getElementById('task-list');
const addForm = document.getElementById('add-form');
const taskInput = document.getElementById('task-input');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const dateDisplay = document.getElementById('date-display');
const statusTime = document.getElementById('status-time');
const emptyState = document.getElementById('empty-state');
const emptyTitle = document.getElementById('empty-title');
const emptySubtitle = document.getElementById('empty-subtitle');
const pageTitle = document.getElementById('page-title');
const resultsCount = document.getElementById('results-count');

// Theme Toggle Element
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Welcome Screen Elements
const welcomeScreen = document.getElementById('welcome-screen');
const startAppBtn = document.getElementById('start-app-btn');
const startBtnLabel = document.getElementById('start-btn-label');

// Add Task Elements & Keyboard
const addBtn = document.getElementById('add-btn');
const inputWrapper = document.getElementById('input-wrapper');
const phoneFrame = document.querySelector('.phone-frame');
const androidKeyboard = document.getElementById('android-keyboard');

// Sidebar (Mobile Drawer) Elements
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const openSidebarBtn = document.getElementById('open-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const navItems = document.querySelectorAll('.nav-item');
const metaFilterTag = document.getElementById('meta-filter-tag');

// Stats Elements
const countAll = document.getElementById('count-all');
const countActive = document.getElementById('count-active');
const countCompleted = document.getElementById('count-completed');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const progressText = document.getElementById('progress-text');
const clearCompletedBtn = document.getElementById('clear-completed-btn');

// State: Standardmäßig Fokus auf offene Aufgaben
let tasks = loadTasks();
let currentFilter = 'active'; // 'active' (Standard Fokus) | 'completed' | 'all'
let searchQuery = '';
let currentTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';

// ==========================================================================
// Initialization
// ==========================================================================
function init() {
  applyTheme(currentTheme, false);
  updateTimeAndDate();
  setInterval(updateLiveClock, 30000);
  checkWelcomeScreen();
  bindEvents();
  render();
}

function updateTimeAndDate() {
  const now = new Date();
  
  // Live Clock in Android Status Bar
  if (statusTime) {
    statusTime.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  // Header Date
  if (dateDisplay) {
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    dateDisplay.textContent = now.toLocaleDateString('de-DE', options);
  }
}

function updateLiveClock() {
  const now = new Date();
  if (statusTime) {
    statusTime.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
}

// ==========================================================================
// Speicherung & Persistenz (Beim Neustarten & Schließen sicher erhalten)
// ==========================================================================
function loadTasks() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (data !== null) {
      return JSON.parse(data);
    }
    // Wenn das erste Mal gestartet wird, leere Aufgabenliste bereitstellen
    return [];
  } catch (e) {
    console.error('Fehler beim Laden der Aufgaben aus localStorage:', e);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Fehler beim Speichern der Aufgaben in localStorage:', e);
  }
}

// Willkommens-Status prüfen & Steuerung: Bei jedem Seitenstart / Neuladen immer anzeigen
function checkWelcomeScreen() {
  const isFirstTime = !tasks || tasks.length === 0;
  showWelcomeScreen(isFirstTime);
}

function showWelcomeScreen(isFirstTime = false) {
  if (startBtnLabel) {
    startBtnLabel.textContent = isFirstTime ? 'Jetzt starten' : 'Weiter zur App';
  }
  welcomeScreen.classList.remove('hidden');
  welcomeScreen.classList.remove('closing');
}

function hideWelcomeScreen() {
  localStorage.setItem(STORAGE_KEYS.WELCOME_COMPLETED, 'true');
  welcomeScreen.classList.add('closing');
  setTimeout(() => {
    welcomeScreen.classList.add('hidden');
    welcomeScreen.classList.remove('closing');
    taskInput.focus();
  }, 280);
}

// ==========================================================================
// Erscheinungsbild: Hell- / Dunkelmodus Steuerung & Animation
// ==========================================================================
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('title', 'Zum hellen Modus wechseln');
      themeToggleBtn.setAttribute('aria-label', 'Zum hellen Modus wechseln');
    }
  } else {
    document.body.classList.remove('dark-theme');
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('title', 'Zum dunklen Modus wechseln');
      themeToggleBtn.setAttribute('aria-label', 'Zum dunklen Modus wechseln');
    }
  }
}

function toggleTheme() {
  currentTheme = (currentTheme === 'light') ? 'dark' : 'light';
  localStorage.setItem(STORAGE_KEYS.THEME, currentTheme);
  applyTheme(currentTheme);
}

// ==========================================================================
// Event Listeners
// ==========================================================================
function bindEvents() {
  // Hell/Dunkel Modus Umschalter
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Start Button auf dem Willkommens-Screen
  startAppBtn.addEventListener('click', hideWelcomeScreen);

  // Mobile Seitenleiste öffnen & schließen
  openSidebarBtn.addEventListener('click', openSidebar);
  closeSidebarBtn.addEventListener('click', closeSidebar);
  sidebarBackdrop.addEventListener('click', closeSidebar);

  // Schnelleingabe Tipp-Status (Dynamische Button-Animation)
  taskInput.addEventListener('input', () => {
    if (addBtn) {
      addBtn.classList.toggle('ready', taskInput.value.trim().length > 0);
    }
  });

  // Tastatur öffnen bei Klick auf das Eingabefeld (Zeile fährt nach oben)
  taskInput.addEventListener('focus', () => {
    if (phoneFrame) phoneFrame.classList.add('keyboard-open');
  });

  // Klick außerhalb schließt die Tastatur und fährt die Zeile nach unten
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.mobile-bottom-bar') && !e.target.closest('.android-keyboard')) {
      if (phoneFrame && phoneFrame.classList.contains('keyboard-open')) {
        taskInput.blur();
        phoneFrame.classList.remove('keyboard-open');
      }
    }
  });

  // Virtuelle Android Tastatur Steuerung (Gboard)
  if (androidKeyboard) {
    // Verhindert Fokusverlust beim Tippen auf die Tasten
    androidKeyboard.addEventListener('pointerdown', (e) => {
      e.preventDefault();
    });

    const shiftBtn = document.getElementById('kb-shift');
    const backspaceBtn = document.getElementById('kb-backspace');
    const spaceBtn = document.getElementById('kb-space');
    const hideBtn = document.getElementById('kb-hide');
    const enterBtn = document.getElementById('kb-enter');

    androidKeyboard.addEventListener('click', (e) => {
      const key = e.target.closest('.kb-key');
      if (!key) return;

      const char = key.getAttribute('data-char');
      if (char) {
        const isShift = shiftBtn && shiftBtn.classList.contains('active');
        taskInput.value += isShift ? char.toUpperCase() : char.toLowerCase();
        taskInput.dispatchEvent(new Event('input'));
      }
    });

    if (shiftBtn) {
      shiftBtn.addEventListener('click', () => {
        const isActive = shiftBtn.classList.toggle('active');
        document.querySelectorAll('.kb-key[data-char]').forEach(k => {
          const c = k.getAttribute('data-char');
          k.textContent = isActive ? c.toUpperCase() : c.toLowerCase();
        });
      });
    }

    if (backspaceBtn) {
      backspaceBtn.addEventListener('click', () => {
        taskInput.value = taskInput.value.slice(0, -1);
        taskInput.dispatchEvent(new Event('input'));
      });
    }

    if (spaceBtn) {
      spaceBtn.addEventListener('click', () => {
        taskInput.value += ' ';
        taskInput.dispatchEvent(new Event('input'));
      });
    }

    if (hideBtn) {
      hideBtn.addEventListener('click', () => {
        taskInput.blur();
        if (phoneFrame) phoneFrame.classList.remove('keyboard-open');
      });
    }

    if (enterBtn) {
      enterBtn.addEventListener('click', () => {
        handleTaskSubmit();
      });
    }
  }

  function handleTaskSubmit() {
    const val = taskInput.value.trim();
    if (!val) {
      if (inputWrapper) {
        inputWrapper.classList.remove('shake');
        void inputWrapper.offsetWidth;
        inputWrapper.classList.add('shake');
      }
      taskInput.focus();
      return;
    }
    addTask(val);
  }

  // Aufgabe hinzufügen
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleTaskSubmit();
  });

  // Live-Suche
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    clearSearchBtn.classList.toggle('hidden', searchQuery.length === 0);
    render();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    searchInput.focus();
    render();
  });

  // Filter in der Seitenleiste (Zentrale Filterverwaltung)
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const filter = item.getAttribute('data-filter');
      setFilter(filter);
      closeSidebar();
    });
  });

  // Erledigte aufräumen
  clearCompletedBtn.addEventListener('click', () => {
    const completedCount = tasks.filter(t => t.completed).length;
    if (completedCount === 0) return;

    if (confirm(`Möchtest du wirklich alle ${completedCount} erledigten Aufgaben entfernen?`)) {
      tasks = tasks.filter(t => !t.completed);
      saveTasks();
      closeSidebar();
      render();
    }
  });

  // Vor Schließen / Neuladen der Seite nochmals speichern
  window.addEventListener('beforeunload', () => {
    saveTasks();
  });
}

function openSidebar() {
  sidebar.classList.add('open');
  sidebarBackdrop.classList.add('active');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('active');
}

function setFilter(filter) {
  currentFilter = filter;

  navItems.forEach(nav => {
    nav.classList.toggle('active', nav.getAttribute('data-filter') === filter);
  });

  if (metaFilterTag) {
    if (currentFilter === 'active') metaFilterTag.textContent = 'OFFEN';
    if (currentFilter === 'completed') metaFilterTag.textContent = 'ERLEDIGT';
    if (currentFilter === 'all') metaFilterTag.textContent = 'ALLE';

    // Sanfte Pop-Animation beim Wechseln
    metaFilterTag.classList.remove('pop');
    void metaFilterTag.offsetWidth;
    metaFilterTag.classList.add('pop');
  }

  if (currentFilter === 'active') pageTitle.textContent = 'Meine Aufgaben';
  if (currentFilter === 'completed') pageTitle.textContent = 'Erledigte Aufgaben';
  if (currentFilter === 'all') pageTitle.textContent = 'Alle Aufgaben';

  render();
}

// ==========================================================================
// Aufgaben-Verwaltung (CRUD)
// ==========================================================================
let justAddedTaskId = null;

function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const newId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  const newTask = {
    id: newId,
    text: trimmed,
    completed: false,
    createdAt: `Erstellt um ${timeStr}`
  };

  justAddedTaskId = newId;
  tasks.unshift(newTask);
  saveTasks();
  taskInput.value = '';
  if (addBtn) addBtn.classList.remove('ready');

  // Wenn man gerade in "Erledigt" war, automatisch zurück zur offenen Liste wechseln
  if (currentFilter === 'completed') {
    setFilter('active');
  } else {
    render();
  }

  // Liste sanft nach oben scrollen
  const scrollArea = document.querySelector('.task-scroll-area');
  if (scrollArea) scrollArea.scrollTop = 0;
}

function toggleTask(id, event = null) {
  let wasCompleted = false;
  const targetTask = tasks.find(t => t.id === id);
  if (!targetTask) return;

  wasCompleted = !targetTask.completed;
  targetTask.completed = wasCompleted;
  saveTasks();

  const wrapperEl = document.querySelector(`[data-id="${id}"]`);
  const cardEl = wrapperEl ? (wrapperEl.querySelector('.task-item') || wrapperEl) : null;

  // Game-Feel: Mikro-Konfetti bei erfolgreichem Abhaken
  if (wasCompleted && event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    triggerMicroConfetti(cx, cy);
  }

  // In der Offen-Ansicht: Erledigte Aufgabe verweilt kurz mit Erfolgs-Feedback und blendet sanft gleitend aus
  if (currentFilter === 'active' && wasCompleted && wrapperEl) {
    if (cardEl) cardEl.classList.add('completed');
    updateSidebarStats();

    setTimeout(() => {
      wrapperEl.style.transition = 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
      wrapperEl.style.opacity = '0';
      wrapperEl.style.transform = 'scale(0.9) translateY(-12px)';
      setTimeout(() => {
        render();
      }, 300);
    }, 520);
    return;
  }

  // In der Erledigt-Ansicht: Reaktivieren lässt sie zurück zu "Offen" wandern
  if (currentFilter === 'completed' && !wasCompleted && wrapperEl) {
    if (cardEl) cardEl.classList.remove('completed');
    updateSidebarStats();

    setTimeout(() => {
      wrapperEl.style.transition = 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
      wrapperEl.style.opacity = '0';
      wrapperEl.style.transform = 'scale(0.9) translateY(-12px)';
      setTimeout(() => {
        render();
      }, 300);
    }, 400);
    return;
  }

  render();
}

// Mikro-Konfetti Partikel im minimalistischen Schwarz-Weiß Stil
function triggerMicroConfetti(x, y) {
  const count = 14;
  const colors = currentTheme === 'dark'
    ? ['#ffffff', '#f4f4f5', '#d4d4d8', '#a1a1aa', '#71717a', '#ffffff']
    : ['#000000', '#1c1c1e', '#3a3a3c', '#636366', '#8e8e93', '#ffffff'];

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'micro-particle';

    const size = Math.floor(Math.random() * 5) + 3; // 3px - 8px
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.7;
    const distance = Math.floor(Math.random() * 38) + 24; // 24px - 62px
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const rot = Math.floor(Math.random() * 360);

    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.border = '1px solid rgba(0,0,0,0.18)';
    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);
    p.style.setProperty('--rot', `${rot}deg`);

    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

function deleteTask(id) {
  const taskEl = document.querySelector(`[data-id="${id}"]`);
  if (taskEl) {
    taskEl.classList.add('deleting');
    setTimeout(() => {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      render();
    }, 320);
  } else {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    render();
  }
}

// ==========================================================================
// Rendering
// ==========================================================================
function render() {
  updateSidebarStats();

  let filtered = tasks.filter(t => {
    if (currentFilter === 'active') return !t.completed;
    if (currentFilter === 'completed') return t.completed;
    return true;
  });

  if (searchQuery) {
    filtered = filtered.filter(t => t.text.toLowerCase().includes(searchQuery));
  }

  resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'Aufgabe' : 'Aufgaben'}`;

  taskList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    if (searchQuery) {
      emptyTitle.textContent = 'Keine Treffer';
      emptySubtitle.textContent = `Keine Aufgabe enthält "${searchQuery}".`;
    } else if (currentFilter === 'active') {
      emptyTitle.textContent = 'Alles erledigt! 🎉';
      emptySubtitle.textContent = 'Du hast aktuell keine offenen Aufgaben.';
    } else if (currentFilter === 'completed') {
      emptyTitle.textContent = 'Noch nichts erledigt';
      emptySubtitle.textContent = 'Hake eine Aufgabe ab, um sie hier zu sehen.';
    } else {
      emptyTitle.textContent = 'Keine Aufgaben vorhanden';
      emptySubtitle.textContent = 'Deine Liste ist leer. Tippe unten auf das Eingabefeld, um deine erste Aufgabe zu erstellen.';
    }
  } else {
    emptyState.classList.add('hidden');
    filtered.forEach((task, index) => {
      const li = createTaskElement(task, index);
      taskList.appendChild(li);
    });
    // Nach Rendern neuen ID-Marker zurücksetzen
    justAddedTaskId = null;
  }
}

function createTaskElement(task, index = 0) {
  const isNew = task.id === justAddedTaskId;
  const li = document.createElement('li');
  li.className = `task-swipe-wrapper ${isNew ? 'spring-in' : ''}`;
  li.setAttribute('data-id', task.id);

  // Gestaffelte sanfte Wellen-Animation für jede Aufgabenkarte
  if (!isNew) {
    li.style.animationDelay = `${Math.min(index * 0.045, 0.32)}s`;
  }

  li.innerHTML = `
    <div class="swipe-delete-background">
      <div class="swipe-delete-indicator">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </div>
    </div>
    <div class="task-item ${task.completed ? 'completed' : ''}">
      <div class="task-left">
        <div class="custom-checkbox" role="checkbox" aria-checked="${task.completed}" title="${task.completed ? 'Als offen markieren' : 'Als erledigt markieren'}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="task-body">
          <span class="task-title">${escapeHTML(task.text)}</span>
          <span class="task-date">${escapeHTML(task.createdAt)}</span>
        </div>
      </div>
    </div>
  `;

  const card = li.querySelector('.task-item');
  const checkbox = li.querySelector('.custom-checkbox');

  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    checkbox.classList.add('bouncing');
    toggleTask(task.id, e);
  });

  // Wisch-Geste nach rechts zum Löschen (Finger & Maus)
  attachSwipeListeners(li, card, task.id);

  return li;
}

// ==========================================================================
// Wisch-Geste nach rechts (Swipe-to-Delete)
// ==========================================================================
function attachSwipeListeners(wrapper, card, taskId) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isDragging = false;
  let isHorizontalSwipe = false;
  let hasDecidedDirection = false;
  const threshold = 105;
  const indicator = wrapper.querySelector('.swipe-delete-indicator');

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.custom-checkbox')) return;

    startX = e.clientX;
    startY = e.clientY;
    currentX = 0;
    isDragging = true;
    isHorizontalSwipe = false;
    hasDecidedDirection = false;
    card.style.transition = 'none';
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!hasDecidedDirection) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        hasDecidedDirection = true;
        // Nur aktivieren, wenn horizontal und nach rechts gewischt wird
        if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
          isHorizontalSwipe = true;
          try { card.setPointerCapture(e.pointerId); } catch (_) {}
          card.classList.add('swiping');
        } else {
          isDragging = false;
          return;
        }
      } else {
        return;
      }
    }

    if (!isHorizontalSwipe) return;

    if (e.cancelable) e.preventDefault();

    currentX = Math.max(0, dx);
    let displayX = currentX;
    if (displayX > 170) {
      displayX = 170 + (displayX - 170) * 0.35;
    }

    card.style.transform = `translateX(${displayX}px)`;

    if (indicator) {
      const isPast = currentX >= threshold;
      indicator.classList.toggle('ready', isPast);
      indicator.style.opacity = Math.min((currentX / 30), 1);
      indicator.style.transform = `scale(${isPast ? 1.22 : 0.85 + (currentX / threshold) * 0.25})`;
    }
  }

  function onPointerEnd(e) {
    if (!isDragging && !isHorizontalSwipe) return;

    const wasSwiping = isHorizontalSwipe;
    isDragging = false;
    isHorizontalSwipe = false;
    card.classList.remove('swiping');

    try { card.releasePointerCapture(e.pointerId); } catch (_) {}

    if (wasSwiping && currentX >= threshold) {
      // Nach rechts aus dem Display gleiten lassen und löschen
      card.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
      card.style.transform = 'translateX(110%)';
      card.style.opacity = '0';

      if (navigator.vibrate) {
        try { navigator.vibrate(30); } catch (_) {}
      }

      setTimeout(() => {
        deleteTask(taskId);
      }, 200);
    } else {
      // Zurückfedern, falls Schwellenwert nicht erreicht wurde
      card.style.transition = 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)';
      card.style.transform = 'translateX(0px)';

      if (indicator) {
        indicator.classList.remove('ready');
        indicator.style.opacity = '0';
        indicator.style.transform = 'scale(0.85)';
      }

      setTimeout(() => {
        card.style.transition = '';
      }, 340);
    }
  }

  card.addEventListener('pointerdown', onPointerDown);
  card.addEventListener('pointermove', onPointerMove);
  card.addEventListener('pointerup', onPointerEnd);
  card.addEventListener('pointercancel', onPointerEnd);
}

function updateSidebarStats() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const active = total - completed;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  countAll.textContent = total;
  countActive.textContent = active;
  countCompleted.textContent = completed;

  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  progressText.textContent = `${completed} von ${total} erledigt`;

  // Dynamischer Zahlen-Impuls
  if (progressPercent) {
    progressPercent.classList.remove('pop');
    void progressPercent.offsetWidth;
    progressPercent.classList.add('pop');
  }

  clearCompletedBtn.style.opacity = completed > 0 ? '1' : '0.4';
  clearCompletedBtn.style.pointerEvents = completed > 0 ? 'auto' : 'none';
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Start
document.addEventListener('DOMContentLoaded', init);
