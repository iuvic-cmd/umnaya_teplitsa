'use strict';

// ═══════════════════════════════════════════
// ЗАМЕНИТЕ НА СВОИ ДАННЫЕ:
// ═══════════════════════════════════════════
let token    = localStorage.getItem('tg_token')    || '8899706883:AAEhg-tV6EN6j0HbBzMsdc1HIXoUsghXMWI';
let chatId   = localStorage.getItem('tg_chatid')   || '5741848306';
// ═══════════════════════════════════════════

let online = false, failCount = 0;
const MAX_FAILS = 5;
let pollTimer = null, statusCache = null;

const $ = (id) => document.getElementById(id);
const $t = (id, v) => { const e = $(id); if (e) e.textContent = v; };
const $h = (id, v) => { const e = $(id); if (e) e.innerHTML = v; };

let toastT = null;
function toast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 2500);
}

function fmtNum(v, dec = 1) {
  return (typeof v === 'number' && isFinite(v)) ? v.toFixed(dec) : '--';
}

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return d + 'д ' + h + 'ч';
  return h + 'ч ' + m + 'м';
}

function openTgModal() {
  $('tg-token').value = token;
  $('tg-chatid').value = chatId;
  $('modal-tg').classList.remove('hidden');
}

function closeTgModal() {
  $('modal-tg').classList.add('hidden');
}

function saveTgConfig() {
  const t = $('tg-token').value.trim();
  const c = $('tg-chatid').value.trim();
  if (!t || !c) { toast('⚠️ Введите токен и chat_id'); return; }
  token = t;
  chatId = c;
  localStorage.setItem('tg_token', token);
  localStorage.setItem('tg_chatid', chatId);
  closeTgModal();
  startPolling();
  toast('✅ Подключено!');
}

async function fetchStatus() {
  if (!token || !chatId) return null;
  const url = `https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || 'API error');
    const pinned = data.result?.pinned_message;
    if (!pinned?.text) throw new Error('Нет закреплённого сообщения');
    return JSON.parse(pinned.text);
  } catch (err) {
    console.warn('[Poll]', err.message);
    return null;
  }
}

function updateUI(status) {
  $h('v-temp', fmtNum(status.temp_air) + '°');
  $h('v-hum', fmtNum(status.humidity, 0) + '%');
  $h('v-out', fmtNum(status.temp_out) + '°');
  
  const s1 = status.soil_1 ?? 0;
  const s2 = status.soil_2 ?? 0;
  $t('v-s1', s1 + '%');
  $t('v-s2', s2 + '%');
  $('pb1').style.width = s1 + '%';
  $('pb2').style.width = s2 + '%';
  
  $t('v-lux', (status.lux ?? '--') + ' лк');
  $t('v-day', status.is_day ? '☀️ День' : '🌙 Ночь');
  
  const toggleDev = (id, on) => {
    const el = $(id);
    if (!el) return;
    el.className = 'dev-item' + (on ? ' on' : '');
    const stateEl = el.querySelector('.dev-state');
    if (stateEl) stateEl.textContent = on ? 'ВКЛ' : 'ВЫКЛ';
  };
  
  toggleDev('dev-heater', status.heater);
  toggleDev('dev-fan', status.fan);
  toggleDev('dev-humid', status.humidifier);
  toggleDev('dev-valve', status.valve);
  toggleDev('dev-light', status.light);
  
  $t('v-mode', status.mode === 'auto' ? '🤖 Авто' : '🔧 Ручной');
  $t('v-crop', status.crop || '--');
  $t('v-season', status.season || '--');
  $t('v-water', status.water_count ?? '0');
  $t('v-uptime', fmtUptime(status.uptime || 0));
}

function updateConnectionUI(isOnline) {
  online = isOnline;
  const dot = $('hdr-dot');
  const text = $('hdr-text');
  if (dot) dot.className = 'hdr-dot' + (isOnline ? ' online' : '');
  if (text) {
    text.textContent = isOnline ? 'Онлайн' : 'Нет связи';
    text.style.color = isOnline ? 'var(--on)' : 'var(--dim)';
  }
}

async function poll() {
  const status = await fetchStatus();
  if (status) {
    statusCache = status;
    updateUI(status);
    if (!online) {
      updateConnectionUI(true);
      if (failCount > 0) toast('📡 Связь восстановлена');
    }
    failCount = 0;
  } else {
    failCount++;
    if (online && failCount >= MAX_FAILS) {
      updateConnectionUI(false);
      toast('⚠️ Нет ответа от Telegram');
    }
    if (statusCache && failCount < MAX_FAILS) {
      updateUI(statusCache);
    }
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  if (!token || !chatId) {
    updateConnectionUI(false);
    $t('hdr-text', 'Не настроено');
    return;
  }
  updateConnectionUI(false);
  $t('hdr-text', 'Подключение...');
  failCount = 0;
  poll();
  pollTimer = setInterval(poll, 5000);
}

window.openTgModal = openTgModal;
window.closeTgModal = closeTgModal;
window.saveTgConfig = saveTgConfig;

startPolling();
console.log('🌿 Умная Теплица v2.8.1 готово!');
