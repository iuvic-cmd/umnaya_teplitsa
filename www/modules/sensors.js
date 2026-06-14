// ================================================
//  modules/sensors.js — ДАТЧИКИ (ЗАГЛУШКА)
//  Раскомментируй в app.js: SensorsModule
// ================================================

const SensorsModule = {
  id:   'sensors',
  name: 'Датчики',
  icon: '📡',

  render() {
    return `
      <div class="placeholder">
        <div class="placeholder-icon">📡</div>
        <h3>Датчики</h3>
        <p>Здесь будут данные с датчиков температуры, влажности и CO₂</p>
      </div>
    `;
  }
};
