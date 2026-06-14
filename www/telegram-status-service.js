/**
 * Telegram Status Service
 * ============================================================
 * ×èòàåò çàêðåïë¸ííîå ñîîáùåíèå áîòà — òóäà ESP32 êàæäóþ
 * ìèíóòó ïèøåò JSON ñî âñåìè äàííûìè.
 * Ðàáîòàåò èç ëþáîé òî÷êè ìèðà ÷åðåç api.telegram.org
 */
const TG_BOT_TOKEN = '8899706883:AAEhg-tV6EN6j0HbBzMsdc1HIXoUsghXMWI';   // çàìåíèòå íà ðåàëüíûé òîêåí
const TG_CHAT_ID   = '5741848306';       // âàø chat id
class TelegramStatusService {
  constructor(state, bus) {
    this.state       = state;
    this.bus         = bus;
    this.ip          = 'telegram';
    this.connected   = false;
    this.failCount   = 0;
    this.pollSeconds = 15;
    this._interval   = null;
    this.MAX_FAILS   = 5;
  }
  setIp() { this.startPolling(); }
  setPollSeconds(s) {
    this.pollSeconds = Math.max(5, Math.min(60, Math.round(s)));
    this.startPolling();
  }
  startPolling() {
    if (this._interval) clearInterval(this._interval);
    this.failCount = 0;
    this.bus.emit('esp:status', 'connecting');
    this._fetch();
    this._interval = setInterval(() => this._fetch(), this.pollSeconds * 1000);
  }
  stopPolling() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }
  retry() {
    this.startPolling();
    this.bus.emit('toast:show', '?? Ïîâòîð ïîäêëþ÷åíèÿ...');
  }
  async _fetch() {
    try {
      const url = https://api.telegram.org/bot/getChat?chat_id=;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const pinned = data?.result?.pinned_message;
      if (!pinned || !pinned.text) throw new Error('Íåò çàêðåïë¸ííîãî ñòàòóñà');
      const d = JSON.parse(pinned.text);
      // Ìàïïèíã ïîëåé
      if (typeof d.temp     === 'number') this.state.tempAir  = d.temp;
      if (typeof d.humidity === 'number') this.state.humidity = d.humidity;
      if (typeof d.soil1    === 'number') this.state.soil[0]  = d.soil1;
      if (typeof d.soil2    === 'number') this.state.soil[1]  = d.soil2;
      if (typeof d.lux      === 'number') this.state.lux      = d.lux;
      this.state.heater     = !!d.heater;
      this.state.fan        = !!d.fan;
      this.state.valve      = !!d.valve;
      this.state.humidifier = !!d.humidifier;
      this.state.pumps[0]   = !!d.valve;
      this.state.pumps[1]   = !!d.valve;
      if (this.failCount > 0) {
        this.state.addLog(?? Ñâÿçü âîññòàíîâëåíà: °C, %, 'esp');
      }
      this.failCount = 0;
      this.connected = true;
      this.bus.emit('esp:status', 'connected');
      this.bus.emit('ui:update');
    } catch (err) {
      this.connected = false;
      this.failCount++;
      if (this.failCount === this.MAX_FAILS) {
        this.state.addLog(? Telegram íå îòâå÷àåò: , 'err');
        this.stopPolling();
        this.bus.emit('esp:status', 'error');
      }
    }
  }
}
