// ================================================
//  APP.JS — ТОЛЬКО ЭТОТ ФАЙЛ МЕНЯЕШЬ ДЛЯ НОВОГО ПРИЛОЖЕНИЯ
// ================================================

const APP_CONFIG = {
  name: "Умная Теплица",      // Название приложения
  logo: "🌿",                  // Иконка (эмодзи или текст)
  version: "1.0.0",
  accentColor: "#4ade80",      // Главный цвет (CSS hex)
  darkMode: true,              // true = тёмная тема

  // ── МОДУЛИ ─────────────────────────────────────
  // Чтобы добавить новый экран:
  // 1. Создай файл modules/mymodule.js
  // 2. Добавь строку сюда
  modules: [
    DashboardModule,
    // SensorsModule,   ← раскомментируй когда добавишь датчики
    // CameraModule,    ← раскомментируй когда добавишь камеру
    // SettingsModule,  ← раскомментируй для настроек
  ]
};

// ================================================
//  ДВИЖОК — НЕ ТРОГАЙ
// ================================================

class AppEngine {
  constructor(config) {
    this.config = config;
    this.modules = {};
    this.currentModule = null;
    this.sidebarOpen = false;
  }

  init() {
    this.applyTheme();
    this.setMeta();
    this.registerModules();
    this.buildNav();
    this.bindEvents();
    this.navigate(this.config.modules[0].id);
  }

  applyTheme() {
    const root = document.documentElement;
    root.style.setProperty('--accent', this.config.accentColor);
    if (!this.config.darkMode) document.body.classList.add('light');
  }

  setMeta() {
    document.getElementById('app-title').textContent = this.config.name;
    document.getElementById('sidebar-logo').textContent = this.config.logo;
    document.getElementById('sidebar-name').textContent = this.config.name;
    document.getElementById('app-version').textContent = this.config.version;
  }

  registerModules() {
    this.config.modules.forEach(mod => {
      this.modules[mod.id] = mod;
    });
  }

  buildNav() {
    const list = document.getElementById('nav-list');
    list.innerHTML = '';
    this.config.modules.forEach(mod => {
      const li = document.createElement('li');
      li.innerHTML = `
        <button class="nav-item" data-id="${mod.id}">
          <span class="nav-icon">${mod.icon}</span>
          <span class="nav-label">${mod.name}</span>
        </button>`;
      li.querySelector('button').addEventListener('click', () => {
        this.navigate(mod.id);
        this.closeSidebar();
      });
      list.appendChild(li);
    });
  }

  navigate(id) {
    const mod = this.modules[id];
    if (!mod) return;
    this.currentModule = id;

    // Обновить заголовок
    document.getElementById('header-title').textContent = mod.name;

    // Активная кнопка в nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === id);
    });

    // Рендер страницы
    const container = document.getElementById('page-container');
    container.innerHTML = '';

    // Анимация появления
    container.style.opacity = '0';
    container.style.transform = 'translateY(12px)';

    if (typeof mod.render === 'function') {
      const content = mod.render();
      if (typeof content === 'string') {
        container.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        container.appendChild(content);
      }
    }

    if (typeof mod.mount === 'function') {
      mod.mount();
    }

    requestAnimationFrame(() => {
      container.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    });

    // Кнопки действий в хедере
    const actions = document.getElementById('header-actions');
    actions.innerHTML = '';
    if (mod.actions) {
      mod.actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'icon-btn';
        btn.textContent = action.icon;
        btn.title = action.label;
        btn.addEventListener('click', action.handler);
        actions.appendChild(btn);
      });
    }
  }

  bindEvents() {
    document.getElementById('menu-toggle').addEventListener('click', () => this.toggleSidebar());
    document.getElementById('overlay').addEventListener('click', () => this.closeSidebar());
  }

  toggleSidebar() {
    this.sidebarOpen ? this.closeSidebar() : this.openSidebar();
  }

  openSidebar() {
    this.sidebarOpen = true;
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('visible');
  }

  closeSidebar() {
    this.sidebarOpen = false;
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('visible');
  }
}

// Запуск
const app = new AppEngine(APP_CONFIG);
document.addEventListener('DOMContentLoaded', () => app.init());
