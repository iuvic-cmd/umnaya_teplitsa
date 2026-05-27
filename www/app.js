/**
 * Умная Теплица v4.0 — app.js
 * Архитектура: EventEmitter + модульные классы
 * Исправлены все ошибки v1/v2, добавлен ESP32Service, WeatherService с fallback
 */

'use strict';

// ====================================================================
// UTILITIES
// ====================================================================
const rnd   = (a, b) => a + Math.random() * (b - a);
const rndn  = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad   = (n) => String(n).padStart(2, '0');
const el    = (id) => document.getElementById(id);
const setH  = (id, h) => { const e = el(id); if (e) e.innerHTML  = h; };
const setT  = (id, t) => { const e = el(id); if (e) e.textContent = t; };
const setW  = (id, p) => { const e = el(id); if (e) e.style.width = Math.round(clamp(p, 0, 100)) + '%'; };

// ====================================================================
// КОНСТАНТЫ
// ====================================================================
const WEATHER_API_KEY = 'ecff0695fb86204bc7154641eb257cad';

const REGIONS = {
  chisinau:   { name: 'Кишинёв',         lat: 47.01, lon: 28.86 },
  moscow:     { name: 'Москва',           lat: 55.75, lon: 37.62 },
  spb:        { name: 'Санкт-Петербург',  lat: 59.95, lon: 30.32 },
  krasnodar:  { name: 'Краснодар',        lat: 45.03, lon: 38.97 },
  sochi:      { name: 'Сочи',             lat: 43.58, lon: 39.72 },
  minsk:      { name: 'Минск',            lat: 53.90, lon: 27.57 },
  kyiv:       { name: 'Киев',             lat: 50.45, lon: 30.52 },
  almaty:     { name: 'Алматы',           lat: 43.26, lon: 76.95 },
};

const CROPS = {
  tomato:      { name: 'Томаты',      min: 14, max: 16 },
  cucumber:    { name: 'Огурцы',      min: 12, max: 14 },
  pepper:      { name: 'Перцы',       min: 14, max: 16 },
  eggplant:    { name: 'Баклажаны',   min: 14, max: 16 },
  strawberry:  { name: 'Клубника',    min:  8, max: 12 },
  lettuce:     { name: 'Салат',       min: 12, max: 14 },
  radish:      { name: 'Редис',       min: 12, max: 14 },
  onion:       { name: 'Лук зелёный', min: 12, max: 14 },
  basil:       { name: 'Базилик',     min: 14, max: 16 },
  microgreens: { name: 'Микрозелень', min: 14, max: 16 },
  greens:      { name: 'Зелень',      min: 12, max: 16 },
};

const CROP_PRESETS = {
  tomato:      { name:'🍅 Томаты',      icon:'🍅', heaterOn:18, heaterOff:24, fanOn:28, fanOff:25, humidOn:65, humidOff:80, co2Alert:1500, soilMin:55, waterSec:45, desc:'Теплолюбивая, высокая влажность' },
  cucumber:    { name:'🥒 Огурцы',      icon:'🥒', heaterOn:20, heaterOff:26, fanOn:27, fanOff:24, humidOn:75, humidOff:90, co2Alert:1200, soilMin:60, waterSec:60, desc:'Высокая влажность, обильный полив' },
  pepper:      { name:'🌶 Перцы',       icon:'🌶', heaterOn:19, heaterOff:25, fanOn:29, fanOff:26, humidOn:60, humidOff:75, co2Alert:1400, soilMin:50, waterSec:40, desc:'Как томаты, чуть суше' },
  eggplant:    { name:'🍆 Баклажаны',   icon:'🍆', heaterOn:20, heaterOff:27, fanOn:30, fanOff:26, humidOn:65, humidOff:80, co2Alert:1300, soilMin:55, waterSec:50, desc:'Теплолюбивые, умеренный полив' },
  strawberry:  { name:'🍓 Клубника',    icon:'🍓', heaterOn:14, heaterOff:22, fanOn:26, fanOff:22, humidOn:70, humidOff:85, co2Alert:1000, soilMin:45, waterSec:35, desc:'Прохладнее, капельный полив' },
  lettuce:     { name:'🥬 Салат',       icon:'🥬', heaterOn:14, heaterOff:21, fanOn:25, fanOff:21, humidOn:60, humidOff:75, co2Alert:1000, soilMin:50, waterSec:30, desc:'Прохладная, короткий день' },
  radish:      { name:'🟢 Редис',       icon:'🟢', heaterOn:13, heaterOff:20, fanOn:24, fanOff:20, humidOn:65, humidOff:80, co2Alert: 900, soilMin:55, waterSec:40, desc:'Холодостойкий, быстрый цикл' },
  onion:       { name:'🧅 Лук зелёный', icon:'🧅', heaterOn:14, heaterOff:22, fanOn:26, fanOff:22, humidOn:60, humidOff:75, co2Alert:1000, soilMin:50, waterSec:35, desc:'Неприхотлив' },
  basil:       { name:'🌿 Базилик',     icon:'🌿', heaterOn:20, heaterOff:27, fanOn:29, fanOff:25, humidOn:65, humidOff:80, co2Alert:1400, soilMin:55, waterSec:45, desc:'Тепло и много света' },
  microgreens: { name:'🌱 Микрозелень', icon:'🌱', heaterOn:18, heaterOff:24, fanOn:26, fanOff:22, humidOn:70, humidOff:85, co2Alert:1100, soilMin:60, waterSec:20, desc:'Высокая влажность, частый полив' },
  greens:      { name:'🥗 Зелень',      icon:'🥗', heaterOn:16, heaterOff:23, fanOn:27, fanOff:23, humidOn:65, humidOff:80, co2Alert:1200, soilMin:50, waterSec:40, desc:'Универсальный режим' },
};

const DEFAULT_CFG = {
  heaterOn:18, heaterOff:24, fanOn:28, fanOff:25,
  humidOn:65,  humidOff:80,  co2Alert:1500,
  soilMin:55,  waterSec:45,
  season:'summer', autoMode:true,
  region:'chisinau', crop:'tomato',
  pollInterval:3,
  notifyAlarms:true, notifyWarns:true, vibrate:true,
};

/** Ограничения значений параметров */
const CFG_BOUNDS = {
  heaterOn:[5,35],  heaterOff:[10,40],
  fanOn:[20,45],    fanOff:[15,42],
  humidOn:[20,90],  humidOff:[25,100],
  co2Alert:[400,2500], soilMin:[10,90], waterSec:[5,300],
};

const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня',
                   'июля','августа','сентября','октября','ноября','декабря'];
const RU_DAYS   = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

// ====================================================================
// EVENT EMITTER
// ====================================================================
class EventEmitter {
  constructor() { this._l = {}; }

  on(e, fn)  { (this._l[e] = this._l[e] || []).push(fn); }
  off(e, fn) { if (this._l[e]) this._l[e] = this._l[e].filter(f => f !== fn); }

