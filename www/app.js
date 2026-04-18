// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
const NIGHT_PRICE = 65;
const AP_PRICE = 50;
let currentDate = new Date();
let massEditDate = new Date();
let selectedDays = new Set();
let massEditTargetType = "work";
let currentLanguage = "ru";
let ordersLog = JSON.parse(localStorage.getItem("ordersLog")) || [];
let originalDayData = null;

// ============================================
// ЧАСЫ В ШАПКЕ
// ============================================
function updateClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const clockElement = document.getElementById("realTimeClock");
  if (clockElement) clockElement.innerText = timeString;
}
setInterval(updateClock, 1000);

// ============================================
// СЧЁТЧИК ЗАКАЗОВ ЗА ПРОСМАТРИВАЕМЫЙ МЕСЯЦ
// ============================================
function updateMonthlyCounter() {
  const history = JSON.parse(localStorage.getItem("courierData")) || [];
  // Используем currentDate (просматриваемый месяц), а не today
  const viewMonth = currentDate.getMonth() + 1;
  const viewYear = currentDate.getFullYear();
  let monthlyNight = 0;
  let monthlyAp = 0;
  let monthlyIncome = 0;

  history.forEach((day) => {
    const [year, month] = day.date.split("-").map(Number);
    if (year === viewYear && month === viewMonth) {
      monthlyNight += day.nightOrders || 0;
      monthlyAp += day.apOrders || 0;
      monthlyIncome += day.total || 0;
    }
  });

  const total = monthlyNight + monthlyAp;
  const counterElement = document.getElementById("monthlyCounter");
  if (counterElement) {
    const t = translations[currentLanguage];
    const monthName = t.months ? t.months[currentDate.getMonth()] : "";
    counterElement.innerHTML = `📊 ${total}`;
    counterElement.title = `${monthName} ${viewYear}: 🌙${monthlyNight} 📦${monthlyAp} — ${monthlyIncome} ${translations[currentLanguage].currency||"лей"}`;
  }
}

// ============================================
// МОДАЛЬНОЕ ОКНО ДЛЯ ДОБАВЛЕНИЯ ЗАКАЗОВ
// ============================================
function openAddOrdersModal() {
  const dateInput = document.getElementById("date").value;
  if (!dateInput) {
    showAlertDialog((translations[currentLanguage].noDate || "Сначала выберите дату!"));
    return;
  }
  document.getElementById("addOrdersModal").style.display = "block";
}

function closeAddOrdersModal() {
  document.getElementById("addOrdersModal").style.display = "none";
  document.getElementById("addNightOrders").value = "";
  document.getElementById("addApOrders").value = "";
}

function addOrders() {
  const date = document.getElementById("date").value;
  const addNight = parseInt(document.getElementById("addNightOrders").value) || 0;
  const addAp = parseInt(document.getElementById("addApOrders").value) || 0;

  if (addNight === 0 && addAp === 0) {
    showAlertDialog((translations[currentLanguage].noOrders || "Добавьте хотя бы один заказ!"));
    return;
  }

  let history = JSON.parse(localStorage.getItem("courierData")) || [];
  const dayIndex = history.findIndex((d) => d.date === date);
  if (dayIndex >= 0) {
    history[dayIndex].nightOrders += addNight;
    history[dayIndex].apOrders += addAp;
    history[dayIndex].total = history[dayIndex].nightOrders * NIGHT_PRICE + history[dayIndex].apOrders * AP_PRICE;
  } else {
    history.push({
      date: date,
      dayType: "work",
      nightOrders: addNight,
      apOrders: addAp,
      total: addNight * NIGHT_PRICE + addAp * AP_PRICE,
      generated: false,
    });
  }

  const logEntry = {
    id: Date.now() + "_" + Math.random().toString(36).substr(2,5),
    date: date,
    time: new Date().toLocaleString(),
    addedNight: addNight,
    addedAp: addAp,
  };
  ordersLog.push(logEntry);
  localStorage.setItem("ordersLog", JSON.stringify(ordersLog));

  history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("courierData", JSON.stringify(history));

  renderCalendar();
  renderMassEditCalendar();
  loadHistory();
  updateTotals();
  updateMonthlyCounter();
  displayOrdersLog();
  renderForecast();

  const updatedDay = history.find((d) => d.date === date);
  if (updatedDay) {
    document.getElementById("nightOrders").value = updatedDay.nightOrders;
    document.getElementById("apOrders").value = updatedDay.apOrders;
  }

  closeAddOrdersModal();
  showNotification(`${translations[currentLanguage].notifyAdded || "✅ Добавлено"}: +${addNight}🌙 +${addAp}📦`);
}

// ============================================
// П.1: ИСТОРИЯ ДОБАВЛЕНИЙ — иерархический календарь с удалением
// ============================================
function displayOrdersLog() {
  const logContainer = document.getElementById("ordersLog");
  if (!logContainer) return;
  logContainer.innerHTML = "";

  if (ordersLog.length === 0) {
    logContainer.innerHTML = `<p style="text-align:center; color:#666; padding:15px;">${translations[currentLanguage].noLogsText || 'Нет записей'}</p>`;
    return;
  }

  // Группируем по году → месяцу → дате
  const grouped = {};
  ordersLog.forEach((entry) => {
    const dateParts = entry.date.split("-");
    const y = dateParts[0];
    const m = dateParts[1];
    const d = entry.date;
    if (!grouped[y]) grouped[y] = {};
    if (!grouped[y][m]) grouped[y][m] = {};
    if (!grouped[y][m][d]) grouped[y][m][d] = [];
    grouped[y][m][d].push(entry);
  });

  const t = translations[currentLanguage];

  Object.keys(grouped).sort().reverse().forEach((y) => {
    const yearBlock = document.createElement("div");
    yearBlock.classList.add("log-year-block");

    const yearHeader = document.createElement("div");
    yearHeader.classList.add("log-year-header");
    const totalEntriesYear = Object.values(grouped[y]).reduce((acc, months) =>
      acc + Object.values(months).reduce((a, entries) => a + entries.length, 0), 0);
    const tLog = translations[currentLanguage];
    yearHeader.innerText = `📅 ${y} — ${totalEntriesYear} ${tLog.importedWord || "записей"}`;
    yearBlock.appendChild(yearHeader);

    const yearBody = document.createElement("div");
    yearBody.style.display = "none";

    Object.keys(grouped[y]).sort().reverse().forEach((m) => {
      const monthBlock = document.createElement("div");
      monthBlock.classList.add("log-month-block");

      const totalEntriesMonth = Object.values(grouped[y][m]).reduce((a, entries) => a + entries.length, 0);
      const monthHeader = document.createElement("div");
      monthHeader.classList.add("log-month-header");
      monthHeader.innerHTML = `<span>${t.months[parseInt(m)-1]} ${y}</span><span>${totalEntriesMonth} ${t.importedWord||"записей"} ▶</span>`;
      monthBlock.appendChild(monthHeader);

      const monthBody = document.createElement("div");
      monthBody.style.display = "none";

      Object.keys(grouped[y][m]).sort().reverse().forEach((dateStr) => {
        const dayBlock = document.createElement("div");
        dayBlock.classList.add("log-day-block");

        const dayEntries = grouped[y][m][dateStr];
        const totalNight = dayEntries.reduce((a, e) => a + (e.addedNight || 0), 0);
        const totalAp = dayEntries.reduce((a, e) => a + (e.addedAp || 0), 0);

        const dayHeader = document.createElement("div");
        dayHeader.classList.add("log-day-header");
        const dayLabel = dateStr.split("-").reverse().join(".");
        dayHeader.innerHTML = `<span>📅 ${dayLabel}</span><span>🌙${totalNight} 📦${totalAp} (${dayEntries.length}) ▶</span>`;
        dayBlock.appendChild(dayHeader);

        const entriesDiv = document.createElement("div");
        entriesDiv.classList.add("log-entries");

        dayEntries.forEach((entry) => {
          const row = document.createElement("div");
          row.classList.add("log-entry-row");
          row.innerHTML = `
            <span>🕐 ${entry.time} | +${entry.addedNight}🌙 +${entry.addedAp}📦</span>
            <button class="log-delete-btn" onclick="deleteLogEntry('${entry.id}', event)">🗑️</button>
          `;
          entriesDiv.appendChild(row);
        });

        // Кнопка удаления всего дня
        const deleteAllBtn = document.createElement("button");
        deleteAllBtn.style.cssText = "width:100%; margin-top:5px; padding:5px; background:linear-gradient(135deg,#e53935,#c62828); color:white; border:none; border-radius:8px; font-size:0.8em; cursor:pointer;";
        deleteAllBtn.innerText = `${translations[currentLanguage].confirmDeleteDayBtn || "🗑️ Удалить все записи за"} ${dayLabel}`;
        deleteAllBtn.onclick = (e) => { e.stopPropagation(); deleteLogDay(dateStr); };
        entriesDiv.appendChild(deleteAllBtn);

        dayBlock.appendChild(entriesDiv);
        monthBody.appendChild(dayBlock);

        dayHeader.addEventListener("click", () => {
          const isHidden = entriesDiv.style.display === "none" || entriesDiv.style.display === "";
          entriesDiv.style.display = isHidden ? "block" : "none";
          const arrow = dayHeader.querySelector("span:last-child");
          if (arrow) arrow.textContent = arrow.textContent.replace(/[▶▼]/, isHidden ? "▼" : "▶");
        });
      });

      monthBlock.appendChild(monthBody);
      yearBody.appendChild(monthBlock);

      monthHeader.addEventListener("click", () => {
        const isHidden = monthBody.style.display === "none" || monthBody.style.display === "";
        monthBody.style.display = isHidden ? "block" : "none";
        const arrow = monthHeader.querySelector("span:last-child");
        if (arrow) {
          arrow.textContent = arrow.textContent.replace(/[▶▼]/, isHidden ? "▼" : "▶");
        }
      });
    });

    yearBlock.appendChild(yearBody);
    logContainer.appendChild(yearBlock);

    yearHeader.addEventListener("click", () => {
      const isHidden = yearBody.style.display === "none" || yearBody.style.display === "";
      yearBody.style.display = isHidden ? "block" : "none";
    });
  });
}

function deleteLogEntry(id, event) {
  if (event) event.stopPropagation();
  showConfirmDialog((translations[currentLanguage].confirmDeleteEntry || "🗑️ Удалить эту запись?"), () => {
    ordersLog = ordersLog.filter(e => e.id !== id);
    localStorage.setItem("ordersLog", JSON.stringify(ordersLog));
    displayOrdersLog();
    showNotification((translations[currentLanguage].notifyEntryDeleted || "🗑️ Запись удалена"));
  });
}

function deleteLogDay(dateStr) {
  showConfirmDialog(`${translations[currentLanguage].confirmDeleteDay || "🗑️ Удалить все записи за"} ${dateStr}?`, () => {
    ordersLog = ordersLog.filter(e => e.date !== dateStr);
    localStorage.setItem("ordersLog", JSON.stringify(ordersLog));
    displayOrdersLog();
    showNotification(`${translations[currentLanguage].notifyDayDeleted || "🗑️ Записи удалены"}: ${dateStr}`);
  });
}

