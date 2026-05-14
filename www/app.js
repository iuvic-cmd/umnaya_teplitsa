/**
 * @fileoverview Smart Greenhouse Dashboard v3.0 — Production-Ready Architecture
 * @description Модульная архитектура с EventEmitter для слабой связанности компонентов.
 *   Все DOM-зависимости централизованы в классе `DashboardRenderer`.
 *   Логика данных инкапсулирована в `StateManager`, `AutoController`, `AlarmManager`.
 */

// ====================================================================
//  UTILITIES — чистые функции, не зависящие от окружения
// ====================================================================

/** Генератор случайного числа в диапазоне [a, b) */
const rnd = (a, b) => a + Math.random() * (b - a);

/** Случайное число с округлением до d знаков */
const rndn = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

/** Ограничение числа диапазоном */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Дополнение числа нулем слева */
const pad = (n) => String(n).padStart(2, '0');

/** Безопасный getElementById */
const el = (id) => document.getElementById(id);

/** Установка innerHTML через data-attribute */
const setH = (id, h) => { const e = el(id); if (e) e.innerHTML = h; };

/** Установка textContent */
const setT = (id, t) => { const e = el(id); if (e) e.textContent = t; };

/** Установка ширины в процентах */
const setW = (id, p) => { const e = el(id); if (e) e.style.width = Math.round(p) + '%'; };

// ====================================================================
//  EVENT EMITTER — простая шина событий
// ====================================================================

class EventEmitter {
    constructor() {
        this._listeners = {};
    }

    on(event, fn) {
        (this._listeners[event] = this._listeners[event] || []).push(fn);
    }

    emit(event, ...args) {
        (this._listeners[event] || []).forEach(fn => fn(...args));
    }
}

// ====================================================================
//  КОНСТАНТЫ И СПРАВОЧНИКИ
// ====================================================================

// ====================================================================
//  WEATHER SERVICE — конфигурация
// ====================================================================

/** 🔑 OpenWeatherMap API ключ */
const WEATHER_API_KEY = 'ecff0695fb86204bc7154641eb257cad';

/** Интервал обновления погоды (мс) */
const WEATHER_UPDATE_INTERVAL = 10 * 60 * 1000; // 10 минут

const REGIONS = {
    murmansk:   {name:'Мурманск',        lat:68.97, lon:33.07},
    spb:        {name:'Санкт-Петербург',  lat:59.95, lon:30.32},
    moscow:     {name:'Москва',          lat:55.75, lon:37.62},
    kazan:      {name:'Казань',          lat:55.79, lon:49.12},
    ekb:        {name:'Екатеринбург',    lat:56.83, lon:60.60},
    novosib:    {name:'Новосибирск',     lat:55.00, lon:82.92},
    krasnodar:  {name:'Краснодар',       lat:45.03, lon:38.97},
    sochi:      {name:'Сочи',            lat:43.58, lon:39.72},
    vladivostok:{name:'Владивосток',     lat:43.12, lon:131.90},
    minsk:      {name:'Минск',           lat:53.90, lon:27.57},
    kyiv:       {name:'Киев',            lat:50.45, lon:30.52},
    almaty:     {name:'Алматы',          lat:43.26, lon:76.95},
    tashkent:   {name:'Ташкент',         lat:41.30, lon:69.27}
};

const CROPS = {
    tomato:     {name:'Томаты',   min:14, max:16},
    cucumber:   {name:'Огурцы',   min:12, max:14},
    pepper:     {name:'Перец',    min:14, max:16},
    lettuce:    {name:'Салат',    min:12, max:14},
    strawberry: {name:'Клубника', min:8,  max:12},
    greens:     {name:'Зелень',   min:12, max:16}
};

const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня',
                   'июля','августа','сентября','октября','ноября','декабря'];
const RU_DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

// Настройки по умолчанию
const DEFAULT_CFG = {
    heaterOn: 15, heaterOff: 22, fanOn: 28, fanOff: 25,
    humidOn: 60, humidOff: 80, co2Alert: 1200,
    soilMin: 40, waterSec: 30,
    season: 'summer', autoMode: true,
    region: 'moscow', crop: 'tomato',
    notifyAlarms: true, notifyWarns: true, vibrate: true
};

// ====================================================================
//  LIGHTING CALCULATOR — инкапсулирует астрономические расчеты
// ====================================================================

class LightingCalculator {
    /** Длина светового дня по широте и дате */
    static calcDayLength(lat, date = new Date()) {
        const doy = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
        const P = Math.asin(0.39795 * Math.cos(0.2163108 + 2 *
            Math.atan(0.9671396 * Math.tan(0.00860 * (doy - 186)))));
        const arg = (Math.sin(0.8333 * Math.PI / 180) +
                     Math.sin(lat * Math.PI / 180) * Math.sin(P)) /
                    (Math.cos(lat * Math.PI / 180) * Math.cos(P));
        const D = 24 - (24 / Math.PI) * Math.acos(Math.max(-1, Math.min(1, arg)));
        return Math.max(0, Math.min(24, Math.round(D * 10) / 10));
    }

    /** Время восхода/заката (приблизительно) */
    static calcSunTimes(lat, date = new Date()) {
        const dl = this.calcDayLength(lat, date);
        const noon = 13; // солнечный полдень ~13:00 местного
        const half = dl / 2;
        return { rise: noon - half, set: noon + half, dl };
    }

    /** Перевод десятичных часов в HH:MM */
    static hoursToHM(h) {
        let hh = Math.floor(h);
        let mm = Math.round((h - hh) * 60);
        if (mm === 60) { hh++; mm = 0; }
        return pad(hh) + ':' + pad(mm);
    }
}

// ====================================================================
//  STATE MANAGER — централизованное хранилище состояния
// ====================================================================