  emit(e, ...args) {
    (this._l[e] || []).forEach(fn => {
      try { fn(...args); } catch(err) { console.error('[Bus]', e, err); }
    });
  }
}

// ====================================================================
// LIGHTING CALCULATOR  (астрономические расчёты)
// ====================================================================
class LightingCalculator {
  /** Длина светового дня в часах для заданной широты и даты */
  static calcDayLength(lat, date = new Date()) {
    const doy = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    const P   = Math.asin(0.39795 *
                  Math.cos(0.2163108 + 2 *
                    Math.atan(0.9671396 * Math.tan(0.00860 * (doy - 186)))));
    const arg = (Math.sin(0.8333 * Math.PI / 180) +
                 Math.sin(lat   * Math.PI / 180) * Math.sin(P)) /
                (Math.cos(lat   * Math.PI / 180) * Math.cos(P));
    const D   = 24 - (24 / Math.PI) * Math.acos(Math.max(-1, Math.min(1, arg)));
    return Math.max(0, Math.min(24, Math.round(D * 10) / 10));
  }

  /** Время восхода / заката */
  static calcSunTimes(lat, date = new Date()) {
    const dl = this.calcDayLength(lat, date);
    const noon = 13, half = dl / 2;
    return { rise: noon - half, set: noon + half, dl };
  }

  /** Десятичные часы → HH:MM */
  static hm(h) {
    let hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (mm === 60) { hh++; mm = 0; }
    return pad(hh) + ':' + pad(mm);
  }
}

// ====================================================================
// STATE MANAGER
// ====================================================================
class StateManager {
  constructor() {
    // Датчики
    this.tempAir    = 24.5;
    this.tempSoil   = 19.2;
    this.humidity   = 65;
    this.co2        = 680;
    this.lux        = 45000;
    this.pressure   = 1013;
    this.soil       = [62, 58, 71, 45];
    this.waterLvl   = 78;
    this.condensate = 45;

    // Устройства
    this.heater     = false;
    this.fan        = false;
    this.humidifier = false;
    this.pumps      = [false, false, false, false];
    this.pumpTimers = [null,  null,  null,  null];

    // История для спарклайнов (последние 30 точек)
    this.hist = { temp:[], hum:[], co2:[], lux:[] };

    // Аварии
    this.alarms     = [];
    this.alarmIdSet = {};

    // Камеры
    this.cameras = [
      { name:'CAM 1', label:'Вход',    url:'' },
      { name:'CAM 2', label:'Грядки',  url:'' },
      { name:'CAM 3', label:'Клапаны', url:'' },
      { name:'CAM 4', label:'Бак',     url:'' },
    ];
    this.selCam = 0;

    // Конфиг
    this.cfg = { ...DEFAULT_CFG };

    // Лог событий
    this.logs = [];

    // Уличная погода (заполняется WeatherService)
    this.outdoor = null;
  }

  /**
   * Симуляция датчиков.
   * Если ESP32 подключён — не трогаем tempAir и humidity (реальные данные).
   */
  simulate(espConnected = false) {
    if (!espConnected) {
      this.tempAir  = rndn(clamp(this.tempAir  + rnd(-0.3,  0.3),  5,  45), 1);
      this.humidity = clamp(Math.round(this.humidity + rnd(-1.5, 1.5)), 20, 100);
    }
    // CO₂, свет, почва — всегда симулируем (нет датчика на ESP32 базовой версии)
    this.co2      = clamp(Math.round(this.co2  + rnd(-20,   20)),    300, 2500);
    this.lux      = clamp(Math.round(this.lux  + rnd(-1000, 1000)),    0, 100000);
    this.soil[0]  = clamp(Math.round(this.soil[0] + rnd(-1,  1)),     5, 100);
    this.soil[3]  = clamp(Math.round(this.soil[3] + rnd(-1.5, 1.5)),  5, 100);

    const push = (a, v) => { a.push(v); if (a.length > 30) a.shift(); };
    push(this.hist.temp, this.tempAir);
    push(this.hist.hum,  this.humidity);
    push(this.hist.co2,  this.co2);
    push(this.hist.lux,  this.lux);
  }

  addLog(text, type = 'ok') {
    const n = new Date();
    const t = pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds());
    this.logs.unshift({ t, text, type });
    if (this.logs.length > 50) this.logs.pop();
  }

  initHistory() {
    for (let i = 0; i < 30; i++) this.simulate(false);
  }
}

// ====================================================================
// ALARM MANAGER
// ====================================================================
class AlarmManager {
  constructor(state, bus) {
    this.state = state;
    this.bus   = bus;
  }

  /** Добавить аварию (идемпотентно по id) */
  add(id, text, sev) {
    if (this.state.alarmIdSet[id]) return;
    this.state.alarmIdSet[id] = true;
    this.state.alarms.unshift({ id, text, sev, ts: new Date() });
    this.state.addLog('🚨 ' + text, 'err');
    if (this.state.cfg.vibrate && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    this.bus.emit('alarms:changed');
  }

  /** Снять конкретную аварию */
  clear(id) {
    if (!this.state.alarmIdSet[id]) return;
    this.state.alarmIdSet[id] = false;
    this.state.alarms = this.state.alarms.filter(a => a.id !== id);
    this.bus.emit('alarms:changed');
  }

  /** Снять все */
  dismissAll() {
    this.state.alarms     = [];
    this.state.alarmIdSet = {};
    this.bus.emit('alarms:changed');
  }

  /** Проверить все условия аварий */
  checkAll() {
    const s = this.state, c = s.cfg;
    const chk = (id, cond, text, sev) => cond ? this.add(id, text, sev) : this.clear(id);

    // Критические
    chk('temp_hi',    s.tempAir > 38,                           `🔴 Перегрев: ${s.tempAir}°C!`,         'crit');
    chk('temp_lo',    s.tempAir < 5,                            `🔴 Крит. низкая темп.: ${s.tempAir}°C`, 'crit');
    chk('water_crit', s.waterLvl < 8,                           `🔴 Бак пуст! ${s.waterLvl}%`,           'crit');
    chk('pump_dry',   s.pumps.some(Boolean) && s.waterLvl < 5, '🔴 Насос вхолостую! Бак пуст',          'crit');

    // Предупреждения
    if (c.notifyWarns) {
      chk('co2',       s.co2 > c.co2Alert,             `🟡 CO₂ высокий: ${s.co2} ppm (>${c.co2Alert})`, 'warn');
      chk('water_low', s.waterLvl < 20 && s.waterLvl >= 8, `🟡 Бак низкий: ${s.waterLvl}%`,            'warn');
      chk('humid_lo',  s.humidity < 30,                 `🟡 Критически сухо: ${s.humidity}%`,           'warn');
    }
  }
}

// ====================================================================
// AUTO CONTROLLER
// ====================================================================
class AutoController {
  constructor(state, bus) {
    this.state          = state;
    this.bus            = bus;
    this.manualOverride = {};   // { heater:bool, fan:bool, humidifier:bool }
    this._thr           = {};   // троттлинг логов
  }