// ============================================
// ПЕРЕВОДЫ
// ============================================
const translations = {
  ru: {
    appTitle: "📦 Учёт рабочего дня курьера",
    today: "Сегодня",
    allTotal: "Общий доход",
    allAp: "Всего АП-34",
    allNight: "Всего ночных",
    monthlyIncome: "Доход за этот месяц",
    todayTrips: "Ходок сегодня",
    statistics: "Статистика",
    planning: "Планирование графика",
    massEdit: "Массовое изменение дней",
    editDay: "Редактировать день",
    shiftSetup: "Настройка коротких дней",
    shiftOverview: "График смены (месяц)",
    shiftStatus: "Статус дня",
    history: "История изменений",
    analytics: "Аналитика",
    importExport: "Импорт / Экспорт",
    forecast: "Прогноз дохода",
    reset: "⚠️ Сбросить все данные",
    currency: "лей",
    work: "🏢 Рабочий",
    help: "🤝 Подмога",
    short: "⚡ Короткий день",
    replace: "🔄 Замена",
    weekend: "🏖️ Выходной",
    manualPlan: "✏️ Ручное планирование",
    monthPlan: "🔄 График 2/2 (месяц)",
    yearPlan: "📆 График 2/2 (год)",
    year: "год",
    monthsText: "мес",
    monthTotal: "Итого за месяц",
    nightText: "Н",
    apText: "АП",
    apply: "📌 Применить",
    generate: "📆 Сгенерировать",
    selectDays: "Выберите дни в календаре ниже и укажите новый тип",
    confirmClear: "Очистить данные за ${date}?",
    selectAll: "✅ Выбрать все",
    clear: "❌ Очистить выбор",
    keepOrders: "📦 Сохранить количество заказов",
    applyToSelected: "🔄 Применить к выбранным",
    save: "📂 Открыть день",
    noData: "📭 Нет данных",
    saved: "✅ День сохранен!",
    applied: "✅ Изменено",
    confirmReset: "⚠️ Вы точно хотите удалить все данные?",
    ordersLog: "Лог заказов",
    // Статистика — сегодня
    todayIncome: "Доход",
    todayNightLabel: "Ночные",
    todayApLabel: "📦 АП-34",
    todayTripsLabel: "Всего ходок",
    // Статистика — месяц
    monthIncomeLabel: "Всего доход",
    monthNightLabel: "🌙 Ночные",
    monthApLabel: "📦 АП-34",
    monthTripsLabel: "Всего ходок",
    monthAvgLabel: "Ср. выручка в день",
    // Статистика — всё время
    allIncomeLabel: "Выручка",
    allApLabel: "📦 АП-34",
    allNightLabel: "🌙 Ночных",
    // Заголовки блоков
    statsTodayHeader: "📅 СЕГОДНЯ",
    statsAllHeader: "🌍 ЗА ВСЁ ВРЕМЯ",
    // Среднее по типам
    avgByTypeTitle: "📈 Среднее кол-во ходок по типам дней",
    avgDaysCount: "дней",
    avgNoData: "нет данных",
    // Редактировать день
    dateLabel: "📅 Дата:",
    dayTypeLabel: "📋 Тип дня:",
    nightOrdersLabel: "🌙 Ночные (65 лей):",
    apOrdersLabel: "📦 АП-34 (50 лей):",
    addOrdersBtn: "➕ Добавить заказы",
    clearDayBtn: "🗑️ Очистить",
    // Модалка
    addOrdersTitle: "➕ Добавить заказы к существующим",
    addNightLabel: "➕ Ночные:",
    addApLabel: "➕ АП-34:",
    addConfirmBtn: "✅ Добавить",
    cancelBtn: "❌ Отмена",
    // Планирование
    manualPlanTitle: "✏️ Ручное планирование",
    dayTypeSelectLabel: "Тип дня:",
    planDaysLabel: "Дни месяца (1,2,5-10):",
    monthScheduleTitle: "🔄 График 2/2 (месяц)",
    monthSelectLabel: "Месяц:",
    firstWorkDayLabel: "Первый рабочий день:",
    yearScheduleTitle: "📆 График 2/2 (год)",
    yearLabel: "Год:",
    firstMonthLabel: "Месяц первого дня:",
    // Массовое редактирование
    setTypeLabel: "🎯 Установить тип для выбранных дней:",
    keepOrdersLabel: "📦 Сохранить количество заказов",
    // Экспорт/импорт
    exportTitle: "📤 Экспорт данных",
    exportJson: "📄 Экспорт JSON",
    exportCsv: "📊 Экспорт CSV",
    exportExcel: "📋 Экспорт Excel (xls)",
    importTitle: "📥 Импорт данных",
    importHint: "Вставьте содержимое JSON или CSV файла в поле ниже",
    importPlaceholder: "Вставьте JSON или CSV данные сюда...",
    importJson: "📄 Импорт JSON",
    importCsv: "📊 Импорт CSV",
    importFileLabel: "Или выберите файл (.json / .csv / .xlsx):",
    importFileBtnText: "📎 Выбрать файл",
    // История
    historyAddTitle: "История добавлений",
    deleteEntry: "🗑️ Удалить эту запись?",
    deleteDay: "🗑️ Удалить все записи за",
    deleteDayBtn: "🗑️ Удалить все записи за",
    // Аналитика
    analyticsNoData: "📭 Нет данных для анализа",
    chartDailyIncomeTitle: "📅 Доход по дням (текущий месяц)",
    chartDailyTripsTitle: "📊 Ходки по дням (текущий месяц)",
    chartDayTypesTitle: "🥧 Распределение по типам дней",
    chartMonthlyTitle: "📈 Доход по месяцам",
    chartNightVsApTitle: "🌙 Ночные vs 📦 АП-34 (месяц)",
    chartTop5Title: "🏆 Топ-5 лучших дней",
    // Прогноз
    forecastTitle: "🔮 Прогноз на",
    forecastEarned: "💰 Заработано сейчас",
    forecastDays: "📅 Дней в месяце",
    forecastByType: "📈 Прогноз (по типам)",
    forecastByAvg: "📊 Прогноз (по среднему)",
    forecastProgress: "Прогресс месяца",
    forecastWorked: "💡 Вы работали",
    forecastDaysWord: "дней, средний доход за рабочий день —",
    forecastDayWord: "день",
    forecastLeft: "Осталось дней в месяце:",
    forecastTypeStat: "📊 Статистика по типам (вся история):",
    // Уведомления / диалоги
    noDate: "Сначала выберите дату!",
    noOrders: "Добавьте хотя бы один заказ!",
    notifyAdded: "✅ Добавлено",
    notifyEntryDeleted: "🗑️ Запись удалена",
    notifyDayDeleted: "🗑️ Записи удалены",
    confirmDeleteEntry: "🗑️ Удалить эту запись?",
    confirmDeleteDay: "🗑️ Удалить все записи за",
    confirmDeleteDayBtn: "🗑️ Удалить все записи за",
    noLogsText: "Нет записей",
    noDate2: "❌ Выберите дату!",
    notifyDayCleared: "🗑️ День очищен",
    notifyAllDeleted: "🗑️ Все данные удалены",
    noDaysSelected: "Выберите дни!",
    notifyMassApplied: "✅ Изменено",
    noDaysInput: "Введите дни!",
    wrongDaysFormat: "Неверный формат дней!",
    notifyPlanApplied: "✅ Применено к",
    planDaysWord: "дням",
    notifyMonthPlan: "✅ График 2/2 за",
    notifyMonthPlanEnd: "создан",
    notifyYearPlan: "✅ График 2/2 за",
    notifyYearPlanEnd: "год создан",
    notifyJsonExported: "📄 JSON скопирован и скачан",
    notifyCsvExported: "📊 CSV скопирован и скачан",
    notifyExcelExported: "📋 Excel файл скачан",
    noImportData: "Вставьте данные в текстовое поле!",
    confirmImportJson: "Импортировать данные? Существующие данные будут объединены.",
    notifyImported: "✅ Импортировано",
    importedWord: "записей",
    errorJsonFormat: "❌ Неверный формат JSON!",
    errorJsonParse: "❌ Ошибка парсинга JSON: ",
    errorCsvDate: "❌ CSV должен содержать колонку 'date'",
    confirmImportCsv: "Импортировать",
    confirmImportCsvEnd: "записей из CSV?",
    months: ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"],
    weekdays: ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],
  },
  ro: {
    appTitle: "📦 Evidența zilei de lucru",
    today: "Astăzi",
    allTotal: "Venit total",
    allAp: "Total AP-34",
    allNight: "Total noapte",
    monthlyIncome: "Venit lunar",
    todayTrips: "Curse azi",
    statistics: "Statistici",
    planning: "Planificare grafic",
    massEdit: "Editare în masă",
    editDay: "Editare zi",
    shiftSetup: "Configurare zile scurte",
    shiftOverview: "Grafic tură (lună)",
    shiftStatus: "Status zi",
    history: "Istoric modificări",
    analytics: "Analitică",
    importExport: "Import / Export",
    forecast: "Prognoză venituri",
    reset: "⚠️ Resetați toate datele",
    currency: "lei",
    work: "🏢 Lucru",
    help: "🤝 Ajutor",
    short: "⚡ Zi scurtă",
    replace: "🔄 Înlocuire",
    weekend: "🏖️ Weekend",
    manualPlan: "✏️ Planificare manuală",
    monthPlan: "🔄 Program 2/2 (lună)",
    yearPlan: "📆 Program 2/2 (an)",
    year: "an",
    monthsText: "luni",
    monthTotal: "Total pe lună",
    nightText: "N",
    apText: "AP",
    apply: "📌 Aplică",
    generate: "📆 Generează",
    selectDays: "Selectați zilele în calendar și specificați noul tip",
    confirmClear: "Ștergeți datele pentru ${date}?",
    selectAll: "✅ Selectați toate",
    clear: "❌ Șterge selecția",
    keepOrders: "📦 Păstrați numărul de comenzi",
    applyToSelected: "🔄 Aplică la selectate",
    save: "📂 Deschide ziua",
    noData: "📭 Nu există date",
    saved: "✅ Ziua salvată!",
    applied: "✅ Modificat",
    confirmReset: "⚠️ Sigur doriți să ștergeți toate datele?",
    ordersLog: "Jurnal comenzi",
    todayIncome: "Venit",
    todayNightLabel: "Noapte",
    todayApLabel: "📦 AP-34",
    todayTripsLabel: "Total curse",
    monthIncomeLabel: "Venit total",
    monthNightLabel: "🌙 Noapte",
    monthApLabel: "📦 AP-34",
    monthTripsLabel: "Total curse",
    monthAvgLabel: "Medie/zi",
    allIncomeLabel: "Venit",
    allApLabel: "📦 AP-34",
    allNightLabel: "🌙 Noapte",
    statsTodayHeader: "📅 AZI",
    statsAllHeader: "🌍 TOTAL",
    avgByTypeTitle: "📈 Medie curse pe tip de zi",
    avgDaysCount: "zile",
    avgNoData: "fără date",
    dateLabel: "📅 Dată:",
    dayTypeLabel: "📋 Tip zi:",
    nightOrdersLabel: "🌙 Noapte (65 lei):",
    apOrdersLabel: "📦 AP-34 (50 lei):",
    addOrdersBtn: "➕ Adaugă comenzi",
    clearDayBtn: "🗑️ Șterge",
    addOrdersTitle: "➕ Adaugă comenzi la existente",
    addNightLabel: "➕ Noapte:",
    addApLabel: "➕ AP-34:",
    addConfirmBtn: "✅ Adaugă",
    cancelBtn: "❌ Anulare",
    manualPlanTitle: "✏️ Planificare manuală",
    dayTypeSelectLabel: "Tip zi:",
    planDaysLabel: "Zile (1,2,5-10):",
    monthScheduleTitle: "🔄 Program 2/2 (lună)",
    monthSelectLabel: "Lună:",
    firstWorkDayLabel: "Prima zi lucrătoare:",
    yearScheduleTitle: "📆 Program 2/2 (an)",
    yearLabel: "An:",
    firstMonthLabel: "Luna primei zile:",
    setTypeLabel: "🎯 Setați tipul pentru zilele selectate:",
    keepOrdersLabel: "📦 Păstrați numărul de comenzi",
    exportTitle: "📤 Export date",
    exportJson: "📄 Export JSON",
    exportCsv: "📊 Export CSV",
    exportExcel: "📋 Export Excel (xls)",
    importTitle: "📥 Importați date",
    importHint: "Inserați conținutul fișierului JSON sau CSV mai jos",
    importPlaceholder: "Inserați datele JSON sau CSV aici...",
    importJson: "📄 Import JSON",
    importCsv: "📊 Import CSV",
    importFileLabel: "Sau selectați fișierul (.json / .csv / .xlsx):",
    importFileBtnText: "📎 Selectați fișierul",
    historyAddTitle: "Istoric adăugări",
    deleteEntry: "🗑️ Ștergeți această înregistrare?",
    deleteDay: "🗑️ Ștergeți toate înregistrările pentru",
    deleteDayBtn: "🗑️ Șterge toate pentru",
    analyticsNoData: "📭 Nu există date pentru analiză",
    chartDailyIncomeTitle: "📅 Venit pe zile (luna curentă)",
    chartDailyTripsTitle: "📊 Curse pe zile (luna curentă)",
    chartDayTypesTitle: "🥧 Distribuție pe tipuri de zile",
    chartMonthlyTitle: "📈 Venit pe luni",
    chartNightVsApTitle: "🌙 Noapte vs 📦 AP-34 (lună)",
    chartTop5Title: "🏆 Top 5 cele mai bune zile",
    forecastTitle: "🔮 Prognoză pentru",
    forecastEarned: "💰 Câștigat până acum",
    forecastDays: "📅 Zile în lună",
    forecastByType: "📈 Prognoză (după tip)",
    forecastByAvg: "📊 Prognoză (după medie)",
    forecastProgress: "Progres lună",
    forecastWorked: "💡 Ați lucrat",
    forecastDaysWord: "zile, venitul mediu pe zi lucrătoare —",
    forecastDayWord: "zi",
    forecastLeft: "Zile rămase în lună:",
    forecastTypeStat: "📊 Statistici pe tipuri (toată istoria):",
    noDate: "Mai întâi selectați data!",
    noOrders: "Adăugați cel puțin o comandă!",
    notifyAdded: "✅ Adăugat",
    notifyEntryDeleted: "🗑️ Înregistrare ștearsă",
    notifyDayDeleted: "🗑️ Înregistrări șterse",
    confirmDeleteEntry: "🗑️ Ștergeți această înregistrare?",
    confirmDeleteDay: "🗑️ Ștergeți toate înregistrările pentru",
    confirmDeleteDayBtn: "🗑️ Șterge toate pentru",
    noLogsText: "Nu există înregistrări",
    noDate2: "❌ Selectați data!",
    notifyDayCleared: "🗑️ Ziua ștearsă",
    notifyAllDeleted: "🗑️ Toate datele șterse",
    noDaysSelected: "Selectați zilele!",
    notifyMassApplied: "✅ Modificat",
    noDaysInput: "Introduceți zilele!",
    wrongDaysFormat: "Format de zile incorect!",
    notifyPlanApplied: "✅ Aplicat la",
    planDaysWord: "zile",
    notifyMonthPlan: "✅ Program 2/2 pentru",
    notifyMonthPlanEnd: "creat",
    notifyYearPlan: "✅ Program 2/2 pentru",
    notifyYearPlanEnd: "an creat",
    notifyJsonExported: "📄 JSON copiat și descărcat",
    notifyCsvExported: "📊 CSV copiat și descărcat",
    notifyExcelExported: "📋 Fișier Excel descărcat",
    noImportData: "Inserați datele în câmpul de text!",
    confirmImportJson: "Importați datele? Datele existente vor fi combinate.",
    notifyImported: "✅ Importat",
    importedWord: "înregistrări",
    errorJsonFormat: "❌ Format JSON incorect!",
    errorJsonParse: "❌ Eroare parsare JSON: ",
    errorCsvDate: "❌ CSV trebuie să conțină coloana 'date'",
    confirmImportCsv: "Importați",
    confirmImportCsvEnd: "înregistrări din CSV?",
    months: ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"],
    weekdays: ["Lu","Ma","Mi","Jo","Vi","Sâ","Du"],
  },
  en: {
    appTitle: "📦 Courier Work Day Tracker",
    today: "Today",
    allTotal: "Total income",
    allAp: "Total AP-34",
    allNight: "Total night",
    monthlyIncome: "Monthly income",
    todayTrips: "Trips today",
    statistics: "Statistics",
    planning: "Schedule planning",
    massEdit: "Mass edit days",
    editDay: "Edit day",
    shiftSetup: "Short days setup",
    shiftOverview: "Shift schedule (month)",
    shiftStatus: "Day status",
    history: "Change history",
    analytics: "Analytics",
    importExport: "Import / Export",
    forecast: "Revenue forecast",
    reset: "⚠️ Reset all data",
    currency: "lei",
    work: "🏢 Work",
    help: "🤝 Help",
    short: "⚡ Short day",
    replace: "🔄 Replacement",
    weekend: "🏖️ Weekend",
    manualPlan: "✏️ Manual planning",
    monthPlan: "🔄 2/2 schedule (month)",
    yearPlan: "📆 2/2 schedule (year)",
    year: "year",
    monthsText: "months",
    monthTotal: "Month total",
    nightText: "N",
    apText: "AP",
    apply: "📌 Apply",
    generate: "📆 Generate",
    selectDays: "Select days in the calendar and specify new type",
    confirmClear: "Clear data for ${date}?",
    selectAll: "✅ Select all",
    clear: "❌ Clear selection",
    keepOrders: "📦 Keep number of orders",
    applyToSelected: "🔄 Apply to selected",
    save: "📂 Open day",
    noData: "📭 No data",
    saved: "✅ Day saved!",
    applied: "✅ Modified",
    confirmReset: "⚠️ Are you sure you want to delete all data?",
    ordersLog: "Orders log",
    todayIncome: "Income",
    todayNightLabel: "Night",
    todayApLabel: "📦 AP-34",
    todayTripsLabel: "Total trips",
    monthIncomeLabel: "Total income",
    monthNightLabel: "🌙 Night",
    monthApLabel: "📦 AP-34",
    monthTripsLabel: "Total trips",
    monthAvgLabel: "Avg income/day",
    allIncomeLabel: "Revenue",
    allApLabel: "📦 AP-34",
    allNightLabel: "🌙 Night",
    statsTodayHeader: "📅 TODAY",
    statsAllHeader: "🌍 ALL TIME",
    avgByTypeTitle: "📈 Avg trips by day type",
    avgDaysCount: "days",
    avgNoData: "no data",
    dateLabel: "📅 Date:",
    dayTypeLabel: "📋 Day type:",
    nightOrdersLabel: "🌙 Night (65 lei):",
    apOrdersLabel: "📦 AP-34 (50 lei):",
    addOrdersBtn: "➕ Add orders",
    clearDayBtn: "🗑️ Clear",
    addOrdersTitle: "➕ Add to existing orders",
    addNightLabel: "➕ Night:",
    addApLabel: "➕ AP-34:",
    addConfirmBtn: "✅ Add",
    cancelBtn: "❌ Cancel",
    manualPlanTitle: "✏️ Manual planning",
    dayTypeSelectLabel: "Day type:",
    planDaysLabel: "Days (1,2,5-10):",
    monthScheduleTitle: "🔄 2/2 schedule (month)",
    monthSelectLabel: "Month:",
    firstWorkDayLabel: "First work day:",
    yearScheduleTitle: "📆 2/2 schedule (year)",
    yearLabel: "Year:",
    firstMonthLabel: "Month of first day:",
    setTypeLabel: "🎯 Set type for selected days:",
    keepOrdersLabel: "📦 Keep number of orders",
    exportTitle: "📤 Export data",
    exportJson: "📄 Export JSON",
    exportCsv: "📊 Export CSV",
    exportExcel: "📋 Export Excel (xls)",
    importTitle: "📥 Import data",
    importHint: "Paste JSON or CSV file content below",
    importPlaceholder: "Paste JSON or CSV data here...",
    importJson: "📄 Import JSON",
    importCsv: "📊 Import CSV",
    importFileLabel: "Or select file (.json / .csv / .xlsx):",
    importFileBtnText: "📎 Select file",
    historyAddTitle: "Add history",
    deleteEntry: "🗑️ Delete this entry?",
    deleteDay: "🗑️ Delete all entries for",
    deleteDayBtn: "🗑️ Delete all for",
    analyticsNoData: "📭 No data for analysis",
    chartDailyIncomeTitle: "📅 Income by day (current month)",
    chartDailyTripsTitle: "📊 Trips by day (current month)",
    chartDayTypesTitle: "🥧 Distribution by day type",
    chartMonthlyTitle: "📈 Income by month",
    chartNightVsApTitle: "🌙 Night vs 📦 AP-34 (month)",
    chartTop5Title: "🏆 Top 5 best days",
    forecastTitle: "🔮 Forecast for",
    forecastEarned: "💰 Earned so far",
    forecastDays: "📅 Days in month",
    forecastByType: "📈 Forecast (by type)",
    forecastByAvg: "📊 Forecast (by average)",
    forecastProgress: "Month progress",
    forecastWorked: "💡 You worked",
    forecastDaysWord: "days, avg income per work day —",
    forecastDayWord: "day",
    forecastLeft: "Days left in month:",
    forecastTypeStat: "📊 Stats by type (all history):",
    noDate: "Please select a date first!",
    noOrders: "Add at least one order!",
    notifyAdded: "✅ Added",
    notifyEntryDeleted: "🗑️ Entry deleted",
    notifyDayDeleted: "🗑️ Entries deleted",
    confirmDeleteEntry: "🗑️ Delete this entry?",
    confirmDeleteDay: "🗑️ Delete all entries for",
    confirmDeleteDayBtn: "🗑️ Delete all for",
    noLogsText: "No entries",
    noDate2: "❌ Please select a date!",
    notifyDayCleared: "🗑️ Day cleared",
    notifyAllDeleted: "🗑️ All data deleted",
    noDaysSelected: "Select days!",
    notifyMassApplied: "✅ Modified",
    noDaysInput: "Enter days!",
    wrongDaysFormat: "Invalid day format!",
    notifyPlanApplied: "✅ Applied to",
    planDaysWord: "days",
    notifyMonthPlan: "✅ 2/2 schedule for",
    notifyMonthPlanEnd: "created",
    notifyYearPlan: "✅ 2/2 schedule for",
    notifyYearPlanEnd: "year created",
    notifyJsonExported: "📄 JSON copied and downloaded",
    notifyCsvExported: "📊 CSV copied and downloaded",
    notifyExcelExported: "📋 Excel file downloaded",
    noImportData: "Paste data into the text field!",
    confirmImportJson: "Import data? Existing data will be merged.",
    notifyImported: "✅ Imported",
    importedWord: "records",
    errorJsonFormat: "❌ Invalid JSON format!",
    errorJsonParse: "❌ JSON parse error: ",
    errorCsvDate: "❌ CSV must contain a 'date' column",
    confirmImportCsv: "Import",
    confirmImportCsvEnd: "records from CSV?",
    months: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    weekdays: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
  },
};