class StateManager {
    constructor() {
        // Сенсоры
        this.tempAir = 24.5;
        this.tempSoil = 19.2;
        this.humidity = 65;
        this.co2 = 680;
        this.lux = 45000;
        this.pressure = 1013;
        this.soil = [62, 58, 71, 45];
        this.waterLvl = 78;
        this.condensate = 45;

        // Устройства
        this.heater = false;
        this.fan = false;
        this.humidifier = false;
        this.pumps = [false, false, false, false];
        this.pumpTimers = [null, null, null, null];

        // LED
        this.redLed = 80;
        this.blueLed = 40;

        // История для спарклайнов
        this.hist = { temp:[], hum:[], co2:[], lux:[] };

        // Аварии
        this.alarms = [];
        this.alarmIdSet = {};

        // Камеры
        this.cameras = [
            {name:'CAM 1', label:'Вход',    url:''},
            {name:'CAM 2', label:'Грядки',  url:''},
            {name:'CAM 3', label:'Клапаны', url:''},
            {name:'CAM 4', label:'Бак',     url:''}
        ];
        this.selCam = 0;

        // Конфигурация
        this.cfg = {...DEFAULT_CFG};

        // Логи
        this.logs = [];

        // Уличная погода (заполняется WeatherService)
        this.outdoor = null;
    }

    /** Симуляция датчиков */
    simulate() {
        this.tempAir  = rndn(clamp(this.tempAir  + rnd(-0.3, 0.3), 5, 45), 1);
        this.humidity = clamp(Math.round(this.humidity + rnd(-1.5, 1.5)), 20, 100);
        this.co2      = clamp(Math.round(this.co2 + rnd(-20, 20)), 300, 2500);
        this.lux      = clamp(Math.round(this.lux + rnd(-1000, 1000)), 0, 100000);
        this.soil[0]  = clamp(Math.round(this.soil[0] + rnd(-1, 1)), 5, 100);
        this.soil[3]  = clamp(Math.round(this.soil[3] + rnd(-1.5, 1.5)), 5, 100);

        const push = (a, v) => { a.push(v); if (a.length > 30) a.shift(); };
        push(this.hist.temp, this.tempAir);
        push(this.hist.hum,  this.humidity);
        push(this.hist.co2,  this.co2);
        push(this.hist.lux,  this.lux);
    }

    /** Добавление записи в лог */
    addLog(text, type = 'ok') {
        const n = new Date();
        const t = pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds());
        this.logs.unshift({t, text, type});
        if (this.logs.length > 40) this.logs.pop();
    }

    /** Инициализация истории */
    initHistory() {
        for (let i = 0; i < 30; i++) this.simulate();
    }
}

// ====================================================================
//  ALARM MANAGER — управление авариями и уведомлениями
// ====================================================================

class AlarmManager {
    /**
     * @param {StateManager} state
     * @param {EventEmitter} bus
     */
    constructor(state, bus) {
        this.state = state;
        this.bus = bus;
    }

    /** Добавить аварию, если еще не активна */
    add(id, text, sev) {
        if (this.state.alarmIdSet[id]) return;
        this.state.alarmIdSet[id] = true;
        this.state.alarms.unshift({id, text, sev, ts: new Date()});
        this.state.addLog('🚨 ' + text, 'err');

        if (this.state.cfg.vibrate && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
        this.bus.emit('alarms:changed');
    }

    /** Снять конкретную аварию */
    clear(id) {
        if (!this.state.alarmIdSet[id]) return;
        this.state.alarmIdSet[id] = false;
        this.state.alarms = this.state.alarms.filter(a => a.id !== id);
        this.bus.emit('alarms:changed');
    }

    /** Проверка всех условий аварий */
    checkAll() {
        const s = this.state;
        const c = s.cfg;

        // Критические
        if (s.tempAir > 38) this.add('temp_hi', `🔴 Перегрев: ${s.tempAir}°C!`, 'crit');
        else this.clear('temp_hi');

        if (s.tempAir < 5) this.add('temp_lo', `🔴 Критически низкая темп.: ${s.tempAir}°C`, 'crit');
        else this.clear('temp_lo');

        if (s.waterLvl < 8) this.add('water_crit', `🔴 Бак полива пуст! ${s.waterLvl}%`, 'crit');
        else this.clear('water_crit');

        // Предупреждения
        if (s.co2 > c.co2Alert && c.notifyWarns)
            this.add('co2', `🟡 CO₂ высокий: ${s.co2} ppm (порог ${c.co2Alert})`, 'warn');
        else this.clear('co2');

        if (s.waterLvl < 20 && s.waterLvl >= 8 && c.notifyWarns)
            this.add('water_low', `🟡 Бак полива низкий: ${s.waterLvl}%`, 'warn');
        else this.clear('water_low');

        if (s.humidity < 30 && c.notifyWarns)
            this.add('humid_lo', `🟡 Критически сухо: ${s.humidity}%`, 'warn');
        else this.clear('humid_lo');

        // Отказы оборудования
        if (s.heater && s.tempAir < c.heaterOn - 10 && c.notifyAlarms)
            this.add('heater_fail', `🔴 Возможный отказ обогревателя! Темп: ${s.tempAir}°C`, 'crit');
        else this.clear('heater_fail');

        if (s.humidifier && s.humidity < 25 && c.notifyAlarms)
            this.add('humid_fail', `🔴 Увлажнитель не справляется! Влажность: ${s.humidity}%`, 'crit');
        else this.clear('humid_fail');

        s.pumps.forEach((pumpOn, i) => {
            if (pumpOn && s.waterLvl < 5)
                this.add('pump_dry', '🔴 Насос работает вхолостую! Бак пуст', 'crit');
        });
        if (s.waterLvl >= 5) this.clear('pump_dry');
    }

    /** Снять все аварии */
    dismissAll() {
        this.state.alarms = [];
        this.state.alarmIdSet = {};
        this.bus.emit('alarms:changed');
    }
}

// ====================================================================
//  AUTO CONTROLLER — логика автоматического управления
// ====================================================================

class AutoController {
    /**
     * @param {StateManager} state
     * @param {EventEmitter} bus
     */
    constructor(state, bus) {
        this.state = state;
        this.bus = bus;
        this.autoLogThrottle = {};
        this.manualOverride = {};
    }