  /** Основной цикл автоматики */
  run() {
    if (!this.state.cfg.autoMode) return;
    const s = this.state, c = s.cfg;

    // ── Отопление
    if (s.tempAir < c.heaterOn && !s.heater) {
      s.heater = true;
      this._tlog('h_on', `🤖 Авто: Обогрев ВКЛ (${s.tempAir}°C < ${c.heaterOn}°C)`, 60000);
    } else if (s.tempAir > c.heaterOff && s.heater && !this.manualOverride.heater) {
      s.heater = false;
      s.addLog(`🤖 Авто: Обогрев ВЫКЛ (${s.tempAir}°C > ${c.heaterOff}°C)`, 'auto');
    }

    // ── Вентилятор
    if (s.tempAir > c.fanOn && !s.fan) {
      s.fan = true;
      s.addLog(`🤖 Авто: Вентилятор ВКЛ (${s.tempAir}°C)`, 'auto');
    } else if (s.tempAir < c.fanOff && s.fan && !this.manualOverride.fan) {
      s.fan = false;
      s.addLog('🤖 Авто: Вентилятор ВЫКЛ', 'auto');
    }

    // ── Увлажнитель
    if (s.humidity < c.humidOn && !s.humidifier) {
      s.humidifier = true;
      this._tlog('hm_on', `🤖 Авто: Увлажнитель ВКЛ (${s.humidity}%)`, 60000);
    } else if (s.humidity > c.humidOff && s.humidifier && !this.manualOverride.humidifier) {
      s.humidifier = false;
      s.addLog(`🤖 Авто: Увлажнитель ВЫКЛ (${s.humidity}%)`, 'auto');
    }

    // ── Автополив
    s.soil.forEach((v, i) => {
      if (v < c.soilMin && !s.pumps[i]) this._startPump(i, true);
    });
  }

  /** Ручное переключение устройства (инвертирует состояние) */
  manualToggle(dev) {
    const s = this.state;
    s[dev] = !s[dev];
    this.manualOverride[dev] = s[dev];
    const names = { heater:'🔥 Обогрев', fan:'💨 Вентилятор', humidifier:'💧 Увлажнитель' };
    s.addLog(`${names[dev]} ${s[dev] ? 'ВКЛ (ручной)' : 'ВЫКЛ (ручной)'}`, s[dev] ? 'ok' : 'warn');
    this.bus.emit('toast:show', `${names[dev]} ${s[dev] ? 'включён' : 'выключен'}`);
    this.bus.emit('ui:update');
  }

  /** Ручной запуск полива грядки */
  startPumpManual(i) {
    if (this.state.pumps[i]) return;
    this._startPump(i, false);
    this.bus.emit('toast:show', `💦 Полив Грядка ${i + 1} запущен`);
  }

  /** Остановка полива грядки */
  stopPump(i) {
    const s = this.state;
    if (!s.pumps[i]) return;
    s.pumps[i] = false;
    if (s.pumpTimers[i]) { clearTimeout(s.pumpTimers[i]); s.pumpTimers[i] = null; }
    s.addLog(`💦 Полив Грядка ${i + 1} остановлен`, 'warn');
    this.bus.emit('toast:show', `⏹ Полив Грядка ${i + 1} остановлен`);
    this.bus.emit('ui:update');
  }

  /** Полить все грядки */
  waterAll() {
    for (let i = 0; i < 4; i++) if (!this.state.pumps[i]) this.startPumpManual(i);
    this.bus.emit('toast:show', '💦 Полив всех грядок запущен');
  }

  // ── Приватные ──

  _startPump(i, isAuto) {
    const s = this.state;
    if (s.pumps[i]) return;
    s.pumps[i] = true;
    s.addLog(`💦 Полив Грядка ${i + 1}${isAuto ? ' (авто)' : ' (ручной)'}`, 'ok');
    if (s.pumpTimers[i]) clearTimeout(s.pumpTimers[i]);
    s.pumpTimers[i] = setTimeout(() => {
      s.pumps[i] = false;
      s.addLog(`💦 Полив Грядка ${i + 1} завершён`, 'ok');
      this.bus.emit('ui:update');
    }, s.cfg.waterSec * 1000);
    this.bus.emit('ui:update');
  }

  /** Троттлинг повторяющихся лог-записей */
  _tlog(key, msg, ms) {
    if (!this._thr[key] || Date.now() - this._thr[key] > ms) {
      this.state.addLog(msg, 'auto');
      this._thr[key] = Date.now();
    }
  }
}

// ====================================================================
// CAMERA MANAGER
// ====================================================================
class CameraManager {
  constructor(state, bus) {
    this.state = state;
    this.bus   = bus;
  }

  /** Выбрать активную камеру */
  select(index) {
    this.state.selCam = index;
    const cam = this.state.cameras[index];
    setT('cm-label', `${cam.name} — ${cam.label}`);
    const img = el('cm-img'), ph = el('cm-ph');
    if (cam.url) {
      if (img) { img.src = cam.url; img.style.display = 'block'; }
      if (ph)  ph.style.display = 'none';
    } else {
      if (img) img.style.display = 'none';
      if (ph)  ph.style.display  = 'flex';
    }
    this.bus.emit('cameras:render');
  }

  /** Применить URL потока для камеры */
  applyUrl(index, url) {
    this.state.cameras[index].url = url.trim();
    this.select(index);
    this.bus.emit('toast:show',
      url.trim() ? `📷 ${this.state.cameras[index].name} подключена` : '📷 URL очищен');
  }
}

// ====================================================================
// DASHBOARD RENDERER — всё взаимодействие с DOM
// ====================================================================
class DashboardRenderer {
  constructor(state, bus) {
    this.state = state;
    this.bus   = bus;
  }

  /** Полное обновление интерфейса */
  updateAll() {
    this._clock();
    this._dashboard();
    this._sensors();
    this._climateToggles();
    this._irrigation();
    this._lighting();
    this._systemBadges();
    this._logList();
    this._alarmUI();
  }

  /** Перерисовать все спарклайны */
  drawSparklines() {
    this._spark('sp-temp', this.state.hist.temp, '#00ff7f');
    this._spark('sp-hum',  this.state.hist.hum,  '#00b4fc');
    this._spark('sp-co2',  this.state.hist.co2,  '#ffa502');
    this._spark('sp-lux',  this.state.hist.lux,  '#fbbf24');
  }