// ============================================
// ПЕРЕВОД
// ============================================
function setLanguage(lang) {
  currentLanguage = lang;
  translateUI();
  loadHistory();
  displayOrdersLog();
  localStorage.setItem("appLanguage", lang);
}

function changeLanguage(lang) {
  setLanguage(lang);
}

function translateUI() {
  const t = translations[currentLanguage];

  // Вспомогательная функция: меняет текст элемента по id
  const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.innerText = val; };
  // Меняет текст первого найденного элемента по селектору
  const setQ = (sel, val) => { const el = document.querySelector(sel); if (el && val) el.innerText = val; };

  // Заголовок
  setQ("h1", t.appTitle);

  // Все currency-label
  document.querySelectorAll(".currency-label").forEach(el => el.innerText = t.currency);

  // Меню — аккордеоны (перевод по data-i18n, не зависит от порядка в DOM)
  document.querySelectorAll(".menu-text[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.innerText = t[key];
  });

  // Заголовки секций
  setQ(".stats-title", t.statistics);
  setQ(".history-title", t.history);
  setQ(".mass-edit-title", t.massEdit);
  setQ(".mass-edit-description", t.selectDays);

  // Заголовки сворачиваемых блоков статистики
  const todayHeader = document.querySelector("#statsToday")?.previousElementSibling;
  if (todayHeader) todayHeader.querySelector("span:first-child").innerText = t.statsTodayHeader || "📅 СЕГОДНЯ";
  const allHeader = document.querySelector("#statsAll")?.previousElementSibling;
  if (allHeader) allHeader.querySelector("span:first-child").innerText = t.statsAllHeader || "🌍 ЗА ВСЁ ВРЕМЯ";

  // Карточки СЕГОДНЯ (по data-i18n)
  setText("labelTodayIncome",  t.todayIncome);
  setText("labelTodayNight",   t.todayNightLabel);
  setText("labelTodayAp",      t.todayApLabel);
  setText("labelTodayTrips",   t.todayTripsLabel);

  // Карточки МЕСЯЦ
  setText("labelMonthIncome",  t.monthIncomeLabel);
  setText("labelMonthNight",   t.monthNightLabel);
  setText("labelMonthAp",      t.monthApLabel);
  setText("labelMonthTrips",   t.monthTripsLabel);
  setText("labelMonthAvg",     t.monthAvgLabel);

  // Карточки ВСЁ ВРЕМЯ
  setText("labelAllTotal",  t.allIncomeLabel);
  setText("labelAllAp",     t.allApLabel);
  setText("labelAllNight",  t.allNightLabel);

  // Редактировать день
  setQ("label[for='date']",     t.dateLabel);
  setQ("label[for='dayType']",  t.dayTypeLabel);
  setQ("label[for='nightOrders']", t.nightOrdersLabel);
  setQ("label[for='apOrders']",    t.apOrdersLabel);
  const addOrdersBtn = document.querySelector(".btn-add-orders");
  if (addOrdersBtn) addOrdersBtn.innerText = t.addOrdersBtn;
  setQ(".btn-clear-day", t.clearDayBtn);

  // Модальное окно
  setQ("#addOrdersModal h3", t.addOrdersTitle);
  setQ("label[for='addNightOrders']", t.addNightLabel);
  setQ("label[for='addApOrders']",    t.addApLabel);

  // Кнопки сохранения/отмены
  const saveDayBtn = document.getElementById("saveDayBtn");
  if (saveDayBtn) saveDayBtn.innerText = t.save;
  const resetBtn = document.querySelector(".btn-reset");
  if (resetBtn) resetBtn.innerText = t.reset;

  // Кнопки типов дней (quick-types в редакторе)
  const quickTypeBtns = document.querySelectorAll(".quick-types .type-btn");
  const typeKeys = ["work","help","short","replace","weekend"];
  quickTypeBtns.forEach((btn, i) => { if (t[typeKeys[i]]) btn.innerText = t[typeKeys[i]]; });

  // Кнопки типов в массовом редактировании
  const massTypeBtns = document.querySelectorAll(".mass-edit-type-buttons .type-btn");
  massTypeBtns.forEach((btn, i) => { if (t[typeKeys[i]]) btn.innerText = t[typeKeys[i]]; });

  // Кнопки типов в select dayType
  const dayTypeSelect = document.getElementById("dayType");
  if (dayTypeSelect) {
    const opts = dayTypeSelect.options;
    const optKeys = ["work","help","short","replace","weekend"];
    for (let i = 0; i < opts.length; i++) {
      if (t[optKeys[i]]) opts[i].text = t[optKeys[i]];
    }
  }
  const planDayTypeSelect = document.getElementById("planDayType");
  if (planDayTypeSelect) {
    const opts = planDayTypeSelect.options;
    const optKeys = ["work","help","short","replace","weekend"];
    for (let i = 0; i < opts.length; i++) {
      if (t[optKeys[i]]) opts[i].text = t[optKeys[i]];
    }
  }

  // Кнопки массового редактирования (Выбрать все / Очистить / Применить)
  const massActions = document.querySelectorAll(".mass-edit-actions .btn");
  if (massActions[0]) massActions[0].innerText = t.selectAll;
  if (massActions[1]) massActions[1].innerText = t.clear;
  const massMassBtn = document.querySelector(".btn-mass");
  if (massMassBtn) massMassBtn.innerText = t.applyToSelected;

  // Модальное окно — кнопки
  const modalBtns = document.querySelectorAll("#addOrdersModal .btn");
  if (modalBtns[0]) modalBtns[0].innerText = t.addConfirmBtn;
  if (modalBtns[1]) modalBtns[1].innerText = t.cancelBtn;

  // Планирование — карточки и лейблы
  const planCards = document.querySelectorAll(".plan-card h3");
  if (planCards[0]) planCards[0].innerText = t.manualPlanTitle || "✏️ Ручное планирование";
  if (planCards[1]) planCards[1].innerText = t.monthScheduleTitle || "🔄 График 2/2 (месяц)";
  if (planCards[2]) planCards[2].innerText = t.yearScheduleTitle || "📆 График 2/2 (год)";

  // Лейблы внутри планирования — через querySelectorAll по секции
  const planSection = document.getElementById("planning");
  if (planSection) {
    const planLabels = planSection.querySelectorAll("label");
    // Карточка 1: Тип дня, Дни месяца
    if (planLabels[0]) planLabels[0].innerText = t.dayTypeSelectLabel || "Тип дня:";
    if (planLabels[1]) planLabels[1].innerText = t.planDaysLabel || "Дни месяца (1,2,5-10):";
    // Карточка 2: Месяц, Первый рабочий день
    if (planLabels[2]) planLabels[2].innerText = t.monthSelectLabel || "Месяц:";
    if (planLabels[3]) planLabels[3].innerText = t.firstWorkDayLabel || "Первый рабочий день:";
    // Карточка 3: Год, Первый рабочий день, Месяц первого дня
    if (planLabels[4]) planLabels[4].innerText = t.yearLabel || "Год:";
    if (planLabels[5]) planLabels[5].innerText = t.firstWorkDayLabel || "Первый рабочий день:";
    if (planLabels[6]) planLabels[6].innerText = t.firstMonthLabel || "Месяц первого дня:";
  }

  // Кнопки планирования
  const planBtns = document.querySelectorAll(".btn-plan, .btn-generate");
  if (planBtns[0]) planBtns[0].innerText = t.apply;
  if (planBtns[1]) planBtns[1].innerText = t.generate;
  if (planBtns[2]) planBtns[2].innerText = t.generate;

  // Массовое редактирование
  setQ(".mass-edit-controls .form-group label", t.setTypeLabel);
  const keepOrdersSpan = document.querySelector(".mass-edit-options .checkbox-label span");
  if (keepOrdersSpan) keepOrdersSpan.innerText = t.keepOrdersLabel;

  // Импорт / Экспорт
  const importExportCards = document.querySelectorAll("#importExport .plan-card h3");
  if (importExportCards[0]) importExportCards[0].innerText = t.exportTitle;
  if (importExportCards[1]) importExportCards[1].innerText = t.importTitle;
  setQ("#importExport .plan-card p", t.importHint);
  const importTextarea = document.getElementById("importTextarea");
  if (importTextarea) importTextarea.placeholder = t.importPlaceholder;
  const exportBtns = document.querySelectorAll("#importExport .btn");
  if (exportBtns[0]) exportBtns[0].innerText = t.exportJson;
  if (exportBtns[1]) exportBtns[1].innerText = t.exportCsv;
  if (exportBtns[2]) exportBtns[2].innerText = t.exportExcel;
  if (exportBtns[3]) exportBtns[3].innerText = t.importJson;
  if (exportBtns[4]) exportBtns[4].innerText = t.importCsv;
  const importFileLabelEl = document.getElementById("importFileLabelText");
  if (importFileLabelEl) importFileLabelEl.innerText = t.importFileLabel || "Или выберите файл (.json / .csv / .xlsx):";
  const importFileBtn = document.getElementById("importFileBtn");
  if (importFileBtn) importFileBtn.innerText = (t.importFileBtnText || "📎 Выбрать файл");

  // История добавлений — заголовок
  setText("ordersLogTitle", t.historyAddTitle);

  // Календари
  const currentMonthEl = document.getElementById("currentMonth");
  if (currentMonthEl) currentMonthEl.innerText = `${t.months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const massEditMonthEl = document.getElementById("massEditCurrentMonth");
  if (massEditMonthEl) massEditMonthEl.innerText = `${t.months[massEditDate.getMonth()]} ${massEditDate.getFullYear()}`;

  renderCalendar();
  renderMassEditCalendar();
  populateMonthSelect("generateMonth", document.getElementById("generateMonth")?.value);
  populateMonthSelect("firstWorkMonthYear", document.getElementById("firstWorkMonthYear")?.value);
  renderForecast();
  updateTotals();
}

// ============================================
// ТЕМА
// ============================================
function initThemeToggle() {
  const themeToggle = document.getElementById("theme-toggle");
  if (!themeToggle) return;
  const body = document.body;
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    body.classList.add("dark-theme");
    themeToggle.checked = true;
  }

  themeToggle.addEventListener("change", function () {
    if (this.checked) {
      body.classList.add("dark-theme");
      localStorage.setItem("theme", "dark");
    } else {
      body.classList.remove("dark-theme");
      localStorage.setItem("theme", "light");
    }
    renderCalendar();
    renderMassEditCalendar();
  });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
function initApp() {
  if (document.getElementById("date")) {
    const today = new Date();
    document.getElementById("date").value = today.toISOString().split("T")[0];
  }

  loadHistory();
  renderCalendar();
  renderMassEditCalendar();
  updateTotals();
  updateMonthlyCounter();
  displayOrdersLog();
  updateClock();
  initThemeToggle();
  populateMonthSelect("generateMonth");
  populateMonthSelect("firstWorkMonthYear");
  renderForecast();
  initShiftUI();

  document.querySelectorAll(".accordion-content").forEach((el) => el.classList.remove("show"));
  document.querySelectorAll(".arrow").forEach((el) => el.classList.remove("rotated"));

  const savedLang = localStorage.getItem("appLanguage");
  if (savedLang) setLanguage(savedLang);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// ============================================
// ДАННЫЕ
// ============================================
function loadHistory() {
  const historyContainer = document.getElementById("history");
  if (!historyContainer) return;
  const history = JSON.parse(localStorage.getItem("courierData")) || [];
  historyContainer.innerHTML = "";
  const t = translations[currentLanguage];
  const filteredHistory = history.filter((day) => day.total > 0);

  if (filteredHistory.length === 0) {
    historyContainer.innerHTML = `<p style='text-align:center; color:#666; padding: 20px;'>${t.noData}</p>`;
    return;
  }

  const grouped = {};
  filteredHistory.forEach((day) => {
    const y = day.date.slice(0, 4);
    const m = day.date.slice(5, 7);
    if (!grouped[y]) grouped[y] = {};
    if (!grouped[y][m]) grouped[y][m] = [];
    grouped[y][m].push(day);
  });

  Object.keys(grouped).sort().reverse().forEach((y) => {
    const yearBlock = document.createElement("div");
    yearBlock.classList.add("year-block");

    const yearHeader = document.createElement("div");
    yearHeader.classList.add("year-header");
    yearHeader.innerText = `📅 ${y} ${t.year || "год"} — ${Object.keys(grouped[y]).length} ${t.monthsText || "мес"}`;
    yearBlock.appendChild(yearHeader);

    const monthsDiv = document.createElement("div");
    monthsDiv.classList.add("year-months");
    monthsDiv.style.display = "none";

    Object.keys(grouped[y]).sort().reverse().forEach((m) => {
      const monthBlock = document.createElement("div");
      monthBlock.classList.add("month-block");

      const monthHeader = document.createElement("div");
      monthHeader.classList.add("month-header");
      monthHeader.innerText = `${t.months[parseInt(m) - 1]} ${y} (${grouped[y][m].length}) ▶`;
      monthBlock.appendChild(monthHeader);

      const daysDiv = document.createElement("div");
      daysDiv.classList.add("month-days");
      let monthTotal = 0;

      grouped[y][m].forEach((day) => {
        const dayDiv = document.createElement("div");
        const typeIcon = getDayTypeIcon(day.dayType);
        dayDiv.innerHTML = `${day.date.slice(8, 10)}.${m}.${y} ${typeIcon} | ${t.nightText || "Н"}:${day.nightOrders} ${t.apText || "АП"}:${day.apOrders} | <strong>${day.total} ${t.currency}</strong>`;
        daysDiv.appendChild(dayDiv);
        monthTotal += day.total || 0;
      });

      const monthTotalDiv = document.createElement("div");
      monthTotalDiv.style.fontWeight = "bold";
      monthTotalDiv.style.marginTop = "10px";
      monthTotalDiv.style.padding = "8px";
      monthTotalDiv.style.background = "linear-gradient(135deg, #667eea20, #764ba220)";
      monthTotalDiv.style.borderRadius = "5px";
      monthTotalDiv.innerHTML = `📊 ${t.monthTotal || "Итого за месяц"}: <strong>${monthTotal} ${t.currency}</strong>`;
      daysDiv.appendChild(monthTotalDiv);
      monthBlock.appendChild(daysDiv);
      monthsDiv.appendChild(monthBlock);

      monthHeader.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = daysDiv.style.display === "none" || daysDiv.style.display === "";
        daysDiv.style.display = isHidden ? "block" : "none";
        monthHeader.innerText = `${t.months[parseInt(m) - 1]} ${y} ${isHidden ? "▼" : "▶"}`;
      });
    });

    yearBlock.appendChild(monthsDiv);
    historyContainer.appendChild(yearBlock);

    yearHeader.addEventListener("click", () => {
      const isHidden = monthsDiv.style.display === "none" || monthsDiv.style.display === "";
      monthsDiv.style.display = isHidden ? "block" : "none";
      yearHeader.innerText = `📅 ${y} ${t.year || "год"} — ${Object.keys(grouped[y]).length} ${t.monthsText || "мес"} ${isHidden ? "▼" : "▶"}`;
    });
  });
}

// ============================================
// СОХРАНЕНИЕ ДНЯ
// ============================================
function saveDay() {
  const dateInput = document.getElementById("date");
  const dayTypeSelect = document.getElementById("dayType");
  const nightOrdersInput = document.getElementById("nightOrders");
  const apOrdersInput = document.getElementById("apOrders");

  if (!dateInput || !dayTypeSelect || !nightOrdersInput || !apOrdersInput) return;

  const date = dateInput.value;
  if (!date) { showAlertDialog((translations[currentLanguage].noDate2 || "❌ Выберите дату!")); return; }

  const dayType = dayTypeSelect.value;
  const nightOrders = parseInt(nightOrdersInput.value) || 0;
  const apOrders = parseInt(apOrdersInput.value) || 0;
  const total = nightOrders * NIGHT_PRICE + apOrders * AP_PRICE;
  const note = (document.getElementById("dayNote") || {}).value || "";
  const singleOnly = !!(document.getElementById("singleDayOnly") && document.getElementById("singleDayOnly").checked);

  const dayData = { date, dayType, nightOrders, apOrders, total, generated: false, note };

  let history = JSON.parse(localStorage.getItem("courierData")) || [];
  const index = history.findIndex((d) => d.date === date);
  if (index >= 0) { history[index] = dayData; } else { history.push(dayData); }
  history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("courierData", JSON.stringify(history));

  // Если это "Подмога" и галочка НЕ стоит — сделать этот день якорем и пересчитать график
  if (dayType === "help" && !singleOnly) {
    if (!shiftConfig || !shiftConfig.firstWorkDay || !shiftConfig.myNumber) {
      showAlertDialog("Сначала настройте короткие дни (номер и первый рабочий день).");
    } else {
      const sdDow = new Date(date + "T12:00:00").getDay();
      if (sdDow === 0 || sdDow === 6) {
        showAlertDialog("Дата подмоги не должна быть субботой или воскресеньем. День сохранён только как единичный.");
      } else if (isWorkDay(date, shiftConfig.firstWorkDay)) {
        showAlertDialog("Это рабочий день по графику 2/2 — нельзя использовать как якорь подмоги. День сохранён только как единичный.");
      } else {
        helpConfig = { lastMyHelpDate: date };
        localStorage.setItem("helpConfig", JSON.stringify(helpConfig));
        const helpStartInput = document.getElementById("helpStartDate");
        if (helpStartInput) helpStartInput.value = date;
        markAutoSchedule();
        showNotification("✅ График подмоги пересчитан от " + date);
        document.getElementById("total").innerText = total;
        nightOrdersInput.value = "";
        apOrdersInput.value = "";
        const dayNoteEl = document.getElementById("dayNote");
        if (dayNoteEl) dayNoteEl.value = "";
        const singleBox = document.getElementById("singleDayOnly");
        if (singleBox) singleBox.checked = false;
        originalDayData = null;
        return;
      }
    }
  }

  document.getElementById("total").innerText = total;

  renderCalendar();
  renderMassEditCalendar();
  loadHistory();
  updateTotals();
  updateMonthlyCounter();
  renderForecast();

  nightOrdersInput.value = "";
  apOrdersInput.value = "";
  const dayNoteEl = document.getElementById("dayNote");
  if (dayNoteEl) dayNoteEl.value = "";
  const singleBox = document.getElementById("singleDayOnly");
  if (singleBox) singleBox.checked = false;

  showNotification(translations[currentLanguage].saved || "✅ День сохранен!");
  originalDayData = null;
}

// ============================================
// ОЧИСТИТЬ ТЕКУЩИЙ ДЕНЬ
// ============================================
function clearCurrentDay() {
  const dateInput = document.getElementById("date");
  let date = dateInput ? dateInput.value : "";

  if (!date) {
    const today = new Date();
    date = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    if (dateInput) dateInput.value = date;
  }

  showConfirmDialog(
    `${translations[currentLanguage].confirmClear ? translations[currentLanguage].confirmClear.replace('${date}', date) : '🗑️ Очистить данные за '+date+'?'}`,
    function() {
      let history = JSON.parse(localStorage.getItem("courierData")) || [];
      history = history.filter((d) => d.date !== date);
      localStorage.setItem("courierData", JSON.stringify(history));

      if (document.getElementById("nightOrders")) document.getElementById("nightOrders").value = "";
      if (document.getElementById("apOrders")) document.getElementById("apOrders").value = "";
      if (document.getElementById("dayType")) document.getElementById("dayType").value = "work";
      if (document.getElementById("dayNote")) document.getElementById("dayNote").value = "";

      renderCalendar();
      renderMassEditCalendar();
      loadHistory();
      updateTotals();
      updateMonthlyCounter();
      renderForecast();

      showNotification(`${translations[currentLanguage].notifyDayCleared || "🗑️ День очищен"}: ${date}`);
    }
  );
}

// ============================================
// СБРОСИТЬ ВСЕ ДАННЫЕ
// ============================================
function resetCalendar() {
  const t = translations[currentLanguage];
  showConfirmDialog(
    t.confirmReset || "⚠️ Вы точно хотите удалить все данные?",
    function() {
      localStorage.clear();
      location.reload();
    }
  );
}

// ============================================
// П.4: ОБНОВЛЕНИЕ СТАТИСТИКИ — месяц + всего
// ============================================
function updateTotals() {
  const history = JSON.parse(localStorage.getItem("courierData")) || [];
  const today = new Date();
  const todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

  const viewMonth = currentDate.getMonth() + 1;
  const viewYear = currentDate.getFullYear();

  // Сегодня
  let todayTotal = 0, todayNight = 0, todayAp = 0, todayTrips = 0;
  // Месяц
  let mIncome = 0, mNight = 0, mAp = 0, mTrips = 0, mWorkDays = 0;
  // Всё время
  let allTotal = 0, allAp = 0, allNight = 0;

  history.forEach((day) => {
    allTotal += day.total || 0;
    allAp += day.apOrders || 0;
    allNight += day.nightOrders || 0;

    if (day.date === todayStr) {
      todayTotal = day.total || 0;
      todayNight = day.nightOrders || 0;
      todayAp = day.apOrders || 0;
      todayTrips = todayNight + todayAp;
    }

    const [y, m] = day.date.split("-").map(Number);
    if (y === viewYear && m === viewMonth) {
      mIncome += day.total || 0;
      mNight += day.nightOrders || 0;
      mAp += day.apOrders || 0;
      if ((day.nightOrders || 0) + (day.apOrders || 0) > 0) {
        mTrips += (day.nightOrders || 0) + (day.apOrders || 0);
        mWorkDays++;
      }
    }
  });

  const t = translations[currentLanguage];
  const monthName = t.months ? t.months[currentDate.getMonth()] : "Месяц";

  // --- Сегодня ---
  const el = (id) => document.getElementById(id);
  if (el("total"))       el("total").innerText = todayTotal;
  if (el("todayNight"))  el("todayNight").innerText = todayNight;
  if (el("todayAp"))     el("todayAp").innerText = todayAp;
  if (el("todayTrips"))  el("todayTrips").innerText = todayTrips;

  // --- Месяц ---
  if (el("monthlyIncome")) el("monthlyIncome").innerText = mIncome;
  if (el("monthNight"))    el("monthNight").innerText = mNight;
  if (el("monthAp"))       el("monthAp").innerText = mAp;
  if (el("monthTrips"))    el("monthTrips").innerText = mTrips;
  if (el("monthAvgDay"))   el("monthAvgDay").innerText = mWorkDays > 0 ? Math.round(mIncome / mWorkDays) : 0;
  if (el("monthStatsLabel")) el("monthStatsLabel").innerText = monthName + " " + viewYear;

  // --- Всё время ---
  if (el("allTotal")) el("allTotal").innerText = allTotal;
  if (el("allAp"))    el("allAp").innerText = allAp;
  if (el("allNight")) el("allNight").innerText = allNight;

  renderAvgByDayType(history);
}

function renderAvgByDayType(history) {
  const container = document.getElementById("avgByDayType");
  if (!container) return;

  const dayTypes = ["work", "help", "short", "replace", "weekend"];
  const stats = {};
  dayTypes.forEach(t => stats[t] = { count: 0, totalTrips: 0 });

  history.forEach(day => {
    const type = day.dayType || "work";
    if (stats[type] !== undefined && (day.nightOrders > 0 || day.apOrders > 0)) {
      stats[type].count++;
      stats[type].totalTrips += (day.nightOrders || 0) + (day.apOrders || 0);
    }
  });

  const t = translations[currentLanguage];
  const typeLabels = {
    work: t.work || "🏢 Рабочий",
    help: t.help || "🤝 Подмога",
    short: t.short || "⚡ Короткий",
    replace: t.replace || "🔄 Замена",
    weekend: t.weekend || "🏖️ Выходной"
  };

  const hasData = dayTypes.some(tp => stats[tp].count > 0);
  if (!hasData) { container.innerHTML = ""; return; }

  let html = `<h4>${t.avgByTypeTitle || "📈 Среднее кол-во ходок по типам дней"}</h4><div class="avg-day-type-grid">`;
  dayTypes.forEach(tp => {
    const s = stats[tp];
    const avg = s.count > 0 ? (s.totalTrips / s.count).toFixed(1) : "—";
    const label = typeLabels[tp];
    const countText = s.count > 0 ? s.count + " " + (t.avgDaysCount || "дней") : (t.avgNoData || "нет данных");
    html += `<div class="avg-type-card">
      <span class="type-name">${label}</span>
      <span class="type-avg">${avg}</span>
      <span style="font-size:0.7em; color:#aaa;">${countText}</span>
    </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}

