'use strict';1

class AppState {
  constructor() {
    this.tempAir   = 0;
    this.humidity  = 0;
    this.lux       = 0;
    this.soil      = [0, 0];
    this.heater    = false;
    this.fan       = false;
    this.valve     = false;
    this.humidifier = false;
    this.pumps     = [false, false];
    this.logs      = [];
  }
  addLog(msg, type = 'info') {
    this.logs.unshift({ msg, type, time: new Date().toLocaleTimeString() });
    if (this.logs.length > 50) this.logs.pop();
  }
}

class EventBus {
  constructor() { this._events = {}; }
  on(evt, fn) { (this._events[evt] = this._events[evt] || []).push(fn); }
  emit(evt, data) { (this._events[evt] || []).forEach(fn => fn(data)); }
}

class App {
  constructor() {
    this.state = new AppState();
    this.bus   = new EventBus();
    
    // Автоматически подключаемся к Telegram
    this.esp32 = new TelegramStatusService(this.state, this.bus);
    this.esp32.startPolling();
    
    this.bus.on('ui:update', () => this.render());
    this.bus.on('toast:show', (msg) => this._toast(msg));
    this.render();
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
    document.getElementById('app').innerHTML = `
      <div style="padding:16px;font-family:sans-serif;">
        <h2>🌿 Умная Теплица</h2>
        <p>🌡 Температура: <b>${s.tempAir.toFixed(1)}°C</b></p>
        <p>💧 Влажность: <b>${s.humidity.toFixed(0)}%</b></p>
        <p>☀️ Освещение: <b>${s.lux} лк</b></p>
        <p>🌱 Почва 1: <b>${s.soil[0]}%</b></p>
        <p>🌱 Почва 2: <b>${s.soil[1]}%</b></p>
        <hr>
        <button onclick="window.manualToggle('heater')" style="margin:4px;padding:8px 16px;background:${s.heater?'#4CAF50':'#ddd'}">🔥 Обогрев</button>
        <button onclick="window.manualToggle('fan')" style="margin:4px;padding:8px 16px;background:${s.fan?'#4CAF50':'#ddd'}">🌀 Вентилятор</button>
        <button onclick="window.manualToggle('humidifier')" style="margin:4px;padding:8px 16px;background:${s.humidifier?'#4CAF50':'#ddd'}">💨 Увлажнитель</button>
        <button onclick="window.waterAll()" style="margin:4px;padding:8px 16px;background:#2196F3;color:#fff">💦 Полив ВКЛ</button>
        <button onclick="window.stopPumpRemote()" style="margin:4px;padding:8px 16px;background:#f44336;color:#fff">⏹ Полив ВЫКЛ</button>
      </div>
    `;
  }
}

window.app = new App();