    /** Основной цикл автоматического управления */
    run() {
        if (!this.state.cfg.autoMode) return;
        const s = this.state;
        const c = s.cfg;

        // ОТОПЛЕНИЕ
        if (s.tempAir < c.heaterOn && !s.heater) {
            s.heater = true;
            this._throttledLog('h_on', `🤖 Авто: Обогрев ВКЛ (${s.tempAir}°C < ${c.heaterOn}°C)`, 60000);
        } else if (s.tempAir > c.heaterOff && s.heater) {
            s.heater = false;
            s.addLog(`🤖 Авто: Обогрев ВЫКЛ (${s.tempAir}°C > ${c.heaterOff}°C)`, 'auto');
        }

        // ВЕНТИЛЯТОР
        if (s.tempAir > c.fanOn && !s.fan) {
            s.fan = true;
            s.addLog(`🤖 Авто: Вентилятор ВКЛ (${s.tempAir}°C)`, 'auto');
        } else if (s.tempAir < c.fanOff && s.fan && !this.manualOverride.fan) {
            s.fan = false;
            s.addLog('🤖 Авто: Вентилятор ВЫКЛ', 'auto');
        }

        // УВЛАЖНИТЕЛЬ
        if (s.humidity < c.humidOn && !s.humidifier) {
            s.humidifier = true;
            this._throttledLog('hm_on', `🤖 Авто: Увлажнитель ВКЛ (${s.humidity}%)`, 60000);
        } else if (s.humidity > c.humidOff && s.humidifier) {
            s.humidifier = false;
            s.addLog(`🤖 Авто: Увлажнитель ВЫКЛ (${s.humidity}%)`, 'auto');
        }

        // ПОЛИВ ПОЧВЫ
        s.soil.forEach((v, i) => {
            if (v < c.soilMin && !s.pumps[i]) this._startPump(i, true);
        });
    }

    /** Ручное переключение устройства */
    manualToggle(dev) {
        const s = this.state;
        s[dev] = !s[dev];
        this.manualOverride[dev] = s[dev];
        const names = {heater: '🔥 Обогрев', fan: '💨 Вентилятор', humidifier: '💧 Увлажнитель'};
        const action = s[dev] ? 'ВКЛ (ручной)' : 'ВЫКЛ (ручной)';
        s.addLog(`${names[dev]} ${action}`, s[dev] ? 'ok' : 'warn');
        this.bus.emit('toast:show', `${names[dev]} ${s[dev] ? 'включён' : 'выключен'}`);
        this.bus.emit('ui:update');
    }

    /** Ручной запуск полива грядки */
    startPumpManual(i) {
        this._startPump(i, false);
        this.bus.emit('toast:show', `💦 Полив Грядка ${i+1} запущен`);
    }

    /** Остановка полива грядки */
    stopPump(i) {
        const s = this.state;
        s.pumps[i] = false;
        if (s.pumpTimers[i]) { clearTimeout(s.pumpTimers[i]); s.pumpTimers[i] = null; }
        s.addLog(`💦 Полив Грядка ${i+1} остановлен`, 'warn');
        this.bus.emit('toast:show', `⏹ Полив Грядка ${i+1} остановлен`);
        this.bus.emit('ui:update');
    }

    /** Полив всех грядок */
    waterAll() {
        for (let i = 0; i < 4; i++) {
            if (!this.state.pumps[i]) this.startPumpManual(i);
        }
        this.bus.emit('toast:show', '💦 Полив всех грядок запущен');
    }

    // --- PRIVATE ---

    /** Запуск насоса полива */
    _startPump(i, isAuto) {
        const s = this.state;
        if (s.pumps[i]) return;
        s.pumps[i] = true;
        s.addLog(`💦 Полив Грядка ${i+1}${isAuto ? ' (авто)' : ' (ручной)'}`, 'ok');

        if (s.pumpTimers[i]) clearTimeout(s.pumpTimers[i]);
        s.pumpTimers[i] = setTimeout(() => {
            s.pumps[i] = false;
            s.addLog(`💦 Полив Грядка ${i+1} завершён`, 'ok');
            this.bus.emit('ui:update');
        }, s.cfg.waterSec * 1000);

        this.bus.emit('ui:update');
    }

    /** Троттлинг авто-логов, чтобы не спамить */
    _throttledLog(key, msg, interval) {
        if (!this.autoLogThrottle[key] || Date.now() - this.autoLogThrottle[key] > interval) {
            this.state.addLog(msg, 'auto');
            this.autoLogThrottle[key] = Date.now();
        }
    }
}

// ====================================================================
//  CAMERA MANAGER
// ====================================================================

class CameraManager {
    /** @param {StateManager} state */
    constructor(state, bus) {
        this.state = state;
        this.bus = bus;
    }

    /** Выбор активной камеры */
    select(index) {
        this.state.selCam = index;
        const cam = this.state.cameras[index];
        setT('cm-label', `${cam.name} — ${cam.label}`);

        const img = el('cm-img');
        const ph = el('cm-ph');
        if (cam.url) {
            img.src = cam.url;
            img.style.display = 'block';
            ph.style.display = 'none';
        } else {
            img.style.display = 'none';
            ph.style.display = 'flex';
        }
        this.bus.emit('cameras:render');
    }