function getDayTypeIcon(type) {
  return { work: "🏢", help: "🤝", short: "⚡", replace: "🔄", weekend: "🏖️" }[type] || "📅";
}

// ============================================
// П.5: ПРОГНОЗ ВЫРУЧКИ
// ============================================
function renderForecast() {
  const container = document.getElementById("forecastContent");
  if (!container) return;

  const history = JSON.parse(localStorage.getItem("courierData")) || [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const remainingDays = totalDaysInMonth - todayDay;
  const t = translations[currentLanguage];

  // Данные текущего месяца
  const thisMonthDays = history.filter(d => {
    const [y, m] = d.date.split("-").map(Number);
    return y === currentYear && m === currentMonth;
  });

  // Уже заработанное в этом месяце
  const earnedSoFar = thisMonthDays.reduce((acc, d) => acc + (d.total || 0), 0);

  // Рабочие дни этого месяца (прошедшие + сегодня)
  const workedDays = thisMonthDays.filter(d => {
    const dayNum = parseInt(d.date.split("-")[2]);
    return dayNum <= todayDay && (d.nightOrders > 0 || d.apOrders > 0);
  });

  // Среднее за рабочий день в текущем месяце
  const avgPerWorkDayThisMonth = workedDays.length > 0
    ? workedDays.reduce((acc, d) => acc + (d.total || 0), 0) / workedDays.length
    : 0;

  // Среднее по типам дней за всю историю
  const dayTypes = ["work", "help", "short", "replace", "weekend"];
  const typeStats = {};
  dayTypes.forEach(tp => typeStats[tp] = { count: 0, totalIncome: 0, totalTrips: 0 });
  history.forEach(d => {
    const tp = d.dayType || "work";
    if (typeStats[tp] && (d.nightOrders > 0 || d.apOrders > 0)) {
      typeStats[tp].count++;
      typeStats[tp].totalIncome += d.total || 0;
      typeStats[tp].totalTrips += (d.nightOrders || 0) + (d.apOrders || 0);
    }
  });

  // Будущие дни месяца (по расписанию)
  const futureDays = history.filter(d => {
    const [y, m] = d.date.split("-").map(Number);
    const dayNum = parseInt(d.date.split("-")[2]);
    return y === currentYear && m === currentMonth && dayNum > todayDay;
  });

  // Прогноз по типам дней
  let forecastByType = 0;
  futureDays.forEach(d => {
    const tp = d.dayType || "work";
    const avgIncome = (typeStats[tp] && typeStats[tp].count > 0) ? typeStats[tp].totalIncome / typeStats[tp].count : 0;
    forecastByType += avgIncome;
  });

  // Прогноз по среднему текущего месяца
  const avgDailyThisMonth = workedDays.length > 0 ? avgPerWorkDayThisMonth : 0;
  const workdaysFuture = futureDays.filter(d => d.dayType === "work" || d.dayType === "help" || d.dayType === "short").length;
  const forecastByAvg = earnedSoFar + avgDailyThisMonth * workdaysFuture;

  // Общий прогноз (среднее двух методов)
  const forecastTotal = earnedSoFar + forecastByType;
  const forecastConservative = forecastByAvg;

  // Процент месяца пройден
  const monthProgress = Math.round((todayDay / totalDaysInMonth) * 100);

  if (!container.closest('.accordion-content')) {
    container.innerHTML = "";
    return;
  }

  let forecastHTML = `<div class="forecast-block">
    <div class="forecast-header">${t.forecastTitle || "🔮 Прогноз на"} ${t.months ? t.months[currentMonth-1] : "этот месяц"} ${currentYear}</div>
    <div class="forecast-grid">
      <div class="forecast-card">
        <span class="f-label">${t.forecastEarned || "💰 Заработано сейчас"}</span>
        <span class="f-value">${earnedSoFar} ${t.currency}</span>
      </div>
      <div class="forecast-card">
        <span class="f-label">${t.forecastDays || "📅 Дней в месяце"}</span>
        <span class="f-value">${todayDay} / ${totalDaysInMonth}</span>
      </div>
      <div class="forecast-card">
        <span class="f-label">${t.forecastByType || "📈 Прогноз (по типам)"}</span>
        <span class="f-value">${Math.round(forecastTotal)} ${t.currency}</span>
      </div>
      <div class="forecast-card">
        <span class="f-label">${t.forecastByAvg || "📊 Прогноз (по среднему)"}</span>
        <span class="f-value">${Math.round(forecastConservative)} ${t.currency}</span>
      </div>
    </div>`;

  // Прогресс-бар
  forecastHTML += `
    <div style="margin-top:10px;">
      <div style="display:flex; justify-content:space-between; font-size:0.82em; color:#666; margin-bottom:4px;">
        <span>${t.forecastProgress || "Прогресс месяца"}</span><span>${monthProgress}%</span>
      </div>
      <div style="background:#e0e0e0; border-radius:10px; height:10px; overflow:hidden;">
        <div style="background:linear-gradient(135deg,#6a1b9a,#9c27b0); width:${monthProgress}%; height:100%; border-radius:10px; transition:width 0.5s;"></div>
      </div>
    </div>`;

  if (workedDays.length > 0) {
    forecastHTML += `<div class="forecast-tip">
      ${t.forecastWorked || "💡 Вы работали"} <strong>${workedDays.length}</strong> ${t.forecastDaysWord || "дней, средний доход за рабочий день —"} <strong>${Math.round(avgPerWorkDayThisMonth)} ${t.currency}</strong>.
      ${t.forecastLeft || "Осталось дней в месяце:"} <strong>${remainingDays}</strong>.
    </div>`;
  }

  // Анализ по типам дней
  const typeSummary = dayTypes.filter(tp => typeStats[tp].count > 0).map(tp => {
    const avg = Math.round(typeStats[tp].totalIncome / typeStats[tp].count);
    const avgTrips = (typeStats[tp].totalTrips / typeStats[tp].count).toFixed(1);
    const label = { work: t.work||"🏢 Рабочий", help: t.help||"🤝 Подмога", short: t.short||"⚡ Короткий", replace: t.replace||"🔄 Замена", weekend: t.weekend||"🏖️ Выходной" }[tp];
    const dayWord = t.forecastDayWord || "день";
    const tripsWord = t.todayTripsLabel || "ходок";
    return `${label}: ~${avg} ${t.currency}/${dayWord}, ~${avgTrips} ${tripsWord}`;
  }).join(" | ");

  if (typeSummary) {
    forecastHTML += `<div class="forecast-note">${t.forecastTypeStat || "📊 Статистика по типам (вся история):"} ${typeSummary}</div>`;
  }

  forecastHTML += `</div>`;
  container.innerHTML = forecastHTML;
}

// ============================================
// РЕНДЕР КАЛЕНДАРЯ
// ============================================
function renderCalendar() {
  const calendar = document.getElementById("calendar");
  const currentMonthElement = document.getElementById("currentMonth");
  if (!calendar) return;

  calendar.innerHTML = "";
  const history = JSON.parse(localStorage.getItem("courierData")) || [];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const t = translations[currentLanguage];

  if (currentMonthElement) currentMonthElement.innerText = `${t.months[month]} ${year}`;

  t.weekdays.forEach((day) => {
    const dayNameDiv = document.createElement("div");
    dayNameDiv.classList.add("day-name");
    dayNameDiv.innerText = day;
    calendar.appendChild(dayNameDiv);
  });

  let emptyCells = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < emptyCells; i++) {
    const emptyDiv = document.createElement("div");
    emptyDiv.classList.add("day", "empty");
    calendar.appendChild(emptyDiv);
  }

  const todayStr = new Date().toISOString().split("T")[0];

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayDiv = document.createElement("div");
    dayDiv.classList.add("day");
    if (dateStr === todayStr) dayDiv.classList.add("today");

    const dayNumber = document.createElement("div");
    dayNumber.classList.add("day-number");
    dayNumber.style.fontWeight = "bold";
    dayNumber.innerText = day;
    dayDiv.appendChild(dayNumber);

    const dayData = history.find((d) => d.date === dateStr);

    if (dayData) {
      dayDiv.classList.add(dayData.dayType);

      const ordersDiv = document.createElement("div");
      ordersDiv.classList.add("orders-info");
      ordersDiv.style.fontSize = "10px";
      ordersDiv.style.marginTop = "2px";
      let ordersText = [];
      if (dayData.nightOrders > 0) ordersText.push(`🌙${dayData.nightOrders}`);
      if (dayData.apOrders > 0) ordersText.push(`📦${dayData.apOrders}`);
      ordersDiv.innerText = ordersText.join(" ") || "—";
      dayDiv.appendChild(ordersDiv);

      if (dayData.total > 0) {
        const totalDiv = document.createElement("div");
        totalDiv.classList.add("total-info");
        totalDiv.style.fontSize = "10px";
        totalDiv.style.fontWeight = "bold";
        totalDiv.style.marginTop = "2px";
        totalDiv.innerText = `${dayData.total}`;
        dayDiv.appendChild(totalDiv);
      }
      if (dayData.note) {
        const noteBadge = document.createElement("div");
        noteBadge.classList.add("day-note-badge");
        noteBadge.innerText = "📝";
        noteBadge.title = dayData.note;
        dayDiv.appendChild(noteBadge);
      }
    } else {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        dayDiv.classList.add("weekend");
      } else if (typeof isMyShortDay === "function" && isMyShortDay(dateStr)) {
        dayDiv.classList.add("short");
        const lbl = document.createElement("div");
        lbl.style.cssText = "font-size:9px;opacity:0.7;margin-top:1px;";
        lbl.textContent = "⚡авто";
        dayDiv.appendChild(lbl);
      } else if (typeof isMyHelpDay === "function" && isMyHelpDay(dateStr)) {
        dayDiv.classList.add("help");
        const lbl = document.createElement("div");
        lbl.style.cssText = "font-size:9px;opacity:0.7;margin-top:1px;";
        lbl.textContent = "🤝авто";
        dayDiv.appendChild(lbl);
      }
    }

    dayDiv.addEventListener("click", () => editDay(dateStr));
    calendar.appendChild(dayDiv);
  }

  const totalCells = emptyCells + lastDay;
  const remainingCells = 42 - totalCells;
  if (remainingCells > 0 && remainingCells < 7) {
    for (let i = 0; i < remainingCells; i++) {
      const emptyDiv = document.createElement("div");
      emptyDiv.classList.add("day", "empty");
      calendar.appendChild(emptyDiv);
    }
  }
}