  /** Обновить UI сезона и все зависимые элементы */
  updateSeasonUI() {
    const season = this.state.cfg.season, sum = season === 'summer';
    const bar = el('season-bar');
    if (bar) bar.className = 'season-bar ' + season;
    setH('season-label', sum ? '☀️ Режим: ЛЕТО' : '❄️ Режим: ЗИМА');
    const bs = el('sbtn-summer'), bw = el('sbtn-winter');
    if (bs) bs.className = 'season-btn' + (sum ? ' active summer' : '');
    if (bw) bw.className = 'season-btn' + (sum ? '' : ' active winter');
    // Вентиляция
    const vmb = el('vent-mode-badge');
    if (vmb) { vmb.textContent = sum ? 'ЛЕТО' : 'ЗИМА'; vmb.className = 'badge ' + (sum ? 'b-warn' : 'b-info'); }
    setT('vent-mode-hint', sum ? 'Забор свежего воздуха с улицы' : 'Рециркуляция внутри теплицы');
    // Климат: целевые значения
    const lb = el('clim-season-lbl'); if (lb) lb.textContent = sum ? 'ЛЕТО' : 'ЗИМА';
    setH('clim-ttarget', (sum ? '22' : '18') + '<span class="munit">°C</span>');
    setH('clim-htarget', '70<span class="munit">%</span>');
    this.updateClimateHints();
  }

  /** Обновить подсказки порогов в карточках климата */
  updateClimateHints() {
    const c = this.state.cfg;
    setT('heat-hint',  `Вкл при <${c.heaterOn}°C, Выкл при >${c.heaterOff}°C`);
    setT('fan-hint',   `Вкл при >${c.fanOn}°C, Выкл при <${c.fanOff}°C`);
    setT('humid-hint', `Вкл при <${c.humidOn}%, Выкл при >${c.humidOff}%`);
  }

  /** Обновить виджет уличной погоды */
  updateWeatherUI() {
    const w = this.state.outdoor;
    if (!w) {
      setT('ow-desc',    'Нет данных о погоде');
      setT('ow-updated', '');
      return;
    }
    setT('ow-icon',    w.icon);
    setT('ow-temp',    w.temp + '°C');
    setT('ow-desc',    w.description);
    setT('ow-hum',     '💧 ' + w.humidity + '%');
    setT('ow-wind',    '💨 ' + w.wind + ' м/с');
    setT('ow-pres',    '📊 ' + w.pressure + ' hPa');
    setT('ow-updated', 'Обновлено: ' + w.city);
  }

  // ── Приватные методы ──

  _dashboard() {
    const s = this.state;
    setH('db-temp', s.tempAir.toFixed(1) + '<span class="munit">°C</span>');
    setH('db-hum',  s.humidity           + '<span class="munit">%</span>');
    setH('db-co2',  s.co2                + '<span class="munit">ppm</span>');
    setH('db-lux',  s.lux                + '<span class="munit">lx</span>');
    this._btnToggle('qb-heater', s.heater,     '🔥 Обогрев', 'btn-r');
    this._btnToggle('qb-fan',    s.fan,        '💨 Вентил.',  'btn-g');
    this._btnToggle('qb-humid',  s.humidifier, '💧 Увлажн.',  'btn-i');
  }

  _sensors() {
    const s = this.state;
    setH('s-ta', s.tempAir.toFixed(1)  + '<span class="munit">°C</span>');
    setH('s-hu', s.humidity            + '<span class="munit">%</span>');
    setH('s-ts', s.tempSoil.toFixed(1) + '<span class="munit">°C</span>');
    setH('s-pr', s.pressure            + '<span class="munit">hPa</span>');
    setH('s-co', s.co2                 + '<span class="munit">ppm</span>');
    setH('s-lx', s.lux                 + '<span class="munit">lx</span>');
    setW('s-co-b', Math.min(100, s.co2 / 10));
    setW('s-lx-b', Math.min(100, s.lux / 500));

    const w1 = el('wl1');
    if (w1) { w1.textContent = s.waterLvl + '%'; w1.className = 'badge ' + (s.waterLvl > 20 ? 'b-ok' : 'b-danger'); }
    setW('wl1b', s.waterLvl);

    const w2 = el('wl2');
    if (w2) { w2.textContent = s.condensate + '%'; }
    setW('wl2b', s.condensate);
  }

  _climateToggles() {
    const s = this.state;
    const tf  = el('tog-fan'),    th = el('tog-heater'), thi = el('tog-humid');
    if (tf)  tf.checked  = s.fan;
    if (th)  th.checked  = s.heater;
    if (thi) thi.checked = s.humidifier;
  }

  _irrigation() {
    const s  = this.state;
    const sg = el('soil-grid');
    if (!sg) return;

    sg.innerHTML = s.soil.map((v, i) => {
      const cls      = s.pumps[i] ? 'watering' : (v < s.cfg.soilMin ? 'dry' : '');
      const badgeCls = v > s.cfg.soilMin ? 'b-ok' : 'b-warn';
      const barColor = v > s.cfg.soilMin ? 'var(--green)' : 'var(--warn)';
      const btn      = s.pumps[i]
        ? `<button class="btn btn-w btn-full" style="margin-top:7px;padding:7px;font-size:11px"
             onclick="autoCtrl.stopPump(${i})">⏹ Стоп</button>`
        : `<button class="btn btn-ghost btn-full" style="margin-top:7px;padding:7px;font-size:11px"
             onclick="autoCtrl.startPumpManual(${i})">💦 ${s.cfg.waterSec}с</button>`;
      return `<div class="soil-card ${cls}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="font-size:12px;font-weight:700">🌱 Грядка ${i + 1}</span>
          <span class="badge ${badgeCls}">${v}%</span>
        </div>
        <div class="prog"><div class="pf" style="width:${v}%;background:${barColor}"></div></div>
        ${btn}
      </div>`;
    }).join('');

    setW('irr-wl', s.waterLvl);
    const ib = el('irr-wlb');
    if (ib) { ib.textContent = s.waterLvl + '%'; ib.className = 'badge ' + (s.waterLvl > 20 ? 'b-ok' : 'b-danger'); }
  }

  _lighting() {
    setH('l-lux', this.state.lux + '<span class="munit">lx</span>');
  }

  _systemBadges() {
    const s = this.state;
    this._badge('sys-heater', s.heater,     'ВКЛ', 'ВЫКЛ');
    this._badge('sys-fan',    s.fan,        'ВКЛ', 'ВЫКЛ');
    this._badge('sys-humid',  s.humidifier, 'ВКЛ', 'ВЫКЛ');
    const wb = el('sys-water');
    if (wb) {
      wb.textContent = s.waterLvl + '%';
      wb.className   = 'badge ' + (s.waterLvl > 20 ? 'b-ok' : 'b-danger');
    }
  }

  _logList() {
    const ll = el('log-list');
    if (!ll) return;
    const logs = this.state.logs;
    if (!logs.length) {
      ll.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:11px;padding:10px">Нет событий</div>';
      return;
    }
    const cls = { err:'li-err', warn:'li-warn', auto:'li-auto', ok:'li-ok', esp:'li-esp' };
    ll.innerHTML = logs.slice(0, 15).map(l =>
      `<div class="log-item ${cls[l.type] || 'li-ok'}">
        <span>${l.text}</span>
        <span class="log-t">${l.t}</span>
      </div>`
    ).join('');
  }