    /** Применить URL камеры */
    applyUrl(index, url) {
        this.state.cameras[index].url = url.trim();
        this.select(index);
        this.bus.emit('toast:show', url ? `📷 Подключение: ${this.state.cameras[index].name}` : '📷 URL очищен');
    }
}

// ====================================================================
//  DASHBOARD RENDERER — все обновления DOM
// ====================================================================

class DashboardRenderer {
    /**
     * @param {StateManager} state
     * @param {EventEmitter} bus
     */
    constructor(state, bus) {
        this.state = state;
        this.bus = bus;
    }

    /** Полное обновление интерфейса */
    updateAll() {
        this._updateDashboard();
        this._updateSensors();
        this._updateClimate();
        this._updateIrrigation();
        this._updateLighting();
        this._updateAlarmUI();
        this._updateSystemBadges();
        this._updateLogList();
        this._updateClock();
    }

    /** Рисование спарклайнов */
    drawSparklines() {
        this._drawSpark('sp-temp', this.state.hist.temp, '#00ff7f');
        this._drawSpark('sp-hum',  this.state.hist.hum,  '#00b4fc');
        this._drawSpark('sp-co2',  this.state.hist.co2,  '#ffa502');
        this._drawSpark('sp-lux',  this.state.hist.lux,  '#fbbf24');
    }

    /** Обновление сезона */
    updateSeasonUI() {
        const s = this.state.cfg.season;
        const isSum = s === 'summer';
        const bar = el('season-bar');
        if (bar) bar.className = 'season-bar ' + s;
        setH('season-label', isSum ? '☀️ Режим: ЛЕТО' : '❄️ Режим: ЗИМА');

        const bs = el('sbtn-summer'), bw = el('sbtn-winter');
        if (bs) bs.className = 'season-btn' + (isSum ? ' active summer' : '');
        if (bw) bw.className = 'season-btn' + (isSum ? '' : ' active winter');

        // Обновление хинтов вкладки климат
        setT('fan-hint', isSum
            ? `Вкл при >${this.state.cfg.fanOn}°C (забор с улицы)`
            : `Вкл при >${this.state.cfg.fanOn}°C (рециркуляция)`);
        setT('vent-mode-hint', isSum ? 'Забор свежего воздуха с улицы' : 'Рециркуляция внутри теплицы');

        const vmb = el('vent-mode-badge');
        if (vmb) { vmb.textContent = isSum ? 'ЛЕТО' : 'ЗИМА'; vmb.className = 'badge ' + (isSum ? 'b-warn' : 'b-info'); }

        const clbl = el('clim-season-lbl');
        if (clbl) clbl.textContent = isSum ? 'ЛЕТО' : 'ЗИМА';

        setH('clim-ttarget', (isSum ? '22' : '18') + '<span class="munit">°C</span>');
        setH('clim-htarget', '70<span class="munit">%</span>');
    }

    // --- PRIVATE ---

    _updateDashboard() {
        const s = this.state;
        setH('db-temp', s.tempAir.toFixed(1) + '<span class="munit">°C</span>');
        setH('db-hum',  s.humidity + '<span class="munit">%</span>');
        setH('db-co2',  s.co2 + '<span class="munit">ppm</span>');
        setH('db-lux',  s.lux + '<span class="munit">lx</span>');

        // Кнопки ручного управления
        this._setBtnActive('qb-heater', s.heater, '🔥 Обогрев', 'btn-r');
        this._setBtnActive('qb-fan',    s.fan,    '💨 Вентил.', 'btn-g');
        this._setBtnActive('qb-humid',  s.humidifier, '💧 Увлажн.', 'btn-i');
    }

    _updateSensors() {
        const s = this.state;
        setH('s-ta', s.tempAir.toFixed(1) + '<span class="munit">°C</span>');
        setH('s-hu', s.humidity + '<span class="munit">%</span>');
        setH('s-ts', s.tempSoil.toFixed(1) + '<span class="munit">°C</span>');
        setH('s-pr', s.pressure + '<span class="munit">hPa</span>');
        setH('s-co', s.co2 + '<span class="munit">ppm</span>');
        setH('s-lx', s.lux + '<span class="munit">lx</span>');
        setW('s-co-b', Math.min(100, s.co2 / 10));
        setW('s-lx-b', Math.min(100, s.lux / 500));

        // Уровни воды
        const w1 = el('wl1');
        if (w1) { w1.textContent = s.waterLvl + '%'; w1.className = 'badge ' + (s.waterLvl > 20 ? 'b-ok' : 'b-danger'); setW('wl1b', s.waterLvl); }
        const w2 = el('wl2');
        if (w2) { w2.textContent = s.condensate + '%'; w2.className = 'badge b-dim'; setW('wl2b', s.condensate); }
    }

    _updateClimate() {
        const s = this.state;
        const tf = el('tog-fan'), th = el('tog-heater'), thi = el('tog-humid');
        if (tf) tf.checked = s.fan;
        if (th) th.checked = s.heater;
        if (thi) thi.checked = s.humidifier;
    }