function renderMassEditCalendar() {
  const calendar = document.getElementById("massEditCalendar");
  const currentMonthElement = document.getElementById("massEditCurrentMonth");
  if (!calendar) return;

  calendar.innerHTML = "";
  const history = JSON.parse(localStorage.getItem("courierData")) || [];
  const year = massEditDate.getFullYear();
  const month = massEditDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const t = translations[currentLanguage];

  if (currentMonthElement) currentMonthElement.innerText = `${t.months[month]} ${year}`;

  t.weekdays.forEach((day) => {
    const dayNameDiv = document.createElement("div");
    dayNameDiv.classList.add("day-name");
    dayNameDiv.innerText = day;
    calendar.appendChild(dayNameDiv);
  });

  let emptyCells = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < emptyCells; i++) {
    const emptyDiv = document.createElement("div");
    emptyDiv.classList.add("day", "empty");
    calendar.appendChild(emptyDiv);
  }

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayDiv = document.createElement("div");
    dayDiv.classList.add("day");
    if (selectedDays.has(dateStr)) dayDiv.classList.add("selected");

    const dayNumber = document.createElement("div");
    dayNumber.style.fontWeight = "bold";
    dayNumber.innerText = day;
    dayDiv.appendChild(dayNumber);

    const dayData = history.find((d) => d.date === dateStr);
    if (dayData) {
      dayDiv.classList.add(dayData.dayType);
      const info = document.createElement("div");
      info.classList.add("info");
      if (dayData.nightOrders > 0 || dayData.apOrders > 0) {
        info.innerHTML = `🌙${dayData.nightOrders}<br>📦${dayData.apOrders}`;
      } else {
        info.innerHTML = getDayTypeIcon(dayData.dayType);
      }
      dayDiv.appendChild(info);
    } else {
      const date = new Date(year, month, day);
      if (date.getDay() === 0 || date.getDay() === 6) dayDiv.classList.add("weekend");
    }

    dayDiv.addEventListener("click", (e) => toggleDaySelection(dateStr, e));
    calendar.appendChild(dayDiv);
  }

  const totalCells = emptyCells + lastDay;
  const remainingCells = 42 - totalCells;
  if (remainingCells > 0 && remainingCells < 7) {
    for (let i = 0; i < remainingCells; i++) {
      const emptyDiv = document.createElement("div");
      emptyDiv.classList.add("day", "empty");
      calendar.appendChild(emptyDiv);
    }
  }
}

// ============================================
// НАВИГАЦИЯ
// ============================================
function changeMonth(direction) {
  currentDate.setMonth(currentDate.getMonth() + direction);
  renderCalendar();
  updateMonthlyCounter();
  updateTotals();
  renderForecast();
}

function changeMassEditMonth(direction) {
  massEditDate.setMonth(massEditDate.getMonth() + direction);
  renderMassEditCalendar();
}

// ============================================
// РЕДАКТИРОВАНИЕ ДНЯ
// ============================================
function editDay(dateStr) {
  // Открыть главное меню если закрыто
  const mainMenu = document.getElementById("mainMenu");
  const mainMenuArrow = document.getElementById("mainMenuArrow");
  if (mainMenu && !mainMenu.classList.contains("show")) {
    mainMenu.classList.add("show");
    if (mainMenuArrow) mainMenuArrow.textContent = "▲";
  }

  const editSection = document.getElementById("edit");
  const editBtn = document.querySelector("[onclick=\"toggleSection('edit', this)\"]");

  if (editSection && !editSection.classList.contains("show")) {
    editSection.classList.add("show");
    if (editBtn) {
      const arrow = editBtn.querySelector(".arrow");
      if (arrow) arrow.classList.add("rotated");
    }
  }

  document.getElementById("date").value = dateStr;

  const history = JSON.parse(localStorage.getItem("courierData")) || [];
  const dayData = history.find((d) => d.date === dateStr);
  originalDayData = dayData ? { ...dayData } : null;

  if (dayData) {
    document.getElementById("dayType").value = dayData.dayType;
    document.getElementById("nightOrders").value = dayData.nightOrders || "";
    document.getElementById("apOrders").value = dayData.apOrders || "";
    const noteEl = document.getElementById("dayNote");
    if (noteEl) noteEl.value = dayData.note || "";
  } else {
    document.getElementById("dayType").value = "work";
    document.getElementById("nightOrders").value = "";
    document.getElementById("apOrders").value = "";
    const noteEl = document.getElementById("dayNote");
    if (noteEl) noteEl.value = "";
  }

  editSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setDayType(type, btn) {
  document.getElementById("dayType").value = type;
}

// ============================================
// МАССОВОЕ РЕДАКТИРОВАНИЕ
// ============================================
function toggleDaySelection(dateStr, e) {
  if (selectedDays.has(dateStr)) { selectedDays.delete(dateStr); } else { selectedDays.add(dateStr); }
  renderMassEditCalendar();
  updateMassEditPreview();
}

function setMassEditTargetType(type) {
  massEditTargetType = type;
  updateMassEditPreview();
}

function selectAllDays() {
  const year = massEditDate.getFullYear();
  const month = massEditDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    selectedDays.add(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  renderMassEditCalendar();
  updateMassEditPreview();
}

function clearSelection() {
  selectedDays.clear();
  renderMassEditCalendar();
  updateMassEditPreview();
}

function updateMassEditPreview() {
  const preview = document.getElementById("massEditPreview");
  if (!preview) return;
  if (selectedDays.size === 0) {
    preview.innerHTML = `<p style="color:#666; text-align:center;">${translations[currentLanguage].noDaysSelected || "Нет выбранных дней"}</p>`;
    return;
  }
  const t = translations[currentLanguage];
  const typeIcon = getDayTypeIcon(massEditTargetType);
  const sortedDays = Array.from(selectedDays).sort();
  preview.innerHTML = `<strong>${typeIcon} ${t[massEditTargetType] || massEditTargetType} → ${sortedDays.length} ${t.avgDaysCount||"дней"}</strong><br>` +
    sortedDays.map((d) => `<span class="preview-item">${d}</span>`).join("");
}

function applyMassDayTypeEdit() {
  if (selectedDays.size === 0) { showAlertDialog((translations[currentLanguage].noDaysSelected || "Выберите дни!")); return; }
  const keepOrders = document.getElementById("massEditKeepOrders").checked;
  let history = JSON.parse(localStorage.getItem("courierData")) || [];

  selectedDays.forEach((dateStr) => {
    const index = history.findIndex((d) => d.date === dateStr);
    if (index >= 0) {
      const oldData = history[index];
      history[index] = {
        ...oldData,
        dayType: massEditTargetType,
        nightOrders: keepOrders ? oldData.nightOrders : 0,
        apOrders: keepOrders ? oldData.apOrders : 0,
        total: keepOrders ? oldData.total : 0,
      };
    } else {
      history.push({ date: dateStr, dayType: massEditTargetType, nightOrders: 0, apOrders: 0, total: 0, generated: true });
    }
  });

  history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("courierData", JSON.stringify(history));

  const t = translations[currentLanguage];
  showNotification(`${t.notifyMassApplied || t.applied || "✅ Изменено"}: ${selectedDays.size} ${t.planDaysWord || "дней"}`);

  selectedDays.clear();
  renderCalendar();
  renderMassEditCalendar();
  loadHistory();
  updateTotals();
  updateMonthlyCounter();
  updateMassEditPreview();
  renderForecast();
}

// ============================================
// ПЛАНИРОВАНИЕ
// ============================================
function populateMonthSelect(selectId, currentValue) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const t = translations[currentLanguage];
  const now = new Date();
  select.innerHTML = "";

  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
    for (let m = 0; m < 12; m++) {
      const option = document.createElement("option");
      const value = `${y}-${String(m + 1).padStart(2, "0")}`;
      option.value = value;
      option.text = `${t.months[m]} ${y}`;
      if (value === currentValue) option.selected = true;
      select.appendChild(option);
    }
  }

  if (!currentValue) {
    select.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
}

function applyPlan() {
  const dayType = document.getElementById("planDayType").value;
  const daysInput = document.getElementById("planDays").value.trim();
  if (!daysInput) { showAlertDialog((translations[currentLanguage].noDaysInput || "Введите дни!")); return; }

  const days = parseDaysInput(daysInput);
  if (days.length === 0) { showAlertDialog((translations[currentLanguage].wrongDaysFormat || "Неверный формат дней!")); return; }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  let history = JSON.parse(localStorage.getItem("courierData")) || [];

  days.forEach((day) => {
    if (day < 1 || day > lastDay) return;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const index = history.findIndex((d) => d.date === dateStr);
    if (index >= 0) { history[index] = { ...history[index], dayType }; }
    else { history.push({ date: dateStr, dayType, nightOrders: 0, apOrders: 0, total: 0, generated: true }); }
  });

  history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("courierData", JSON.stringify(history));
  renderCalendar();
  renderMassEditCalendar();
  loadHistory();
  updateTotals();
  renderForecast();
  showNotification(`${translations[currentLanguage].notifyPlanApplied || "✅ Применено к"} ${days.length} ${translations[currentLanguage].planDaysWord || "дням"}`);
  document.getElementById("planDays").value = "";
}

function parseDaysInput(input) {
  const days = [];
  input.split(",").forEach((part) => {
    part = part.trim();
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      for (let i = start; i <= end; i++) days.push(i);
    } else {
      const num = parseInt(part);
      if (!isNaN(num)) days.push(num);
    }
  });
  return [...new Set(days)].sort((a, b) => a - b);
}

function generateMonthPlan() {
  const monthValue = document.getElementById("generateMonth").value;
  const firstWorkDay = parseInt(document.getElementById("firstWorkDay").value) || 1;
  if (!monthValue) return;

  const [year, month] = monthValue.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  let history = JSON.parse(localStorage.getItem("courierData")) || [];

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const offset = (day - firstWorkDay + 1000) % 4;
    const dayType = offset === 0 || offset === 1 ? "work" : "weekend";
    const index = history.findIndex((d) => d.date === dateStr);
    if (index >= 0) { history[index] = { ...history[index], dayType }; }
    else { history.push({ date: dateStr, dayType, nightOrders: 0, apOrders: 0, total: 0, generated: true }); }
  }

  history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("courierData", JSON.stringify(history));
  renderCalendar();
  renderMassEditCalendar();
  loadHistory();
  updateTotals();
  renderForecast();
  showNotification(`${translations[currentLanguage].notifyMonthPlan || '✅ График 2/2 за'} ${monthValue} ${translations[currentLanguage].notifyMonthPlanEnd || 'создан'}`);
}

function generateYearPlan() {
  const year = parseInt(document.getElementById("generateYear").value);
  const firstWorkDay = parseInt(document.getElementById("firstWorkDayYear").value) || 1;
  const firstMonthValue = document.getElementById("firstWorkMonthYear").value;
  if (!year || !firstMonthValue) return;

  const [startYear, startMonth] = firstMonthValue.split("-").map(Number);
  const startDate = new Date(startYear, startMonth - 1, firstWorkDay);
  let history = JSON.parse(localStorage.getItem("courierData")) || [];

  for (let month = 1; month <= 12; month++) {
    const lastDay = new Date(year, month, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const currentDateObj = new Date(year, month - 1, day);
      const diffDays = Math.floor((currentDateObj - startDate) / (1000 * 60 * 60 * 24));
      const offset = ((diffDays % 4) + 4) % 4;
      const dayType = offset === 0 || offset === 1 ? "work" : "weekend";
      const index = history.findIndex((d) => d.date === dateStr);
      if (index >= 0) { history[index] = { ...history[index], dayType }; }
      else { history.push({ date: dateStr, dayType, nightOrders: 0, apOrders: 0, total: 0, generated: true }); }
    }
  }

  history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("courierData", JSON.stringify(history));
  renderCalendar();
  renderMassEditCalendar();
  loadHistory();
  updateTotals();
  renderForecast();
  showNotification(`${translations[currentLanguage].notifyYearPlan || '✅ График 2/2 за'} ${year} ${translations[currentLanguage].notifyYearPlanEnd || 'год создан'}`);
}

