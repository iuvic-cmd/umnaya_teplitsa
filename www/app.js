'use strict';

// ========== СОСТОЯНИЕ ==========
class AppState {
  constructor() {
    this.tempAir   = 0;
    this.humidity  = 0;
    this.tempSoil  = 0;
    this.lux       = 0;
    this.soil      = [0, 0, 0, 0];
    this.heater    = false;
    this.fan       = false;
    this.valve     = false;
    this.humidifier = false;
    this.pumps     = [false, false, false, false];
    this.light     = false;
    this.logs      = [];
  }

  addLog(msg, type = 'info') {
    this.logs.unshift({ msg, type, time: new Date().toLocaleTimeString() });
    if (this.logs.length > 50) this.logs.pop();
  }
}

// ========== ШИНА СОБЫТИЙ ==========
class EventBus {
  constructor() { this._events = {}; }
  on(evt, fn) { (this._events[evt] = this._events[evt] || []).push(fn); }
  emit(evt, data) { (this._events[evt] || []).forEach(fn => fn(data)); }
}

// ========== ПРИЛОЖЕНИЕ ==========
class App {
  constructor() {
    this.state = new AppState();
    this.bus   = new EventBus();
    this.esp32 = new TelegramStatusService(this.state, this.bus);
    
    this.bus.on('ui:update', () => this.render());
    this.bus.on('esp:status', (s) => console.log('ESP:', s));
    this.bus.on('toast:show', (msg) => this._toast(msg));
    
    this.render();
    this.esp32.startPolling();
  }

  _toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:20px;z-index:9999;transition:opacity 0.3s;opacity:0;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.style.opacity = '0', 2500);
  }

  render() {
    const s = this.state;
    const html = `
      <div class="header">
        <h1>🌿 Умная Теплица</h1>
        <div class="status-dot ${s.heater ? 'on' : ''}"></div>
      </div>
      <div class="sensors">
        <div class="sensor">🌡 Температура: <b>${s.tempAir.toFixed(1)}°C</b></div>
        <div class="sensor">💧 Влажность: <b>${s.humidity.toFixed(0)}%</b></div>
        <div class="sensor">☀️ Освещение: <b>${s.lux} лк</b></div>
        <div class="sensor">🌱 Почва 1: <b>${s.soil[0]}%</b></div>
        <div class="sensor">🌱 Почва 2: <b>${s.soil[1]}%</b></div>
      </div>
      <div class="controls">
        <button onclick="window.manualToggle('heater')" class="${s.heater ? 'on' : ''}">🔥 Обогрев</button>
        <button onclick="window.manualToggle('fan')" class="${s.fan ? 'on' : ''}">🌀 Вентилятор</button>
        <button onclick="window.manualToggle('humidifier')" class="${s.humidifier ? 'on' : ''}">💨 Увлажнитель</button>
        <button onclick="window.waterAll()">💦 Полив ВКЛ</button>
        <button onclick="window.stopPumpRemote()">⏹ Полив ВЫКЛ</button>
      </div>
      <div class="logs">
        ${s.logs.slice(0, 10).map(l => `<div class="log ${l.type}">${l.time} ${l.msg}</div>`).join('')}
      </div>
    `;
    document.getElementById('app').innerHTML = html;
  }
}

window.app = new App();