    _updateIrrigation() {
        const s = this.state;
        const sg = el('soil-grid');
        if (!sg) return;

        sg.innerHTML = s.soil.map((v, i) => {
            const cls = s.pumps[i] ? 'watering' : (v < s.cfg.soilMin ? 'dry' : '');
            const badgeCls = v > s.cfg.soilMin ? 'b-ok' : 'b-warn';
            return `<div class="soil-card ${cls}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
                    <span style="font-size:12px;font-weight:700">🌱 Грядка ${i+1}</span>
                    <span class="badge ${badgeCls}">${v}%</span>
                </div>
                <div class="prog"><div class="pf" style="width:${v}%;background:${v > s.cfg.soilMin ? 'var(--green)' : 'var(--warn)'}"></div></div>
                ${s.pumps[i]
                    ? `<button class="btn btn-w btn-full" style="margin-top:7px;padding:7px;font-size:11px" onclick="autoCtrl.stopPump(${i})">⏹ Стоп</button>`
                    : `<button class="btn btn-ghost btn-full" style="margin-top:7px;padding:7px;font-size:11px" onclick="autoCtrl.startPumpManual(${i})">💦 ${s.cfg.waterSec}с</button>`}
            </div>`;
        }).join('');

        setW('irr-wl', s.waterLvl);
        const ib = el('irr-wlb');
        if (ib) { ib.textContent = s.waterLvl + '%'; ib.className = 'badge ' + (s.waterLvl > 20 ? 'b-ok' : 'b-danger'); }
    }

    _updateLighting() {
        const ll = el('l-lux');
        if (ll) setH('l-lux', this.state.lux + '<span class="munit">lx</span>');
    }

    _updateSystemBadges() {
        const s = this.state;
        this._setBadge('sys-heater', s.heater, 'ВКЛ', 'ВЫКЛ');
        this._setBadge('sys-fan',    s.fan,    'ВКЛ', 'ВЫКЛ');
        this._setBadge('sys-humid',  s.humidifier, 'ВКЛ', 'ВЫКЛ');

        const wBadge = el('sys-water');
        if (wBadge) {
            wBadge.textContent = s.waterLvl + '%';
            wBadge.className = 'badge ' + (s.waterLvl > 20 ? 'b-ok' : 'b-danger');
        }
    }

    _updateLogList() {
        const ll = el('log-list');
        if (!ll) return;
        const logs = this.state.logs;
        ll.innerHTML = logs.length === 0
            ? '<div style="text-align:center;color:var(--muted);font-size:11px;padding:10px">Нет событий</div>'
            : logs.slice(0, 15).map(l => {
                const clsMap = {err:'li-err', warn:'li-warn', auto:'li-auto', ok:'li-ok'};
                return `<div class="log-item ${clsMap[l.type] || 'li-ok'}"><span>${l.text}</span><span class="log-t">${l.t}</span></div>`;
            }).join('');
    }

    _updateAlarmUI() {
        const active = this.state.alarms.filter(a => !a.dismissed);
        const panel = el('alarm-list');
        if (!panel) return;

        if (active.length === 0) {
            panel.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--muted)">Нет активных аварий ✓</div>';
        } else {
            panel.innerHTML = active.map(a => {
                const cls = {crit:'alarm-sev-crit', warn:'alarm-sev-warn', info:'alarm-sev-info'}[a.sev] || '';
                const ts = pad(a.ts.getHours()) + ':' + pad(a.ts.getMinutes());
                return `<div class="alarm-item"><span class="${cls}">${a.text}</span>
                    <span style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                        <span style="font-size:10px;color:var(--muted)">${ts}</span>
                        <button class="alarm-dismiss" onclick="alarmMgr.clear('${a.id}')">✕</button>
                    </span></div>`;
            }).join('');
        }

        const cnt = active.length;
        const badge = el('alarm-count');
        if (badge) { badge.textContent = cnt; badge.style.display = cnt > 0 ? 'flex' : 'none'; }
    }