// ============================================
// П.2: ИМПОРТ / ЭКСПОРТ
// ============================================
function exportData(format) {
  const history = JSON.parse(localStorage.getItem("courierData")) || [];
  const log = JSON.parse(localStorage.getItem("ordersLog")) || [];

  if (format === "json") {
    const exportObj = { courierData: history, ordersLog: log };
    const jsonStr = JSON.stringify(exportObj, null, 2);
    copyToClipboard(jsonStr);
    downloadFile("courier_data.json", jsonStr, "application/json");
    showNotification((translations[currentLanguage].notifyJsonExported || "📄 JSON скопирован и скачан"));

  } else if (format === "csv") {
    let csv = "date,dayType,nightOrders,apOrders,total\n";
    history.forEach(d => {
      csv += `${d.date},${d.dayType},${d.nightOrders || 0},${d.apOrders || 0},${d.total || 0}\n`;
    });
    copyToClipboard(csv);
    downloadFile("courier_data.csv", csv, "text/csv");
    showNotification((translations[currentLanguage].notifyCsvExported || "📊 CSV скопирован и скачан"));

  } else if (format === "excel") {
    // Генерируем XLSX через HTML table → data URI
    let table = "<table><tr><th>Дата</th><th>Тип</th><th>Ночные</th><th>АП-34</th><th>Сумма</th></tr>";
    history.forEach(d => {
      table += `<tr><td>${d.date}</td><td>${d.dayType}</td><td>${d.nightOrders||0}</td><td>${d.apOrders||0}</td><td>${d.total||0}</td></tr>`;
    });
    table += "</table>";
    const xlsContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"/></head><body>${table}</body></html>`;
    downloadFile("courier_data.xls", xlsContent, "application/vnd.ms-excel");
    showNotification((translations[currentLanguage].notifyExcelExported || "📋 Excel файл скачан"));
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(format) {
  const textarea = document.getElementById("importTextarea");
  if (!textarea || !textarea.value.trim()) {
    showAlertDialog((translations[currentLanguage].noImportData || "Вставьте данные в текстовое поле!"));
    return;
  }
  const text = textarea.value.trim();

  if (format === "json") {
    try {
      const parsed = JSON.parse(text);
      let importedHistory = [];
      let importedLog = [];

      if (Array.isArray(parsed)) {
        importedHistory = parsed;
      } else if (parsed.courierData) {
        importedHistory = parsed.courierData;
        importedLog = parsed.ordersLog || [];
      } else {
        showAlertDialog((translations[currentLanguage].errorJsonFormat || "❌ Неверный формат JSON!"));
        return;
      }

      showConfirmDialog((translations[currentLanguage].confirmImportJson || "Импортировать данные? Существующие данные будут объединены."), () => {
        let existing = JSON.parse(localStorage.getItem("courierData")) || [];
        importedHistory.forEach(d => {
          const idx = existing.findIndex(e => e.date === d.date);
          if (idx >= 0) existing[idx] = d; else existing.push(d);
        });
        existing.sort((a, b) => a.date.localeCompare(b.date));
        localStorage.setItem("courierData", JSON.stringify(existing));

        if (importedLog.length > 0) {
          let existingLog = JSON.parse(localStorage.getItem("ordersLog")) || [];
          importedLog.forEach(e => {
            if (!e.id) e.id = Date.now() + "_" + Math.random().toString(36).substr(2,5);
            if (!existingLog.find(x => x.id === e.id)) existingLog.push(e);
          });
          ordersLog = existingLog;
          localStorage.setItem("ordersLog", JSON.stringify(ordersLog));
        }

        refreshAll();
        textarea.value = "";
        showNotification(`${translations[currentLanguage].notifyImported || "✅ Импортировано"} ${importedHistory.length} ${translations[currentLanguage].importedWord || "записей"}`);
      });
    } catch(e) {
      showAlertDialog(`${translations[currentLanguage].errorJsonParse || "❌ Ошибка парсинга JSON: "}${e.message}`);
    }

  } else if (format === "csv") {
    try {
      const lines = text.split("\n").filter(l => l.trim());
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const dateIdx = headers.indexOf("date");
      const typeIdx = headers.indexOf("daytype");
      const nightIdx = headers.indexOf("nightorders");
      const apIdx = headers.indexOf("aporders");
      const totalIdx = headers.indexOf("total");

      if (dateIdx === -1) { showAlertDialog((translations[currentLanguage].errorCsvDate || "❌ CSV должен содержать колонку date")); return; }

      const importedHistory = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        if (cols.length < 2) continue;
        const night = nightIdx >= 0 ? parseInt(cols[nightIdx]) || 0 : 0;
        const ap = apIdx >= 0 ? parseInt(cols[apIdx]) || 0 : 0;
        importedHistory.push({
          date: cols[dateIdx].trim(),
          dayType: typeIdx >= 0 ? cols[typeIdx].trim() : "work",
          nightOrders: night,
          apOrders: ap,
          total: totalIdx >= 0 ? parseInt(cols[totalIdx]) || 0 : night * NIGHT_PRICE + ap * AP_PRICE,
          generated: false
        });
      }

      showConfirmDialog(`${translations[currentLanguage].confirmImportCsv || 'Импортировать'} ${importedHistory.length} ${translations[currentLanguage].confirmImportCsvEnd || 'записей из CSV?'}`, () => {
        let existing = JSON.parse(localStorage.getItem("courierData")) || [];
        importedHistory.forEach(d => {
          const idx = existing.findIndex(e => e.date === d.date);
          if (idx >= 0) existing[idx] = d; else existing.push(d);
        });
        existing.sort((a, b) => a.date.localeCompare(b.date));
        localStorage.setItem("courierData", JSON.stringify(existing));
        refreshAll();
        textarea.value = "";
        showNotification(`✅ CSV импортировано: ${importedHistory.length} записей`);
      });
    } catch(e) {
      showAlertDialog("❌ Ошибка парсинга CSV: " + e.message);
    }
  }
}

function importFromFile(input) {
  // Показываем имя файла
  const nameSpan = document.getElementById("importFileName");
  if (nameSpan && input.files[0]) nameSpan.innerText = "📄 " + input.files[0].name;
  const file = input.files[0];
  if (!file) return;

  const ext = file.name.split(".").pop().toLowerCase();
  const reader = new FileReader();

  if (ext === "json") {
    reader.onload = (e) => {
      const ta = document.getElementById("importTextarea");
      if (ta) ta.value = e.target.result;
      showNotification("📄 JSON файл загружен — нажмите 'Импорт JSON'");
    };
    reader.readAsText(file);

  } else if (ext === "csv") {
    reader.onload = (e) => {
      const ta = document.getElementById("importTextarea");
      if (ta) ta.value = e.target.result;
      showNotification("📊 CSV файл загружен — нажмите 'Импорт CSV'");
    };
    reader.readAsText(file);

  } else if (ext === "xlsx" || ext === "xls") {
    showAlertDialog("ℹ️ Для импорта Excel: сначала экспортируйте как CSV из Excel, затем импортируйте CSV здесь.");
  }
}

function refreshAll() {
  renderCalendar();
  renderMassEditCalendar();
  loadHistory();
  updateTotals();
  updateMonthlyCounter();
  displayOrdersLog();
  renderForecast();
  if (typeof renderStatusGrid === "function") renderStatusGrid(); if (typeof renderShiftOverview === "function") renderShiftOverview();
}

// ============================================
// СТАТИСТИКА — СВОРАЧИВАЕМЫЕ БЛОКИ
// ============================================
function toggleStatsBlock(id, btn) {
  const body = document.getElementById(id);
  if (!body) return;
  const arrow = btn ? btn.querySelector(".stats-arrow") : null;
  const isOpen = body.classList.contains("show");
  body.classList.toggle("show", !isOpen);
  if (arrow) arrow.textContent = isOpen ? "▶" : "▼";
}

// ============================================
// АККОРДЕОНЫ
// ============================================
function toggleSection(id, btn) {
  const section = document.getElementById(id);
  if (!section) return;
  const arrow = btn ? btn.querySelector(".arrow") : null;
  if (section.classList.contains("show")) {
    section.classList.remove("show");
    if (arrow) arrow.classList.remove("rotated");
  } else {
    section.classList.add("show");
    if (arrow) arrow.classList.add("rotated");
    if (id === "forecast") renderForecast();
    if (id === "analytics") renderAnalytics();
  }
}

function toggleMainMenu() {
  const menu = document.getElementById("mainMenu");
  const arrow = document.getElementById("mainMenuArrow");
  if (!menu) return;
  const isOpen = menu.classList.contains("show");
  if (isOpen) {
    menu.classList.remove("show");
    if (arrow) arrow.textContent = "▼";
  } else {
    menu.classList.add("show");
    if (arrow) arrow.textContent = "▲";
  }
}

// ============================================
// КАСТОМНЫЙ ДИАЛОГ
// ============================================
function showConfirmDialog(message, onConfirm) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.6);z-index:9999;
    display:flex;align-items:center;justify-content:center;
  `;

  const box = document.createElement("div");
  box.style.cssText = `
    background:white;border-radius:16px;padding:24px;
    max-width:300px;width:85%;text-align:center;
    box-shadow:0 10px 40px rgba(0,0,0,0.3);
  `;

  const msg = document.createElement("p");
  msg.innerText = message;
  msg.style.cssText = "font-size:1em;color:#2c3e2f;margin-bottom:20px;line-height:1.5;";

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:10px;justify-content:center;";

  const btnYes = document.createElement("button");
  btnYes.innerText = "✅ Да";
  btnYes.style.cssText = `flex:1;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#c44536,#b33939);color:white;font-size:1em;font-weight:500;cursor:pointer;`;

  const btnNo = document.createElement("button");
  btnNo.innerText = "❌ Нет";
  btnNo.style.cssText = `flex:1;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#95a5a6,#7f8c8d);color:white;font-size:1em;font-weight:500;cursor:pointer;`;

  btnYes.onclick = function() { document.body.removeChild(overlay); onConfirm(); };
  btnNo.onclick = function() { document.body.removeChild(overlay); };

  btnRow.appendChild(btnYes);
  btnRow.appendChild(btnNo);
  box.appendChild(msg);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showAlertDialog(message) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.6);z-index:9999;
    display:flex;align-items:center;justify-content:center;
  `;

  const box = document.createElement("div");
  box.style.cssText = `
    background:white;border-radius:16px;padding:24px;
    max-width:300px;width:85%;text-align:center;
    box-shadow:0 10px 40px rgba(0,0,0,0.3);
  `;

  const msg = document.createElement("p");
  msg.innerText = message;
  msg.style.cssText = "font-size:1em;color:#2c3e2f;margin-bottom:20px;line-height:1.5;";

  const btnOk = document.createElement("button");
  btnOk.innerText = "OK";
  btnOk.style.cssText = `width:100%;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#2e7d32,#4caf50);color:white;font-size:1em;font-weight:500;cursor:pointer;`;

  btnOk.onclick = function() { document.body.removeChild(overlay); };

  box.appendChild(msg);
  box.appendChild(btnOk);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ============================================
// УВЕДОМЛЕНИЯ
// ============================================
function showNotification(message) {
  const existing = document.querySelector(".notification");
  if (existing) existing.remove();
  const notification = document.createElement("div");
  notification.classList.add("notification");
  notification.innerText = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = "slideUp 0.3s ease-in forwards";
    setTimeout(() => notification.remove(), 300);
  }, 2500);
}

// ============================================
// АНАЛИТИКА С ГРАФИКАМИ
// ============================================
function renderAnalytics() {
  const container = document.getElementById("analyticsContent");
  if (!container) return;

  const history = JSON.parse(localStorage.getItem("courierData")) || [];
  const t = translations[currentLanguage];
  if (history.filter(d => d.total > 0).length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#666;padding:20px;">${t.analyticsNoData || "📭 Нет данных для анализа"}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="analytics-block">
      <div class="analytics-card">
        <h4>${t.chartDailyIncomeTitle || "📅 Доход по дням"}</h4>
        <div class="chart-scroll-wrap"><canvas id="chartDailyIncome" height="180"></canvas></div>
      </div>
      <div class="analytics-card">
        <h4>${t.chartDailyTripsTitle || "📊 Ходки по дням"}</h4>
        <div class="chart-scroll-wrap"><canvas id="chartDailyTrips" height="180"></canvas></div>
      </div>
      <div class="analytics-card">
        <h4>${t.chartDayTypesTitle || "🥧 Распределение по типам дней"}</h4>
        <canvas id="chartDayTypes" height="200"></canvas>
        <div id="chartDayTypesLegend" class="chart-legend"></div>
      </div>
      <div class="analytics-card">
        <h4>${t.chartMonthlyTitle || "📈 Доход по месяцам"}</h4>
        <div class="chart-scroll-wrap"><canvas id="chartMonthlyIncome" height="180"></canvas></div>
      </div>
      <div class="analytics-card">
        <h4>${t.chartNightVsApTitle || "🌙 vs 📦 (месяц)"}</h4>
        <div class="chart-scroll-wrap"><canvas id="chartNightVsAp" height="180"></canvas></div>
      </div>
      <div class="analytics-card" id="topDaysCard">
        <h4>${t.chartTop5Title || "🏆 Топ-5 лучших дней"}</h4>
        <div id="topDaysList"></div>
      </div>
    </div>
  `;

  const viewMonth = currentDate.getMonth() + 1;
  const viewYear = currentDate.getFullYear();

  // Только дни С данными для дневных графиков
  const allMonthDays = history.filter(d => {
    const [y, m] = d.date.split("-").map(Number);
    return y === viewYear && m === viewMonth;
  }).sort((a, b) => a.date.localeCompare(b.date));
  const monthDays = allMonthDays.filter(d => (d.nightOrders || 0) + (d.apOrders || 0) > 0);

  // === CHART 1: Доход по дням месяца (только дни с данными) ===
  drawBarChart("chartDailyIncome", {
    labels: monthDays.map(d => d.date.slice(8)),
    values: monthDays.map(d => d.total || 0),
    color: "#2e7d32",
    color2: "#81c784",
    unit: t.currency || "лей"
  });

  // === CHART 2: Ходки по дням (только дни с данными) ===
  drawBarChart("chartDailyTrips", {
    labels: monthDays.map(d => d.date.slice(8)),
    values: monthDays.map(d => (d.nightOrders || 0) + (d.apOrders || 0)),
    color: "#1565c0",
    color2: "#42a5f5",
    unit: t.todayTripsLabel || "ходок"
  });

  // === CHART 3: Пирог по типам ===
  const typeCount = { work: 0, help: 0, short: 0, replace: 0, weekend: 0 };
  history.filter(d => d.total > 0).forEach(d => { if (typeCount[d.dayType] !== undefined) typeCount[d.dayType]++; });
  const typeColors = { work: "#2e7d32", help: "#1e88e5", short: "#fb8b24", replace: "#7b1fa2", weekend: "#9e9e9e" };
  const typeLabels = { work: t.work||"🏢 Рабочий", help: t.help||"🤝 Подмога", short: t.short||"⚡ Короткий", replace: t.replace||"🔄 Замена", weekend: t.weekend||"🏖️ Выходной" };
  drawPieChart("chartDayTypes", Object.keys(typeCount).map(k => ({
    label: typeLabels[k], value: typeCount[k], color: typeColors[k]
  })));
  const legend = document.getElementById("chartDayTypesLegend");
  if (legend) {
    legend.innerHTML = Object.keys(typeCount).map(k =>
      `<span class="legend-dot" style="background:${typeColors[k]}"></span>${typeLabels[k]}: <b>${typeCount[k]}</b>`
    ).join(" &nbsp; ");
  }

  // === CHART 4: Доход по месяцам ===
  const byMonth = {};
  history.forEach(d => {
    const key = d.date.slice(0, 7);
    if (!byMonth[key]) byMonth[key] = 0;
    byMonth[key] += d.total || 0;
  });
  const monthKeys = Object.keys(byMonth).sort();
  const tMonths = t.months || ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
  drawBarChart("chartMonthlyIncome", {
    labels: monthKeys.map(k => tMonths[parseInt(k.slice(5)) - 1].slice(0,3) + " " + k.slice(2,4)),
    values: monthKeys.map(k => byMonth[k]),
    color: "#6a1b9a",
    color2: "#ce93d8",
    unit: t.currency || "лей"
  });

  // === CHART 5: Ночные vs АП (grouped bar) — только дни с данными ===
  drawGroupedBarChart("chartNightVsAp", {
    labels: monthDays.map(d => d.date.slice(8)),
    values1: monthDays.map(d => d.nightOrders || 0),
    values2: monthDays.map(d => d.apOrders || 0),
    color1: "#1565c0",
    color2: "#fb8b24",
    label1: "🌙 " + (t.todayNightLabel||"Ночные"),
    label2: "📦 " + (t.todayApLabel||"АП-34")
  });

  // === TOP 5 дней ===
  const topDays = history.filter(d => d.total > 0).sort((a, b) => (b.total||0) - (a.total||0)).slice(0,5);
  const topList = document.getElementById("topDaysList");
  if (topList) {
    topList.innerHTML = topDays.map((d, i) => {
      const medal = ["🥇","🥈","🥉","4️⃣","5️⃣"][i];
      const typeIcon = getDayTypeIcon(d.dayType);
      return `<div class="top-day-row">
        <span>${medal} ${d.date.split("-").reverse().join(".")} ${typeIcon}</span>
        <span><b>${d.total} ${t.currency||"лей"}</b> | 🌙${d.nightOrders} 📦${d.apOrders}</span>
      </div>`;
    }).join("");
  }
}

// ---- Canvas: Bar Chart ----
function drawBarChart(canvasId, { labels, values, color, color2, unit }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const containerW = canvas.parentElement ? canvas.parentElement.offsetWidth || 340 : 340;
  const minW = Math.max(containerW, labels.length * 52);
  const W = minW;
  const H = canvas.height;
  canvas.style.width = W + "px";
  canvas.width = W;

  const pad = { top: 20, right: 10, bottom: 36, left: 50 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const max = Math.max(...values, 1);

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i / 4) * chartH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillStyle = "#999"; ctx.font = "10px Roboto,sans-serif"; ctx.textAlign = "right";
    ctx.fillText(Math.round(max * i / 4), pad.left - 4, y + 4);
  }

  if (labels.length === 0) return;
  const barW = Math.max(4, (chartW / labels.length) * 0.7);
  const gap = chartW / labels.length;

  labels.forEach((label, i) => {
    const x = pad.left + i * gap + gap / 2;
    const barH = (values[i] / max) * chartH;
    const y = pad.top + chartH - barH;

    // Gradient bar
    const grad = ctx.createLinearGradient(0, y, 0, pad.top + chartH);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - barW / 2, y, barW, barH, 3) :
      ctx.rect(x - barW / 2, y, barW, barH);
    ctx.fill();

    // Value label on top
    if (values[i] > 0) {
      ctx.fillStyle = "#333"; ctx.font = "9px Roboto,sans-serif"; ctx.textAlign = "center";
      ctx.fillText(values[i], x, y - 3);
    }

    // X label
    ctx.fillStyle = "#666"; ctx.font = "10px Roboto,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(label, x, H - 4);
  });
}

// ---- Canvas: Grouped Bar Chart ----
function drawGroupedBarChart(canvasId, { labels, values1, values2, color1, color2, label1, label2 }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const containerW = canvas.parentElement ? canvas.parentElement.offsetWidth || 340 : 340;
  const minW = Math.max(containerW, labels.length * 60);
  const W = minW;
  const H = canvas.height;
  canvas.style.width = W + "px";
  canvas.width = W;

  const pad = { top: 30, right: 10, bottom: 36, left: 40 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const max = Math.max(...values1, ...values2, 1);

  ctx.clearRect(0, 0, W, H);

  // Legend
  ctx.fillStyle = color1; ctx.fillRect(pad.left, 8, 12, 10);
  ctx.fillStyle = "#333"; ctx.font = "10px Roboto,sans-serif"; ctx.textAlign = "left";
  ctx.fillText(label1, pad.left + 16, 17);
  ctx.fillStyle = color2; ctx.fillRect(pad.left + 80, 8, 12, 10);
  ctx.fillText(label2, pad.left + 96, 17);

  // Grid
  ctx.strokeStyle = "#e0e0e0"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i / 4) * chartH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillStyle = "#999"; ctx.font = "9px Roboto,sans-serif"; ctx.textAlign = "right";
    ctx.fillText(Math.round(max * i / 4), pad.left - 3, y + 3);
  }

  if (labels.length === 0) return;
  const groupW = chartW / labels.length;
  const barW = Math.max(3, groupW * 0.35);

  labels.forEach((label, i) => {
    const cx = pad.left + i * groupW + groupW / 2;
    [values1[i], values2[i]].forEach((val, j) => {
      const bx = cx + (j === 0 ? -barW - 1 : 1);
      const barH = (val / max) * chartH;
      const y = pad.top + chartH - barH;
      ctx.fillStyle = j === 0 ? color1 : color2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, y, barW, barH, 2) : ctx.rect(bx, y, barW, barH);
      ctx.fill();
    });
    ctx.fillStyle = "#666"; ctx.font = "10px Roboto,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(label, cx, H - 4);
  });
}

// ---- Canvas: Pie Chart ----
function drawPieChart(canvasId, segments) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.offsetWidth || 340;
  const H = canvas.height;
  canvas.width = W;

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) { ctx.fillStyle="#ccc"; ctx.font="14px sans-serif"; ctx.textAlign="center"; ctx.fillText("Нет данных", W/2, H/2); return; }

  const cx = W / 2, cy = H / 2 - 10, r = Math.min(cx, cy) - 10;
  let angle = -Math.PI / 2;

  segments.forEach(seg => {
    if (seg.value === 0) return;
    const slice = (seg.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();

    // Label inside
    const midAngle = angle + slice / 2;
    const lx = cx + Math.cos(midAngle) * r * 0.65;
    const ly = cy + Math.sin(midAngle) * r * 0.65;
    const pct = Math.round(seg.value / total * 100);
    if (pct > 5) {
      ctx.fillStyle = "white"; ctx.font = "bold 11px Roboto,sans-serif"; ctx.textAlign = "center";
      ctx.fillText(pct + "%", lx, ly);
    }
    angle += slice;
  });
}

// ============================================
// КОРОТКИЕ ДНИ — СКОЛЬЗЯЩИЕ ПАРЫ + ГРАФИК 2/2
// ============================================
let shiftConfig = JSON.parse(localStorage.getItem("shiftConfig")) || null;
let helpConfig = JSON.parse(localStorage.getItem("helpConfig")) || null;
let rosterConfig = JSON.parse(localStorage.getItem("rosterConfig")) || { A: {}, B: {} };

function personName(shift, num) {
  const r = rosterConfig && rosterConfig[shift];
  return (r && r[num]) ? String(r[num]).trim() : "";
}
function personLabel(shift, num) {
  const name = personName(shift, num);
  return name ? `${shift}${num} ${name}` : `${shift}${num}`;
}

function renderRosterInputs() {
  ["A","B"].forEach(sh => {
    const wrap = document.getElementById("roster" + sh);
    if (!wrap) return;
    let html = "";
    for (let n = 1; n <= 7; n++) {
      const val = personName(sh, n).replace(/"/g,"&quot;");
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="display:inline-block;min-width:34px;padding:4px 8px;background:${sh==='A'?'#2e7d32':'#1565c0'};color:#fff;border-radius:6px;font-weight:700;text-align:center;">${sh}${n}</span>
        <input type="text" class="form-control" data-roster-shift="${sh}" data-roster-num="${n}" value="${val}" placeholder="Имя Фамилия" style="flex:1;padding:6px 8px;"/>
      </div>`;
    }
    wrap.innerHTML = html;
  });
}

