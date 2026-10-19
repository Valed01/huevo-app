/**
 * huEVO Themes — Popup Script (huEVO Games / VK 2010 Style Edition)
 * Полная поддержка тем .hvthm, видео/GIF обоев, виджета часов и живой синхронизации
 * by neriusshadow huEVO SWAGdev
 */
document.addEventListener("DOMContentLoaded", () => {
  const { PRESET_THEMES, DEFAULT_SETTINGS } = window.HUEVO_THEMES;

  let currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!currentSettings.clock) currentSettings.clock = Object.assign({}, DEFAULT_SETTINGS.clock);
  if (!currentSettings.effects) currentSettings.effects = Object.assign({}, DEFAULT_SETTINGS.effects);
  if (!currentSettings.sound) currentSettings.sound = Object.assign({}, DEFAULT_SETTINGS.sound);
  if (!currentSettings.customTheme) currentSettings.customTheme = Object.assign({}, DEFAULT_SETTINGS.customTheme);
  if (!currentSettings.customTheme.glow) currentSettings.customTheme.glow = Object.assign({}, DEFAULT_SETTINGS.customTheme.glow);
  if (!Array.isArray(currentSettings.savedThemes)) currentSettings.savedThemes = [];

  // Проверка режима вкладки
  if (window.location.search.includes("tab=1") || window.innerWidth > 480) {
    document.body.classList.add("full-tab-mode");
    const tabBtn = document.getElementById("btn-open-tab");
    if (tabBtn) tabBtn.style.display = "none";
  }

  const btnOpenTab = document.getElementById("btn-open-tab");
  if (btnOpenTab) {
    btnOpenTab.addEventListener("click", () => {
      const url = chrome.runtime.getURL("popup.html?tab=1");
      if (chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, "_blank");
      }
    });
  }

  // Шапка и статус
  const statusToggle = document.getElementById("status-toggle");
  const statusDot = statusToggle ? statusToggle.querySelector(".status-dot") : null;
  const statusText = document.getElementById("status-text");

  // Главная синяя кнопка действия
  const btnQuickExport = document.getElementById("btn-quick-export");

  // 3 колонки статистики
  const statPresetsCount = document.getElementById("stat-presets-count");
  const statSavedCount = document.getElementById("stat-saved-count");
  const statActiveName = document.getElementById("stat-active-name");
  const colPresets = document.getElementById("col-presets");
  const colSaved = document.getElementById("col-saved");

  // Навигация
  const navTabs = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // Темы и .hvthm
  const inputSaveThemeName = document.getElementById("input-save-theme-name");
  const btnSaveCurrentTheme = document.getElementById("btn-save-current-theme");
  const btnExportHvthm = document.getElementById("btn-export-hvthm");
  const fileImportHvthm = document.getElementById("file-import-hvthm");
  const hvthmDropzone = document.getElementById("hvthm-dropzone");
  const savedThemesHeader = document.getElementById("saved-themes-header");
  const savedThemesList = document.getElementById("saved-themes-list");
  const presetsList = document.getElementById("presets-list");

  // Обои и видео
  const bgTypeImageRadio = document.getElementById("bg-type-image");
  const bgTypeVideoRadio = document.getElementById("bg-type-video");
  const wallpaperDropzone = document.getElementById("wallpaper-dropzone");
  const fileBgImage = document.getElementById("file-bg-image");
  const fileBgVideo = document.getElementById("file-bg-video");
  const dropzoneIcon = document.getElementById("dropzone-icon");
  const dropzoneText = document.getElementById("dropzone-text");
  const wallpaperPreviewBox = document.getElementById("wallpaper-preview-box");
  const wallpaperThumb = document.getElementById("wallpaper-thumb");
  const wallpaperThumbVideo = document.getElementById("wallpaper-thumb-video");
  const wallpaperStatusText = document.getElementById("wallpaper-status-text");
  const btnClearBg = document.getElementById("btn-clear-bg");
  const inputBgImage = document.getElementById("input-bg-image");
  const presetWallpapersGrid = document.getElementById("preset-wallpapers-grid");

  // Ползунки фона
  const rangeBgOpacity = document.getElementById("range-bg-opacity");
  const valBgOpacity = document.getElementById("val-bg-opacity");
  const rangeBgOverlay = document.getElementById("range-bg-overlay");
  const valBgOverlay = document.getElementById("val-bg-overlay");
  const rangeBgBlur = document.getElementById("range-bg-blur");
  const valBgBlur = document.getElementById("val-bg-blur");
  const rangeBgBrightness = document.getElementById("range-bg-brightness");
  const valBgBrightness = document.getElementById("val-bg-brightness");
  const selectBgSize = document.getElementById("select-bg-size");

  // Стекло карточек, боковое меню и шапка
  const rangeCardOpacity = document.getElementById("range-card-opacity");
  const valCardOpacity = document.getElementById("val-card-opacity");
  const rangeCardBlur = document.getElementById("range-card-blur");
  const valCardBlur = document.getElementById("val-card-blur");
  const toggleSidebarCard = document.getElementById("toggle-sidebar-card");
  const rangeHeaderOpacity = document.getElementById("range-header-opacity");
  const valHeaderOpacity = document.getElementById("val-header-opacity");
  const rangeHeaderBlur = document.getElementById("range-header-blur");
  const valHeaderBlur = document.getElementById("val-header-blur");
  const toggleHeaderRounding = document.getElementById("toggle-header-rounding");

  // Часы
  const toggleClockEnabled = document.getElementById("toggle-clock-enabled");
  const clockLiveDisplay = document.getElementById("clock-live-display");
  const previewClockTime = document.getElementById("preview-clock-time");
  const previewClockDate = document.getElementById("preview-clock-date");
  const clockFormat24 = document.getElementById("clock-format-24");
  const clockFormat12 = document.getElementById("clock-format-12");
  const checkClockSeconds = document.getElementById("check-clock-seconds");
  const checkClockDate = document.getElementById("check-clock-date");
  const selectClockPosition = document.getElementById("select-clock-position");
  const selectClockStyle = document.getElementById("select-clock-style");
  const rangeClockSize = document.getElementById("range-clock-size");
  const valClockSize = document.getElementById("val-clock-size");
  const selectClockFont = document.getElementById("select-clock-font");
  const clockCustomFontBox = document.getElementById("clock-custom-font-box");
  const fileClockFont = document.getElementById("file-clock-font");
  const clockFontDropzone = document.getElementById("clock-font-dropzone");
  const clockFontActiveRow = document.getElementById("clock-font-active-row");
  const clockFontNameLabel = document.getElementById("clock-font-name-label");
  const btnClearClockFont = document.getElementById("btn-clear-clock-font");

  // Цвета
  const colorCardsList = document.getElementById("color-cards-list");

  // Эффекты
  const rangeBorderRadius = document.getElementById("range-border-radius");
  const valBorderRadius = document.getElementById("val-border-radius");
  const toggleBorderRadius = document.getElementById("toggle-border-radius");
  const toggleBadgeRounding = document.getElementById("toggle-badge-rounding");
  const toggleChatBorders = document.getElementById("toggle-chat-borders");
  const toggleCardBorders = document.getElementById("toggle-card-borders");
  const selectFont = document.getElementById("select-font");
  const customFontWrap = document.getElementById("custom-font-wrap");
  const fileUiFont = document.getElementById("file-ui-font");
  const uiFontDropzone = document.getElementById("ui-font-dropzone");
  const uiFontActiveRow = document.getElementById("ui-font-active-row");
  const uiFontNameLabel = document.getElementById("ui-font-name-label");
  const btnClearUiFont = document.getElementById("btn-clear-ui-font");
  const toggleCrt = document.getElementById("toggle-crt");
  const toggleSnow = document.getElementById("toggle-snow");
  const toggleRainbow = document.getElementById("toggle-rainbow");
  const toggleLogoImage = document.getElementById("toggle-logo-image");
  const textareaCustomCss = document.getElementById("textarea-custom-css");

  // Кастомный логотип
  const fileCustomLogo = document.getElementById("file-custom-logo");
  const logoDropzone = document.getElementById("logo-dropzone");
  const logoStatusText = document.getElementById("logo-status-text");
  const inputCustomLogo = document.getElementById("input-custom-logo");
  const btnApplyLogoUrl = document.getElementById("btn-apply-logo-url");
  const logoPreviewCard = document.getElementById("logo-preview-card");
  const logoPreviewThumb = document.getElementById("logo-preview-thumb");
  const btnClearLogo = document.getElementById("btn-clear-logo");
  const checkLogoOriginalColors = document.getElementById("check-logo-original-colors");

  // Неоновые светяшки (Glow)
  const toggleGlowEnabled = document.getElementById("toggle-glow-enabled");
  const glowOptionsWrap = document.getElementById("glow-options-wrap");
  const pickerGlowColor = document.getElementById("picker-glow-color");
  const swatchGlowColor = document.getElementById("swatch-glow-color");
  const hexGlowColor = document.getElementById("hex-glow-color");
  const btnGlowMatchAccent = document.getElementById("btn-glow-match-accent");
  const checkGlowHeader = document.getElementById("check-glow-header");
  const checkGlowLogo = document.getElementById("check-glow-logo");
  const checkGlowButtons = document.getElementById("check-glow-buttons");
  const checkGlowCards = document.getElementById("check-glow-cards");
  const checkGlowInputs = document.getElementById("check-glow-inputs");

  // Звуки уведомлений
  const toggleSoundEnabled = document.getElementById("toggle-sound-enabled");
  const selectNotifySound = document.getElementById("select-notify-sound");
  const btnPlaySound = document.getElementById("btn-play-sound");
  const customSoundUploadBox = document.getElementById("custom-sound-upload-box");
  const fileCustomSound = document.getElementById("file-custom-sound");
  const soundDropzone = document.getElementById("sound-dropzone");
  const soundStatusText = document.getElementById("sound-status-text");
  const soundActiveRow = document.getElementById("sound-active-row");
  const soundNameLabel = document.getElementById("sound-name-label");
  const btnClearCustomSound = document.getElementById("btn-clear-custom-sound");
  const rangeSoundVolume = document.getElementById("range-sound-volume");
  const valSoundVolume = document.getElementById("val-sound-volume");

  // Футер
  const btnReset = document.getElementById("btn-reset");

  /* ====================================================================
     Быстрые обои (1 клик)
     ==================================================================== */
  const CURATED_WALLPAPERS = [
    { name: "Киберпанк", url: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1920&q=80" },
    { name: "Синтвейв 80s", url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80" },
    { name: "Сакура", url: "https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1920&q=80" },
    { name: "Космос", url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80" },
    { name: "Горы Dark", url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80" },
    { name: "WinXP Поля", url: "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fserver.wallpaperalchemy.com%2Fstorage%2Fwallpapers%2F92%2Fwindows-xp-wallpaper-bliss-4k-wallpaper.jpeg&f=1&nofb=1&ipt=fd74fec816fb0781cef7240c5628364d2ec4645b2cf1cf3402eb2d783e4d56fa&ipo=images" }
  ];

  function renderCuratedWallpapers() {
    if (!presetWallpapersGrid) return;
    presetWallpapersGrid.textContent = "";
    CURATED_WALLPAPERS.forEach(item => {
      const card = document.createElement("div");
      card.className = "curated-card";
      card.style.backgroundImage = `url("${item.url}")`;
      const titleSpan = document.createElement("span");
      titleSpan.textContent = item.name;
      card.appendChild(titleSpan);
      card.addEventListener("click", () => {
        currentSettings.customTheme.bgType = "image";
        currentSettings.customTheme.bgImage = item.url;
        currentSettings.customTheme.bgVideo = "";
        updateUiFromSettings();
        saveAndApply();
      });
      presetWallpapersGrid.appendChild(card);
    });
  }

  /* ====================================================================
     Настраиваемые цвета интерфейса
     ==================================================================== */
  const COLOR_ITEMS = [
    { key: "headerBg", label: "Шапка сайта", icon: "🏛️", desc: "Верхняя навигация сайта" },
    { key: "headerText", label: "Текст в шапке", icon: "🔤", desc: "Логотип, кнопки и текст шапки" },
    { key: "bg", label: "Фон страницы", icon: "📄", desc: "Основной фон (когда нет обоев)" },
    { key: "cardBg", label: "Фон карточек и постов", icon: "🗂️", desc: "Стена, сообщения, блоки контента" },
    { key: "accent", label: "Акцентный цвет", icon: "⭐", desc: "Главные кнопки, бейджи, ховеры" },
    { key: "textColor", label: "Основной текст", icon: "📝", desc: "Записи, комментарии, текст постов" },
    { key: "mutedColor", label: "Второстепенный текст", icon: "💬", desc: "Подписи, даты, счетчики, серый текст" },
    { key: "linkColor", label: "Обычные ссылки", icon: "🔗", desc: "Ненаведенные гиперссылки" },
    { key: "borderColor", label: "Границы и линии", icon: "🔲", desc: "Разделители и обводка карточек" },
    { key: "buttonBg", label: "Фон обычных кнопок", icon: "🔘", desc: "Кнопки действий, отправки и тулбара" },
    { key: "buttonText", label: "Текст на кнопках", icon: "🔤", desc: "Цвет надписей на кнопках" },
    { key: "inputBg", label: "Фон полей ввода", icon: "✏️", desc: "Поля ввода, поиск, textarea" },
    { key: "inputText", label: "Текст в полях ввода", icon: "🖊️", desc: "Вводимый текст и placeholder" },
    { key: "sidebarBg", label: "Фон бокового меню", icon: "📑", desc: "Подложка левой колонки меню" },
    { key: "chatBubbleMine", label: "Мои сообщения в чате", icon: "🗨️", desc: "Исходящие облачка сообщений" },
    { key: "chatBubbleOthers", label: "Чужие сообщения в чате", icon: "💬", desc: "Входящие облачка сообщений" }
  ];

  const QUICK_SCHEMES = {
    vk: {
      headerBg: "#45668E", headerText: "#FFFFFF", bg: "#F7F7F7", cardBg: "#FFFFFF",
      accent: "#45668E", textColor: "#2B2B2B", mutedColor: "#777777", linkColor: "#2B587A", borderColor: "#DAE1E8",
      buttonBg: "#45668E", buttonText: "#FFFFFF", inputBg: "#FFFFFF", inputText: "#2B2B2B",
      sidebarBg: "#FFFFFF", chatBubbleMine: "#E1EEF9", chatBubbleOthers: "#F0F2F5"
    },
    dark: {
      headerBg: "#1E1F29", headerText: "#F8F8F2", bg: "#282A36", cardBg: "#343746",
      accent: "#BD93F9", textColor: "#F8F8F2", mutedColor: "#6272A4", linkColor: "#8BE9FD", borderColor: "#44475A",
      buttonBg: "#44475A", buttonText: "#F8F8F2", inputBg: "#21222C", inputText: "#F8F8F2",
      sidebarBg: "#282A36", chatBubbleMine: "#44475A", chatBubbleOthers: "#343746"
    },
    amoled: {
      headerBg: "#000000", headerText: "#FFFFFF", bg: "#000000", cardBg: "#0C0C0C",
      accent: "#3B82F6", textColor: "#E5E7EB", mutedColor: "#71717A", linkColor: "#60A5FA", borderColor: "#202020",
      buttonBg: "#18181B", buttonText: "#FFFFFF", inputBg: "#0A0A0A", inputText: "#E5E7EB",
      sidebarBg: "#000000", chatBubbleMine: "#1E3A5F", chatBubbleOthers: "#18181B"
    },
    neon: {
      headerBg: "#0E0D16", headerText: "#00F0FF", bg: "#09090E", cardBg: "#13121D",
      accent: "#FF0055", textColor: "#F0F6FC", mutedColor: "#8B949E", linkColor: "#00F0FF", borderColor: "#2B2642",
      buttonBg: "#201830", buttonText: "#00F0FF", inputBg: "#0B0A12", inputText: "#F0F6FC",
      sidebarBg: "#13121D", chatBubbleMine: "#2C1236", chatBubbleOthers: "#19152B"
    }
  };

  // Слушатели быстрых цветовых схем
  document.querySelectorAll(".btn-scheme-tag").forEach(btn => {
    btn.addEventListener("click", () => {
      const schemeKey = btn.getAttribute("data-scheme");
      const scheme = QUICK_SCHEMES[schemeKey];
      if (scheme) {
        Object.assign(currentSettings.customTheme, scheme);
        currentSettings.activeThemeId = "custom";
        renderColorCards();
        updateUiFromSettings();
        saveAndApply();
      }
    });
  });

  function renderColorCards() {
    colorCardsList.textContent = "";
    const c = currentSettings.customTheme;

    COLOR_ITEMS.forEach(item => {
      let currentHex = (c[item.key] || "#FFFFFF").toUpperCase();
      if (!currentHex.startsWith("#")) currentHex = "#" + currentHex;
      // Для input[type="color"] требуется строго 7 символов #RRGGBB
      const validColor = currentHex.length === 7 ? currentHex : (currentHex.length === 4 ? `#${currentHex[1]}${currentHex[1]}${currentHex[2]}${currentHex[2]}${currentHex[3]}${currentHex[3]}` : "#45668E");

      const row = document.createElement("div");
      row.className = "color-item-row";

      const infoDiv = document.createElement("div");
      infoDiv.className = "color-item-info";

      const iconSpan = document.createElement("span");
      iconSpan.className = "color-item-icon";
      iconSpan.textContent = item.icon;
      infoDiv.appendChild(iconSpan);

      const textsDiv = document.createElement("div");
      textsDiv.className = "color-item-texts";

      const labelSpan = document.createElement("span");
      labelSpan.className = "color-item-label";
      labelSpan.textContent = item.label;
      textsDiv.appendChild(labelSpan);

      const descSpan = document.createElement("span");
      descSpan.className = "color-item-desc";
      descSpan.textContent = item.desc;
      textsDiv.appendChild(descSpan);

      infoDiv.appendChild(textsDiv);
      row.appendChild(infoDiv);

      const controlsDiv = document.createElement("div");
      controlsDiv.className = "color-item-controls";

      const swatchWrap = document.createElement("div");
      swatchWrap.className = "color-swatch-wrap";
      swatchWrap.title = "Нажмите для открытия палитры (с пипеткой)";

      const picker = document.createElement("input");
      picker.type = "color";
      picker.className = "native-color-input";
      picker.id = `picker-${item.key}`;
      picker.value = validColor;
      swatchWrap.appendChild(picker);

      const swatch = document.createElement("div");
      swatch.className = "color-swatch-preview";
      swatch.id = `swatch-${item.key}`;
      swatch.style.backgroundColor = currentHex;
      swatchWrap.appendChild(swatch);

      controlsDiv.appendChild(swatchWrap);

      const hexInput = document.createElement("input");
      hexInput.type = "text";
      hexInput.className = "color-hex-field";
      hexInput.id = `hex-${item.key}`;
      hexInput.value = currentHex;
      hexInput.maxLength = 7;
      hexInput.spellcheck = false;
      hexInput.title = "HEX код цвета";
      controlsDiv.appendChild(hexInput);

      row.appendChild(controlsDiv);

      // Мгновенное обновление при выборе в нативной палитре
      picker.addEventListener("input", (e) => {
        const val = e.target.value.toUpperCase();
        swatch.style.backgroundColor = val;
        hexInput.value = val;
        currentSettings.customTheme[item.key] = val;
        currentSettings.activeThemeId = "custom";
        if (item.key === "accent") {
          broadcastLiveUpdate({ key: "accent", value: val });
        }
        saveAndApply();
      });

      // Ручной ввод HEX кода
      hexInput.addEventListener("input", () => {
        let val = hexInput.value.trim().toUpperCase();
        if (!val.startsWith("#") && val.length > 0) val = "#" + val;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
          picker.value = val;
          swatch.style.backgroundColor = val;
          currentSettings.customTheme[item.key] = val;
          currentSettings.activeThemeId = "custom";
          if (item.key === "accent") {
            broadcastLiveUpdate({ key: "accent", value: val });
          }
          saveAndApply();
        }
      });

      colorCardsList.appendChild(row);
    });
  }

  /* ====================================================================
     Навигация по вкладкам (быстрое и удобное перелистывание)
     ==================================================================== */
  const contentArea = document.querySelector(".content-scroll");
  const navTabsStrip = document.querySelector(".nav-tabs-strip");

  function switchToTab(index) {
    if (index < 0 || index >= navTabs.length) return;
    const tab = navTabs[index];
    navTabs.forEach(t => t.classList.remove("active"));
    tabPanes.forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    const targetPane = document.getElementById(tab.getAttribute("data-tab"));
    if (targetPane) targetPane.classList.add("active");
    if (contentArea) contentArea.scrollTop = 0;
  }

  navTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      switchToTab(index);
    });
  });

  // Быстрое перелистывание колесиком мыши по полосе вкладок
  if (navTabsStrip) {
    navTabsStrip.addEventListener("wheel", (e) => {
      e.preventDefault();
      const currentActiveIndex = Array.from(navTabs).findIndex(t => t.classList.contains("active"));
      if (e.deltaY > 0 || e.deltaX > 0) {
        switchToTab((currentActiveIndex + 1) % navTabs.length);
      } else if (e.deltaY < 0 || e.deltaX < 0) {
        switchToTab((currentActiveIndex - 1 + navTabs.length) % navTabs.length);
      }
    }, { passive: false });
  }

  // Перелистывание стрелочками клавиатуры (Влево / Вправо)
  document.addEventListener("keydown", (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT")) {
      return;
    }
    const currentActiveIndex = Array.from(navTabs).findIndex(t => t.classList.contains("active"));
    if (e.key === "ArrowRight") {
      switchToTab((currentActiveIndex + 1) % navTabs.length);
    } else if (e.key === "ArrowLeft") {
      switchToTab((currentActiveIndex - 1 + navTabs.length) % navTabs.length);
    }
  });

  // Свайп жестами влево/вправо
  let touchStartX = 0;
  let touchStartY = 0;
  if (contentArea) {
    contentArea.addEventListener("touchstart", (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }
    }, { passive: true });

    contentArea.addEventListener("touchend", (e) => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const touchEndX = e.changedTouches[0].screenX;
      const touchEndY = e.changedTouches[0].screenY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.4) {
        const currentActiveIndex = Array.from(navTabs).findIndex(t => t.classList.contains("active"));
        if (diffX < 0) {
          switchToTab((currentActiveIndex + 1) % navTabs.length);
        } else {
          switchToTab((currentActiveIndex - 1 + navTabs.length) % navTabs.length);
        }
      }
    }, { passive: true });
  }

  // Быстрые переходы через колонки статистики
  if (colPresets) {
    colPresets.addEventListener("click", () => {
      switchToTab(0);
      presetsList.scrollIntoView({ behavior: "smooth" });
    });
  }
  if (colSaved) {
    colSaved.addEventListener("click", () => {
      switchToTab(0);
      if (savedThemesHeader) savedThemesHeader.scrollIntoView({ behavior: "smooth" });
    });
  }
  const colActive = document.getElementById("col-active");
  if (colActive) {
    colActive.addEventListener("click", () => {
      if (currentSettings.activeThemeId === "custom") {
        switchToTab(2); // Цвета
      } else {
        switchToTab(0); // Темы
      }
    });
  }

  // Включение / отключение через статус
  if (statusToggle) {
    statusToggle.addEventListener("click", () => {
      currentSettings.enabled = !currentSettings.enabled;
      updateStatusUi();
      saveAndApply();
    });
  }

  function updateStatusUi() {
    if (currentSettings.enabled) {
      if (statusDot) statusDot.classList.remove("disabled");
      if (statusText) statusText.textContent = "Готово";
    } else {
      if (statusDot) statusDot.classList.add("disabled");
      if (statusText) statusText.textContent = "Откл";
    }
  }

  /* ====================================================================
     Менеджер тем (.hvthm) & Сохраненные темы пользователя
     ==================================================================== */
  function renderSavedThemes() {
    savedThemesList.textContent = "";
    const list = currentSettings.savedThemes || [];

    statSavedCount.textContent = list.length;

    if (list.length === 0) {
      if (savedThemesHeader) savedThemesHeader.style.display = "none";
      return;
    }

    if (savedThemesHeader) savedThemesHeader.style.display = "block";

    list.forEach((t, idx) => {
      const item = document.createElement("div");
      const isActive = currentSettings.activeThemeId === t.id;
      item.className = `item-row ${isActive ? "active" : ""}`;

      const colors = t.customTheme || t.colors || {};
      const grad = `linear-gradient(135deg, ${colors.headerBg || '#45668e'} 0%, ${colors.accent || '#e53935'} 50%, ${colors.cardBg || '#fff'} 100%)`;

      const itemLeft = document.createElement("div");
      itemLeft.className = "item-left";

      const itemThumb = document.createElement("div");
      itemThumb.className = "item-thumb";
      itemThumb.style.background = grad;
      itemLeft.appendChild(itemThumb);

      const titleBlock = document.createElement("div");
      titleBlock.className = "item-title-block";

      const titleSpan = document.createElement("span");
      titleSpan.className = "item-title";
      titleSpan.textContent = t.name || ("Тема #" + (idx + 1));
      titleBlock.appendChild(titleSpan);
      itemLeft.appendChild(titleBlock);

      item.appendChild(itemLeft);

      const itemActions = document.createElement("div");
      itemActions.className = "item-actions";

      const btnApply = document.createElement("button");
      btnApply.className = "btn-blue-sm btn-apply-theme";
      btnApply.title = "Применить тему";
      btnApply.textContent = "Применить";
      itemActions.appendChild(btnApply);

      const btnDl = document.createElement("button");
      btnDl.className = "btn-light-sm btn-dl-theme";
      btnDl.title = "Экспорт .hvthm";
      btnDl.textContent = "📥";
      itemActions.appendChild(btnDl);

      const btnDel = document.createElement("button");
      btnDel.className = "btn-danger-sm btn-del-theme";
      btnDel.title = "Удалить";
      btnDel.textContent = "✕";
      itemActions.appendChild(btnDel);

      item.appendChild(itemActions);

      item.addEventListener("click", e => {
        if (e.target.closest("button")) return;
        applyThemeObject(t);
      });

      btnApply.addEventListener("click", e => {
        e.stopPropagation();
        applyThemeObject(t);
      });

      btnDl.addEventListener("click", e => {
        e.stopPropagation();
        exportThemeAsHvthm(t);
      });

      item.querySelector(".btn-del-theme").addEventListener("click", e => {
        e.stopPropagation();
        if (confirm(`Удалить сохраненную тему «${t.name}»?`)) {
          currentSettings.savedThemes.splice(idx, 1);
          renderSavedThemes();
          saveAndApply();
        }
      });

      savedThemesList.appendChild(item);
    });
  }

  function applyThemeObject(t) {
    const sourceCustom = t.customTheme || t.colors || {};
    currentSettings.customTheme = Object.assign({}, DEFAULT_SETTINGS.customTheme, JSON.parse(JSON.stringify(sourceCustom)));
    if (!currentSettings.customTheme.glow) {
      currentSettings.customTheme.glow = Object.assign({}, DEFAULT_SETTINGS.customTheme.glow);
    } else {
      currentSettings.customTheme.glow = Object.assign({}, DEFAULT_SETTINGS.customTheme.glow, currentSettings.customTheme.glow);
    }
    currentSettings.effects = Object.assign({}, DEFAULT_SETTINGS.effects, JSON.parse(JSON.stringify(t.effects || {})));
    currentSettings.clock = Object.assign({}, DEFAULT_SETTINGS.clock, JSON.parse(JSON.stringify(t.clock || {})));
    if (t.sound) currentSettings.sound = Object.assign({}, DEFAULT_SETTINGS.sound, JSON.parse(JSON.stringify(t.sound)));
    currentSettings.customCss = t.customCss || "";
    currentSettings.activeThemeId = t.id || "custom";
    updateUiFromSettings();
    saveAndApply();
  }

  function exportThemeAsHvthm(themeObj) {
    const activePreset = currentSettings.activeThemeId && currentSettings.activeThemeId !== "custom" && Array.isArray(PRESET_THEMES)
      ? PRESET_THEMES.find(p => p.id === currentSettings.activeThemeId)
      : null;
    const defaultName = (activePreset && activePreset.name) || (currentSettings.customTheme && currentSettings.customTheme.name) || "huEVO Тема";
    const data = {
      type: "huEVO_THEME",
      version: "2.0",
      extension: "hvthm",
      name: themeObj.name || defaultName,
      author: "neriusshadow huEVO SWAGdev",
      createdAt: new Date().toISOString(),
      customTheme: JSON.parse(JSON.stringify(themeObj.customTheme || currentSettings.customTheme)),
      effects: JSON.parse(JSON.stringify(themeObj.effects || currentSettings.effects || DEFAULT_SETTINGS.effects)),
      clock: JSON.parse(JSON.stringify(themeObj.clock || currentSettings.clock || DEFAULT_SETTINGS.clock)),
      sound: JSON.parse(JSON.stringify(themeObj.sound || currentSettings.sound || DEFAULT_SETTINGS.sound)),
      customCss: themeObj.customCss !== undefined ? themeObj.customCss : (currentSettings.customCss || "")
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const safeName = (data.name.replace(/[^a-zA-Z0-9а-яА-Я_-]/g, "_") || "theme") + ".hvthm";

    const a = document.createElement("a");
    a.href = url;
    a.download = safeName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Кнопка Быстрый Экспорт в .hvthm
  if (btnQuickExport) {
    btnQuickExport.addEventListener("click", () => {
      exportThemeAsHvthm({
        name: (currentSettings.customTheme && currentSettings.customTheme.name) || "huEVO_Custom_Theme",
        customTheme: currentSettings.customTheme,
        effects: currentSettings.effects,
        clock: currentSettings.clock,
        sound: currentSettings.sound,
        customCss: currentSettings.customCss
      });
    });
  }

  // Кнопка Сохранить тему
  btnSaveCurrentTheme.addEventListener("click", () => {
    let name = inputSaveThemeName.value.trim();
    if (!name) {
      name = "Моя тема #" + ((currentSettings.savedThemes ? currentSettings.savedThemes.length : 0) + 1);
    }
    const themeToSave = {
      id: "saved_" + Date.now(),
      name: name,
      customTheme: JSON.parse(JSON.stringify(currentSettings.customTheme)),
      effects: JSON.parse(JSON.stringify(currentSettings.effects || DEFAULT_SETTINGS.effects)),
      clock: JSON.parse(JSON.stringify(currentSettings.clock || DEFAULT_SETTINGS.clock)),
      sound: JSON.parse(JSON.stringify(currentSettings.sound || DEFAULT_SETTINGS.sound)),
      customCss: currentSettings.customCss || ""
    };
    currentSettings.savedThemes.push(themeToSave);
    currentSettings.activeThemeId = themeToSave.id;
    inputSaveThemeName.value = "";
    updateUiFromSettings();
    saveAndApply();
    alert(`Тема «${name}» сохранена в вашей библиотеке!`);
  });

  // Кнопка Экспорт в .hvthm
  btnExportHvthm.addEventListener("click", () => {
    exportThemeAsHvthm({
      name: (currentSettings.customTheme && currentSettings.customTheme.name) || "huEVO_Custom_Theme",
      customTheme: currentSettings.customTheme,
      effects: currentSettings.effects,
      clock: currentSettings.clock,
      sound: currentSettings.sound,
      customCss: currentSettings.customCss
    });
  });

  // Загрузка файла .hvthm
  fileImportHvthm.addEventListener("change", e => {
    if (e.target.files && e.target.files[0]) {
      handleHvthmFile(e.target.files[0]);
    }
  });

  // Drag & drop зоны .hvthm
  hvthmDropzone.addEventListener("dragover", e => {
    e.preventDefault();
    hvthmDropzone.classList.add("dragover");
  });
  hvthmDropzone.addEventListener("dragleave", () => {
    hvthmDropzone.classList.remove("dragover");
  });
  hvthmDropzone.addEventListener("drop", e => {
    e.preventDefault();
    hvthmDropzone.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleHvthmFile(e.dataTransfer.files[0]);
    }
  });
  hvthmDropzone.addEventListener("click", () => {
    fileImportHvthm.click();
  });

  function handleHvthmFile(file) {
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const name = parsed.name || file.name.replace(/\.(hvthm|json)$/i, "");
        const sourceCustom = parsed.customTheme || parsed.colors || parsed;
        const newTheme = {
          id: "imported_" + Date.now(),
          name: name,
          customTheme: Object.assign({}, DEFAULT_SETTINGS.customTheme, JSON.parse(JSON.stringify(sourceCustom))),
          effects: Object.assign({}, DEFAULT_SETTINGS.effects, JSON.parse(JSON.stringify(parsed.effects || {}))),
          clock: Object.assign({}, DEFAULT_SETTINGS.clock, JSON.parse(JSON.stringify(parsed.clock || {}))),
          sound: Object.assign({}, DEFAULT_SETTINGS.sound, JSON.parse(JSON.stringify(parsed.sound || {}))),
          customCss: parsed.customCss || ""
        };

        currentSettings.savedThemes.push(newTheme);
        applyThemeObject(newTheme);
        renderSavedThemes();
        alert(`Тема «${name}» успешно импортирована и применена!`);
      } catch (err) {
        alert("Ошибка при чтении файла .hvthm: " + err.message);
      }
    };
    reader.readAsText(file);
    fileImportHvthm.value = "";
  }

  /* ====================================================================
     Рендеринг готовых пресетов (в точности как строки "Недавние игры")
     ==================================================================== */
  function renderPresets() {
    presetsList.textContent = "";
    statPresetsCount.textContent = PRESET_THEMES.length;

    // Пользовательский свой стиль
    const customRow = document.createElement("div");
    const isCustomActive = currentSettings.activeThemeId === "custom";
    customRow.className = `item-row ${isCustomActive ? "active" : ""}`;

    const customLeft = document.createElement("div");
    customLeft.className = "item-left";

    const customThumb = document.createElement("div");
    customThumb.className = "item-thumb";
    customThumb.style.background = `linear-gradient(135deg, ${currentSettings.customTheme.headerBg} 0%, ${currentSettings.customTheme.accent} 50%, ${currentSettings.customTheme.bg} 100%)`;
    customLeft.appendChild(customThumb);

    const customTitleBlock = document.createElement("div");
    customTitleBlock.className = "item-title-block";
    const customTitleSpan = document.createElement("span");
    customTitleSpan.className = "item-title";
    customTitleSpan.textContent = "🛠️ Свой дизайн";
    customTitleBlock.appendChild(customTitleSpan);
    customLeft.appendChild(customTitleBlock);

    customRow.appendChild(customLeft);

    const customCatSpan = document.createElement("span");
    customCatSpan.className = "item-category";
    customCatSpan.textContent = "Кастомная";
    customRow.appendChild(customCatSpan);

    customRow.addEventListener("click", () => {
      currentSettings.activeThemeId = "custom";
      updateUiFromSettings();
      saveAndApply();
      document.querySelector('[data-tab="tab-custom"]').click();
    });
    presetsList.appendChild(customRow);

    // Готовые темы
    PRESET_THEMES.forEach(preset => {
      const row = document.createElement("div");
      const isActive = currentSettings.activeThemeId === preset.id;
      row.className = `item-row ${isActive ? "active" : ""}`;

      let catLabel = "Классика";
      if (preset.category === "dark") catLabel = "Темная";
      if (preset.category === "neon") catLabel = "Неон";
      if (preset.category === "retro") catLabel = "Ретро";

      const itemLeft = document.createElement("div");
      itemLeft.className = "item-left";

      const itemThumb = document.createElement("div");
      itemThumb.className = "item-thumb";
      itemThumb.style.background = preset.previewGradient;
      itemLeft.appendChild(itemThumb);

      const titleBlock = document.createElement("div");
      titleBlock.className = "item-title-block";
      const titleSpan = document.createElement("span");
      titleSpan.className = "item-title";
      titleSpan.textContent = preset.name;
      titleBlock.appendChild(titleSpan);
      itemLeft.appendChild(titleBlock);

      row.appendChild(itemLeft);

      const catSpan = document.createElement("span");
      catSpan.className = "item-category";
      catSpan.textContent = catLabel;
      row.appendChild(catSpan);

      row.addEventListener("click", () => {
        currentSettings.activeThemeId = preset.id;
        currentSettings.customTheme = Object.assign({}, DEFAULT_SETTINGS.customTheme, preset.colors);
        if (preset.bgVideo) {
          currentSettings.customTheme.bgType = "video";
          currentSettings.customTheme.bgVideo = preset.bgVideo;
          currentSettings.customTheme.bgImage = "";
          currentSettings.customTheme.bgOverlay = preset.bgOverlay ?? 0.45;
          currentSettings.customTheme.cardOpacity = preset.colors.cardOpacity ?? 0.88;
          currentSettings.customTheme.cardBlur = preset.colors.cardBlur ?? 8;
          currentSettings.customTheme.headerOpacity = preset.colors.headerOpacity ?? 0.9;
          currentSettings.customTheme.headerBlur = preset.colors.headerBlur ?? 8;
        } else if (preset.wallpaper) {
          currentSettings.customTheme.bgType = "image";
          currentSettings.customTheme.bgImage = preset.wallpaper;
          currentSettings.customTheme.bgVideo = "";
          currentSettings.customTheme.bgOverlay = preset.bgOverlay ?? 0.3;
          if (typeof preset.bgBlur === "number") currentSettings.customTheme.bgBlur = preset.bgBlur;
          if (typeof preset.bgBrightness === "number") currentSettings.customTheme.bgBrightness = preset.bgBrightness;
          currentSettings.customTheme.cardOpacity = preset.colors.cardOpacity ?? 0.9;
          currentSettings.customTheme.cardBlur = preset.colors.cardBlur ?? 6;
          currentSettings.customTheme.headerOpacity = preset.colors.headerOpacity ?? 0.95;
          currentSettings.customTheme.headerBlur = preset.colors.headerBlur ?? 6;
        } else {
          currentSettings.customTheme.bgType = "image";
          currentSettings.customTheme.bgImage = "";
          currentSettings.customTheme.bgVideo = "";
          currentSettings.customTheme.cardOpacity = preset.colors.cardOpacity ?? 1;
          currentSettings.customTheme.cardBlur = preset.colors.cardBlur ?? 0;
          currentSettings.customTheme.headerOpacity = preset.colors.headerOpacity ?? 1;
          currentSettings.customTheme.headerBlur = preset.colors.headerBlur ?? 0;
        }
        currentSettings.customTheme.headerBg = preset.colors.headerBg;
        currentSettings.customTheme.headerText = preset.colors.headerText || "#FFFFFF";
        if (preset.sound) {
          currentSettings.sound = Object.assign({}, DEFAULT_SETTINGS.sound, preset.sound);
        }
        if (preset.clock) {
          currentSettings.clock = Object.assign({}, DEFAULT_SETTINGS.clock, preset.clock);
        }
        currentSettings.customTheme.alphabetTransform = !!preset.alphabetTransform;
        currentSettings.effects = Object.assign({}, DEFAULT_SETTINGS.effects, preset.effects || {});
        currentSettings.customCss = preset.customCss || "";
        updateUiFromSettings();
        saveAndApply();
      });

      presetsList.appendChild(row);
    });

    // Название активной темы в шапке статистики
    if (isCustomActive) {
      statActiveName.textContent = "Своя";
    } else {
      const activeObj = PRESET_THEMES.find(p => p.id === currentSettings.activeThemeId);
      if (activeObj) {
        statActiveName.textContent = activeObj.name.split(" ")[0];
      } else {
        const savedObj = (currentSettings.savedThemes || []).find(s => s.id === currentSettings.activeThemeId);
        statActiveName.textContent = savedObj ? savedObj.name.slice(0, 10) : "ВК 2007";
      }
    }
  }

  /* ====================================================================
     Загрузка обоев (Картинки, GIF, MP4 Видео)
     ==================================================================== */
  bgTypeImageRadio.addEventListener("change", () => {
    currentSettings.customTheme.bgType = "image";
    syncMediaTypeUi();
    saveAndApply();
  });

  bgTypeVideoRadio.addEventListener("change", () => {
    currentSettings.customTheme.bgType = "video";
    syncMediaTypeUi();
    saveAndApply();
  });

  function syncMediaTypeUi() {
    const isVideo = currentSettings.customTheme.bgType === "video";
    bgTypeVideoRadio.checked = isVideo;
    bgTypeImageRadio.checked = !isVideo;

    if (isVideo) {
      dropzoneIcon.textContent = "🎬";
      dropzoneText.querySelector("b").textContent = "Перетащите видео сюда (MP4 / WebM)";
      dropzoneText.querySelector("span").textContent = "или нажмите для выбора видеофайла";
      document.getElementById("curated-wallpapers-section").style.display = "none";
    } else {
      dropzoneIcon.textContent = "📁";
      dropzoneText.querySelector("b").textContent = "Перетащите картинку сюда";
      dropzoneText.querySelector("span").textContent = "или нажмите для выбора (PNG, JPG, WebP, GIF)";
      document.getElementById("curated-wallpapers-section").style.display = "block";
    }
  }

  wallpaperDropzone.addEventListener("click", () => {
    if (currentSettings.customTheme.bgType === "video") {
      fileBgVideo.click();
    } else {
      fileBgImage.click();
    }
  });

  fileBgImage.addEventListener("change", e => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  });

  fileBgVideo.addEventListener("change", e => {
    if (e.target.files && e.target.files[0]) {
      processVideoFile(e.target.files[0]);
    }
  });

  wallpaperDropzone.addEventListener("dragover", e => {
    e.preventDefault();
    wallpaperDropzone.classList.add("dragover");
  });

  wallpaperDropzone.addEventListener("dragleave", () => {
    wallpaperDropzone.classList.remove("dragover");
  });

  wallpaperDropzone.addEventListener("drop", e => {
    e.preventDefault();
    wallpaperDropzone.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("video/")) {
        currentSettings.customTheme.bgType = "video";
        syncMediaTypeUi();
        processVideoFile(file);
      } else {
        currentSettings.customTheme.bgType = "image";
        syncMediaTypeUi();
        processImageFile(file);
      }
    }
  });

  function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const rawDataUrl = e.target.result;
      if (file.type === "image/gif" || file.size < 400 * 1024) {
        currentSettings.customTheme.bgImage = rawDataUrl;
        currentSettings.customTheme.bgVideo = "";
        currentSettings.customTheme.bgType = "image";
        inputBgImage.value = "(Локальное изображение: " + file.name + ")";
        updateUiFromSettings();
        saveAndApply();
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxDim = 1920;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const optimized = canvas.toDataURL("image/webp", 0.88);
          currentSettings.customTheme.bgImage = optimized;
        } catch (err) {
          currentSettings.customTheme.bgImage = rawDataUrl;
        }
        currentSettings.customTheme.bgVideo = "";
        currentSettings.customTheme.bgType = "image";
        inputBgImage.value = "(Локальное изображение: " + file.name + ")";
        updateUiFromSettings();
        saveAndApply();
      };
      img.onerror = () => {
        currentSettings.customTheme.bgImage = rawDataUrl;
        currentSettings.customTheme.bgVideo = "";
        currentSettings.customTheme.bgType = "image";
        updateUiFromSettings();
        saveAndApply();
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  }

  function processVideoFile(file) {
    if (file.size > 15 * 1024 * 1024) {
      alert("Видео слишком большое (более 15MB). Для тяжелых видео используйте прямую ссылку из интернета (URL).");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      currentSettings.customTheme.bgVideo = e.target.result;
      currentSettings.customTheme.bgImage = "";
      currentSettings.customTheme.bgType = "video";
      inputBgImage.value = "(Локальное видео: " + file.name + ")";
      updateUiFromSettings();
      saveAndApply();
    };
    reader.readAsDataURL(file);
  }

  btnClearBg.addEventListener("click", () => {
    currentSettings.customTheme.bgImage = "";
    currentSettings.customTheme.bgVideo = "";
    inputBgImage.value = "";
    updateUiFromSettings();
    saveAndApply();
  });

  inputBgImage.addEventListener("change", () => {
    const val = inputBgImage.value.trim();
    if (!val.startsWith("(Локальн")) {
      if (val.endsWith(".mp4") || val.endsWith(".webm")) {
        currentSettings.customTheme.bgType = "video";
        currentSettings.customTheme.bgVideo = val;
        currentSettings.customTheme.bgImage = "";
      } else {
        currentSettings.customTheme.bgType = "image";
        currentSettings.customTheme.bgImage = val;
        currentSettings.customTheme.bgVideo = "";
      }
      updateUiFromSettings();
      saveAndApply();
    }
  });

  // Ползунки фона (живое обновление без фризов)
  rangeBgOpacity.addEventListener("input", () => {
    const val = parseFloat(rangeBgOpacity.value);
    valBgOpacity.textContent = `${Math.round(val * 100)}%`;
    currentSettings.customTheme.bgOpacity = val;
    broadcastLiveUpdate({ key: "bgOpacity", value: val });
    debouncedSave(250);
  });
  rangeBgOpacity.addEventListener("change", commitSaveImmediately);

  rangeBgOverlay.addEventListener("input", () => {
    const val = parseFloat(rangeBgOverlay.value);
    valBgOverlay.textContent = `${Math.round(val * 100)}%`;
    currentSettings.customTheme.bgOverlay = val;
    broadcastLiveUpdate({ key: "bgOverlay", value: val });
    debouncedSave(250);
  });
  rangeBgOverlay.addEventListener("change", commitSaveImmediately);

  rangeBgBlur.addEventListener("input", () => {
    const val = parseInt(rangeBgBlur.value, 10);
    valBgBlur.textContent = `${val}px`;
    currentSettings.customTheme.bgBlur = val;
    const br = typeof currentSettings.customTheme.bgBrightness === "number" ? currentSettings.customTheme.bgBrightness : 100;
    broadcastLiveUpdate({ key: "bgFilter", blur: val, brightness: br });
    debouncedSave(250);
  });
  rangeBgBlur.addEventListener("change", commitSaveImmediately);

  rangeBgBrightness.addEventListener("input", () => {
    const val = parseInt(rangeBgBrightness.value, 10);
    valBgBrightness.textContent = `${val}%`;
    currentSettings.customTheme.bgBrightness = val;
    const bl = currentSettings.customTheme.bgBlur || 0;
    broadcastLiveUpdate({ key: "bgFilter", blur: bl, brightness: val });
    debouncedSave(250);
  });
  rangeBgBrightness.addEventListener("change", commitSaveImmediately);

  selectBgSize.addEventListener("change", () => {
    currentSettings.customTheme.bgSize = selectBgSize.value;
    commitSaveImmediately();
  });

  rangeCardOpacity.addEventListener("input", () => {
    const val = parseFloat(rangeCardOpacity.value);
    valCardOpacity.textContent = `${Math.round(val * 100)}%`;
    currentSettings.customTheme.cardOpacity = val;
    const c = (window.HUEVO_THEMES && window.HUEVO_THEMES.getActiveColors) ? window.HUEVO_THEMES.getActiveColors(currentSettings) : {};
    const cardBg = c.cardBg || currentSettings.customTheme.cardBg || "#FFFFFF";
    broadcastLiveUpdate({ key: "cardOpacity", value: val, cardBg: cardBg });
    debouncedSave(250);
  });
  rangeCardOpacity.addEventListener("change", commitSaveImmediately);

  rangeCardBlur.addEventListener("input", () => {
    const val = parseInt(rangeCardBlur.value, 10);
    valCardBlur.textContent = `${val}px`;
    currentSettings.customTheme.cardBlur = val;
    broadcastLiveUpdate({ key: "cardBlur", value: val });
    debouncedSave(250);
  });
  rangeCardBlur.addEventListener("change", commitSaveImmediately);

  if (toggleSidebarCard) {
    toggleSidebarCard.addEventListener("change", () => {
      currentSettings.customTheme.sidebarCard = toggleSidebarCard.checked;
      broadcastLiveUpdate({ key: "sidebarCard", value: toggleSidebarCard.checked });
      saveAndApply();
    });
  }

  if (rangeHeaderOpacity) {
    rangeHeaderOpacity.addEventListener("input", () => {
      const val = parseFloat(rangeHeaderOpacity.value);
      if (valHeaderOpacity) valHeaderOpacity.textContent = `${Math.round(val * 100)}%`;
      currentSettings.customTheme.headerOpacity = val;
      const c = (window.HUEVO_THEMES && window.HUEVO_THEMES.getActiveColors) ? window.HUEVO_THEMES.getActiveColors(currentSettings) : {};
      const headerBg = c.headerBg || currentSettings.customTheme.headerBg || "#3A3A3A";
      broadcastLiveUpdate({ key: "headerOpacity", value: val, headerBg: headerBg });
      debouncedSave(250);
    });
    rangeHeaderOpacity.addEventListener("change", commitSaveImmediately);
  }

  if (rangeHeaderBlur) {
    rangeHeaderBlur.addEventListener("input", () => {
      const val = parseInt(rangeHeaderBlur.value, 10);
      if (valHeaderBlur) valHeaderBlur.textContent = `${val}px`;
      currentSettings.customTheme.headerBlur = val;
      broadcastLiveUpdate({ key: "headerBlur", value: val });
      debouncedSave(250);
    });
    rangeHeaderBlur.addEventListener("change", commitSaveImmediately);
  }

  if (toggleHeaderRounding) {
    toggleHeaderRounding.addEventListener("change", () => {
      const isChecked = toggleHeaderRounding.checked;
      currentSettings.customTheme.headerRounding = isChecked;
      broadcastLiveUpdate({ key: "headerRounding", value: isChecked });
      commitSaveImmediately();
    });
  }

  /* ====================================================================
     Настройки виджета часов
     ==================================================================== */
  toggleClockEnabled.addEventListener("change", () => {
    currentSettings.clock.enabled = toggleClockEnabled.checked;
    saveAndApply();
    updateClockPreview();
  });

  clockFormat24.addEventListener("change", () => {
    currentSettings.clock.format = "24";
    saveAndApply();
    updateClockPreview();
  });

  clockFormat12.addEventListener("change", () => {
    currentSettings.clock.format = "12";
    saveAndApply();
    updateClockPreview();
  });

  checkClockSeconds.addEventListener("change", () => {
    currentSettings.clock.showSeconds = checkClockSeconds.checked;
    saveAndApply();
    updateClockPreview();
  });

  checkClockDate.addEventListener("change", () => {
    currentSettings.clock.showDate = checkClockDate.checked;
    saveAndApply();
    updateClockPreview();
  });

  selectClockPosition.addEventListener("change", () => {
    currentSettings.clock.position = selectClockPosition.value;
    saveAndApply();
  });

  if (selectClockStyle) {
    selectClockStyle.addEventListener("change", () => {
      currentSettings.clock.styleType = selectClockStyle.value;
      saveAndApply();
      updateClockPreview();
    });
  }

  rangeClockSize.addEventListener("input", () => {
    const val = parseInt(rangeClockSize.value, 10);
    valClockSize.textContent = `${val}px`;
    currentSettings.clock.fontSize = val;
    previewClockTime.style.fontSize = `${Math.min(48, Math.max(22, Math.round(val * 0.72)))}px`;
    debouncedSave(250);
  });
  rangeClockSize.addEventListener("change", commitSaveImmediately);

  selectClockFont.addEventListener("change", () => {
    const val = selectClockFont.value;
    currentSettings.clock.fontStyle = val;
    if (val === "custom") {
      clockCustomFontBox.style.display = "block";
      if (!currentSettings.clock.customFontData) {
        fileClockFont.click();
      }
    } else {
      clockCustomFontBox.style.display = "none";
    }
    saveAndApply();
    updateClockPreview();
  });

  if (clockFontDropzone) {
    clockFontDropzone.addEventListener("click", () => {
      fileClockFont.click();
    });
    clockFontDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      clockFontDropzone.classList.add("dragover");
    });
    clockFontDropzone.addEventListener("dragleave", () => {
      clockFontDropzone.classList.remove("dragover");
    });
    clockFontDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      clockFontDropzone.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        processClockFontFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileClockFont) {
    fileClockFont.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        processClockFontFile(e.target.files[0]);
      }
    });
  }

  if (btnClearClockFont) {
    btnClearClockFont.addEventListener("click", (e) => {
      e.stopPropagation();
      currentSettings.clock.customFontData = "";
      currentSettings.clock.customFontName = "";
      currentSettings.clock.fontStyle = "light";
      applyPreviewCustomFont("");
      updateUiFromSettings();
      saveAndApply();
    });
  }

  function processClockFontFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      currentSettings.clock.customFontData = e.target.result;
      currentSettings.clock.customFontName = file.name;
      currentSettings.clock.fontStyle = "custom";
      applyPreviewCustomFont(e.target.result);
      updateUiFromSettings();
      saveAndApply();
    };
    reader.readAsDataURL(file);
  }

  function applyPreviewCustomFont(fontData) {
    let fontStyleEl = document.getElementById("huevo-preview-custom-font-style");
    if (!fontStyleEl) {
      fontStyleEl = document.createElement("style");
      fontStyleEl.id = "huevo-preview-custom-font-style";
      document.head.appendChild(fontStyleEl);
    }
    if (fontData && fontData.trim() !== "") {
      fontStyleEl.textContent = `
        @font-face {
          font-family: 'HuevoClockCustomFontPreview';
          src: url("${fontData}");
        }
      `;
    } else {
      fontStyleEl.textContent = "";
    }
  }

  function updateClockPreview() {
    const clock = currentSettings.clock;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    let suffix = "";

    if (clock.format === "12") {
      suffix = hours >= 12 ? " PM" : " AM";
      hours = hours % 12 || 12;
    }

    const hoursStr = String(hours).padStart(2, "0");
    let timeStr = `${hoursStr}:${minutes}`;
    if (clock.showSeconds === true) {
      timeStr += `:${seconds}`;
    }
    if (suffix) {
      timeStr += suffix;
    }

    previewClockTime.textContent = timeStr;

    if (clock.showDate !== false) {
      previewClockDate.style.display = "block";
      // В точности как на скриншоте: "среда, 12 октября"
      previewClockDate.textContent = now.toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long"
      });
    } else {
      previewClockDate.style.display = "none";
    }

    if (clock.fontStyle === "custom" && clock.customFontData) {
      applyPreviewCustomFont(clock.customFontData);
      previewClockTime.style.fontFamily = "'HuevoClockCustomFontPreview', sans-serif";
      previewClockTime.style.fontWeight = "normal";
      previewClockTime.style.letterSpacing = "normal";
    } else if (clock.fontStyle === "digital") {
      previewClockTime.style.fontFamily = "'Courier New', monospace";
      previewClockTime.style.fontWeight = "bold";
      previewClockTime.style.letterSpacing = "1px";
    } else if (clock.fontStyle === "tahoma") {
      previewClockTime.style.fontFamily = "Tahoma, Arial, sans-serif";
      previewClockTime.style.fontWeight = "bold";
      previewClockTime.style.letterSpacing = "normal";
    } else {
      // Light / minimalist lockscreen font as in photo
      previewClockTime.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      previewClockTime.style.fontWeight = "200";
      previewClockTime.style.letterSpacing = "-0.5px";
    }
  }

  setInterval(updateClockPreview, 1000);

  /* ====================================================================
     Эффекты и геометрия
     ==================================================================== */
  rangeBorderRadius.addEventListener("input", () => {
    const val = parseInt(rangeBorderRadius.value, 10);
    valBorderRadius.textContent = `${val}px`;
    currentSettings.customTheme.borderRadius = val;
    broadcastLiveUpdate({ key: "borderRadius", value: val });
    debouncedSave(250);
  });
  rangeBorderRadius.addEventListener("change", commitSaveImmediately);

  if (toggleBorderRadius) {
    toggleBorderRadius.addEventListener("change", () => {
      const isChecked = toggleBorderRadius.checked;
      currentSettings.customTheme.borderRadiusEnabled = isChecked;
      const rVal = isChecked ? (currentSettings.customTheme.borderRadius ?? 4) : 0;
      broadcastLiveUpdate({ key: "borderRadius", value: rVal });
      debouncedSave(200);
    });
  }

  if (toggleBadgeRounding) {
    toggleBadgeRounding.addEventListener("change", () => {
      const isChecked = toggleBadgeRounding.checked;
      currentSettings.customTheme.badgeRounding = isChecked;
      broadcastLiveUpdate({ key: "badgeRounding", value: isChecked });
      commitSaveImmediately();
    });
  }

  if (toggleChatBorders) {
    toggleChatBorders.addEventListener("change", () => {
      const isChecked = toggleChatBorders.checked;
      currentSettings.customTheme.chatBordersEnabled = isChecked;
      broadcastLiveUpdate({ key: "chatBorders", value: isChecked });
      commitSaveImmediately();
    });
  }

  if (toggleCardBorders) {
    toggleCardBorders.addEventListener("change", () => {
      currentSettings.customTheme.cardBordersEnabled = toggleCardBorders.checked;
      commitSaveImmediately();
    });
  }

  selectFont.addEventListener("change", () => {
    const val = selectFont.value;
    currentSettings.customTheme.fontFamily = val;
    if (val === "custom") {
      customFontWrap.style.display = "block";
      if (!currentSettings.customTheme.customFontData) {
        fileUiFont.click();
      }
    } else {
      customFontWrap.style.display = "none";
    }
    commitSaveImmediately();
  });

  if (uiFontDropzone) {
    uiFontDropzone.addEventListener("click", () => {
      fileUiFont.click();
    });
    uiFontDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      uiFontDropzone.classList.add("dragover");
    });
    uiFontDropzone.addEventListener("dragleave", () => {
      uiFontDropzone.classList.remove("dragover");
    });
    uiFontDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      uiFontDropzone.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        processUiFontFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileUiFont) {
    fileUiFont.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        processUiFontFile(e.target.files[0]);
      }
    });
  }

  if (btnClearUiFont) {
    btnClearUiFont.addEventListener("click", (e) => {
      e.stopPropagation();
      currentSettings.customTheme.customFontData = "";
      currentSettings.customTheme.customFontName = "";
      currentSettings.customTheme.customFontFamily = "";
      currentSettings.customTheme.fontFamily = "tahoma";
      updateUiFromSettings();
      commitSaveImmediately();
    });
  }

  function processUiFontFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      currentSettings.customTheme.customFontData = e.target.result;
      currentSettings.customTheme.customFontName = file.name;
      currentSettings.customTheme.fontFamily = "custom";
      updateUiFromSettings();
      commitSaveImmediately();
    };
    reader.readAsDataURL(file);
    fileUiFont.value = "";
  }

  toggleCrt.addEventListener("change", () => {
    currentSettings.effects.crtScanlines = toggleCrt.checked;
    commitSaveImmediately();
  });

  toggleSnow.addEventListener("change", () => {
    currentSettings.effects.snowfall = toggleSnow.checked;
    commitSaveImmediately();
  });

  toggleRainbow.addEventListener("change", () => {
    currentSettings.effects.rainbowHeader = toggleRainbow.checked;
    commitSaveImmediately();
  });

  if (toggleLogoImage) {
    toggleLogoImage.addEventListener("change", () => {
      currentSettings.effects.logoImage = toggleLogoImage.checked;
      commitSaveImmediately();
    });
  }

  /* ====================================================================
     Кастомный логотип
     ==================================================================== */
  function updateCustomLogoUI() {
    const c = currentSettings.customTheme || {};
    const logoUrl = c.customLogo || "";
    if (inputCustomLogo) inputCustomLogo.value = logoUrl.startsWith("data:") ? "" : logoUrl;
    if (checkLogoOriginalColors) checkLogoOriginalColors.checked = c.customLogoOriginalColors !== false;

    if (logoUrl) {
      if (logoPreviewThumb) logoPreviewThumb.src = logoUrl;
      if (logoPreviewCard) logoPreviewCard.style.display = "flex";
      if (logoStatusText) logoStatusText.innerHTML = "Кастомный логотип активен (нажмите для смены)";
    } else {
      if (logoPreviewCard) logoPreviewCard.style.display = "none";
      if (logoPreviewThumb) logoPreviewThumb.src = "";
      if (logoStatusText) logoStatusText.innerHTML = "Нажмите или перетащите файл логотипа <b>.png / .svg / .jpg / .gif</b>";
    }
  }

  function handleLogoFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|svg|gif|webp|ico)$/i.test(file.name)) {
      alert("Пожалуйста, выберите файл изображения (PNG, SVG, JPG, GIF, WebP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      currentSettings.customTheme.customLogo = dataUrl;
      currentSettings.activeThemeId = "custom";
      updateCustomLogoUI();
      saveAndApply();
    };
    reader.readAsDataURL(file);
  }

  if (logoDropzone && fileCustomLogo) {
    logoDropzone.addEventListener("click", () => fileCustomLogo.click());
    fileCustomLogo.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleLogoFile(e.target.files[0]);
        fileCustomLogo.value = "";
      }
    });

    logoDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      logoDropzone.classList.add("dragover");
    });
    logoDropzone.addEventListener("dragleave", () => {
      logoDropzone.classList.remove("dragover");
    });
    logoDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      logoDropzone.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleLogoFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (btnApplyLogoUrl && inputCustomLogo) {
    const applyUrl = () => {
      const val = inputCustomLogo.value.trim();
      if (val) {
        currentSettings.customTheme.customLogo = val;
        currentSettings.activeThemeId = "custom";
        updateCustomLogoUI();
        saveAndApply();
      }
    };
    btnApplyLogoUrl.addEventListener("click", applyUrl);
    inputCustomLogo.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyUrl();
      }
    });
  }

  if (btnClearLogo) {
    btnClearLogo.addEventListener("click", () => {
      currentSettings.customTheme.customLogo = "";
      if (inputCustomLogo) inputCustomLogo.value = "";
      if (fileCustomLogo) fileCustomLogo.value = "";
      updateCustomLogoUI();
      saveAndApply();
    });
  }

  if (checkLogoOriginalColors) {
    checkLogoOriginalColors.addEventListener("change", () => {
      currentSettings.customTheme.customLogoOriginalColors = checkLogoOriginalColors.checked;
      saveAndApply();
    });
  }

  /* ====================================================================
     Неоновая подсветка (Glow / Светяшки)
     ==================================================================== */
  if (toggleGlowEnabled) {
    toggleGlowEnabled.addEventListener("change", () => {
      const isEnabled = toggleGlowEnabled.checked;
      if (!currentSettings.customTheme.glow) currentSettings.customTheme.glow = Object.assign({}, DEFAULT_SETTINGS.customTheme.glow);
      currentSettings.customTheme.glow.enabled = isEnabled;
      if (glowOptionsWrap) glowOptionsWrap.style.display = isEnabled ? "block" : "none";
      saveAndApply();
    });
  }

  if (pickerGlowColor) {
    pickerGlowColor.addEventListener("input", (e) => {
      const val = e.target.value.toUpperCase();
      if (!currentSettings.customTheme.glow) currentSettings.customTheme.glow = Object.assign({}, DEFAULT_SETTINGS.customTheme.glow);
      currentSettings.customTheme.glow.color = val;
      if (swatchGlowColor) swatchGlowColor.style.backgroundColor = val;
      if (hexGlowColor) hexGlowColor.value = val;
      saveAndApply();
    });
  }

  if (hexGlowColor) {
    hexGlowColor.addEventListener("input", () => {
      let val = hexGlowColor.value.trim().toUpperCase();
      if (!val.startsWith("#")) val = "#" + val;
      if (val.length === 7 && /^#[0-9A-F]{6}$/i.test(val)) {
        if (!currentSettings.customTheme.glow) currentSettings.customTheme.glow = Object.assign({}, DEFAULT_SETTINGS.customTheme.glow);
        currentSettings.customTheme.glow.color = val;
        if (swatchGlowColor) swatchGlowColor.style.backgroundColor = val;
        if (pickerGlowColor) pickerGlowColor.value = val;
        saveAndApply();
      }
    });
  }

  if (btnGlowMatchAccent) {
    btnGlowMatchAccent.addEventListener("click", () => {
      const accent = (currentSettings.customTheme.accent || "#B01E1E").toUpperCase();
      if (!currentSettings.customTheme.glow) currentSettings.customTheme.glow = Object.assign({}, DEFAULT_SETTINGS.customTheme.glow);
      currentSettings.customTheme.glow.color = accent;
      if (pickerGlowColor) pickerGlowColor.value = accent.length === 7 ? accent : "#B01E1E";
      if (swatchGlowColor) swatchGlowColor.style.backgroundColor = accent;
      if (hexGlowColor) hexGlowColor.value = accent;
      saveAndApply();
    });
  }

  const glowCheckboxMap = [
    { el: checkGlowHeader, key: "header" },
    { el: checkGlowLogo, key: "logo" },
    { el: checkGlowButtons, key: "buttons" },
    { el: checkGlowCards, key: "cards" },
    { el: checkGlowInputs, key: "inputs" }
  ];

  glowCheckboxMap.forEach(({ el, key }) => {
    if (el) {
      el.addEventListener("change", () => {
        if (!currentSettings.customTheme.glow) currentSettings.customTheme.glow = Object.assign({}, DEFAULT_SETTINGS.customTheme.glow);
        currentSettings.customTheme.glow[key] = el.checked;
        saveAndApply();
      });
    }
  });

  textareaCustomCss.addEventListener("input", () => {
    currentSettings.customCss = textareaCustomCss.value;
    debouncedSave(400);
  });
  textareaCustomCss.addEventListener("change", commitSaveImmediately);

  const fileCustomCss = document.getElementById("file-custom-css");
  const btnLoadCss = document.getElementById("btn-load-css");
  const btnClearCss = document.getElementById("btn-clear-css");
  const cssFileStatus = document.getElementById("css-file-status");

  if (btnLoadCss && fileCustomCss) {
    btnLoadCss.addEventListener("click", () => {
      fileCustomCss.click();
    });

    fileCustomCss.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          const content = evt.target.result || "";
          textareaCustomCss.value = content;
          currentSettings.customCss = content;
          if (cssFileStatus) {
            cssFileStatus.style.display = "block";
            cssFileStatus.textContent = `✓ Загружен «${file.name}» (${(file.size / 1024).toFixed(1)} КБ)`;
          }
          saveAndApply();
        };
        reader.readAsText(file);
        fileCustomCss.value = "";
      }
    });
  }

  if (btnClearCss) {
    btnClearCss.addEventListener("click", () => {
      textareaCustomCss.value = "";
      currentSettings.customCss = "";
      if (cssFileStatus) {
        cssFileStatus.style.display = "block";
        cssFileStatus.textContent = "CSS очищен";
        setTimeout(() => { cssFileStatus.style.display = "none"; }, 2500);
      }
      saveAndApply();
    });
  }

  /* ====================================================================
     Звуки уведомлений
     ==================================================================== */
  if (toggleSoundEnabled) {
    toggleSoundEnabled.addEventListener("change", () => {
      if (!currentSettings.sound) currentSettings.sound = Object.assign({}, DEFAULT_SETTINGS.sound);
      currentSettings.sound.enabled = toggleSoundEnabled.checked;
      saveAndApply();
    });
  }

  if (selectNotifySound) {
    selectNotifySound.addEventListener("change", () => {
      if (!currentSettings.sound) currentSettings.sound = Object.assign({}, DEFAULT_SETTINGS.sound);
      const val = selectNotifySound.value;
      if (val === "custom") {
        if (!currentSettings.sound.customSoundData) {
          if (fileCustomSound) fileCustomSound.click();
        } else {
          currentSettings.sound.soundId = "custom";
        }
      } else {
        currentSettings.sound.soundId = val;
      }
      syncSoundUi();
      saveAndApply();
      // Быстрое превью при выборе
      if (currentSettings.sound.enabled && currentSettings.sound.soundId !== "mute") {
        if (window.HUEVO_THEMES && window.HUEVO_THEMES.playNotificationSound) {
          window.HUEVO_THEMES.playNotificationSound(currentSettings.sound);
        }
      }
    });
  }

  if (btnPlaySound) {
    btnPlaySound.addEventListener("click", () => {
      if (!currentSettings.sound) currentSettings.sound = Object.assign({}, DEFAULT_SETTINGS.sound);
      if (window.HUEVO_THEMES && window.HUEVO_THEMES.playNotificationSound) {
        window.HUEVO_THEMES.playNotificationSound({
          enabled: true,
          soundId: currentSettings.sound.soundId || "vk",
          volume: currentSettings.sound.volume ?? 80,
          customSoundData: currentSettings.sound.customSoundData
        });
      }
    });
  }

  if (soundDropzone && fileCustomSound) {
    soundDropzone.addEventListener("click", () => {
      fileCustomSound.click();
    });

    fileCustomSound.addEventListener("change", e => {
      if (e.target.files && e.target.files[0]) {
        processCustomSoundFile(e.target.files[0]);
      }
    });

    soundDropzone.addEventListener("dragover", e => {
      e.preventDefault();
      soundDropzone.classList.add("dragover");
    });
    soundDropzone.addEventListener("dragleave", () => {
      soundDropzone.classList.remove("dragover");
    });
    soundDropzone.addEventListener("drop", e => {
      e.preventDefault();
      soundDropzone.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        processCustomSoundFile(e.dataTransfer.files[0]);
      }
    });
  }

  function processCustomSoundFile(file) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("Аудиофайл слишком большой (максимум 15 МБ)");
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      if (!currentSettings.sound) currentSettings.sound = Object.assign({}, DEFAULT_SETTINGS.sound);
      currentSettings.sound.soundId = "custom";
      currentSettings.sound.customSoundName = file.name;
      currentSettings.sound.customSoundData = dataUrl;
      syncSoundUi();
      saveAndApply();
      if (window.HUEVO_THEMES && window.HUEVO_THEMES.playNotificationSound) {
        window.HUEVO_THEMES.playNotificationSound(currentSettings.sound);
      }
    };
    reader.readAsDataURL(file);
    fileCustomSound.value = "";
  }

  if (btnClearCustomSound) {
    btnClearCustomSound.addEventListener("click", () => {
      if (!currentSettings.sound) currentSettings.sound = Object.assign({}, DEFAULT_SETTINGS.sound);
      currentSettings.sound.customSoundName = "";
      currentSettings.sound.customSoundData = "";
      currentSettings.sound.soundId = "vk";
      syncSoundUi();
      saveAndApply();
    });
  }

  if (rangeSoundVolume) {
    rangeSoundVolume.addEventListener("input", () => {
      const vol = parseInt(rangeSoundVolume.value, 10);
      if (valSoundVolume) valSoundVolume.textContent = `${vol}%`;
      if (!currentSettings.sound) currentSettings.sound = Object.assign({}, DEFAULT_SETTINGS.sound);
      currentSettings.sound.volume = vol;
      saveAndApply();
    });
  }

  function syncSoundUi() {
    const sound = currentSettings.sound || DEFAULT_SETTINGS.sound;
    if (toggleSoundEnabled) toggleSoundEnabled.checked = sound.enabled !== false;
    if (selectNotifySound) selectNotifySound.value = sound.soundId || "vk";
    if (rangeSoundVolume) {
      rangeSoundVolume.value = sound.volume ?? 80;
      if (valSoundVolume) valSoundVolume.textContent = `${sound.volume ?? 80}%`;
    }

    const isCustom = sound.soundId === "custom" || Boolean(sound.customSoundData);
    if (customSoundUploadBox) {
      customSoundUploadBox.style.display = isCustom ? "block" : "none";
      if (sound.customSoundData) {
        if (soundActiveRow) soundActiveRow.style.display = "flex";
        if (soundNameLabel) soundNameLabel.textContent = sound.customSoundName || "Пользовательский звук";
        if (soundDropzone) soundDropzone.style.display = "none";
      } else {
        if (soundActiveRow) soundActiveRow.style.display = "none";
        if (soundDropzone) soundDropzone.style.display = "block";
      }
    }
  }

  btnReset.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Сбросить все настройки оформления к стандартным?")) {
      const savedThemesBackup = currentSettings.savedThemes || [];
      currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      currentSettings.savedThemes = savedThemesBackup;
      updateUiFromSettings();
      saveAndApply();
    }
  });

  /* ====================================================================
     Синхронизация интерфейса со значениями настроек
     ==================================================================== */
  function updateUiFromSettings() {
    updateStatusUi();

    const c = currentSettings.customTheme;
    const eff = currentSettings.effects || {};
    const clock = currentSettings.clock || DEFAULT_SETTINGS.clock;

    syncMediaTypeUi();

    const isVideo = c.bgType === "video" && c.bgVideo && c.bgVideo.trim() !== "";
    const isImage = !isVideo && c.bgImage && c.bgImage.trim() !== "";

    if (isVideo) {
      wallpaperPreviewBox.style.display = "flex";
      wallpaperThumb.style.display = "none";
      wallpaperThumbVideo.style.display = "block";
      wallpaperThumbVideo.src = c.bgVideo;
      wallpaperStatusText.textContent = "Видео-обои активны";
      if (!c.bgVideo.startsWith("data:")) {
        inputBgImage.value = c.bgVideo;
      }
    } else if (isImage) {
      wallpaperPreviewBox.style.display = "flex";
      wallpaperThumb.style.display = "block";
      wallpaperThumbVideo.style.display = "none";
      wallpaperThumb.src = c.bgImage;
      wallpaperStatusText.textContent = "Обои активны";
      if (!c.bgImage.startsWith("data:")) {
        inputBgImage.value = c.bgImage;
      }
    } else {
      wallpaperPreviewBox.style.display = "none";
      wallpaperThumb.src = "";
      wallpaperThumbVideo.src = "";
      inputBgImage.value = "";
    }

    rangeBgOpacity.value = c.bgOpacity ?? 1.0;
    valBgOpacity.textContent = `${Math.round((c.bgOpacity ?? 1.0) * 100)}%`;

    rangeBgOverlay.value = c.bgOverlay ?? 0.3;
    valBgOverlay.textContent = `${Math.round((c.bgOverlay ?? 0.3) * 100)}%`;

    rangeBgBlur.value = c.bgBlur ?? 0;
    valBgBlur.textContent = `${c.bgBlur ?? 0}px`;

    rangeBgBrightness.value = c.bgBrightness ?? 100;
    valBgBrightness.textContent = `${c.bgBrightness ?? 100}%`;

    selectBgSize.value = c.bgSize || "cover";

    rangeCardOpacity.value = c.cardOpacity ?? 0.9;
    valCardOpacity.textContent = `${Math.round((c.cardOpacity ?? 0.9) * 100)}%`;

    rangeCardBlur.value = c.cardBlur ?? 6;
    valCardBlur.textContent = `${c.cardBlur ?? 6}px`;

    if (toggleSidebarCard) {
      toggleSidebarCard.checked = !!c.sidebarCard;
    }

    if (rangeHeaderOpacity) {
      rangeHeaderOpacity.value = c.headerOpacity ?? 1.0;
      if (valHeaderOpacity) valHeaderOpacity.textContent = `${Math.round((c.headerOpacity ?? 1.0) * 100)}%`;
    }

    if (rangeHeaderBlur) {
      rangeHeaderBlur.value = c.headerBlur ?? 0;
      if (valHeaderBlur) valHeaderBlur.textContent = `${c.headerBlur ?? 0}px`;
    }

    if (toggleHeaderRounding) {
      toggleHeaderRounding.checked = c.headerRounding !== false;
    }

    // Часы
    toggleClockEnabled.checked = !!clock.enabled;
    clockFormat24.checked = clock.format !== "12";
    clockFormat12.checked = clock.format === "12";
    checkClockSeconds.checked = clock.showSeconds === true;
    checkClockDate.checked = clock.showDate !== false;
    selectClockPosition.value = clock.position || "bottom-left";
    if (selectClockStyle) selectClockStyle.value = clock.styleType || "minimal";
    rangeClockSize.value = clock.fontSize || 52;
    valClockSize.textContent = `${clock.fontSize || 52}px`;
    selectClockFont.value = clock.fontStyle || "light";

    const hasCustomFont = Boolean(clock.customFontData && clock.customFontData.trim() !== "");
    if (clock.fontStyle === "custom" || hasCustomFont) {
      clockCustomFontBox.style.display = "block";
      if (hasCustomFont) {
        clockFontActiveRow.style.display = "flex";
        clockFontNameLabel.textContent = clock.customFontName || "Шрифт загружен";
        clockFontDropzone.style.display = "none";
        applyPreviewCustomFont(clock.customFontData);
      } else {
        clockFontActiveRow.style.display = "none";
        clockFontDropzone.style.display = "block";
      }
    } else {
      clockCustomFontBox.style.display = "none";
    }

    updateClockPreview();

    // Геометрия & Шрифты
    if (toggleBorderRadius) {
      toggleBorderRadius.checked = c.borderRadiusEnabled !== false;
    }
    if (toggleBadgeRounding) {
      toggleBadgeRounding.checked = c.badgeRounding !== false;
    }
    if (toggleChatBorders) {
      toggleChatBorders.checked = !!c.chatBordersEnabled;
    }
    if (toggleCardBorders) {
      toggleCardBorders.checked = c.cardBordersEnabled !== false;
    }
    rangeBorderRadius.value = c.borderRadius ?? 4;
    valBorderRadius.textContent = `${c.borderRadius ?? 4}px`;

    selectFont.value = c.fontFamily || "tahoma";
    const hasCustomUiFont = Boolean(c.customFontData && c.customFontData.trim() !== "");
    if (c.fontFamily === "custom" || hasCustomUiFont) {
      customFontWrap.style.display = "block";
      if (hasCustomUiFont) {
        if (uiFontActiveRow) uiFontActiveRow.style.display = "flex";
        if (uiFontNameLabel) uiFontNameLabel.textContent = c.customFontName || "Шрифт загружен";
        if (uiFontDropzone) uiFontDropzone.style.display = "none";
      } else {
        if (uiFontActiveRow) uiFontActiveRow.style.display = "none";
        if (uiFontDropzone) uiFontDropzone.style.display = "block";
      }
    } else {
      customFontWrap.style.display = "none";
    }

    // Эффекты
    toggleCrt.checked = !!eff.crtScanlines;
    toggleSnow.checked = !!eff.snowfall;
    toggleRainbow.checked = !!eff.rainbowHeader;
    if (toggleLogoImage) {
      toggleLogoImage.checked = eff.logoImage !== false;
    }
    textareaCustomCss.value = currentSettings.customCss || "";

    // Кастомный логотип
    updateCustomLogoUI();

    // Неоновая подсветка (Glow / Светяшки)
    const glow = c.glow || DEFAULT_SETTINGS.customTheme.glow;
    if (toggleGlowEnabled) toggleGlowEnabled.checked = Boolean(glow.enabled);
    if (glowOptionsWrap) glowOptionsWrap.style.display = glow.enabled ? "block" : "none";
    let glowColor = (glow.color || c.accent || "#B01E1E").toUpperCase();
    if (!glowColor.startsWith("#")) glowColor = "#" + glowColor;
    const validGlowColor = glowColor.length === 7 ? glowColor : "#B01E1E";
    if (pickerGlowColor) pickerGlowColor.value = validGlowColor;
    if (swatchGlowColor) swatchGlowColor.style.backgroundColor = validGlowColor;
    if (hexGlowColor) hexGlowColor.value = validGlowColor;
    if (checkGlowHeader) checkGlowHeader.checked = Boolean(glow.header);
    if (checkGlowLogo) checkGlowLogo.checked = Boolean(glow.logo);
    if (checkGlowButtons) checkGlowButtons.checked = Boolean(glow.buttons);
    if (checkGlowCards) checkGlowCards.checked = Boolean(glow.cards);
    if (checkGlowInputs) checkGlowInputs.checked = Boolean(glow.inputs);

    syncSoundUi();
    renderPresets();
    renderSavedThemes();
    renderColorCards();
  }

  /* ====================================================================
     Сохранение в storage и трансляция на вкладки huEVO
     ==================================================================== */
  let saveTimer = null;

  function broadcastLiveUpdate(payload) {
    if (chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ url: ["*://huevo.su/*", "*://*.huevo.su/*", "*://huevo.departament.site/*", "*://*.huevo.departament.site/*"] }, tabs => {
        if (tabs) {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, Object.assign({ type: "HUEVO_LIVE_UPDATE" }, payload), () => {
              if (chrome.runtime.lastError) {}
            });
          });
        }
      });
    }
  }

  function debouncedSave(delay = 250) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveAndApply();
    }, delay);
  }

  function commitSaveImmediately() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveAndApply();
  }

  function saveAndApply() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ huevo_theme_settings: currentSettings });
    }

    if (chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ url: ["*://huevo.su/*", "*://*.huevo.su/*", "*://huevo.departament.site/*", "*://*.huevo.departament.site/*"] }, tabs => {
        if (tabs) {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              type: "HUEVO_APPLY_THEME",
              settings: currentSettings
            }, () => {
              if (chrome.runtime.lastError) {}
            });
          });
        }
      });
    }
  }

  /* ====================================================================
     Инициализация
     ==================================================================== */
  renderCuratedWallpapers();

  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["huevo_theme_settings"], res => {
      if (res && res.huevo_theme_settings) {
        currentSettings = Object.assign({}, DEFAULT_SETTINGS, res.huevo_theme_settings);
        currentSettings.customTheme = Object.assign({}, DEFAULT_SETTINGS.customTheme, res.huevo_theme_settings.customTheme || {});
        if (!currentSettings.customTheme.glow) {
          currentSettings.customTheme.glow = Object.assign({}, DEFAULT_SETTINGS.customTheme.glow);
        } else {
          currentSettings.customTheme.glow = Object.assign({}, DEFAULT_SETTINGS.customTheme.glow, currentSettings.customTheme.glow);
        }
        currentSettings.effects = Object.assign({}, DEFAULT_SETTINGS.effects, res.huevo_theme_settings.effects || {});
        currentSettings.clock = Object.assign({}, DEFAULT_SETTINGS.clock, res.huevo_theme_settings.clock || {});
        currentSettings.sound = Object.assign({}, DEFAULT_SETTINGS.sound, res.huevo_theme_settings.sound || {});
        if (!Array.isArray(currentSettings.savedThemes)) currentSettings.savedThemes = [];
      }
      updateUiFromSettings();
    });
  } else {
    updateUiFromSettings();
  }
});
