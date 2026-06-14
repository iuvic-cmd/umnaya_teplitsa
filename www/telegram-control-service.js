/**
 * Telegram Control Service
 * Отправка команд на ESP32 через Telegram-диплинк.
 */
const TG_BOT_USERNAME = 'iuvic_tomato_bot';
function sendTelegramCommand(cmd) {
  const text = encodeURIComponent('/' + cmd);
  window.location.href = https://t.me/?text=;
}
document.addEventListener('DOMContentLoaded', () => {
  const cmdMap = { heater: 'heat', fan: 'fan', humidifier: 'hum' };
  window.manualToggle = function (dev) {
    const s = window.app.state;
    const willTurnOn = !s[dev];
    const prefix = cmdMap[dev];
    sendTelegramCommand(${prefix}_);
    window.app._toast(?? Команда: _);
  };
  window.waterAll = function () {
    sendTelegramCommand('water_on');
    window.app._toast('?? Полив ВКЛ');
  };
  window.stopPumpRemote = function () {
    sendTelegramCommand('water_off');
    window.app._toast('?? Полив ВЫКЛ');
  };
  if (window.autoCtrl) {
    window.autoCtrl.stopPump = (i) => window.stopPumpRemote();
    window.autoCtrl.startPumpManual = (i) => window.waterAll();
  }
  window.toggleAuto = function () {
    const c = document.getElementById('tog-auto');
    if (!c) return;
    sendTelegramCommand(c.checked ? 'auto' : 'manual');
    window.app._toast(?? Режим: );
  };
  console.log('?? Telegram Control Service подключён. Бот: @' + TG_BOT_USERNAME);
});