function saveRoster() {
  const next = { A: {}, B: {} };
  document.querySelectorAll("[data-roster-shift]").forEach(inp => {
    const sh = inp.getAttribute("data-roster-shift");
    const n = parseInt(inp.getAttribute("data-roster-num"));
    const name = (inp.value || "").trim();
    if (name) next[sh][n] = name;
  });
  rosterConfig = next;
  localStorage.setItem("rosterConfig", JSON.stringify(rosterConfig));
  showNotification("✅ Список сохранён");
  if (typeof renderStatusGrid === "function") renderStatusGrid();
  if (typeof renderShiftOverview === "function") renderShiftOverview();
}
let statusDayDate = new Date();
let selectedRefPartner = null;

// 7 скользящих пар
function getRotatingPairs() {
  return [[1,2],[3,4],[5,6],[7,1],[2,3],[4,5],[6,7]];
}

// Пары содержащие номер N
function findPairsForNumber(n) {
  const pairs = getRotatingPairs();
  const result = [];
  pairs.forEach((p, i) => {
    if (p.includes(n)) {
      result.push({ index: i, pair: p, partner: p[0] === n ? p[1] : p[0] });
    }
  });
  return result;
}

// ======= КЛЮЧЕВОЙ АЛГОРИТМ =======
// Проверяем: дата — рабочий день по 2/2?
// firstWorkDay — якорь. Цикл 4 дня: 0,1=работа, 2,3=выходной
function isWorkDay(dateStr, firstWorkDay) {
  const f = new Date(firstWorkDay + "T12:00:00");
  const t = new Date(dateStr + "T12:00:00");
  const diff = Math.round((t - f) / 86400000);
  const pos = ((diff % 4) + 4) % 4;
  return pos === 0 || pos === 1;
}

// Номер рабочего дня (0-based) от якоря
function getWorkDayIndex(dateStr, firstWorkDay) {
  const f = new Date(firstWorkDay + "T12:00:00");
  const t = new Date(dateStr + "T12:00:00");
  const diff = Math.round((t - f) / 86400000);
  const pos = ((diff % 4) + 4) % 4;
  if (pos >= 2) return null; // выходной
  const blocks = diff >= 0 ? Math.floor(diff / 4) : Math.ceil((diff - 3) / 4);
  return blocks * 2 + pos;
}

// Какая пара на коротком в рабочий день с индексом wdi
function getPairForWorkDay(wdi, offset) {
  const pairs = getRotatingPairs();
  const idx = (((wdi + offset) % 7) + 7) % 7;
  return { index: idx, pair: pairs[idx] };
}

// Проверить: дата — короткий день для номера N?
function isShortDayFor(dateStr, number) {
  if (!shiftConfig || !shiftConfig.firstWorkDay) return false;
  const wdi = getWorkDayIndex(dateStr, shiftConfig.firstWorkDay);
  if (wdi === null) return false;
  const info = getPairForWorkDay(wdi, shiftConfig.offset);
  return info.pair.includes(number);
}

function isMyShortDay(dateStr) {
  if (!shiftConfig || !shiftConfig.myNumber) return false;
  return isShortDayFor(dateStr, shiftConfig.myNumber);
}

// ===== ПОДМОГА (новая логика) =====
// helpConfig.lastMyHelpDate     — дата последней ВАШЕЙ подмоги (обязательно)
// helpConfig.lastOtherHelpDate  — дата последней подмоги в другой смене (опционально)
//                                  на эту дату считаем, что был №1 из другой смены
// Сб/Вс НЕ считаются в очереди вообще — цикл идёт только по будним нерабочим дням.
// Цикл 7 человек на каждую смену независимо.

// Дата первого рабочего дня ДРУГОЙ смены (= наш first + 2 дня)
function getOtherShiftFirstWorkDay() {
  if (!shiftConfig || !shiftConfig.firstWorkDay) return null;
  const d = new Date(shiftConfig.firstWorkDay + "T12:00:00");
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

// Считает, сколько нерабочих будних дней для смены (my или other) между start (exclusive) и target (inclusive)
function countNonWorkWeekdaysForShift(startDate, targetDate, forMyShift) {
  const firstRef = forMyShift ? shiftConfig.firstWorkDay : getOtherShiftFirstWorkDay();
  if (!firstRef) return -1;
  const start = new Date(startDate + "T12:00:00");
  const target = new Date(targetDate + "T12:00:00");
  if (target <= start) return -1;
  let count = 0;
  const temp = new Date(start);
  temp.setDate(temp.getDate() + 1);
  while (temp <= target) {
    const ds = temp.toISOString().slice(0, 10);
    const dow = temp.getDay();
    // Для этой смены нерабочий будний = не Сб/Вс + не рабочий день ЭТОЙ смены
    if (dow !== 0 && dow !== 6 && !isWorkDay(ds, firstRef)) {
      count++;
    }
    temp.setDate(temp.getDate() + 1);
  }
  return count;
}

// Кто из МОЕЙ смены на подмоге в этот день (1..7) или null
function getHelpPositionForDate(dateStr) {
  if (!helpConfig || !helpConfig.lastMyHelpDate) return null;
  if (!shiftConfig || !shiftConfig.firstWorkDay || !shiftConfig.myNumber) return null;
  const target = new Date(dateStr + "T12:00:00");
  const dow = target.getDay();
  if (dow === 0 || dow === 6) return null;               // Сб/Вс — никакой подмоги
  if (isWorkDay(dateStr, shiftConfig.firstWorkDay)) return null; // мой рабочий → моя смена не на подмоге
  // target - нерабочий будний день моей смены
  // count = сколько таких дней прошло с якоря (не считая якорь, включая target)
  const anchor = helpConfig.lastMyHelpDate;
  if (dateStr === anchor) return shiftConfig.myNumber;
  const count = countNonWorkWeekdaysForShift(anchor, dateStr, true);
  if (count < 0) return null;
  const myPos = shiftConfig.myNumber;
  return (((myPos - 1 + count) % 7) + 7) % 7 + 1;
}

// Кто из ДРУГОЙ смены на подмоге в этот день (1..7 в их нумерации, т.е. Б1..Б7) или null
function getHelpPositionForDateOther(dateStr) {
  if (!helpConfig || !helpConfig.lastOtherHelpDate) return null;
  if (!shiftConfig || !shiftConfig.firstWorkDay) return null;
  const otherFirst = getOtherShiftFirstWorkDay();
  if (!otherFirst) return null;
  const target = new Date(dateStr + "T12:00:00");
  const dow = target.getDay();
  if (dow === 0 || dow === 6) return null;
  if (isWorkDay(dateStr, otherFirst)) return null; // рабочий день другой смены — они не на подмоге
  const anchor = helpConfig.lastOtherHelpDate;
  // На lastOtherHelpDate считаем, что был №1 из другой смены
  if (dateStr === anchor) return 1;
  const count = countNonWorkWeekdaysForShift(anchor, dateStr, false);
  if (count < 0) return null;
  return (((0 + count) % 7) + 7) % 7 + 1;
}

function isMyHelpDay(dateStr) {
  if (!helpConfig || !shiftConfig || !shiftConfig.myNumber) return false;
  return getHelpPositionForDate(dateStr) === shiftConfig.myNumber;
}

// Короткая пара для ДРУГОЙ смены (возвращает [n1,n2] в нумерации 1-7 их смены, либо null)
function getShortPairForOtherShift(dateStr) {
  const otherFirst = getOtherShiftFirstWorkDay();
  if (!otherFirst || !shiftConfig || shiftConfig.offset === undefined) return null;
  const wdi = getWorkDayIndex(dateStr, otherFirst);
  if (wdi === null) return null;
  const info = getPairForWorkDay(wdi, shiftConfig.offset);
  return info.pair;
}

// ======= UI =======
function onMyNumberChange() {
  const n = parseInt(document.getElementById("myNumber").value) || 0;
  const info = document.getElementById("myPairsInfo");
  const box = document.getElementById("pairInfoBox");
  const btns = document.getElementById("partnerBtns");
  if (!n) { info.style.display = "none"; renderAllPairsList(); return; }
  info.style.display = "block";
  const myPairs = findPairsForNumber(n);
  box.innerHTML = `Вы <b>№${n}</b> — в <b>2 парах</b>:<br>` +
    myPairs.map(p => `• Пара ${p.index+1}: <b>(${p.pair[0]}, ${p.pair[1]})</b> — напарник <b>№${p.partner}</b>`).join("<br>");
  btns.innerHTML = "";
  myPairs.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "partner-btn";
    btn.textContent = `№${p.partner}`;
    btn.onclick = () => {
      document.querySelectorAll(".partner-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedRefPartner = p.partner;
    };
    btns.appendChild(btn);
  });
  selectedRefPartner = null;
  renderAllPairsList();
}

function renderAllPairsList() {
  const c = document.getElementById("allPairsList");
  if (!c) return;
  const pairs = getRotatingPairs();
  const n = parseInt(document.getElementById("myNumber").value) || 0;
  c.innerHTML = "";
  pairs.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "pair-row" + (n && p.includes(n) ? " my-pair" : "");
    row.innerHTML = `<span class="pair-num">${i+1}</span><span>👤 ${p[0]} и 👤 ${p[1]}</span>`;
    c.appendChild(row);
  });
}

// ======= ПРИМЕНИТЬ =======
function applyShiftSchedule() {
  const firstWorkDay = document.getElementById("shiftFirstDay").value;
  const myNum = parseInt(document.getElementById("myNumber").value) || 0;
  const refDate = document.getElementById("refShortDate").value;

  if (!firstWorkDay || !myNum || !refDate) {
    showAlertDialog("Заполните: первый рабочий день, номер и дату короткого.");
    return;
  }
  if (!selectedRefPartner) {
    showAlertDialog("Выберите с каким напарником был короткий в тот день.");
    return;
  }

  // Проверяем что refDate — рабочий день
  const wdi = getWorkDayIndex(refDate, firstWorkDay);
  if (wdi === null) {
    showAlertDialog("Указанная дата короткого — НЕ рабочий день по графику 2/2! Проверьте первый рабочий день.");
    return;
  }

  // Находим индекс пары по выбранному напарнику
  const myPairs = findPairsForNumber(myNum);
  const refPair = myPairs.find(p => p.partner === selectedRefPartner);
  if (!refPair) { showAlertDialog("Ошибка: пара не найдена."); return; }

  // Вычисляем offset
  const offset = ((refPair.index - wdi) % 7 + 7) % 7;

  shiftConfig = { firstWorkDay, myNumber: myNum, offset, refPartner: selectedRefPartner };
  localStorage.setItem("shiftConfig", JSON.stringify(shiftConfig));

  // Превью
  const preview = document.getElementById("shiftPreview");
  preview.innerHTML = `✅ Настроено!<br>
    Номер: <b>${myNum}</b>, offset: <b>${offset}</b><br>
    Проверка: ${refDate} → пара (${refPair.pair[0]},${refPair.pair[1]}) ✓<br>
    Смотрите календарь — короткие дни помечены автоматически.`;
  preview.classList.add("visible");

  // Помечаем дни
  markAutoSchedule();
  showNotification("✅ Короткие дни применены!");
}

function markAutoSchedule() {
  let history = JSON.parse(localStorage.getItem("courierData")) || [];

  // Удаляем все старые авто-сгенерированные записи без реальных данных
  history = history.filter(h => {
    const isAutoType = h.dayType === "help" || h.dayType === "short"
                     || h.dayType === "work" || h.dayType === "weekend";
    const hasNoData = (!h.nightOrders || h.nightOrders === 0)
                   && (!h.apOrders || h.apOrders === 0)
                   && (!h.total || h.total === 0)
                   && (!h.note || h.note === "");
    if (h.generated && isAutoType && hasNoData) return false;
    return true;
  });

  if (!shiftConfig || !shiftConfig.firstWorkDay) {
    localStorage.setItem("courierData", JSON.stringify(history));
    renderCalendar(); renderMassEditCalendar(); loadHistory();
    updateTotals(); updateMonthlyCounter(); renderForecast(); renderStatusGrid(); if (typeof renderShiftOverview === "function") renderShiftOverview();
    return;
  }

  const firstRef = shiftConfig.firstWorkDay;
  const now = new Date();
  for (let mOff = -2; mOff <= 5; mOff++) {
    const d = new Date(now.getFullYear(), now.getMonth() + mOff, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const dow = new Date(dateStr + "T12:00:00").getDay();
      const isWork = isWorkDay(dateStr, firstRef);

      // Определяем тип дня с приоритетами:
      // 1. Короткий (это подтип рабочего — когда я в паре коротких)
      // 2. Рабочий (обычный день 2/2)
      // 3. Подмога (нерабочий день, я в очереди подмоги)
      // 4. Выходной (нерабочий день без подмоги)
      let newType = null;
      if (isWork) {
        newType = isMyShortDay(dateStr) ? "short" : "work";
      } else {
        // нерабочий по 2/2
        if (dow !== 0 && dow !== 6 && isMyHelpDay(dateStr)) {
          newType = "help";
        } else {
          newType = "weekend";
        }
      }

      const idx = history.findIndex(h => h.date === dateStr);
      if (idx >= 0) {
        // Перезаписываем только авто-записи; ручные (generated:false) не трогаем
        if (history[idx].generated) {
          history[idx].dayType = newType;
        }
      } else {
        history.push({ date: dateStr, dayType: newType, nightOrders: 0, apOrders: 0, total: 0, generated: true });
      }
    }
  }

  history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("courierData", JSON.stringify(history));
  renderCalendar(); renderMassEditCalendar(); loadHistory();
  updateTotals(); updateMonthlyCounter(); renderForecast(); renderStatusGrid(); if (typeof renderShiftOverview === "function") renderShiftOverview();
}