    _updateClock() {
        const n = new Date();
        setT('hdr-time', pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds()));
        setT('hdr-date', RU_DAYS[n.getDay()] + ', ' + n.getDate() + ' ' + RU_MONTHS[n.getMonth()] + ' ' + n.getFullYear());
        setT('cm-time', pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds()));
    }

    /** Обновление виджета уличной погоды */
    _updateOutdoorWeather() {
        const w = this.state.outdoor;
        const card = el('outdoor-weather-card');
        if (!card) return;

        if (!w) {
            card.innerHTML = '<div class="card-head"><span class="card-title">🌍 УЛИЦА</span><span class="badge b-dim">нет данных</span></div>' +
                '<div style="color:var(--muted);font-size:12px;padding:4px 0">Подключение к сети...</div>';
            return;
        }

        const ago = Math.round((new Date() - w.updated) / 60000);
        const agoStr = ago < 1 ? 'только что' : ago + ' мин назад';
        const tempColor = w.temp < 0 ? 'color:#00b4fc' : w.temp > 30 ? 'color:#ffa502' : 'color:var(--text)';

        card.innerHTML =
            '<div class="card-head">' +
                '<span class="card-title">🌍 УЛИЦА — ' + w.city + '</span>' +
                '<span class="badge b-dim" style="font-size:9px">' + agoStr + '</span>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:12px;align-items:center;margin-top:6px">' +
                '<div style="text-align:center;min-width:64px">' +
                    '<div style="font-size:32px;line-height:1">' + w.icon + '</div>' +
                    '<div style="font-size:22px;font-weight:700;' + tempColor + '">' + w.temp + '°C</div>' +
                    '<div style="font-size:9px;color:var(--muted)">ощущ. ' + w.feels_like + '°C</div>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:5px">' +
                    '<div style="font-size:12px;color:var(--dim)">💧 ' + w.humidity + '%</div>' +
                    '<div style="font-size:12px;color:var(--dim)">💨 ' + w.wind + ' м/с</div>' +
                    '<div style="font-size:12px;color:var(--dim)">📊 ' + w.pressure + ' hPa</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;justify-content:center">' +
                    '<div style="font-size:10px;color:var(--muted);text-align:center;line-height:1.5">' + w.description + '</div>' +
                '</div>' +
            '</div>';
    }

    _drawSpark(cid, data, color) {
        const c = el(cid);
        if (!c || data.length < 2) return;
        const dpr = window.devicePixelRatio || 1;
        const W = c.offsetWidth || 120, H = c.offsetHeight || 24;
        c.width = W * dpr; c.height = H * dpr;
        c.style.width = W + 'px'; c.style.height = H + 'px';
        const ctx = c.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        const mn = Math.min(...data), mx = Math.max(...data);
        const rng = mx - mn || 1;
        const xs = i => (i / (data.length - 1)) * W;
        const ys = v => H - ((v - mn) / rng) * (H - 2) - 1;

        ctx.beginPath();
        ctx.moveTo(xs(0), ys(data[0]));
        for (let i = 1; i < data.length; i++) ctx.lineTo(xs(i), ys(data[i]));
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.lineTo(xs(data.length - 1), H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    _setBtnActive(id, on, label, onCls) {
        const e = el(id); if (!e) return;
        e.className = 'btn ' + (on ? onCls : 'btn-ghost');
        e.innerHTML = (on ? '⏹ ' : '') + label;
    }

    _setBadge(id, on, onT, offT) {
        const e = el(id); if (!e) return;
        e.textContent = on ? onT : offT;
        e.className = 'badge ' + (on ? 'b-ok' : 'b-dim');
    }
}

// ====================================================================
//  APPLICATION — главный контроллер приложения
// ====================================================================


// ====================================================================
//  WEATHER SERVICE — получение реальной погоды
// ====================================================================

class WeatherService {
    constructor(state, bus) {
        this.state = state;
        this.bus = bus;
    }

    /** Запуск: первый запрос сразу, потом каждые 10 мин */
    start() {
        this._fetch();
        setInterval(() => this._fetch(), WEATHER_UPDATE_INTERVAL);
    }

    /** Основной запрос: OpenWeatherMap если токен есть, иначе Open-Meteo */
    async _fetch() {
        const reg = REGIONS[this.state.cfg.region];
        if (!reg) return;

        const hasToken = WEATHER_API_KEY && WEATHER_API_KEY !== 'ВСТАВЬТЕ_ВАШ_ТОКЕН_ЗДЕСЬ';
        if (hasToken) {
            await this._fetchOWM(reg);
        } else {
            await this._fetchOpenMeteo(reg);
        }
    }

    /** OpenWeatherMap (нужен токен) */
    async _fetchOWM(reg) {
        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${reg.lat}&lon=${reg.lon}&appid=${WEATHER_API_KEY}&units=metric&lang=ru`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const d = await res.json();

            this.state.outdoor = {
                temp:        Math.round(d.main.temp * 10) / 10,
                feels_like:  Math.round(d.main.feels_like * 10) / 10,
                humidity:    d.main.humidity,
                pressure:    d.main.pressure,
                wind:        Math.round(d.wind.speed * 10) / 10,
                description: d.weather[0].description,
                icon:        this._owmIcon(d.weather[0].id),
                city:        d.name,
                updated:     new Date()
            };
            this.bus.emit('weather:updated', this.state.outdoor);
            this.state.addLog('🌤 Погода: ' + this.state.outdoor.icon + ' ' + this.state.outdoor.temp + '°C, ' + this.state.outdoor.description, 'ok');
        } catch (e) {
            console.error('[Weather] OWM error:', e);
            const reg2 = REGIONS[this.state.cfg.region];
            if (reg2) await this._fetchOpenMeteo(reg2);
        }
    }

    /** Open-Meteo (бесплатно, без токена — fallback) */
    async _fetchOpenMeteo(reg) {
        try {
            const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + reg.lat +
                '&longitude=' + reg.lon +
                '&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,surface_pressure&wind_speed_unit=ms';
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const d = await res.json();
            const c = d.current;

            this.state.outdoor = {
                temp:        Math.round(c.temperature_2m * 10) / 10,
                feels_like:  Math.round(c.apparent_temperature * 10) / 10,
                humidity:    c.relative_humidity_2m,
                pressure:    Math.round(c.surface_pressure),
                wind:        Math.round(c.wind_speed_10m * 10) / 10,
                description: this._wmoDesc(c.weather_code),
                icon:        this._wmoIcon(c.weather_code),
                city:        reg.name,
                updated:     new Date()
            };
            this.bus.emit('weather:updated', this.state.outdoor);
            this.state.addLog('🌤 Погода (Open-Meteo): ' + this.state.outdoor.icon + ' ' + this.state.outdoor.temp + '°C, ' + this.state.outdoor.description, 'ok');
        } catch (e) {
            console.error('[Weather] Open-Meteo error:', e);
            this.state.outdoor = null;
            this.bus.emit('weather:updated', null);
        }
    }

    /** Иконки OpenWeatherMap по weather_id */
    _owmIcon(id) {
        if (id >= 200 && id < 300) return '⛈️';
        if (id >= 300 && id < 400) return '🌦️';
        if (id >= 500 && id < 600) return '🌧️';
        if (id >= 600 && id < 700) return '🌨️';
        if (id >= 700 && id < 800) return '🌫️';
        if (id === 800)             return '☀️';
        if (id === 801)             return '🌤️';
        if (id === 802)             return '⛅';
        return '☁️';
    }

    /** Иконки WMO (Open-Meteo) */
    _wmoIcon(code) {
        if (code === 0)              return '☀️';
        if (code <= 2)               return '🌤️';
        if (code === 3)              return '☁️';
        if (code <= 49)              return '🌫️';
        if (code <= 59)              return '🌦️';
        if (code <= 69)              return '🌧️';
        if (code <= 79)              return '🌨️';
        if (code <= 84)              return '🌧️';
        if (code <= 99)              return '⛈️';
        return '🌡️';
    }

    /** Описания WMO на русском */
    _wmoDesc(code) {
        const d = {
            0:'ясно', 1:'преим. ясно', 2:'переем. облачность', 3:'пасмурно',
            45:'туман', 48:'изморозь',
            51:'лёгкая морось', 53:'морось', 55:'сильная морось',
            61:'лёгкий дождь', 63:'дождь', 65:'сильный дождь',
            71:'лёгкий снег', 73:'снег', 75:'сильный снег', 77:'снежные зёрна',
            80:'кратковр. дождь', 81:'ливень', 82:'сильный ливень',
            85:'снежный ливень', 86:'сильный снежный ливень',
            95:'гроза', 96:'гроза с градом', 99:'гроза с сильным градом'
        };
        return d[code] || 'переем. облачность';
    }
}

class SmartGreenhouseApp {
    constructor() {
        this.bus = new EventEmitter();
        this.state = new StateManager();
        this.alarmMgr = new AlarmManager(this.state, this.bus);
        this.autoCtrl = new AutoController(this.state, this.bus);
        this.cameraMgr = new CameraManager(this.state, this.bus);
        this.renderer = new DashboardRenderer(this.state, this.bus);
        this.weatherSvc = new WeatherService(this.state, this.bus);

        this.currentTab = 'dashboard';
        this.toastTimer = null;

        // Подписка на события
        this.bus.on('ui:update', () => this.renderer.updateAll());
        this.bus.on('alarms:changed', () => this.renderer._updateAlarmUI());
        this.bus.on('toast:show', (msg) => this._showToast(msg));
        this.bus.on('cameras:render', () => this._renderCameras());
        this.bus.on('weather:updated', () => this.renderer._updateOutdoorWeather());

        this._boot();
    }

    /** Инициализация приложения */
    _boot() {
        this.state.initHistory();
        this.state.addLog('✅ Система запущена (тест-режим)', 'ok');
        this.state.addLog('🌡 Датчики опрошены: норма', 'ok');
        this.state.addLog('🤖 Авторежим активен', 'auto');
        this.state.addLog('📷 Видеонаблюдение готово', 'ok');

        this.setSeason('summer');
        this._updateSettingsUI();
        this._renderCameras();
        this.renderer.updateAll();
        this.renderer.drawSparklines();
        this._updateLightingPage();

        // Запуск сервиса погоды
        this.weatherSvc.start();

        // Основной цикл симуляции
        setInterval(() => {
            this.state.simulate();
            this.autoCtrl.run();
            this.alarmMgr.checkAll();
            this.renderer.updateAll();
            this.renderer.drawSparklines();
        }, 2000);
    }

    /** Переключение вкладок */
    switchTab(tab) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));

        const pageEl = el('page-' + tab);
        if (pageEl) pageEl.classList.add('active');

        const navEl = el('nav-' + tab);
        if (navEl) navEl.classList.add('active');

        this.currentTab = tab;
        if (tab === 'cameras') this._renderCameras();
        if (tab === 'lighting') this._updateLightingPage();
    }

    /** Установка сезона */
    setSeason(season) {
        this.state.cfg.season = season;
        this.renderer.updateSeasonUI();
        this.state.addLog('🔄 Сезон переключён: ' + (season === 'summer' ? 'ЛЕТО' : 'ЗИМА'), 'ok');
        this._showToast(season === 'summer' ? '☀️ Режим ЛЕТО активен' : '❄️ Режим ЗИМА активен');
    }

    /** Переключение авторежима */
    toggleAuto() {
        const checked = el('tog-auto').checked;
        this.state.cfg.autoMode = checked;
        const badge = el('auto-badge');
        if (badge) { badge.className = 'auto-badge ' + (checked ? 'on' : 'off'); badge.textContent = checked ? '● ВКЛ' : '○ ВЫКЛ'; }
        this.state.addLog('🤖 Авторежим ' + (checked ? 'ВКЛ' : 'ВЫКЛ'), checked ? 'auto' : 'warn');
        this._showToast('Авторежим ' + (checked ? 'включён' : 'выключён'));
    }

    /** Изменение параметра конфигурации */
    adjustCfg(key, delta) {
        this.state.cfg[key] = +(this.state.cfg[key] + delta).toFixed(1);
        const e = el('sv-' + key); if (e) e.textContent = this.state.cfg[key];
        this._updateClimatHints();
    }

    /** Сброс настроек */
    resetSettings() {
        this.state.cfg = {...DEFAULT_CFG};
        this._updateSettingsUI();
        this._showToast('↺ Настройки сброшены');
    }

    /** Очистка логов */
    clearLogs() {
        this.state.logs = [];
        this.renderer._updateLogList();
        this._showToast('Лог очищен');
    }

    /** Настройки LED */
    setLed(channel, value) {
        const v = +value;
        if (channel === 'red') {
            this.state.redLed = v;
            setT('l-rv', v + '%'); setW('l-rb', v);
        } else {
            this.state.blueLed = v;
            setT('l-bv', v + '%'); setW('l-bb', v);
        }
    }

    /** Обновление страницы освещения */
    updateLighting() {
        this._updateLightingPage();
    }

    // --- PRIVATE ---

    _showToast(msg) {
        const t = el('toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
    }

    _updateSettingsUI() {
        const keys = ['heaterOn','heaterOff','fanOn','humidOn','humidOff','co2Alert','soilMin','waterSec'];
        keys.forEach(k => { const e = el('sv-' + k); if (e) e.textContent = this.state.cfg[k]; });
        this._updateClimatHints();
    }

    _updateClimatHints() {
        const c = this.state.cfg;
        setT('heat-hint',  `Вкл при <${c.heaterOn}°C, Выкл при >${c.heaterOff}°C`);
        setT('fan-hint',   `Вкл при >${c.fanOn}°C, Выкл при <${c.fanOff}°C`);
        setT('humid-hint', `Вкл при <${c.humidOn}%, Выкл при >${c.humidOff}%`);
    }

    _updateLightingPage() {
        const reg = REGIONS[this.state.cfg.region];
        const crop = CROPS[this.state.cfg.crop];
        if (!reg || !crop) return;

        const now = new Date();
        const sun = LightingCalculator.calcSunTimes(reg.lat, now);
        const natural = sun.dl;
        const need = (crop.min + crop.max) / 2;
        const supp = Math.max(0, need - natural);

        setT('pr-region', reg.name);
        setT('pr-rise', LightingCalculator.hoursToHM(sun.rise));
        setT('pr-set', LightingCalculator.hoursToHM(sun.set));
        setT('pr-natural', natural.toFixed(1) + ' ч');
        setT('pr-need', `${crop.min}–${crop.max} ч (${crop.name})`);
        setT('pr-supp', supp > 0 ? rndn(supp, 1) + ' ч' : 'Не нужна ✓');

        const sched = el('led-schedule');
        if (!sched) return;

        const hm = LightingCalculator.hoursToHM;
        if (supp > 0) {
            const suppHalf = supp / 2;
            const morningStart = sun.rise - suppHalf;
            const eveningEnd = sun.set + suppHalf;
            sched.innerHTML = `
                <div class="sr"><span>🌅 Досветка утром</span><span class="sr-t">${hm(morningStart)} – ${hm(sun.rise)}</span></div>
                <div class="sr"><span>☀️ Солнце</span><span class="sr-t">${hm(sun.rise)} – ${hm(sun.set)}</span></div>
                <div class="sr"><span>🌆 Досветка вечером</span><span class="sr-t">${hm(sun.set)} – ${hm(eveningEnd)}</span></div>
                <div class="sr"><span>🌙 Темнота</span><span class="sr-t">${hm(eveningEnd)} – ${hm(morningStart + 24)}</span></div>`;
        } else {
            sched.innerHTML = `
                <div class="sr"><span>☀️ Солнце (достаточно)</span><span class="sr-t">${hm(sun.rise)} – ${hm(sun.set)}</span></div>
                <div class="sr"><span>🌙 Темнота</span><span class="sr-t">${hm(sun.set)} – ${hm(sun.rise + 24)}</span></div>`;
        }

        setH('l-photo', rndn(natural, 1) + '<span class="munit">ч</span>');
    }

    _renderCameras() {
        const thumbs = el('cam-thumbs');
        const settings = el('cam-settings');
        if (!thumbs || !settings) return;

        const cams = this.state.cameras;
        thumbs.innerHTML = cams.map((cam, i) => `
            <div class="cam-thumb${i === this.state.selCam ? ' sel' : ''}" onclick="app.cameraMgr.select(${i})">
                ${cam.url ? `<img src="${cam.url}" onerror="this.style.display='none'">` : ''}
                <div class="cam-ph" id="cam-ph-${i}"><span class="ci">📷</span><span>${cam.label}</span></div>
                <div class="cam-ov"><span class="cam-tag">${cam.name}</span></div>
            </div>`).join('');

        settings.innerHTML = cams.map((cam, i) => `
            <div>
                <div style="font-size:10px;color:var(--muted);margin-bottom:4px">${cam.name} — ${cam.label}</div>
                <div class="url-row">
                    <input class="url-inp" id="curl-${i}" placeholder="http://192.168.x.x/mjpeg" value="${cam.url}">
                    <button class="btn btn-g" style="flex-shrink:0;padding:8px 10px" onclick="app.cameraMgr.applyUrl(${i}, document.getElementById('curl-${i}').value)">▶</button>
                </div>
            </div>`).join('');
    }
}

// ====================================================================
//  ИНИЦИАЛИЗАЦИЯ И ГЛОБАЛЬНЫЙ ИНТЕРФЕЙС
// ====================================================================

// Создаем экземпляр приложения
const app = new SmartGreenhouseApp();

// Экспортируем в глобальную область для обратной совместимости с HTML onclick
window.switchTab = (tab) => app.switchTab(tab);
window.toggleAuto = () => app.toggleAuto();
window.setSeason = (s) => app.setSeason(s);
window.adj = (key, delta) => app.adjustCfg(key, delta);
window.resetSettings = () => app.resetSettings();
window.clearLogs = () => app.clearLogs();
window.manualToggle = (dev) => app.autoCtrl.manualToggle(dev);
window.waterAll = () => app.autoCtrl.waterAll();
window.setLed = (ch, v) => app.setLed(ch, v);
window.clearAlarms = () => app.alarmMgr.dismissAll();
window.dismissAllAlarms = () => app.alarmMgr.dismissAll();
window.dismissAlarm = (id) => app.alarmMgr.clear(id);
window.toggleAlarmPanel = () => {
    window._alarmPanelOpen = !window._alarmPanelOpen;
    const panel = el('alarm-panel');
    if (panel) panel.classList.toggle('open', window._alarmPanelOpen);
};
window.onRegionChange = () => app.updateLighting();
window.onCropChange = () => app.updateLighting();
window.showToast = (msg) => app._showToast(msg);

// Прокси для доступа к alarmMgr и autoCtrl из HTML
window.alarmMgr = app.alarmMgr;
window.autoCtrl = app.autoCtrl;

// Глобальная переменная S для совместимости с inline onclick в settings (notifyAlarms и т.д.)
window.S = { cfg: app.state.cfg };

window._alarmPanelOpen = false;

console.log('🌿 Умная Теплица v3 — Архитектура обновлена (модульная, событийно-ориентированная)');
