// ================================================
//  modules/dashboard.js — ПРИМЕР МОДУЛЯ
//  Копируй этот файл для создания новых экранов
// ================================================

const DashboardModule = {
  id:   'dashboard',
  name: 'Главная',
  icon: '🏠',

  // Кнопки в правом углу хедера (необязательно)
  actions: [
    {
      icon: '🔔',
      label: 'Уведомления',
      handler: () => alert('Уведомлений нет')
    }
  ],

  // Рендер — возвращает HTML строку
  render() {
    return `
      <!-- Статус системы -->
      <div class="card">
        <div class="card-title">Статус системы</div>
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-size:17px; font-weight:600; margin-bottom:6px;">Всё в порядке</div>
            <div style="font-size:13px; color:var(--text-muted);">Последнее обновление: только что</div>
          </div>
          <span class="badge badge-ok">Онлайн</span>
        </div>
      </div>

      <!-- Быстрые действия -->
      <div class="card">
        <div class="card-title">Быстрые действия</div>
        <div class="btn-grid btn-grid-2">
          <button class="btn btn-primary" onclick="DashboardModule._onAction('start')">▶ Запуск</button>
          <button class="btn btn-secondary" onclick="DashboardModule._onAction('stop')">⏹ Стоп</button>
          <button class="btn btn-secondary" onclick="DashboardModule._onAction('refresh')">🔄 Обновить</button>
          <button class="btn btn-secondary" onclick="DashboardModule._onAction('settings')">⚙️ Настройки</button>
        </div>
      </div>

      <!-- Метрики (пример для датчиков) -->
      <div class="card">
        <div class="card-title">Показатели</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div style="background:var(--surface2); border-radius:var(--radius-sm); padding:12px;">
            <div class="metric">
              <div class="metric-value" id="metric-temp">—<span class="metric-unit">°C</span></div>
              <div class="metric-label">Температура</div>
            </div>
          </div>
          <div style="background:var(--surface2); border-radius:var(--radius-sm); padding:12px;">
            <div class="metric">
              <div class="metric-value" id="metric-hum">—<span class="metric-unit">%</span></div>
              <div class="metric-label">Влажность</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Лог событий -->
      <div class="card">
        <div class="card-title">Последние события</div>
        <div id="event-log" style="display:flex; flex-direction:column; gap:8px;">
          <div style="color:var(--text-muted); font-size:14px; text-align:center; padding:16px;">
            Нет событий
          </div>
        </div>
      </div>
    `;
  },

  // Вызывается после рендера — для логики и таймеров
  mount() {
    // Симуляция данных с датчиков (потом заменишь на реальный fetch)
    this._updateMetrics();
    this._logInterval = setInterval(() => this._updateMetrics(), 5000);
  },

  // Сброс при переходе на другой экран
  unmount() {
    clearInterval(this._logInterval);
  },

  // ── Приватные методы ──────────────────────────

  _updateMetrics() {
    const temp = (20 + Math.random() * 10).toFixed(1);
    const hum  = (55 + Math.random() * 20).toFixed(0);

    const tEl = document.getElementById('metric-temp');
    const hEl = document.getElementById('metric-hum');
    if (tEl) tEl.innerHTML = `${temp}<span class="metric-unit">°C</span>`;
    if (hEl) hEl.innerHTML = `${hum}<span class="metric-unit">%</span>`;

    this._addLog(`🌡 Темп: ${temp}°C  💧 Влажность: ${hum}%`);
  },

  _addLog(text) {
    const log = document.getElementById('event-log');
    if (!log) return;

    const time = new Date().toLocaleTimeString('ru', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    const item = document.createElement('div');
    item.style.cssText = `
      display:flex; justify-content:space-between; align-items:center;
      padding:8px 10px; background:var(--surface2); border-radius:var(--radius-sm);
      font-size:13px;
    `;
    item.innerHTML = `<span>${text}</span><span style="color:var(--text-muted)">${time}</span>`;

    // Убрать заглушку если есть
    if (log.children.length === 1 && log.children[0].textContent.includes('Нет событий')) {
      log.innerHTML = '';
    }

    log.prepend(item);

    // Максимум 10 записей
    while (log.children.length > 10) log.removeChild(log.lastChild);
  },

  _onAction(action) {
    const messages = {
      start:    '▶ Система запущена',
      stop:     '⏹ Система остановлена',
      refresh:  '🔄 Данные обновлены',
      settings: '⚙️ Открыть настройки',
    };
    this._addLog(messages[action] || action);
  }
};