function clearShiftConfig() {
  shiftConfig = null;
  localStorage.removeItem("shiftConfig");
  document.getElementById("shiftFirstDay").value = "";
  document.getElementById("myNumber").value = "";
  document.getElementById("refShortDate").value = "";
  document.getElementById("myPairsInfo").style.display = "none";
  document.getElementById("shiftPreview").classList.remove("visible");
  selectedRefPartner = null;
  renderAllPairsList();
  showNotification("🗑️ Настройки сброшены.");
}

// ======= ПОДМОГА =======
function applyHelpSchedule() {
  const lastMyDate = document.getElementById("helpStartDate").value;
  const lastOtherDate = (document.getElementById("helpOtherStartDate") || {}).value || "";
  if (!lastMyDate) { showAlertDialog("Укажите дату последней вашей подмоги."); return; }
  if (!shiftConfig || !shiftConfig.firstWorkDay || !shiftConfig.myNumber) {
    showAlertDialog("Сначала настройте короткие дни (номер и первый рабочий день) — подмога использует ваш номер оттуда.");
    return;
  }
  const sdDow = new Date(lastMyDate + "T12:00:00").getDay();
  if (sdDow === 0 || sdDow === 6) {
    showAlertDialog("Дата не должна быть субботой или воскресеньем.");
    return;
  }
  if (isWorkDay(lastMyDate, shiftConfig.firstWorkDay)) {
    showAlertDialog("Указанная дата — рабочий день по графику 2/2. Подмога считается по нерабочим дням.");
    return;
  }
  // Валидация опционального второго якоря
  if (lastOtherDate) {
    const oDow = new Date(lastOtherDate + "T12:00:00").getDay();
    const otherFirst = getOtherShiftFirstWorkDay();
    if (oDow === 0 || oDow === 6) {
      showAlertDialog("Дата другой смены не должна быть Сб/Вс.");
      return;
    }
    if (otherFirst && isWorkDay(lastOtherDate, otherFirst)) {
      showAlertDialog("Указанная дата для другой смены — их рабочий день. Укажите нерабочий день другой смены.");
      return;
    }
  }
  helpConfig = { lastMyHelpDate: lastMyDate };
  if (lastOtherDate) helpConfig.lastOtherHelpDate = lastOtherDate;
  localStorage.setItem("helpConfig", JSON.stringify(helpConfig));
  markAutoSchedule();
  showNotification("✅ Подмога применена!");
}

// ======= СТАТУС СМЕНЫ =======
function changeStatusDay(dir) {
  statusDayDate = new Date(statusDayDate);
  statusDayDate.setDate(statusDayDate.getDate() + dir);
  renderStatusGrid(); if (typeof renderShiftOverview === "function") renderShiftOverview();
}

function pickStatusDay(val) {
  if (!val) return;
  statusDayDate = new Date(val + "T12:00:00");
  renderStatusGrid(); if (typeof renderShiftOverview === "function") renderShiftOverview();
}

function goToStatusToday() {
  statusDayDate = new Date();
  renderStatusGrid(); if (typeof renderShiftOverview === "function") renderShiftOverview();
}

function openStatusDayPicker() {
  const picker = document.getElementById("statusDayPicker");
  if (!picker) return;
  if (typeof picker.showPicker === "function") {
    try { picker.showPicker(); return; } catch(e) {}
  }
  picker.focus();
  picker.click();
}

// ======= ОБЩИЙ ГРАФИК СМЕНЫ =======
let overviewMonthDate = new Date();

function changeOverviewMonth(dir) {
  overviewMonthDate = new Date(overviewMonthDate.getFullYear(), overviewMonthDate.getMonth() + dir, 1);
  renderShiftOverview();
}

function renderShiftOverview() {
  const title = document.getElementById("overviewMonthTitle");
  const container = document.getElementById("overviewTable");
  if (!title || !container) return;

  const monthNames = ["Январь","Февраль","Март","Апрель","Май","Июнь",
                      "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  const year = overviewMonthDate.getFullYear();
  const month = overviewMonthDate.getMonth();
  title.textContent = `${monthNames[month]} ${year}`;

  if (!shiftConfig || !shiftConfig.firstWorkDay || !shiftConfig.myNumber) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:#888;">Сначала настройте короткие дни.</div>';
    return;
  }

  const myNum = shiftConfig.myNumber;
  const firstRef = shiftConfig.firstWorkDay;
  const otherFirst = getOtherShiftFirstWorkDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dowN = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
  const todayStr = new Date().toISOString().split("T")[0];

  let html = `<table style="width:100%;border-collapse:collapse;font-size:0.78em;">
    <thead>
      <tr style="background:#2e7d32;color:#fff;">
        <th style="padding:5px 3px;border:1px solid #1b5e20;">Дата</th>
        <th style="padding:5px 3px;border:1px solid #1b5e20;" colspan="2">Моя смена (А)</th>
        <th style="padding:5px 3px;border:1px solid #1b5e20;" colspan="2">Другая смена (Б)</th>
      </tr>
      <tr style="background:#388e3c;color:#fff;font-size:0.9em;">
        <th style="padding:3px;border:1px solid #1b5e20;"></th>
        <th style="padding:3px;border:1px solid #1b5e20;">⚡ Кор.</th>
        <th style="padding:3px;border:1px solid #1b5e20;">🤝 Под.</th>
        <th style="padding:3px;border:1px solid #1b5e20;">⚡ Кор.</th>
        <th style="padding:3px;border:1px solid #1b5e20;">🤝 Под.</th>
      </tr>
    </thead><tbody>`;

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const d = new Date(dateStr + "T12:00:00");
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const myWorks = isWorkDay(dateStr, firstRef);

    // Моя смена: короткая пара / подмога
    let myShortCell = "—", myHelpCell = "—";
    if (myWorks) {
      const wdi = getWorkDayIndex(dateStr, firstRef);
      if (wdi !== null) {
        const pair = getPairForWorkDay(wdi, shiftConfig.offset).pair;
        myShortCell = pair.map(n => {
          const nm = personName("А", n);
          const t = nm ? ` title="${nm}"` : "";
          return n === myNum ? `<b style="color:#fb8b24;"${t}>А${n}</b>` : `<span${t}>А${n}</span>`;
        }).join(",");
      }
    } else if (!isWeekend) {
      const hp = getHelpPositionForDate(dateStr);
      if (hp !== null) {
        const nm = personName("А", hp);
        const t = nm ? ` title="${nm}"` : "";
        myHelpCell = hp === myNum ? `<b style="color:#1e88e5;"${t}>А${hp}</b>` : `<span${t}>А${hp}</span>`;
      }
    }

    // Другая смена: короткая пара / подмога
    let otherShortCell = "—", otherHelpCell = "—";
    if (!myWorks && otherFirst) {
      const wdi = getWorkDayIndex(dateStr, otherFirst);
      if (wdi !== null) {
        const pair = getPairForWorkDay(wdi, shiftConfig.offset).pair;
        otherShortCell = pair.map(n => {
          const nm = personName("Б", n);
          const t = nm ? ` title="${nm}"` : "";
          return `<span${t}>Б${n}</span>`;
        }).join(",");
      }
    } else if (myWorks && !isWeekend) {
      const hp = getHelpPositionForDateOther(dateStr);
      if (hp !== null) {
        const nm = personName("Б", hp);
        const t = nm ? ` title="${nm}"` : "";
        otherHelpCell = `<span${t}>Б${hp}</span>`;
      }
      else if (!helpConfig || !helpConfig.lastOtherHelpDate) otherHelpCell = "?";
    }

    const isToday = dateStr === todayStr;
    const rowBg = isToday ? "background:#fff3cd;" : (day % 2 === 0 ? "background:#f9f9f9;" : "");
    const dowColor = isWeekend ? "color:#c62828;" : "";

    html += `<tr style="${rowBg}">
      <td style="padding:4px 3px;text-align:center;border:1px solid #ddd;${dowColor}white-space:nowrap;">
        <b>${day}</b> ${dowN[dow]}${isToday ? " 📍" : ""}
      </td>
      <td style="padding:4px 3px;text-align:center;border:1px solid #ddd;">${myShortCell}</td>
      <td style="padding:4px 3px;text-align:center;border:1px solid #ddd;">${myHelpCell}</td>
      <td style="padding:4px 3px;text-align:center;border:1px solid #ddd;">${otherShortCell}</td>
      <td style="padding:4px 3px;text-align:center;border:1px solid #ddd;">${otherHelpCell}</td>
    </tr>`;
  }

  html += `</tbody></table>`;

  // Итоги по месяцу для моего номера
  let myShortCount = 0, myHelpCount = 0, myWorkCount = 0;
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if (isMyShortDay(dateStr)) myShortCount++;
    else if (isWorkDay(dateStr, firstRef)) myWorkCount++;
    if (isMyHelpDay(dateStr)) myHelpCount++;
  }
  html += `<div style="margin-top:10px;padding:8px;background:rgba(46,125,50,0.08);border-radius:8px;font-size:0.85em;text-align:center;">
    Ваши дни: 🏢 <b>${myWorkCount}</b> раб. &nbsp;·&nbsp; ⚡ <b>${myShortCount}</b> корот. &nbsp;·&nbsp; 🤝 <b>${myHelpCount}</b> подмог.
  </div>`;

  if (!helpConfig || !helpConfig.lastOtherHelpDate) {
    html += `<div style="margin-top:6px;padding:6px;font-size:0.76em;color:#999;text-align:center;">ℹ️ Колонка "Б Под." = "?" — укажите якорь подмоги другой смены в настройках.</div>`;
  }

  container.innerHTML = html;
}

function renderStatusGrid() {
  const grid = document.getElementById("statusGrid");
  const title = document.getElementById("statusDayTitle");
  if (!grid || !title) return;

  if (!shiftConfig || !shiftConfig.firstWorkDay || !shiftConfig.myNumber) {
    grid.innerHTML = '<div class="status-off-label">Сначала настройте короткие дни.</div>';
    return;
  }

  const dateStr = statusDayDate.toISOString().split("T")[0];
  const dow = statusDayDate.getDay();
  const dowN = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
  const todayStr = new Date().toISOString().split("T")[0];
  title.textContent = (dateStr === todayStr ? "Сегодня — " : "") +
    `${dowN[dow]}, ${statusDayDate.getDate()}.${String(statusDayDate.getMonth()+1).padStart(2,"0")}`;

  const picker = document.getElementById("statusDayPicker");
  if (picker) picker.value = dateStr;

  const myWorks = isWorkDay(dateStr, shiftConfig.firstWorkDay);
  const isWeekend = (dow === 0 || dow === 6);

  // Короткие пары для обеих смен (если они сегодня работают)
  const myShortPair = myWorks ? (function(){
    const wdi = getWorkDayIndex(dateStr, shiftConfig.firstWorkDay);
    if (wdi === null) return null;
    return getPairForWorkDay(wdi, shiftConfig.offset).pair;
  })() : null;
  const otherShortPair = !myWorks ? getShortPairForOtherShift(dateStr) : null;

  // Кто из моей/другой смены на подмоге
  const myHelpPos = (!myWorks && !isWeekend) ? getHelpPositionForDate(dateStr) : null;
  const otherHelpPos = (myWorks && !isWeekend) ? getHelpPositionForDateOther(dateStr) : null;

  function personCell(shiftLabel, num, isMine) {
    const iAmThis = isMine && num === shiftConfig.myNumber;
    let status = "weekend", label = "🏖️ Выходной";

    const shiftWorks = isMine ? myWorks : !myWorks;
    if (shiftWorks) {
      const pair = isMine ? myShortPair : otherShortPair;
      if (pair && pair.includes(num)) {
        status = "short";
        const partner = pair[0] === num ? pair[1] : pair[0];
        label = `⚡ Короткий (с ${personLabel(shiftLabel, partner)})`;
      } else {
        status = "work";
        label = "🏢 Работа";
      }
    } else {
      if (!isWeekend) {
        const helpPos = isMine ? myHelpPos : otherHelpPos;
        if (helpPos !== null && helpPos === num) {
          status = "help";
          label = "🤝 Подмога";
        }
      }
    }

    const nm = personName(shiftLabel, num);
    const nameHtml = nm ? `<span style="opacity:.85;font-size:.9em;"> · ${nm}</span>` : "";
    const cls = `status-person st-${status}${iAmThis ? " st-me" : ""}`;
    return `<div class="${cls}"><span class="sp-num">${shiftLabel}${num}</span><span>${label}${nameHtml}</span></div>`;
  }

  let html = "";

  // Шапка с короткой парой той смены, что работает
  if (myWorks && myShortPair) {
    html += `<div style="padding:6px 10px;font-size:0.85em;font-weight:600;color:#fb8b24;">⚡ Короткий (моя смена): ${personLabel("А", myShortPair[0])}, ${personLabel("А", myShortPair[1])}</div>`;
  }
  if (!myWorks && otherShortPair) {
    html += `<div style="padding:6px 10px;font-size:0.85em;font-weight:600;color:#fb8b24;">⚡ Короткий (другая смена): ${personLabel("Б", otherShortPair[0])}, ${personLabel("Б", otherShortPair[1])}</div>`;
  }

  // МОЯ СМЕНА
  html += `<div style="margin-top:6px;padding:4px 8px;font-size:0.82em;font-weight:700;color:#2e7d32;">👥 Моя смена (А) ${myWorks ? '— работает' : '— выходной'}</div>`;
  for (let n = 1; n <= 7; n++) html += personCell("А", n, true);

  // ДРУГАЯ СМЕНА
  html += `<div style="margin-top:8px;padding:4px 8px;font-size:0.82em;font-weight:700;color:#1565c0;">👥 Другая смена (Б) ${!myWorks ? '— работает' : '— выходной'}</div>`;
  for (let n = 1; n <= 7; n++) html += personCell("Б", n, false);

  // Если другая смена на подмоге не настроена — подсказка
  if (myWorks && !isWeekend && !helpConfig?.lastOtherHelpDate) {
    html += `<div style="padding:6px 10px;font-size:0.76em;color:#999;text-align:center;margin-top:4px;">ℹ️ Чтобы видеть очередь подмоги другой смены, укажите их якорь в настройках.</div>`;
  }

  grid.innerHTML = html;
}

// ======= INIT =======
function initShiftUI() {
  if (shiftConfig) {
    if (shiftConfig.firstWorkDay) document.getElementById("shiftFirstDay").value = shiftConfig.firstWorkDay;
    if (shiftConfig.myNumber) {
      document.getElementById("myNumber").value = shiftConfig.myNumber;
      onMyNumberChange();
      if (shiftConfig.refPartner) {
        selectedRefPartner = shiftConfig.refPartner;
        document.querySelectorAll(".partner-btn").forEach(b => {
          if (b.textContent === `№${shiftConfig.refPartner}`) b.classList.add("active");
        });
      }
    }
    const preview = document.getElementById("shiftPreview");
    if (preview && shiftConfig.offset !== undefined) {
      preview.innerHTML = `✅ Настроено! Номер: <b>${shiftConfig.myNumber}</b>`;
      preview.classList.add("visible");
    }
  }
  if (helpConfig) {
    if (helpConfig.lastMyHelpDate) document.getElementById("helpStartDate").value = helpConfig.lastMyHelpDate;
    if (helpConfig.lastOtherHelpDate && document.getElementById("helpOtherStartDate")) {
      document.getElementById("helpOtherStartDate").value = helpConfig.lastOtherHelpDate;
    }
  }
  renderAllPairsList();
  renderRosterInputs();
  renderStatusGrid(); if (typeof renderShiftOverview === "function") renderShiftOverview();
}