  _alarmUI() {
    const active = this.state.alarms;
    const panel  = el('alarm-list');
    if (!panel) return;

    if (!active.length) {
      panel.innerHTML =
        '<div style="padding:12px 14px;font-size:12px;color:var(--muted)">Нет активных аварий ✓</div>';
    } else {
      const clsMap = { crit:'alarm-sev-crit', warn:'alarm-sev-warn', info:'alarm-sev-info' };
      panel.innerHTML = active.map(a => {
        const ts = pad(a.ts.getHours()) + ':' + pad(a.ts.getMinutes());
        return `<div class="alarm-item">
          <span class="${clsMap[a.sev] || ''}">${a.text}</span>
          <span style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <span style="font-size:10px;color:var(--muted)">${ts}</span>
            <button class="alarm-dismiss" onclick="alarmMgr.clear('${a.id}')">✕</button>
          </span>
        </div>`;
      }).join('');
    }

    const cnt   = active.length;
    const badge = el('alarm-count');
    if (badge) {
      badge.textContent = cnt;
      badge.style.display = cnt > 0 ? 'flex' : 'none';
    }
  }

  _clock() {
    const n = new Date();
    setT('hdr-time', pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds()));
    setT('hdr-date', RU_DAYS[n.getDay()] + ', ' + n.getDate() + ' ' + RU_MONTHS[n.getMonth()] + ' ' + n.getFullYear());
    setT('cm-time',  pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds()));
  }

  _spark(cid, data, color) {
    const c = el(cid);
    if (!c || data.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = c.offsetWidth  || 120;
    const H   = c.offsetHeight || 24;
    c.width  = W * dpr;
    c.height = H * dpr;
    c.style.width  = W + 'px';
    c.style.height = H + 'px';
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const mn  = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
    const xs  = i => (i / (data.length - 1)) * W;
    const ys  = v => H - ((v - mn) / rng) * (H - 2) - 1;
    ctx.beginPath();
    ctx.moveTo(xs(0), ys(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(xs(i), ys(data[i]));
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.lineTo(xs(data.length - 1), H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle   = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _btnToggle(id, on, label, onCls) {
    const e = el(id);
    if (!e) return;
    e.className   = 'btn ' + (on ? onCls : 'btn-ghost');
    e.textContent = (on ? '⏹ ' : '') + label;
  }

  _badge(id, on, onT, offT) {
    const e = el(id);
    if (!e) return;
    e.textContent = on ? onT : offT;
    e.className   = 'badge ' + (on ? 'b-ok' : 'b-dim');
  }
}

// ====================================================================
// WEATHER SERVICE — OpenWeatherMap + Open-Meteo fallback
// ====================================================================
class WeatherService {
  constructor(state, bus) {
    this.state = state;
    this.bus   = bus;
  }

  /** Запустить: первый запрос сразу, затем каждые 10 минут */
  start() {
    this._fetch();
    setInterval(() => this._fetch(), 10 * 60 * 1000);
  }

  async _fetch() {
    const reg = REGIONS[this.state.cfg.region];
    if (!reg) return;
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather` +
        `?lat=${reg.lat}&lon=${reg.lon}&appid=${WEATHER_API_KEY}&units=metric&lang=ru`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('OWM HTTP ' + res.status);
      const d = await res.json();
      this.state.outdoor = {
        temp:        Math.round(d.main.temp * 10) / 10,
        humidity:    d.main.humidity,
        pressure:    d.main.pressure,
        wind:        Math.round(d.wind.speed * 10) / 10,
        description: d.weather[0].description,
        icon:        this._owmIcon(d.weather[0].id),
        city:        d.name,
        updated:     new Date(),
      };
      this.state.addLog(`🌤 Погода: ${this.state.outdoor.icon} ${this.state.outdoor.temp}°C`, 'ok');
      this.bus.emit('weather:updated');
    } catch {
      await this._fetchFallback(reg);
    }
  }

  /** Open-Meteo — бесплатно, без токена */
  async _fetchFallback(reg) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${reg.lat}&longitude=${reg.lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,surface_pressure` +
        `&wind_speed_unit=ms`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('OM HTTP ' + res.status);
      const d = await res.json(), c = d.current;
      this.state.outdoor = {
        temp:        Math.round(c.temperature_2m * 10) / 10,
        humidity:    c.relative_humidity_2m,
        pressure:    Math.round(c.surface_pressure),
        wind:        Math.round(c.wind_speed_10m * 10) / 10,
        description: this._wmoDesc(c.weather_code),
        icon:        this._wmoIcon(c.weather_code),
        city:        reg.name,
        updated:     new Date(),
      };
      this.bus.emit('weather:updated');
    } catch {
      this.state.outdoor = null;
      this.bus.emit('weather:updated');
    }
  }

  _owmIcon(id) {
    if (id >= 200 && id < 300) return '⛈️';
    if (id >= 300 && id < 400) return '🌦️';
    if (id >= 500 && id < 600) return '🌧️';
    if (id >= 600 && id < 700) return '🌨️';
    if (id >= 700 && id < 800) return '🌫️';
    if (id === 800) return '☀️';
    if (id === 801) return '🌤️';
    if (id === 802) return '⛅';
    return '☁️';
  }

  _wmoIcon(c) {
    if (c === 0) return '☀️'; if (c <= 2) return '🌤️'; if (c === 3) return '☁️';
    if (c <= 49) return '🌫️'; if (c <= 59) return '🌦️'; if (c <= 69) return '🌧️';
    if (c <= 79) return '🌨️'; if (c <= 84) return '🌧️'; return '⛈️';
  }

  _wmoDesc(c) {
    const d = {
      0:'ясно', 1:'преим. ясно', 2:'перем. облачность', 3:'пасмурно',
      45:'туман', 48:'изморозь', 51:'морось', 53:'морось', 55:'сильная морось',
      61:'лёгкий дождь', 63:'дождь', 65:'сильный дождь',
      71:'лёгкий снег', 73:'снег', 75:'сильный снег',
      80:'ливень', 81:'сильный ливень', 82:'очень сильный ливень',
      95:'гроза', 96:'гроза с градом', 99:'гроза с сильным градом',
    };
    return d[c] || 'перем. облачность';
  }
}

// ====================================================================
// ESP32 SERVICE
// ====================================================================
class ESP32Service {
  constructor(state, bus) {
    this.state       = state;
    this.bus         = bus;
    this.ip          = localStorage.getItem('esp32_ip') || '';
    this.connected   = false;
    this.failCount   = 0;
    this.pollSeconds = 3;
    this._interval   = null;
    this.MAX_FAILS   = 3;
  }

  /** Задать IP и запустить опрос */
  setIp(ip) {
    this.ip = ip.trim();
    if (this.ip) localStorage.setItem('esp32_ip', this.ip);
    this.startPolling();
  }

  /** Изменить интервал опроса (секунды, 1–30) */
  setPollSeconds(s) {
    this.pollSeconds = clamp(Math.round(s), 1, 30);
    if (this.ip) this.startPolling();
  }

  /** (Пере)запустить цикл опроса */
  startPolling() {
    if (this._interval) clearInterval(this._interval);
    this.failCount = 0;
    this.bus.emit('esp:status', 'connecting');
    this._fetch();
    this._interval = setInterval(() => this._fetch(), this.pollSeconds * 1000);
  }

  /** Остановить опрос */
  stopPolling() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }

  async _fetch() {
    if (!this.ip) return;
    try {
      const res = await fetch(`http://${this.ip}/data`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();

      // Применяем только валидные числа
      if (typeof d.temp     === 'number' && isFinite(d.temp))     this.state.tempAir  = Math.round(d.temp * 10) / 10;
      if (typeof d.humidity === 'number' && isFinite(d.humidity)) this.state.humidity = Math.round(d.humidity);
      if (typeof d.pressure === 'number' && isFinite(d.pressure)) this.state.pressure = Math.round(d.pressure);
      if (typeof d.soilTemp === 'number' && isFinite(d.soilTemp)) this.state.tempSoil = d.soilTemp;
      if (typeof d.co2      === 'number' && isFinite(d.co2))      this.state.co2      = Math.round(d.co2);
      if (typeof d.lux      === 'number' && isFinite(d.lux))      this.state.lux      = Math.round(d.lux);

      if (this.failCount > 0)
        this.state.addLog(`📡 ESP32 восстановлен: ${this.state.tempAir}°C, ${this.state.humidity}%`, 'esp');

      this.failCount = 0;
      this.connected = true;
      this.bus.emit('esp:status', 'connected');

    } catch {
      this.connected = false;
      this.failCount++;
      if (this.failCount === this.MAX_FAILS)
        this.state.addLog(`❌ ESP32 не отвечает (${this.ip})`, 'err');
      if (this.failCount >= this.MAX_FAILS)
        this.bus.emit('esp:status', 'error');
    }
  }
}

// ====================================================================
// SMART GREENHOUSE APP — главный контроллер
// ====================================================================
class SmartGreenhouseApp {
  constructor() {
    this.bus        = new EventEmitter();
    this.state      = new StateManager();
    this.alarmMgr   = new AlarmManager(this.state, this.bus);
    this.autoCtrl   = new AutoController(this.state, this.bus);
    this.cameraMgr  = new CameraManager(this.state, this.bus);
    this.renderer   = new DashboardRenderer(this.state, this.bus);
    this.weatherSvc = new WeatherService(this.state, this.bus);
    this.esp32      = new ESP32Service(this.state, this.bus);

    this._toastTimer  = null;
    this._alarmOpen   = false;

    this._boot();
  }

  // ══════════════════════════════════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════════════════════════════════
  _boot() {
    this.state.initHistory();
    this.state.addLog('✅ Система запущена', 'ok');
    this.state.addLog('🤖 Авторежим активен', 'auto');
    this.state.addLog('📡 Ожидание подключения ESP32...', 'warn');

    // ── Подписки на события шины
    this.bus.on('ui:update',       ()  => { this.renderer.updateAll(); this.renderer.drawSparklines(); });
    this.bus.on('alarms:changed',  ()  => this.renderer._alarmUI());
    this.bus.on('toast:show',      msg => this._toast(msg));
    this.bus.on('cameras:render',  ()  => this._renderCameras());
    this.bus.on('weather:updated', ()  => this.renderer.updateWeatherUI());
    this.bus.on('esp:status',      s   => this._updateEspUI(s));

    // ── Начальный рендер
    this._applySeason(this.state.cfg.season, false);
    this._updateSettingsUI();
    this._renderCropPresetCards();
    this._updateEspCodeHint();
    this._renderCameras();
    this.renderer.updateAll();
    this.renderer.drawSparklines();
    this._updateLightingPage();

    // ── ESP32: либо начинаем опрос, либо показываем модал
    if (this.esp32.ip) {
      setT('esp-ip-display', this.esp32.ip);
      this.esp32.startPolling();
    } else {
      setTimeout(() => this.openEspModal(), 800);
    }

    // ── Погода
    this.weatherSvc.start();

    // ── Главный тик: 2 сек
    setInterval(() => {
      this.state.simulate(this.esp32.connected);
      this.autoCtrl.run();
      this.alarmMgr.checkAll();
      this.renderer.updateAll();
      this.renderer.drawSparklines();
    }, 2000);
  }

  // ══════════════════════════════════════════════════════════════════
  // НАВИГАЦИЯ
  // ══════════════════════════════════════════════════════════════════
  switchTab(tab) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
    const p = el('page-' + tab); if (p) p.classList.add('active');
    const n = el('nav-'  + tab); if (n) n.classList.add('active');
    if (tab === 'lighting') this._updateLightingPage();
    if (tab === 'cameras')  this._renderCameras();
    if (tab === 'settings') { this._renderCropPresetCards(); this._updateEspCodeHint(); }
  }

  // ══════════════════════════════════════════════════════════════════
  // СЕЗОН
  // ══════════════════════════════════════════════════════════════════
  setSeason(s) {
    this._applySeason(s, true);
  }

  _applySeason(s, withToast) {
    this.state.cfg.season = s;
    this.renderer.updateSeasonUI();
    this.state.addLog('🔄 Сезон: ' + (s === 'summer' ? 'ЛЕТО' : 'ЗИМА'), 'ok');
    if (withToast) this._toast(s === 'summer' ? '☀️ ЛЕТО' : '❄️ ЗИМА');
  }

  // ══════════════════════════════════════════════════════════════════
  // АВТОРЕЖИМ
  // ══════════════════════════════════════════════════════════════════
  toggleAuto() {
    const c = el('tog-auto');
    if (!c) return;
    const on = c.checked;
    this.state.cfg.autoMode = on;
    const b = el('auto-badge');
    if (b) { b.className = 'auto-badge ' + (on ? 'on' : 'off'); b.textContent = on ? '● ВКЛ' : '○ ВЫКЛ'; }
    this.state.addLog('🤖 Авторежим ' + (on ? 'ВКЛ' : 'ВЫКЛ'), on ? 'auto' : 'warn');
    this._toast('Авторежим ' + (on ? 'включён' : 'выключён'));
  }

  // ══════════════════════════════════════════════════════════════════
  // НАСТРОЙКИ
  // ══════════════════════════════════════════════════════════════════
  adjustCfg(key, delta) {
    if (key === 'pollInterval') {
      this.esp32.setPollSeconds(this.esp32.pollSeconds + delta);
      this.state.cfg.pollInterval = this.esp32.pollSeconds;
      const e = el('sv-pollInterval'); if (e) e.textContent = this.esp32.pollSeconds;
      return;
    }
    const bounds = CFG_BOUNDS[key];
    let v = +(this.state.cfg[key] + delta).toFixed(1);
    if (bounds) v = clamp(v, bounds[0], bounds[1]);
    this.state.cfg[key] = v;
    const e = el('sv-' + key); if (e) e.textContent = v;
    this.renderer.updateClimateHints();
  }

  resetSettings() {
    this.state.cfg = { ...DEFAULT_CFG };
    this._updateSettingsUI();
    this._renderCropPresetCards();
    this._toast('↺ Настройки сброшены');
  }

  clearLogs() {
    this.state.logs = [];
    this.renderer._logList();
    this._toast('Лог очищен');
  }

  // ══════════════════════════════════════════════════════════════════
  // ПРЕСЕТЫ КУЛЬТУР
  // ══════════════════════════════════════════════════════════════════
  applyCropPreset(cropKey) {
    const p = CROP_PRESETS[cropKey];
    if (!p) return;
    const c = this.state.cfg;
    Object.assign(c, {
      heaterOn: p.heaterOn, heaterOff: p.heaterOff,
      fanOn:    p.fanOn,    fanOff:    p.fanOff,
      humidOn:  p.humidOn,  humidOff:  p.humidOff,
      co2Alert: p.co2Alert, soilMin:   p.soilMin, waterSec: p.waterSec,
      crop:     cropKey,
    });
    // Синхронизируем все select с новым cropKey
    ['crop-select', 'crop-sel'].forEach(id => {
      const s = el(id); if (s) s.value = cropKey;
    });
    setT('crop-bar-icon', p.icon);
    setT('crop-bar-name', p.name);
    setT('crop-bar-desc', p.desc);
    this._updateSettingsUI();
    this._renderCropPresetCards();
    this.renderer.updateClimateHints();
    this._updateLightingPage();
    this.state.addLog(`🌱 Режим: ${p.name}`, 'ok');
    this._toast(`🌱 ${p.name} активирован`);
  }

  // ══════════════════════════════════════════════════════════════════
  // ОСВЕЩЕНИЕ
  // ══════════════════════════════════════════════════════════════════
  updateLighting() {
    const regSel  = el('region-sel');
    const cropSel = el('crop-sel');
    if (regSel)  this.state.cfg.region = regSel.value;
    if (cropSel) this.state.cfg.crop   = cropSel.value;
    this._updateLightingPage();
  }

  _updateLightingPage() {
    const regKey  = this.state.cfg.region;
    const cropKey = this.state.cfg.crop;
    const reg     = REGIONS[regKey];
    const crop    = CROPS[cropKey];
    if (!reg || !crop) return;

    const now  = new Date();
    const sun  = LightingCalculator.calcSunTimes(reg.lat, now);
    const need = (crop.min + crop.max) / 2;
    const supp = Math.max(0, need - sun.dl);
    const hm   = LightingCalculator.hm;

    setT('pr-region',  reg.name);
    setT('pr-rise',    hm(sun.rise));
    setT('pr-set',     hm(sun.set));
    setT('pr-natural', sun.dl.toFixed(1) + ' ч');
    setT('pr-need',    `${crop.min}–${crop.max} ч (${crop.name})`);
    setT('pr-supp',    supp > 0 ? rndn(supp, 1) + ' ч' : 'Не нужна ✓');
    setH('l-photo',    rndn(sun.dl, 1) + '<span class="munit">ч</span>');

    const sched = el('led-schedule');
    if (!sched) return;

    if (supp > 0) {
      const h = supp / 2;
      sched.innerHTML = `
        <div class="sr"><span>🌅 Досветка утром</span><span class="sr-t">${hm(sun.rise - h)} – ${hm(sun.rise)}</span></div>
        <div class="sr"><span>☀️ Солнце</span><span class="sr-t">${hm(sun.rise)} – ${hm(sun.set)}</span></div>
        <div class="sr"><span>🌆 Досветка вечером</span><span class="sr-t">${hm(sun.set)} – ${hm(sun.set + h)}</span></div>
        <div class="sr"><span>🌙 Темнота</span><span class="sr-t">${hm(sun.set + h)} – ${hm(sun.rise - h + 24)}</span></div>`;
    } else {
      sched.innerHTML = `
        <div class="sr"><span>☀️ Солнце (достаточно)</span><span class="sr-t">${hm(sun.rise)} – ${hm(sun.set)}</span></div>
        <div class="sr"><span>🌙 Темнота</span><span class="sr-t">${hm(sun.set)} – ${hm(sun.rise + 24)}</span></div>`;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // КАМЕРЫ
  // ══════════════════════════════════════════════════════════════════
  _renderCameras() {
    const thumbs   = el('cam-thumbs');
    const settings = el('cam-settings');
    const cams     = this.state.cameras;

    if (thumbs) {
      thumbs.innerHTML = cams.map((cam, i) => `
        <div class="cam-thumb${i === this.state.selCam ? ' sel' : ''}"
             onclick="cameraMgr.select(${i})">
          ${cam.url ? `<img src="${cam.url}" alt="${cam.name}"
            onerror="this.style.display='none'"
            style="width:100%;height:100%;object-fit:cover;display:block">` : ''}
          <div class="cam-ph"${cam.url ? ' style="display:none"' : ''}>
            <span class="ci">📷</span><span>${cam.label}</span>
          </div>
          <div class="cam-ov"><span class="cam-tag">${cam.name}</span></div>
        </div>`).join('');
    }

    if (settings) {
      settings.innerHTML = cams.map((cam, i) => `
        <div style="margin-bottom:8px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px">
            ${cam.name} — ${cam.label}
          </div>
          <div class="url-row">
            <input class="url-inp" id="curl-${i}"
              placeholder="http://192.168.x.x/mjpeg или /snapshot"
              value="${cam.url}">
            <button class="btn btn-g" style="flex-shrink:0;padding:8px 10px"
              onclick="cameraMgr.applyUrl(${i}, document.getElementById('curl-${i}').value)">
              ▶
            </button>
          </div>
        </div>`).join('');
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // ESP32 UI
  // ══════════════════════════════════════════════════════════════════
  openEspModal() {
    const inp = el('esp-ip-input'); if (inp) inp.value = this.esp32.ip;
    const m   = el('modal-esp');   if (m)   m.classList.remove('hidden');
  }

  closeEspModal() {
    const m = el('modal-esp'); if (m) m.classList.add('hidden');
    if (!this.esp32.ip) {
      this.state.addLog('📊 Режим симуляции (ESP32 не задан)', 'warn');
      this._updateEspUI('disconnected');
    }
  }

  saveEspIp() {
    const inp = el('esp-ip-input'); if (!inp) return;
    const ip  = inp.value.trim();
    if (!ip) { this._toast('⚠ Введите IP-адрес'); return; }
    const m = el('modal-esp'); if (m) m.classList.add('hidden');
    this.esp32.setIp(ip);
    setT('esp-ip-display', ip);
    this._toast('📡 Подключение к ESP32...');
  }

  _updateEspUI(status) {
    const bar   = el('esp-bar');
    const label = el('esp-label');
    const sub   = el('esp-sub');
    const badge = el('sensor-src-badge');
    if (!bar) return;

    bar.className = 'esp-bar ' + {
      connected:    'connected',
      connecting:   'connecting',
      error:        'disconnected',
      disconnected: 'disconnected',
    }[status] || 'disconnected';

    switch (status) {
      case 'connected':
        if (label) label.textContent = `📡 ESP32 — ${this.esp32.ip}`;
        if (sub)   sub.textContent   = `${this.state.tempAir}°C · ${this.state.humidity}% · онлайн`;
        if (badge) { badge.textContent = 'LIVE · ESP32'; badge.className = 'badge b-ok'; }
        break;
      case 'connecting':
        if (label) label.textContent = '⏳ Подключение...';
        if (sub)   sub.textContent   = this.esp32.ip;
        if (badge) { badge.textContent = 'SIM'; badge.className = 'badge b-warn'; }
        break;
      case 'error':
        if (label) label.textContent = '❌ ESP32 недоступен';
        if (sub)   sub.textContent   = `Нет ответа · ${this.esp32.failCount} ошибок`;
        if (badge) { badge.textContent = 'SIM'; badge.className = 'badge b-warn'; }
        break;
      default:
        if (label) label.textContent = 'ESP32 не подключён';
        if (sub)   sub.textContent   = 'Нажмите «Настроить»';
        if (badge) { badge.textContent = 'SIM'; badge.className = 'badge b-dim'; }
    }
    setT('esp-ip-display', this.esp32.ip || 'Не задан — режим симуляции');
  }

  _updateEspCodeHint() {
    const hint = el('esp-code-hint');
    if (!hint) return;
    hint.innerHTML = `
#include &lt;WiFi.h&gt;<br>
#include &lt;WebServer.h&gt;<br>
#include &lt;DHT.h&gt;<br><br>
const char* ssid = "ВАШ_WIFI";<br>
const char* password = "ВАШ_ПАРОЛЬ";<br>
#define DHTPIN 15<br>
#define DHTTYPE DHT22<br>
DHT dht(DHTPIN, DHTTYPE);<br>
WebServer server(80);<br><br>
void handleData() {<br>
&nbsp;&nbsp;float t = dht.readTemperature();<br>
&nbsp;&nbsp;float h = dht.readHumidity();<br>
&nbsp;&nbsp;// Добавьте другие датчики сюда<br>
&nbsp;&nbsp;String j = "{\\"temp\\":" + String(t, 1) +<br>
&nbsp;&nbsp;&nbsp;&nbsp;",\\"humidity\\":" + String(h, 1) + "}";<br>
&nbsp;&nbsp;server.sendHeader("Access-Control-Allow-Origin", "*");<br>
&nbsp;&nbsp;server.send(200, "application/json", j);<br>
}<br>
void setup() {<br>
&nbsp;&nbsp;Serial.begin(115200);<br>
&nbsp;&nbsp;dht.begin();<br>
&nbsp;&nbsp;WiFi.begin(ssid, password);<br>
&nbsp;&nbsp;while (WiFi.status() != WL_CONNECTED) delay(500);<br>
&nbsp;&nbsp;Serial.println(WiFi.localIP());<br>
&nbsp;&nbsp;server.on("/data", handleData);<br>
&nbsp;&nbsp;server.begin();<br>
}<br>
void loop() { server.handleClient(); }`.trim();
  }

  // ══════════════════════════════════════════════════════════════════
  // ВНУТРЕННИЕ ХЕЛПЕРЫ
  // ══════════════════════════════════════════════════════════════════
  _updateSettingsUI() {
    ['heaterOn','heaterOff','fanOn','humidOn','humidOff','co2Alert','soilMin','waterSec'].forEach(k => {
      const e = el('sv-' + k); if (e) e.textContent = this.state.cfg[k];
    });
    const pi = el('sv-pollInterval'); if (pi) pi.textContent = this.esp32.pollSeconds;
    this.renderer.updateClimateHints();
  }

  _renderCropPresetCards() {
    const g = el('crop-preset-grid');
    if (!g) return;
    g.innerHTML = Object.entries(CROP_PRESETS).map(([k, p]) => `
      <div class="crop-preset-card${k === this.state.cfg.crop ? ' active' : ''}"
           onclick="applyCropPreset('${k}')">
        <div class="cp-icon">${p.icon}</div>
        <div class="cp-name">${p.name.replace(/^\S+\s/, '')}</div>
        <div class="cp-desc">${p.desc}</div>
        <div class="cp-info">
          <span>🌡 ${p.heaterOn}–${p.heaterOff}°C</span>
          <span>💧 ${p.humidOn}–${p.humidOff}%</span>
        </div>
      </div>`).join('');
  }

  toggleAlarmPanel() {
    this._alarmOpen = !this._alarmOpen;
    const p = el('alarm-panel');
    if (p) p.classList.toggle('open', this._alarmOpen);
  }

  _toast(msg) {
    const t = el('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
}

// ====================================================================
// ИНИЦИАЛИЗАЦИЯ
// ====================================================================
const app = new SmartGreenhouseApp();

// ── Глобальные функции для onclick-атрибутов в HTML ──────────────────
window.app          = app;
window.autoCtrl     = app.autoCtrl;
window.alarmMgr     = app.alarmMgr;
window.cameraMgr    = app.cameraMgr;

window.switchTab         = t       => app.switchTab(t);
window.setSeason         = s       => app.setSeason(s);
window.toggleAuto        = ()      => app.toggleAuto();
window.adj               = (k, d)  => app.adjustCfg(k, d);
window.resetSettings     = ()      => app.resetSettings();
window.clearLogs         = ()      => app.clearLogs();
window.clearAlarms       = ()      => app.alarmMgr.dismissAll();
window.dismissAllAlarms  = ()      => app.alarmMgr.dismissAll();
window.applyCropPreset   = k       => app.applyCropPreset(k);
window.onCropPresetChange= ()      => app.applyCropPreset((el('crop-select') || {}).value);
window.onRegionChange    = ()      => app.updateLighting();
window.onCropChange      = ()      => app.updateLighting();
window.waterAll          = ()      => app.autoCtrl.waterAll();
window.manualToggle      = d       => app.autoCtrl.manualToggle(d);
window.toggleAlarmPanel  = ()      => app.toggleAlarmPanel();
window.openEspModal      = ()      => app.openEspModal();
window.closeEspModal     = ()      => app.closeEspModal();
window.saveEspIp         = ()      => app.saveEspIp();

console.log('🌿 Умная Теплица v4.0 — готово!');
