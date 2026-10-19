/**
 * huEVO Themes — Content Script
 * Инжектирует стили мгновенно (document_start), управляет живыми эффектами, видео-обоями и часами
 * by neriusshadow huEVO SWAGdev
 */
(function() {
  const STYLE_ID = "huevo-theme-style";
  const WALLPAPER_ID = "huevo-theme-wallpaper";
  const VIDEO_ID = "huevo-theme-video";
  const OVERLAY_ID = "huevo-theme-overlay";
  const CRT_ID = "huevo-crt-overlay";
  const SNOW_ID = "huevo-snow-canvas";
  const CLOCK_ID = "huevo-clock-widget";

  let currentSettings = (window.HUEVO_THEMES && window.HUEVO_THEMES.DEFAULT_SETTINGS) ? JSON.parse(JSON.stringify(window.HUEVO_THEMES.DEFAULT_SETTINGS)) : null;
  let snowAnimationId = null;
  let clockIntervalId = null;

  /**
   * Получение настроек из chrome.storage.local
   */
  function getStorage(keys, callback) {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, callback);
    } else if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(keys, callback);
    } else {
      callback({});
    }
  }

  /**
   * Инжекция или обновление тега <style>
   */
  function injectStyles(css) {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(style);
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          (document.head || document.documentElement).appendChild(style);
        });
      }
    }
    const nextCss = css || "";
    if (style.textContent !== nextCss) {
      style.textContent = nextCss;
    }
  }

  /**
   * Полное и чистое освобождение ресурсов видеоплеера для предотвращения утечек памяти
   */
  function destroyVideoWallpaper() {
    let vidEl = document.getElementById(VIDEO_ID);
    if (vidEl) {
      try {
        vidEl.pause();
        vidEl.removeAttribute("src");
        vidEl.load();
        if (vidEl._huevoBlobUrl) {
          URL.revokeObjectURL(vidEl._huevoBlobUrl);
          vidEl._huevoBlobUrl = null;
        }
      } catch (e) {}
      vidEl.remove();
    }
  }

  // Приостановка фонового видео при неактивной вкладке для экономии RAM, CPU и GPU
  document.addEventListener("visibilitychange", () => {
    const vidEl = document.getElementById(VIDEO_ID);
    if (vidEl && vidEl.tagName === "VIDEO") {
      if (document.hidden) {
        vidEl.pause();
      } else {
        vidEl.play().catch(() => {});
      }
    }
  });

  /**
   * Управление обоями (картинка или видео MP4/WebM) и тонирующим оверлеем
   */
  function updateWallpaper(settings) {
    const custom = (settings && settings.customTheme) || {};
    const isEnabled = Boolean(settings && settings.enabled);

    // Fallback к свойствам активного пресета, если в customTheme они не заданы
    let activePreset = null;
    if (settings && settings.activeThemeId && window.HUEVO_THEMES && Array.isArray(window.HUEVO_THEMES.PRESET_THEMES)) {
      activePreset = window.HUEVO_THEMES.PRESET_THEMES.find(p => p.id === settings.activeThemeId);
    }

    const bgVideo = (custom.bgVideo && custom.bgVideo.trim() !== "")
      ? custom.bgVideo
      : (activePreset && activePreset.bgVideo ? activePreset.bgVideo : "");

    const bgImage = (custom.bgImage && custom.bgImage.trim() !== "")
      ? custom.bgImage
      : (activePreset && activePreset.wallpaper ? activePreset.wallpaper : "");

    let bgType = custom.bgType;
    if (!bgType) {
      if (bgVideo) bgType = "video";
      else if (bgImage) bgType = "image";
      else bgType = "none";
    }

    const hasVideo = isEnabled && (bgType === "video" || (Boolean(bgVideo) && !bgImage)) && Boolean(bgVideo);
    const hasImage = isEnabled && !hasVideo && (bgType === "image" || Boolean(bgImage)) && Boolean(bgImage);

    let imgEl = document.getElementById(WALLPAPER_ID);
    let vidEl = document.getElementById(VIDEO_ID);
    let overlay = document.getElementById(OVERLAY_ID);

    if (!hasImage && !hasVideo) {
      if (imgEl) {
        if (imgEl._huevoBlobUrl) {
          URL.revokeObjectURL(imgEl._huevoBlobUrl);
          imgEl._huevoBlobUrl = null;
        }
        imgEl.remove();
        imgEl = null;
      }
      destroyVideoWallpaper();
      if (overlay) { overlay.remove(); overlay = null; }
      return;
    }

    const attach = () => {
      let target = document.body || document.documentElement;
      if (!target) return;

      const opacity = typeof custom.bgOpacity === "number" ? custom.bgOpacity : 1.0;
      const overlayDark = typeof custom.bgOverlay === "number" 
        ? custom.bgOverlay 
        : (activePreset && typeof activePreset.bgOverlay === "number" ? activePreset.bgOverlay : 0.3);
      const blur = custom.bgBlur || 0;
      const brightness = typeof custom.bgBrightness === "number" ? custom.bgBrightness : 100;

      // Оверлей затемнения
      if (!overlay || !document.getElementById(OVERLAY_ID)) {
        overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        target.prepend(overlay);
      } else if (document.body && overlay.parentElement !== document.body) {
        document.body.prepend(overlay);
      }
      overlay.style.setProperty("position", "fixed", "important");
      overlay.style.setProperty("top", "0px", "important");
      overlay.style.setProperty("left", "0px", "important");
      overlay.style.setProperty("width", "100vw", "important");
      overlay.style.setProperty("height", "100vh", "important");
      overlay.style.setProperty("z-index", "-9998", "important");
      overlay.style.setProperty("pointer-events", "none", "important");
      overlay.style.setProperty("margin", "0", "important");
      overlay.style.setProperty("padding", "0", "important");
      overlay.style.setProperty("border", "none", "important");
      overlay.style.setProperty("display", "block", "important");
      overlay.style.setProperty("background-color", `rgba(0, 0, 0, ${overlayDark})`, "important");

      // Видео-обои
      if (hasVideo) {
        if (imgEl) {
          imgEl.remove();
          imgEl = null;
        }

        if (!vidEl || !document.getElementById(VIDEO_ID)) {
          vidEl = document.createElement("video");
          vidEl.id = VIDEO_ID;
          vidEl.autoplay = true;
          vidEl.loop = true;
          vidEl.muted = true;
          vidEl.playsInline = true;
          vidEl.disablePictureInPicture = true;
          vidEl.setAttribute("autoplay", "");
          vidEl.setAttribute("loop", "");
          vidEl.setAttribute("muted", "");
          vidEl.setAttribute("playsinline", "");
          vidEl.setAttribute("disableremoteplayback", "");
          vidEl.setAttribute("disablepictureinpicture", "");
          target.prepend(vidEl);
        } else if (document.body && vidEl.parentElement !== document.body) {
          document.body.prepend(vidEl);
        }

        let targetSrc = bgVideo;
        if (targetSrc && !targetSrc.startsWith("http://") && !targetSrc.startsWith("https://") && !targetSrc.startsWith("data:") && !targetSrc.startsWith("blob:") && !targetSrc.startsWith("chrome-extension://") && !targetSrc.startsWith("moz-extension://")) {
          try {
            targetSrc = chrome.runtime.getURL(targetSrc);
          } catch (e) {}
        }

        // Асинхронное нативное преобразование data:video в Blob без зависания вкладки
        if (targetSrc && targetSrc.startsWith("data:video/")) {
          if (!vidEl._huevoBlobUrl || vidEl._huevoOriginalSrc !== targetSrc) {
            if (vidEl._huevoBlobUrl) {
              URL.revokeObjectURL(vidEl._huevoBlobUrl);
              vidEl._huevoBlobUrl = null;
            }
            vidEl._huevoOriginalSrc = targetSrc;
            fetch(targetSrc)
              .then(res => res.blob())
              .then(blob => {
                const currentVid = document.getElementById(VIDEO_ID);
                if (currentVid && currentVid._huevoOriginalSrc === targetSrc) {
                  const bUrl = URL.createObjectURL(blob);
                  currentVid._huevoBlobUrl = bUrl;
                  currentVid._huevoCurrentSrc = bUrl;
                  currentVid.src = bUrl;
                  currentVid.play().catch(() => {});
                }
              })
              .catch(err => {
                console.warn("Async video blob fallback:", err);
                vidEl._huevoCurrentSrc = targetSrc;
                vidEl.src = targetSrc;
                vidEl.play().catch(() => {});
              });
          }
        } else {
          // Обычный URL: обновляем src и перезагружаем ТОЛЬКО если путь реально изменился
          if (vidEl._huevoCurrentSrc !== targetSrc) {
            vidEl._huevoCurrentSrc = targetSrc;
            vidEl.src = targetSrc;
            vidEl.load();
            vidEl.play().catch(() => {});
          }
        }

        vidEl.style.setProperty("position", "fixed", "important");
        vidEl.style.setProperty("top", "0px", "important");
        vidEl.style.setProperty("left", "0px", "important");
        vidEl.style.setProperty("width", "100vw", "important");
        vidEl.style.setProperty("height", "100vh", "important");
        vidEl.style.setProperty("min-width", "100vw", "important");
        vidEl.style.setProperty("min-height", "100vh", "important");
        vidEl.style.setProperty("max-width", "100vw", "important");
        vidEl.style.setProperty("max-height", "100vh", "important");
        vidEl.style.setProperty("object-fit", "cover", "important");
        vidEl.style.setProperty("z-index", "-9999", "important");
        vidEl.style.setProperty("pointer-events", "none", "important");
        vidEl.style.setProperty("margin", "0", "important");
        vidEl.style.setProperty("padding", "0", "important");
        vidEl.style.setProperty("border", "none", "important");
        vidEl.style.setProperty("display", "block", "important");
        vidEl.style.setProperty("box-sizing", "border-box", "important");
        vidEl.style.setProperty("opacity", String(opacity), "important");
        vidEl.style.setProperty("transform", "translate3d(0, 0, 0)", "important");

        if (blur > 0 || brightness !== 100) {
          vidEl.style.setProperty("filter", `blur(${blur}px) brightness(${brightness}%)`, "important");
        } else {
          vidEl.style.removeProperty("filter");
        }
      } else if (hasImage) {
        // Обои-картинка / GIF
        destroyVideoWallpaper();

        if (!imgEl || !document.getElementById(WALLPAPER_ID)) {
          imgEl = document.createElement("div");
          imgEl.id = WALLPAPER_ID;
          target.prepend(imgEl);
        } else if (document.body && imgEl.parentElement !== document.body) {
          document.body.prepend(imgEl);
        }

        imgEl.style.setProperty("position", "fixed", "important");
        imgEl.style.setProperty("top", "0px", "important");
        imgEl.style.setProperty("left", "0px", "important");
        imgEl.style.setProperty("width", "100vw", "important");
        imgEl.style.setProperty("height", "100vh", "important");
        imgEl.style.setProperty("z-index", "-9999", "important");
        imgEl.style.setProperty("pointer-events", "none", "important");
        imgEl.style.setProperty("margin", "0", "important");
        imgEl.style.setProperty("padding", "0", "important");
        imgEl.style.setProperty("border", "none", "important");

        let targetImg = bgImage;
        if (targetImg && !targetImg.startsWith("http://") && !targetImg.startsWith("https://") && !targetImg.startsWith("data:") && !targetImg.startsWith("blob:") && !targetImg.startsWith("chrome-extension://") && !targetImg.startsWith("moz-extension://")) {
          try {
            targetImg = chrome.runtime.getURL(targetImg);
          } catch (e) {}
        }

        // ВАЖНО: устанавливаем background-image ТОЛЬКО если путь реально изменился
        // Это предотвращает повторный парсинг тяжелых GIF при перемещении ползунков
        if (imgEl._huevoCurrentSrc !== targetImg) {
          imgEl._huevoCurrentSrc = targetImg;
          if (imgEl._huevoBlobUrl) {
            URL.revokeObjectURL(imgEl._huevoBlobUrl);
            imgEl._huevoBlobUrl = null;
          }
          if (targetImg && targetImg.startsWith("data:image/")) {
            fetch(targetImg)
              .then(res => res.blob())
              .then(blob => {
                const currentImg = document.getElementById(WALLPAPER_ID);
                if (currentImg && currentImg._huevoCurrentSrc === targetImg) {
                  const bUrl = URL.createObjectURL(blob);
                  currentImg._huevoBlobUrl = bUrl;
                  currentImg.style.setProperty("background-image", `url("${bUrl}")`, "important");
                }
              })
              .catch(() => {
                imgEl.style.setProperty("background-image", `url("${targetImg}")`, "important");
              });
          } else {
            imgEl.style.setProperty("background-image", `url("${targetImg}")`, "important");
          }
        }

        imgEl.style.setProperty("background-position", "center center", "important");
        imgEl.style.setProperty("background-size", custom.bgSize || "cover", "important");
        imgEl.style.setProperty("background-repeat", custom.bgSize === "repeat" ? "repeat" : "no-repeat", "important");
        if (blur > 0 || brightness !== 100) {
          imgEl.style.setProperty("filter", `blur(${blur}px) brightness(${brightness}%)`, "important");
        } else {
          imgEl.style.removeProperty("filter");
        }
        imgEl.style.setProperty("opacity", String(opacity), "important");
      }
    };

    if (document.body || document.documentElement) {
      attach();
    }
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", attach, { once: true });
    }
  }

  /**
   * Управление виджетом часов (12/24ч, секунды, дата, позиция, размер)
   */
  let activeClockConfig = null;

  function updateClock(settings) {
    const clock = (settings && settings.enabled && settings.clock) || null;
    activeClockConfig = clock;
    let clockEl = document.getElementById(CLOCK_ID);

    if (clockIntervalId) {
      clearInterval(clockIntervalId);
      clockIntervalId = null;
    }

    if (!clock || !clock.enabled) {
      if (clockEl) clockEl.remove();
      return;
    }

    const attachClock = () => {
      const target = document.body || document.documentElement;
      if (!target) return;

      if (!clockEl || !document.getElementById(CLOCK_ID)) {
        clockEl = document.createElement("div");
        clockEl.id = CLOCK_ID;
        clockEl.className = "huevo-clock-widget";
        const timeSpan = document.createElement("span");
        timeSpan.className = "huevo-clock-time";
        const dateSpan = document.createElement("span");
        dateSpan.className = "huevo-clock-date";
        clockEl.appendChild(timeSpan);
        clockEl.appendChild(dateSpan);
        target.appendChild(clockEl);
      }

      const cfg = activeClockConfig;
      if (!cfg || !cfg.enabled) return;

      // Обновляем позицию, шрифт и стиль оформления (минималистичный или карточка)
      const pos = cfg.position || "bottom-left";
      const font = cfg.fontStyle || "light";
      const styleType = cfg.styleType || "minimal";
      clockEl.className = `huevo-clock-widget huevo-clock-pos-${pos} font-${font} style-${styleType}`;
      clockEl.style.fontSize = `${cfg.fontSize || 52}px`;
      if (cfg.textColor) clockEl.style.color = cfg.textColor;

      const timeEl = clockEl.querySelector(".huevo-clock-time");
      const dateEl = clockEl.querySelector(".huevo-clock-date");

      const tick = () => {
        const c = activeClockConfig;
        if (!c || !c.enabled) return;
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        let suffix = "";

        if (c.format === "12") {
          suffix = hours >= 12 ? " PM" : " AM";
          hours = hours % 12 || 12;
        }

        const hoursStr = String(hours).padStart(2, "0");
        let timeStr = `${hoursStr}:${minutes}`;
        if (c.showSeconds === true) {
          timeStr += `:${seconds}`;
        }
        if (suffix) {
          timeStr += suffix;
        }

        if (timeEl) timeEl.textContent = timeStr;

        if (dateEl) {
          if (c.showDate !== false) {
            dateEl.style.display = "block";
            // В точности как на фото: "среда, 12 октября"
            dateEl.textContent = now.toLocaleDateString("ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long"
            });
          } else {
            dateEl.style.display = "none";
          }
        }
      };

      tick();
      if (clockIntervalId) {
        clearInterval(clockIntervalId);
      }
      clockIntervalId = setInterval(tick, 1000);
    };

    if (document.body || document.documentElement) {
      attachClock();
    } else {
      document.addEventListener("DOMContentLoaded", attachClock);
    }
  }

  /**
   * Управление CRT эффектом
   */
  function updateCrtEffect(settings) {
    const enabled = settings && settings.enabled && settings.effects && settings.effects.crtScanlines;
    let el = document.getElementById(CRT_ID);

    if (!enabled) {
      if (el) el.remove();
      return;
    }

    if (!el) {
      el = document.createElement("div");
      el.id = CRT_ID;
      const target = document.body || document.documentElement;
      if (target) {
        target.appendChild(el);
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          if (!document.getElementById(CRT_ID) && document.body) {
            document.body.appendChild(el);
          }
        });
      }
    }
  }

  /**
   * Эффект снегопада
   */
  function updateSnowEffect(settings) {
    const enabled = settings && settings.enabled && settings.effects && settings.effects.snowfall;
    let canvas = document.getElementById(SNOW_ID);

    if (!enabled) {
      if (canvas) canvas.remove();
      if (snowAnimationId) {
        cancelAnimationFrame(snowAnimationId);
        snowAnimationId = null;
      }
      return;
    }

    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = SNOW_ID;
      const attach = () => {
        const target = document.body || document.documentElement;
        if (!document.getElementById(SNOW_ID) && target) {
          target.appendChild(canvas);
          initSnow(canvas);
        }
      };
      if (document.body || document.documentElement) {
        attach();
      } else {
        document.addEventListener("DOMContentLoaded", attach);
      }
    }
  }

  function initSnow(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener("resize", () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const flakes = [];
    const count = 55;
    for (let i = 0; i < count; i++) {
      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 2.5 + 1,
        d: Math.random() * count,
        vx: Math.random() * 1 - 0.5,
        vy: Math.random() * 1.5 + 0.7
      });
    }

    function render() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const f = flakes[i];
        ctx.moveTo(f.x, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2, true);

        f.y += f.vy;
        f.x += f.vx;

        if (f.y > height) {
          f.y = -5;
          f.x = Math.random() * width;
        }
        if (f.x > width) f.x = 0;
        if (f.x < 0) f.x = width;
      }
      ctx.fill();
      snowAnimationId = requestAnimationFrame(render);
    }

    render();
  }

  /* ====================================================================
     Кастомный алфавит JDFhuEVO (капс + замена букв):
     А Б V Г D Е Ж Z И Й К L М N О П R S Т Y F Х Ц Ч Ш Щ Ъ Ы Ь Э Ю Я
     Заменяются:
       В/в -> V
       Д/д -> D
       З/з -> Z
       Л/л -> L
       Н/н -> N
       Р/р -> R
       С/с -> S
       У/у -> Y
       Ф/ф -> F
     Все остальные русские буквы капсом без изменения начертания.
     Ники и названия треков стилизуются капсом через CSS (без замены букв!).
     Посты, диалоги и сообщения остаются чистым обычным текстом.
     ==================================================================== */
  let alphabetObserver = null;
  let isTransformingDOM = false;
  let rafId = null;
  let isTransformActive = false;

  const IGNORED_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "SELECT", "OPTION", 
    "CODE", "PRE", "SVG", "CANVAS", "VIDEO", "AUDIO"
  ]);

  // 1. Исключаем пользовательский контент: посты, сообщения, переписку, треки, ники, списки групп
  function isUserContent(node) {
    if (!node) return false;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return false;

    // Посты, сообщения, комментарии, переписка
    if (el.closest(
      '.wall_post_text, .wall_text, .post_text, .wall_reply_text, .reply_text, ' +
      '.im-mess--text, .im_msg_text, .im-text, .comment_text, .dpub_text, ' +
      '.article_content, .media_desc, [id^="wpt"], [id^="reply_text"], [id^="post_text"], ' +
      '.im-mess-stack--text, .im-mess, .vk-post, .post-row, .mg-gmsg, .vk-topic-post, ' +
      '.im-dialog--text, .nim-dialog--preview, .dialog_text, .dialog_preview, ' +
      '.im_pinned_msg, .im-pinned, [class*="pinned_msg"], ' +
      '.profile_custom_text, .profile_bio, .profile_about, ' +
      '.user_hover_card .bio, .mention_card .text, ' +
      '.fc_msgs, .fc_msg_text, #im_dialogs .dialog_text, ' +
      '#hue-react-pick, #hue-react-btn, .hue-react, #hue-msg-bar, #hue-msg-menu, ' +
      '.hs-emoji, .hue-stk-btn, #hue-stk-pop, .vk-attach-btn, .hue-cfrom-btn, ' +
      '[class*="reaction"], [class*="Reaction"], [class*="reactions"], [class*="emoji"], .like_btn'
    )) {
      return true;
    }

    // Ники, имена авторов (капсом через CSS, алфавит JDF НЕ трогает)
    if (el.closest(
      '.author, .profile_name, a.mem_link, .peer_name, .wall_signed_by, ' +
      '.im-mess--author, .nim-peer--name, .vk-post-who, .mg-v-author, .vk-topic-author, ' +
      '.vk-profile-name, .profile-name, .user-name, a[href^="/id"], a[href^="/@"], ' +
      '.friends_user_row .bold, .call-row .user-name, .dialog_user'
    )) {
      return true;
    }

    // Названия треков, альбомов и артисты (капсом через CSS, алфавит JDF НЕ трогает) + таймеры плеера
    if (el.closest(
      '.apm-name, .apm-cap, .ap-mini-title, .ap-title-cell, ' +
      '.apm-row, .apm-row-name, .apm-row-sub, .apm-row-dur, ' +
      '.mg-track, .mg-track-name, .mg-track-sub, .mg-track-dur, .mg-ck-track, ' +
      '.apm-side-links, .mu-pl-card-title, .mu-pl-opt-title, .mu-pl-desc, .mu-pl-by, ' +
      '.audio_row, .audio_row__title, .audio_row__performer, .audio_title_inner, ' +
      '.zv-card-title, .zv-card-sub, .zv-track-title, .zv-track-artist, ' +
      '.audio_duration, .ap-time, [id*="time"], [id*="dur"]'
    )) {
      return true;
    }

    // Уведомления (текст событий на /notifications)
    if (el.closest('.feedback_row, .notification_row, .n-row, .notifications-list .row, .mg-notif-row')) {
      return true;
    }

    // Список сообществ в ленте групп (/groups)
    if (el.closest('.group_row, .community_row, .mg-group-row, .groups_list .row')) {
      if (!el.closest('button, .button, input[type="submit"], input[type="button"], .btn')) {
        return true;
      }
    }

    // Имена друзей в списках
    if (el.closest('.friends_user_row .user_name, .calls_user_name, .call-row .bold')) {
      return true;
    }

    return false;
  }

  // Селекторы только для системных элементов интерфейса
  const UI_SELECTOR = [
    '#mh-bar', '#topbar-table', 'table[bgcolor="#3A3A3A"]', 'table[bgcolor="#2F3033"]', '#ap-header-wrap', '.mh-logo',
    '#side_bar', '#sidebar', '#sidebar-nav', '#sidebar-cell', '.side_bar', '.vk-menu-item', '.side-link',
    'button', '.button', '.btn', '.ui_load_more_btn', '.mh-btn', '.apm-b',
    'input[type="submit"]', 'input[type="button"]',
    '.ui_tabs', '.tabs', '.tab_word', '.tab-badge', '.mg-tabs', '.mg-tabs-btn', '.apm-sec', '.apm-pls-h', '.apm-side-head',
    '.mh-drop', '.ui_actions_menu', '.ui_actions_menu_item',
    '.page_block_header', '.box_title', '.box_title_wrap', '.pcast_title', 'th', 'label', '.header_label', '.hue-sheet-head', '.sec-title', '.page_header', '.sub_header',
    '.modal_box', '.pay_box', '.payment_box', '.coin_modal', '.roulette_box', 'h1', 'h2', 'h3', 'h4',
    '.counts_module', '.profile_counters', '.profile-counters', '.profile_info_header', '.profile_label', '.count', '.badge',
    '.post_date', '.wall_post_date', '.post-meta', '.wall_text_meta', '.reply_date', '.wall_replies_header', '.wr_header', '.wr_more', '.reply_link',
    '.call-status', '.user_status', '.online_status', '.last_seen', '.mg-online', '.mg-lastseen',
    '.mg-form', '.mg-field label', '.mg-ck-top', '.mg-tag', '.market-row-btn', '.market-title',
    '.placeholder', '[class*="empty"]', '[class*="pinned_label"]',
    'a[href="/feed"]', 'a[href="/im"]', 'a[href="/friends"]', 'a[href="/photos"]', 'a[href="/audios"]', 'a[href="/videos"]', 'a[href="/pages"]', 'a[href="/groups"]', 'a[href="/settings"]', 'a[href="/support"]', 'a[href="/docs"]', 'a[href="/edit"]', 'a[href="/help"]', 'a[href="/search"]', 'a[href="/notifications"]', 'a[href="/bookmarks"]', 'a[href="/saved"]', 'a[href="/calls"]', 'a[href="/zvuchok"]'
  ].join(',');

  function transformJdflagString(str) {
    if (!str) return str;
    return str.replace(/[вдзлнрсфуВДЗЛНРСФУ]/g, function(ch) {
      switch (ch.toLowerCase()) {
        case 'в': return 'V';
        case 'д': return 'D';
        case 'з': return 'Z';
        case 'л': return 'L';
        case 'н': return 'N';
        case 'р': return 'R';
        case 'с': return 'S';
        case 'у': return 'Y';
        case 'ф': return 'F';
        default: return ch;
      }
    }).toUpperCase();
  }

  function transformPlaceholder(el) {
    if (!el || !el.getAttribute) return;
    const ph = el.getAttribute("placeholder");
    if (!ph || !ph.trim()) return;

    if (el._jdfOrigPh === undefined) {
      el._jdfOrigPh = ph;
    }
    const orig = el._jdfOrigPh;
    const transformed = transformJdflagString(orig);
    el._jdfTransPh = transformed;
    if (el.getAttribute("placeholder") !== transformed) {
      el.setAttribute("placeholder", transformed);
    }
  }

  function restorePlaceholder(el) {
    if (!el || el._jdfOrigPh === undefined) return;
    if (el.getAttribute("placeholder") !== el._jdfOrigPh) {
      el.setAttribute("placeholder", el._jdfOrigPh);
    }
    delete el._jdfOrigPh;
    delete el._jdfTransPh;
  }

  function transformTextNode(textNode) {
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
    const parent = textNode.parentElement;
    if (!parent) return;

    if (IGNORED_TAGS.has(parent.tagName) || parent.isContentEditable) return;
    if (isUserContent(parent)) return;

    const current = textNode.textContent;
    if (!current || !current.trim()) return;

    // Быстрая O(1) проверка: если узел уже преобразован, мгновенный возврат
    if (textNode._jdfDone && textNode.textContent === textNode._jdfTrans) return;

    if (textNode._jdfOrig === undefined) {
      textNode._jdfOrig = current;
    }
    const orig = textNode._jdfOrig;
    const transformed = transformJdflagString(orig);
    textNode._jdfTrans = transformed;
    textNode._jdfDone = true;

    if (textNode.textContent !== transformed) {
      textNode.textContent = transformed;
    }
  }

  function transformDirectTextNodes(el) {
    if (!el || IGNORED_TAGS.has(el.tagName) || el.isContentEditable) return;
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === Node.TEXT_NODE) {
        transformTextNode(c);
      }
    }
  }

  function transformElementTree(scope) {
    if (!scope) return;
    if (scope.nodeType === Node.ELEMENT_NODE) {
      if (isUserContent(scope)) return;
      if (scope.matches && scope.matches(UI_SELECTOR)) {
        transformDirectTextNodes(scope);
      }
      if (scope.matches && scope.matches('input[placeholder], textarea[placeholder]')) {
        transformPlaceholder(scope);
      }
      const uiElements = scope.querySelectorAll(UI_SELECTOR);
      for (let i = 0; i < uiElements.length; i++) {
        const el = uiElements[i];
        if (!isUserContent(el)) {
          transformDirectTextNodes(el);
        }
      }
      const inputs = scope.querySelectorAll('input[placeholder], textarea[placeholder]');
      for (let i = 0; i < inputs.length; i++) {
        transformPlaceholder(inputs[i]);
      }
    } else if (scope.nodeType === Node.DOCUMENT_NODE) {
      transformElementTree(scope.body || scope.documentElement);
    }
  }

  function scheduleTransform() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!isTransformActive) return;
      isTransformingDOM = true;
      try {
        const root = document.body || document.documentElement;
        if (root) {
          transformElementTree(root);
        }
      } finally {
        isTransformingDOM = false;
      }
    });
  }

  function startAlphabetObserver() {
    isTransformActive = true;
    if (alphabetObserver) return;
    alphabetObserver = new MutationObserver(mutations => {
      if (isTransformingDOM) return;
      let hasRelevant = false;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === "childList" && m.addedNodes.length > 0) {
          for (let j = 0; j < m.addedNodes.length; j++) {
            const node = m.addedNodes[j];
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.id === VIDEO_ID || node.id === WALLPAPER_ID || node.id === OVERLAY_ID || node.id === CLOCK_ID) {
                continue;
              }
              if (isUserContent(node)) {
                continue;
              }
              hasRelevant = true;
              break;
            }
          }
        }
        if (hasRelevant) break;
      }
      if (hasRelevant) {
        scheduleTransform();
      }
    });

    const target = document.body || document.documentElement;
    if (target) {
      alphabetObserver.observe(target, {
        childList: true,
        subtree: true
      });
    }
  }

  function stopAlphabetObserver() {
    isTransformActive = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (alphabetObserver) {
      alphabetObserver.disconnect();
      alphabetObserver = null;
    }
  }

  function restoreAlphabet(root) {
    stopAlphabetObserver();
    if (!root) return;
    isTransformingDOM = true;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
      let curr = walker.nextNode();
      while (curr) {
        if (curr.nodeType === Node.TEXT_NODE) {
          if (curr._jdfDone && curr._jdfOrig !== undefined) {
            if (curr.textContent !== curr._jdfOrig) {
              curr.textContent = curr._jdfOrig;
            }
            curr._jdfDone = false;
            delete curr._jdfOrig;
            delete curr._jdfTrans;
          }
        } else if (curr.nodeType === Node.ELEMENT_NODE) {
          if (curr.tagName === "INPUT" || curr.tagName === "TEXTAREA") {
            restorePlaceholder(curr);
          }
        }
        curr = walker.nextNode();
      }
    } finally {
      isTransformingDOM = false;
    }
  }

  function updateAlphabetTransform(settings) {
    const custom = (settings && settings.customTheme) || {};
    const isEnabled = settings && settings.enabled;
    const shouldTransform = Boolean(
      isEnabled && (
        custom.alphabetTransform ||
        settings.alphabetTransform ||
        settings.activeThemeId === "jdflag" ||
        custom.name === "jdflag" ||
        (custom.name && custom.name.toLowerCase().includes("jdflag"))
      )
    );

    const root = document.body || document.documentElement;
    if (shouldTransform) {
      if (root) {
        isTransformingDOM = true;
        try {
          transformElementTree(root);
        } finally {
          isTransformingDOM = false;
        }
      }
      startAlphabetObserver();
    } else {
      if (root) {
        restoreAlphabet(root);
      }
    }
  }

  function updateHeaderLogoLayout(settings) {
    const isEnabled = Boolean(settings && settings.enabled);
    const effects = (settings && settings.effects) || {};
    const custom = (settings && settings.customTheme) || {};
    const showLogoImage = isEnabled && effects.logoImage !== false;
    const customLogo = (custom.customLogo && custom.customLogo.trim() !== "") ? custom.customLogo : null;

    const fixLogo = () => {
      const logos = document.querySelectorAll(".mh-logo, #topbar-table a[href='/'], table[bgcolor='#3A3A3A'] a[href='/'], #ap-header-wrap a[href='/'], a.mh-logo");
      logos.forEach(logo => {
        if (showLogoImage) {
          logo.style.setProperty("display", "inline-flex", "important");
          logo.style.setProperty("flex-direction", "row", "important");
          logo.style.setProperty("flex-wrap", "nowrap", "important");
          logo.style.setProperty("align-items", "center", "important");
          logo.style.setProperty("justify-content", "flex-start", "important");
          logo.style.setProperty("white-space", "nowrap", "important");
          logo.style.setProperty("gap", "8px", "important");
        } else {
          logo.style.removeProperty("gap");
        }
        const imgs = logo.querySelectorAll("img");
        imgs.forEach(img => {
          if (!img.dataset.huevoOriginalSrc) {
            img.dataset.huevoOriginalSrc = img.src;
          }
          if (customLogo) {
            img.src = customLogo;
          } else if (img.dataset.huevoOriginalSrc) {
            img.src = img.dataset.huevoOriginalSrc;
          }
        });
      });
    };

    fixLogo();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fixLogo);
    }
  }

  /**
   * Применение всех настроек темы
   */
  function applySettings(settings) {
    currentSettings = settings;
    updateSoundActiveState(settings);

    const targetRoot = document.documentElement;

    if (!window.HUEVO_THEMES) return;

    if (!settings || !settings.enabled) {
      if (targetRoot) {
        targetRoot.style.removeProperty("--huevo-card-bg");
        targetRoot.style.removeProperty("--card");
        targetRoot.style.removeProperty("--dk-card");
        targetRoot.style.removeProperty("--huevo-card-backdrop");
        targetRoot.style.removeProperty("--huevo-card-blur");
        targetRoot.style.removeProperty("--huevo-radius");
        targetRoot.style.removeProperty("--radius");
        targetRoot.style.removeProperty("--huevo-header-bg");
        targetRoot.style.removeProperty("--head");
        targetRoot.style.removeProperty("--dk-head");
        targetRoot.style.removeProperty("--huevo-header-backdrop");
        targetRoot.style.removeProperty("--huevo-header-blur");
        targetRoot.style.removeProperty("--huevo-logo-color");
        targetRoot.style.removeProperty("--huevo-header-radius");
        targetRoot.removeAttribute("data-huevo-header-no-round");
        targetRoot.removeAttribute("data-huevo-badge-no-round");
        targetRoot.removeAttribute("data-huevo-chat-borders");
      }
      injectStyles("");
      updateWallpaper(null);
      updateClock(null);
      updateCrtEffect(null);
      updateSnowEffect(null);
      updateAlphabetTransform(null);
      return;
    }

    // Мгновенная синхронизация CSS-переменных активной темы на <html>:
    // полностью исключает залипание старого цвета карточек при смене пресетов!
    if (targetRoot) {
      targetRoot.style.removeProperty("--huevo-logo-color");
      const c = window.HUEVO_THEMES.getActiveColors(settings);
      const custom = (settings && settings.customTheme) || {};
      const activePreset = settings.activeThemeId && Array.isArray(window.HUEVO_THEMES.PRESET_THEMES) 
        ? window.HUEVO_THEMES.PRESET_THEMES.find(p => p.id === settings.activeThemeId) 
        : null;
      const bgVideo = (custom.bgVideo && custom.bgVideo.trim() !== "") ? custom.bgVideo : (activePreset && activePreset.bgVideo ? activePreset.bgVideo : "");
      const bgImage = (custom.bgImage && custom.bgImage.trim() !== "") ? custom.bgImage : (activePreset && activePreset.wallpaper ? activePreset.wallpaper : "");
      const hasMedia = Boolean(bgVideo || bgImage);

      let cardOpacity = typeof custom.cardOpacity === "number" ? custom.cardOpacity : (hasMedia ? 0.88 : (c.cardOpacity ?? 1));
      let cardBlur = typeof custom.cardBlur === "number" ? custom.cardBlur : (hasMedia ? 8 : (c.cardBlur ?? 0));
      const isPreset = Boolean(settings.activeThemeId && window.HUEVO_THEMES.PRESET_THEMES.some(p => p.id === settings.activeThemeId));
      if (isPreset && !hasMedia) {
        cardOpacity = c.cardOpacity ?? 1;
        cardBlur = c.cardBlur ?? 0;
      }
      const cardRgba = window.HUEVO_THEMES.hexToRgba(c.cardBg, cardOpacity);
      const radius = typeof custom.borderRadius === "number" ? custom.borderRadius : (typeof c.borderRadius === "number" ? c.borderRadius : 4);
      const blurPx = Math.min(16, Math.max(0, cardBlur));
      const backdrop = blurPx > 0 ? `blur(${blurPx}px)` : "none";

      targetRoot.style.setProperty("--huevo-card-bg", cardRgba, "important");
      targetRoot.style.setProperty("--card", cardRgba, "important");
      targetRoot.style.setProperty("--dk-card", cardRgba, "important");
      targetRoot.style.setProperty("--huevo-card-backdrop", backdrop, "important");
      targetRoot.style.setProperty("--huevo-card-blur", `${blurPx}px`, "important");
      targetRoot.style.setProperty("--huevo-radius", `${radius}px`, "important");
      targetRoot.style.setProperty("--radius", `${radius}px`, "important");

      let headerOpacity = typeof custom.headerOpacity === "number" ? custom.headerOpacity : (c.headerOpacity ?? 1);
      let headerBlur = typeof custom.headerBlur === "number" ? custom.headerBlur : (c.headerBlur ?? 0);
      if (isPreset && !hasMedia) {
        headerOpacity = c.headerOpacity ?? 1;
        headerBlur = c.headerBlur ?? 0;
      }
      const headerRgba = window.HUEVO_THEMES.hexToRgba(c.headerBg, headerOpacity);
      const hBlurPx = Math.min(25, Math.max(0, headerBlur));
      const hBackdrop = hBlurPx > 0 ? `blur(${hBlurPx}px)` : "none";

      targetRoot.style.setProperty("--huevo-header-bg", headerRgba, "important");
      targetRoot.style.setProperty("--head", headerRgba, "important");
      targetRoot.style.setProperty("--dk-head", headerRgba, "important");
      targetRoot.style.setProperty("--huevo-header-backdrop", hBackdrop, "important");
      targetRoot.style.setProperty("--huevo-header-blur", `${hBlurPx}px`, "important");

      const isHeaderRound = custom.headerRounding !== false;
      const hRadiusPx = isHeaderRound ? `${radius}px` : "0px";
      targetRoot.style.setProperty("--huevo-header-radius", hRadiusPx, "important");
      if (!isHeaderRound) {
        targetRoot.setAttribute("data-huevo-header-no-round", "true");
      } else {
        targetRoot.removeAttribute("data-huevo-header-no-round");
      }

      const isBadgeRound = custom.badgeRounding !== false;
      if (!isBadgeRound) {
        targetRoot.setAttribute("data-huevo-badge-no-round", "true");
      } else {
        targetRoot.removeAttribute("data-huevo-badge-no-round");
      }

      const isChatBorders = Boolean(custom.chatBordersEnabled);
      if (isChatBorders) {
        targetRoot.setAttribute("data-huevo-chat-borders", "true");
      } else {
        targetRoot.removeAttribute("data-huevo-chat-borders");
      }

      // Мгновенный расчет контрастного цвета логотипа
      function getL(h) {
        if (!h || typeof h !== "string") return 0.5;
        h = h.replace("#", "");
        if (h.length === 3) h = h.split("").map(x => x + x).join("");
        const r = parseInt(h.substr(0, 2), 16) / 255;
        const g = parseInt(h.substr(2, 2), 16) / 255;
        const b = parseInt(h.substr(4, 2), 16) / 255;
        const a = [r, g, b].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }
      const l1 = getL(c.accent || "#B01E1E"), l2 = getL(c.headerBg || "#3A3A3A");
      const contrastRatio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const finalLogoColor = contrastRatio < 1.3 ? (c.headerText || "#FFFFFF") : (c.accent || "#B01E1E");
      targetRoot.style.setProperty("--huevo-logo-color", finalLogoColor, "important");
    }

    const css = window.HUEVO_THEMES.generateThemeCss(settings);
    injectStyles(css);
    updateWallpaper(settings);
    updateClock(settings);
    updateCrtEffect(settings);
    updateSnowEffect(settings);
    updateAlphabetTransform(settings);
    updateHeaderLogoLayout(settings);
    updateSidebarPanel(settings);
  }

  /* ====================================================================
     Кастомные звуки уведомлений huEVO
     ==================================================================== */
  let lastSoundPlayTime = 0;
  let isAudioUnlocked = false;

  function unlockAudio() {
    if (isAudioUnlocked) return;
    isAudioUnlocked = true;
    try {
      const a = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
      a.volume = 0.001;
      a.play().then(() => a.pause()).catch(() => {});
    } catch(e) {}
  }

  ['click', 'keydown', 'pointerdown', 'touchstart'].forEach(ev => {
    window.addEventListener(ev, unlockAudio, { once: true, passive: true });
  });

  function updateSoundActiveState(settings) {
    const sound = (settings && settings.sound) || (window.HUEVO_THEMES && window.HUEVO_THEMES.DEFAULT_SETTINGS.sound);
    const isEnabled = Boolean(settings && settings.enabled);
    const isCustomActive = Boolean(isEnabled && sound && sound.enabled !== false && sound.soundId !== "default");

    window._huevoSoundCustomActive = isCustomActive;
    if (document.documentElement) {
      document.documentElement.setAttribute("data-huevo-sound-active", isCustomActive ? "true" : "false");
    }

    try {
      if (typeof window.wrappedJSObject !== "undefined" && window.wrappedJSObject) {
        window.wrappedJSObject._huevoSoundCustomActive = isCustomActive;
      }
    } catch(e) {}

    window.postMessage({
      type: "HUEVO_SET_SOUND_ACTIVE",
      active: isCustomActive
    }, "*");
  }

  let lastUserSendActionTime = 0;
  function markUserSendAction() {
    lastUserSendActionTime = Date.now();
  }

  // Фиксация действий отправки сообщений пользователем в чатах
  document.addEventListener("keydown", ev => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      const el = ev.target;
      if (el && (
        el.tagName === "TEXTAREA" ||
        el.tagName === "INPUT" ||
        el.isContentEditable ||
        (el.closest && (el.closest("#chat-form") || el.closest("#chat-box") || el.closest("[class*='chat']") || el.closest("[id*='chat']") || el.closest("[class*='im-']") || el.closest("[id*='im-']")))
      )) {
        markUserSendAction();
      }
    }
  }, true);

  document.addEventListener("submit", () => {
    markUserSendAction();
  }, true);

  document.addEventListener("click", ev => {
    const el = ev.target;
    if (el && el.closest && (
      el.closest("#chat-form button") ||
      el.closest(".vk-chat-row button") ||
      el.closest("[id*='send']") ||
      el.closest("[class*='send']") ||
      el.closest(".im-send-btn") ||
      el.closest("#im-send-btn")
    )) {
      markUserSendAction();
    }
  }, true);

  // ====================================================================
  // Реестр и проверка замьюченных (беззвучных) чатов huEVO
  // ====================================================================
  const MUTED_CHATS_STORAGE_KEY = "huevo_themes_muted_chats";
  const mutedChatsSet = new Set();

  function loadMutedChats() {
    try {
      const raw = sessionStorage.getItem(MUTED_CHATS_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach(id => mutedChatsSet.add(String(id).toLowerCase()));
        }
      }
    } catch(e) {}
  }
  loadMutedChats();

  function saveMutedChats() {
    try {
      sessionStorage.setItem(MUTED_CHATS_STORAGE_KEY, JSON.stringify(Array.from(mutedChatsSet)));
    } catch(e) {}
  }

  function isChatIdOrSenderMuted(idOrSender) {
    if (!idOrSender) return false;
    const s = String(idOrSender).trim().toLowerCase().replace(/^\/+/, '');
    if (!s) return false;
    if (mutedChatsSet.has(s)) return true;
    if (mutedChatsSet.has('chat:' + s)) return true;
    if (mutedChatsSet.has('chat_' + s)) return true;
    if (mutedChatsSet.has('gc:' + s)) return true;
    if (mutedChatsSet.has('user:' + s)) return true;
    return false;
  }

  function isSiteSoundOff() {
    try {
      if (typeof window.HUE_SOUND_OFF === "boolean" && window.HUE_SOUND_OFF) return true;
      if (typeof window.wrappedJSObject !== "undefined" && window.wrappedJSObject && window.wrappedJSObject.HUE_SOUND_OFF === true) return true;
      if (localStorage.getItem("hue_sound_off") === "true" || localStorage.getItem("hue_sound_off") === "1") return true;
      if (localStorage.getItem("sound_off") === "true" || localStorage.getItem("sound_off") === "1") return true;
      if (localStorage.getItem("hue_sound") === "0" || localStorage.getItem("hue_sound") === "false") return true;
      if (document.body && (document.body.classList.contains("hue-sound-off") || document.body.hasAttribute("data-sound-off"))) return true;
    } catch(e) {}
    return false;
  }

  function isCurrentChatMuted() {
    try {
      // 1. Проверяем общую глобальную настройку звука сайта
      if (isSiteSoundOff()) return true;

      // 2. Плашка выключенных уведомлений в беседе (.gc-mute-bar)
      const gcMute = document.querySelector('.gc-mute-bar');
      if (gcMute && !gcMute.hasAttribute('hidden') && gcMute.style.display !== 'none' && !gcMute.closest('[hidden]')) {
        return true;
      }

      // 3. Выключенный колокольчик уведомлений (.hue-bell.is-off, .hue-ico-bell-off)
      const bellOff = document.querySelector('.hue-bell.is-off, .hue-ico-bell-off, form[data-bell-form] .hue-bell.is-off');
      if (bellOff && !bellOff.closest('[hidden]') && bellOff.offsetParent !== null) {
        return true;
      }

      // 4. Иконка беззвучного режима в шапке открытого чата
      const chatHeadMuted = document.querySelector(
        '.vk-chat-head .vk-muted-ico, .vk-chat-head .hue-ico-muted, ' +
        '.vk-chat-head-who .vk-muted-ico, .vk-chat-head-who .hue-ico-muted, ' +
        '.vk-chat-extra .vk-muted-ico, .vk-chat-extra .hue-ico-muted, ' +
        '.gc-info .vk-muted-ico, .gc-info .hue-ico-muted, ' +
        '#chat-box .vk-muted-ico, #chat-box .hue-ico-muted, ' +
        '.im-page--header .vk-muted-ico, .im-page--header .hue-ico-muted'
      );
      if (chatHeadMuted && !chatHeadMuted.closest('[hidden]')) {
        return true;
      }

      // 5. Кнопки и действия в шапке чата или панели беседы с предложением "Включить уведомления" (означает, что сейчас они отключены)
      const chatActions = document.querySelectorAll(
        '.gc-info-acts a, .gc-info-acts button, .vk-chat-head a, .vk-chat-head button, ' +
        '.vk-chat-actions a, .vk-chat-actions button, [data-chat-mute], [href*="mute"], [action*="mute"]'
      );
      for (let i = 0; i < chatActions.length; i++) {
        const btn = chatActions[i];
        if (btn.closest('[hidden]')) continue;
        const txt = ((btn.textContent || '') + ' ' + (btn.getAttribute('title') || '') + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
        if (
          txt.includes('включить уведомления') ||
          txt.includes('включить звук') ||
          txt.includes('включить оповещения') ||
          txt.includes('уведомления отключены') ||
          txt.includes('уведомления выключены') ||
          txt.includes('звук отключен') ||
          txt.includes('звук выключен') ||
          txt.includes('без звука')
        ) {
          return true;
        }
      }

      // 6. Активный диалог в списке диалогов помечен как замьюченный
      const activeDlg = document.querySelector(
        '.vk-dlg.active, .vk-dlg.selected, .nim-dialog--selected, .nim-dialog_selected, ' +
        '.im-dialog-selected, [data-peer].active, [data-peer].selected, tr.active'
      );
      if (activeDlg) {
        if (
          activeDlg.querySelector('.vk-muted-ico, .hue-ico-muted, .hue-ico-bell-off, [class*="muted"], [class*="bell-off"]') ||
          activeDlg.classList.contains('nim-dialog_muted') ||
          activeDlg.classList.contains('nim-dialog--muted') ||
          activeDlg.classList.contains('dialog_muted') ||
          activeDlg.getAttribute('data-muted') === '1' ||
          activeDlg.getAttribute('data-muted') === 'true'
        ) {
          return true;
        }
      }

      // 7. Проверка по нашему реестру известных замьюченных чатов
      const path = location.pathname.replace(/^\/+/, '').toLowerCase();
      if (path && (mutedChatsSet.has(path) || mutedChatsSet.has('chat:' + path))) return true;
      const mChat = path.match(/chat\/(\d+)/i) || location.search.match(/sel=c?(\d+)/i);
      if (mChat && (mutedChatsSet.has(mChat[1]) || mutedChatsSet.has('chat:' + mChat[1]) || mutedChatsSet.has('gc:' + mChat[1]))) return true;

      try {
        if (window.hueActiveGroupChatId != null) {
          const gid = String(window.hueActiveGroupChatId);
          if (mutedChatsSet.has(gid) || mutedChatsSet.has('chat:' + gid) || mutedChatsSet.has('gc:' + gid)) return true;
        }
        if (window.hueActiveChatPartner) {
          const partner = String(window.hueActiveChatPartner).toLowerCase();
          if (mutedChatsSet.has(partner)) return true;
        }
      } catch(e) {}

    } catch(e) {}
    return false;
  }

  function isChatMuted(targetEl) {
    try {
      if (isSiteSoundOff()) return true;
      if (isCurrentChatMuted()) return true;

      if (targetEl && targetEl.nodeType === Node.ELEMENT_NODE) {
        // Если элемент находится внутри замьюченного контейнера
        if (targetEl.closest && targetEl.closest('.gc-mute-bar:not([hidden]), .hue-bell.is-off, [data-muted="1"], [data-muted="true"], [data-chat-muted="true"], [data-chat-muted="1"]')) {
          return true;
        }

        // Если это карточка диалога в списке
        const dlg = targetEl.closest ? targetEl.closest('.vk-dlg, .nim-dialog, .dialog_row, [data-peer], table.dialog_row, .im-dialog-item') : null;
        if (dlg) {
          if (
            dlg.querySelector('.vk-muted-ico, .hue-ico-muted, .hue-ico-bell-off, [class*="muted"], [class*="bell-off"]') ||
            dlg.classList.contains('nim-dialog_muted') ||
            dlg.classList.contains('nim-dialog--muted') ||
            dlg.classList.contains('dialog_muted') ||
            dlg.getAttribute('data-muted') === '1' ||
            dlg.getAttribute('data-muted') === 'true'
          ) {
            return true;
          }
        }

        // Если это всплывающее уведомление .hue-popup
        const popup = (targetEl.classList && targetEl.classList.contains('hue-popup')) ? targetEl : (targetEl.closest ? targetEl.closest('.hue-popup') : null);
        if (popup) {
          if (popup.querySelector('.vk-muted-ico, .hue-ico-muted, .hue-ico-bell-off, [class*="muted"], [class*="bell-off"]')) {
            return true;
          }
          const chatId = popup.getAttribute('data-chat');
          const sender = popup.getAttribute('data-sender');
          const peer = popup.getAttribute('data-peer') || popup.getAttribute('data-id') || popup.getAttribute('data-dialog');
          if (chatId && isChatIdOrSenderMuted(chatId)) return true;
          if (sender && isChatIdOrSenderMuted(sender)) return true;
          if (peer && isChatIdOrSenderMuted(peer)) return true;

          const links = popup.querySelectorAll('a[href]');
          for (let i = 0; i < links.length; i++) {
            const href = (links[i].getAttribute('href') || '').replace(/^\/+/, '');
            if (isChatIdOrSenderMuted(href)) return true;
            const mChat = href.match(/chat\/(\d+)/i) || href.match(/sel=c?(\d+)/i);
            if (mChat && (isChatIdOrSenderMuted(mChat[1]) || isChatIdOrSenderMuted('chat:' + mChat[1]) || isChatIdOrSenderMuted('gc:' + mChat[1]))) return true;
            const mUser = href.match(/sel=(\d+)/i) || href.match(/id(\d+)/i);
            if (mUser && (isChatIdOrSenderMuted(mUser[1]) || isChatIdOrSenderMuted('user:' + mUser[1]))) return true;
          }
        }

        // Если у самого элемента есть data-peer или data-chat или ссылка
        const elPeer = targetEl.getAttribute && (targetEl.getAttribute('data-peer') || targetEl.getAttribute('data-chat') || targetEl.getAttribute('data-dialog'));
        if (elPeer && isChatIdOrSenderMuted(elPeer)) {
          return true;
        }
      }
    } catch(e) {}
    return false;
  }

  function scanMutedDialogs() {
    try {
      const dialogs = document.querySelectorAll('.vk-dlg, .nim-dialog, .dialog_row, [data-peer], table.dialog_row');
      dialogs.forEach(dlg => {
        const isMuted = Boolean(
          dlg.querySelector('.vk-muted-ico, .hue-ico-muted, .hue-ico-bell-off, [class*="muted"], [class*="bell-off"]') ||
          dlg.classList.contains('nim-dialog_muted') ||
          dlg.classList.contains('nim-dialog--muted') ||
          dlg.classList.contains('dialog_muted') ||
          dlg.getAttribute('data-muted') === '1' ||
          dlg.getAttribute('data-muted') === 'true'
        );

        const peer = dlg.getAttribute('data-peer') || dlg.getAttribute('data-id') || '';
        const href = (dlg.getAttribute('href') || (dlg.querySelector('a') && dlg.querySelector('a').getAttribute('href')) || '').replace(/^\/+/, '');

        const identifiers = [];
        if (peer) identifiers.push(peer);
        if (href) {
          identifiers.push(href);
          const mChat = href.match(/chat\/(\d+)/i) || href.match(/sel=c?(\d+)/i);
          if (mChat) identifiers.push(mChat[1], 'chat:' + mChat[1], 'gc:' + mChat[1]);
          const mUser = href.match(/sel=(\d+)/i);
          if (mUser) identifiers.push(mUser[1], 'user:' + mUser[1]);
        }

        identifiers.forEach(id => {
          const key = String(id).toLowerCase();
          if (isMuted) {
            mutedChatsSet.add(key);
          } else if (mutedChatsSet.has(key)) {
            mutedChatsSet.delete(key);
          }
        });
      });

      if (isCurrentChatMuted()) {
        const path = location.pathname.replace(/^\/+/, '').toLowerCase();
        if (path) mutedChatsSet.add(path);
        const mChat = path.match(/chat\/(\d+)/i) || location.search.match(/sel=c?(\d+)/i);
        if (mChat) {
          mutedChatsSet.add(mChat[1]);
          mutedChatsSet.add('chat:' + mChat[1]);
          mutedChatsSet.add('gc:' + mChat[1]);
        }
        try {
          if (window.hueActiveGroupChatId != null) {
            const gid = String(window.hueActiveGroupChatId);
            mutedChatsSet.add(gid);
            mutedChatsSet.add('chat:' + gid);
            mutedChatsSet.add('gc:' + gid);
          }
          if (window.hueActiveChatPartner) {
            mutedChatsSet.add(String(window.hueActiveChatPartner).toLowerCase());
          }
        } catch(e) {}
      }

      saveMutedChats();
    } catch(e) {}
  }

  // Отслеживание действий выключения/включения звука пользователем
  document.addEventListener("click", ev => {
    const el = ev.target;
    if (!el) return;
    if (el.closest && (el.closest('.gc-mute-bar') || el.closest('[data-bell-form]') || el.closest('.hue-bell') || el.closest('[data-chat-mute]') || el.closest('.gc-info-acts'))) {
      setTimeout(scanMutedDialogs, 150);
      setTimeout(scanMutedDialogs, 800);
    }
  }, true);

  document.addEventListener("submit", ev => {
    const form = ev.target;
    if (form && (form.hasAttribute('data-bell-form') || (form.action && form.action.includes('mute')))) {
      setTimeout(scanMutedDialogs, 150);
      setTimeout(scanMutedDialogs, 800);
    }
  }, true);

  // Обновление состояния при смене страниц через PJAX / SPA
  document.addEventListener("hue:swapped", () => {
    setTimeout(scanMutedDialogs, 100);
  });
  window.addEventListener("popstate", () => {
    setTimeout(scanMutedDialogs, 100);
  });

  function triggerCustomNotificationSound(force = false) {
    if (!force && isSiteSoundOff()) return;
    if (!force && isCurrentChatMuted()) return;

    const now = Date.now();
    // Если пользователь только что отправил сообщение (в течение 2.5 сек), не играем входящий звук!
    if (!force && (now - lastUserSendActionTime < 2500)) {
      return;
    }

    if (now - lastSoundPlayTime < 350) return; // Debounce 350ms
    lastSoundPlayTime = now;

    const sound = (currentSettings && currentSettings.sound) || (window.HUEVO_THEMES && window.HUEVO_THEMES.DEFAULT_SETTINGS.sound);
    if (!sound || sound.enabled === false) return;
    if (sound.soundId === "mute" || sound.soundId === "default") return;

    if (window.HUEVO_THEMES && window.HUEVO_THEMES.playNotificationSound) {
      window.HUEVO_THEMES.playNotificationSound(sound);
    }
  }

  // 1. Инжекция перехватчика звука в контекст страницы huEVO
  function patchFirefoxWrappedWindow() {
    try {
      if (typeof window.wrappedJSObject !== "undefined" && window.wrappedJSObject) {
        const w = window.wrappedJSObject;
        if (w.hueSounds && !w.hueSounds._huevoPatched) {
          const orig = w.hueSounds.play;
          w.hueSounds.play = function(name) {
            const sName = String(name || "message").toLowerCase();
            const isOutgoing = sName.includes("send") || sName.includes("out") || sName.includes("sent");
            const isMuted = isCurrentChatMuted() || isSiteSoundOff();
            if (!isOutgoing && !isMuted) {
              window.postMessage({
                type: "HUEVO_NOTIFY_SOUND_TRIGGERED",
                soundType: sName
              }, "*");
            }
            const isCustom = document.documentElement && document.documentElement.getAttribute("data-huevo-sound-active") !== "false";
            if (isCustom && !isOutgoing) {
              return;
            }
            return orig.apply(this, arguments);
          };
          w.hueSounds._huevoPatched = true;
        }
      }
    } catch(e) {}
  }

  function injectAudioHook() {
    if (document.documentElement) {
      document.documentElement.setAttribute("data-huevo-sound-active", "true");
    }

    const script = document.createElement("script");
    script.id = "huevo-audio-hook-script";
    script.textContent = `
      (function() {
        if (window._huevoAudioHookInstalled) return;
        window._huevoAudioHookInstalled = true;

        function isCustomActive() {
          if (typeof window._huevoSoundCustomActive === "boolean") return window._huevoSoundCustomActive;
          const attr = document.documentElement && document.documentElement.getAttribute("data-huevo-sound-active");
          if (attr !== null) return attr !== "false";
          return true;
        }

        function isPageChatMuted() {
          try {
            if (window.HUE_SOUND_OFF === true) return true;
            if (localStorage.getItem("hue_sound_off") === "true" || localStorage.getItem("hue_sound_off") === "1") return true;
            if (localStorage.getItem("sound_off") === "true" || localStorage.getItem("sound_off") === "1") return true;
            if (localStorage.getItem("hue_sound") === "0" || localStorage.getItem("hue_sound") === "false") return true;
            if (document.body && (document.body.classList.contains("hue-sound-off") || document.body.hasAttribute("data-sound-off"))) return true;
            const gcMute = document.querySelector('.gc-mute-bar');
            if (gcMute && !gcMute.hasAttribute('hidden') && gcMute.style.display !== 'none' && !gcMute.closest('[hidden]')) {
              return true;
            }
            const bellOff = document.querySelector('.hue-bell.is-off, .hue-ico-bell-off, form[data-bell-form] .hue-bell.is-off');
            if (bellOff && !bellOff.closest('[hidden]') && bellOff.offsetParent !== null) {
              return true;
            }
            const chatHeadMuted = document.querySelector(
              '.vk-chat-head .vk-muted-ico, .vk-chat-head .hue-ico-muted, ' +
              '.vk-chat-head-who .vk-muted-ico, .vk-chat-head-who .hue-ico-muted, ' +
              '.vk-chat-extra .vk-muted-ico, .vk-chat-extra .hue-ico-muted, ' +
              '.gc-info .vk-muted-ico, .gc-info .hue-ico-muted, #chat-box .vk-muted-ico, #chat-box .hue-ico-muted, ' +
              '.im-page--header .vk-muted-ico, .im-page--header .hue-ico-muted'
            );
            if (chatHeadMuted && !chatHeadMuted.closest('[hidden]')) {
              return true;
            }
            const chatActions = document.querySelectorAll('.gc-info-acts a, .gc-info-acts button, .vk-chat-head a, .vk-chat-head button, .vk-chat-actions a, .vk-chat-actions button, [data-chat-mute], [href*="mute"], [action*="mute"]');
            for (let i = 0; i < chatActions.length; i++) {
              const btn = chatActions[i];
              if (btn.closest('[hidden]')) continue;
              const txt = ((btn.textContent || '') + ' ' + (btn.getAttribute('title') || '') + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
              if (
                txt.includes('включить уведомления') ||
                txt.includes('включить звук') ||
                txt.includes('включить оповещения') ||
                txt.includes('уведомления отключены') ||
                txt.includes('уведомления выключены') ||
                txt.includes('звук отключен') ||
                txt.includes('звук выключен') ||
                txt.includes('без звука')
              ) {
                return true;
              }
            }
            const activeDlg = document.querySelector('.vk-dlg.active, .vk-dlg.selected, .nim-dialog--selected, .nim-dialog_selected, .im-dialog-selected, [data-peer].active, [data-peer].selected, tr.active');
            if (activeDlg) {
              if (
                activeDlg.querySelector('.vk-muted-ico, .hue-ico-muted, .hue-ico-bell-off, [class*="muted"], [class*="bell-off"]') ||
                activeDlg.classList.contains('nim-dialog_muted') ||
                activeDlg.classList.contains('nim-dialog--muted') ||
                activeDlg.classList.contains('dialog_muted') ||
                activeDlg.getAttribute('data-muted') === '1' ||
                activeDlg.getAttribute('data-muted') === 'true'
              ) {
                return true;
              }
            }
            try {
              const raw = sessionStorage.getItem("huevo_themes_muted_chats");
              if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) {
                  const path = location.pathname.replace(/^\\/+/, '').toLowerCase();
                  if (path && list.indexOf(path) !== -1) return true;
                  const mChat = path.match(/chat\\/(\\d+)/i) || location.search.match(/sel=c?(\\d+)/i);
                  if (mChat && list.indexOf(mChat[1]) !== -1) return true;
                  if (window.hueActiveGroupChatId != null && list.indexOf(String(window.hueActiveGroupChatId)) !== -1) return true;
                  if (window.hueActiveChatPartner && list.indexOf(String(window.hueActiveChatPartner).toLowerCase()) !== -1) return true;
                }
              }
            } catch(e) {}
          } catch(e) {}
          return false;
        }

        let rawHueSounds = window.hueSounds;

        function patchHueSounds(hs) {
          if (!hs || hs._huevoPatched) return hs;
          if (typeof hs.play === 'function') {
            const originalPlay = hs.play;
            hs.play = function(name) {
              const sName = String(name || "message").toLowerCase();
              const isOutgoing = sName.includes("send") || sName.includes("out") || sName.includes("sent");
              const isMuted = isPageChatMuted();

              if (!isOutgoing && !isMuted) {
                window.postMessage({
                  type: "HUEVO_NOTIFY_SOUND_TRIGGERED",
                  soundType: sName
                }, "*");

                try {
                  window.dispatchEvent(new CustomEvent("HUEVO_THEME_SOUND_TRIGGER", {
                    detail: { soundType: sName }
                  }));
                } catch(e) {}
              }

              if (isCustomActive() && !isOutgoing) {
                return;
              }
              return originalPlay.apply(this, arguments);
            };
            hs._huevoPatched = true;
          }
          return hs;
        }

        if (rawHueSounds) {
          patchHueSounds(rawHueSounds);
        }

        try {
          Object.defineProperty(window, 'hueSounds', {
            configurable: true,
            enumerable: true,
            get: function() {
              return rawHueSounds;
            },
            set: function(val) {
              rawHueSounds = patchHueSounds(val);
            }
          });
        } catch(e) {}

        const patchTimer = setInterval(function() {
          if (window.hueSounds && !window.hueSounds._huevoPatched) {
            patchHueSounds(window.hueSounds);
          }
        }, 100);
        setTimeout(function() { clearInterval(patchTimer); }, 15000);

        // Перехват fetch для msgg.wav и notify.wav
        const origFetch = window.fetch;
        if (typeof origFetch === 'function') {
          window.fetch = function(input, init) {
            try {
              const url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
              if (typeof url === 'string') {
                const lower = url.toLowerCase();
                if ((lower.includes('/static/sounds/msgg.wav') || lower.includes('/static/sounds/notify.wav')) && isCustomActive()) {
                  const silentWav = new Uint8Array([
                    0x52,0x49,0x46,0x46, 0x24,0x00,0x00,0x00, 0x57,0x41,0x56,0x45,
                    0x66,0x6d,0x74,0x20, 0x10,0x00,0x00,0x00, 0x01,0x00, 0x01,0x00,
                    0x44,0xac,0x00,0x00, 0x44,0xac,0x00,0x00, 0x01,0x00, 0x08,0x00,
                    0x64,0x61,0x74,0x61, 0x00,0x00,0x00,0x00
                  ]);
                  return Promise.resolve(new Response(silentWav.buffer, {
                    status: 200,
                    headers: { 'Content-Type': 'audio/wav' }
                  }));
                }
              }
            } catch(e) {}
            return origFetch.apply(this, arguments);
          };
        }

        // Перехват Audio() конструктора для msgg.wav / notify.wav
        const OrigAudio = window.Audio;
        if (OrigAudio) {
          window.Audio = function(src) {
            const a = new OrigAudio(src);
            try {
              const s = String(src || '').toLowerCase();
              if ((s.includes('msgg.wav') || s.includes('notify.wav')) && isCustomActive()) {
                a.muted = true;
                a.volume = 0;
              }
            } catch(e) {}
            return a;
          };
          window.Audio.prototype = OrigAudio.prototype;
        }

        window.addEventListener("message", function(e) {
          if (e && e.data && e.data.type === "HUEVO_SET_SOUND_ACTIVE") {
            window._huevoSoundCustomActive = Boolean(e.data.active);
          }
        });
      })();
    `;

    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(script);
      script.remove();
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        (document.head || document.documentElement).appendChild(script);
        script.remove();
      });
    }

    patchFirefoxWrappedWindow();
    const interval = setInterval(patchFirefoxWrappedWindow, 200);
    setTimeout(() => clearInterval(interval), 15000);
  }

  try {
    injectAudioHook();
  } catch(e) {}

  window.addEventListener("message", ev => {
    if (ev && ev.data && ev.data.type === "HUEVO_NOTIFY_SOUND_TRIGGERED") {
      const sType = String(ev.data.soundType || "").toLowerCase();
      if (sType.includes("send") || sType.includes("out") || sType.includes("sent")) return;
      if (isSiteSoundOff() || isCurrentChatMuted()) return;
      triggerCustomNotificationSound();
    }
  });

  window.addEventListener("HUEVO_THEME_SOUND_TRIGGER", ev => {
    const sType = String((ev && ev.detail && ev.detail.soundType) || "").toLowerCase();
    if (sType.includes("send") || sType.includes("out") || sType.includes("sent")) return;
    if (isSiteSoundOff() || isCurrentChatMuted()) return;
    triggerCustomNotificationSound();
  });

  // Функция глубокой проверки исходящего сообщения
  function isOutgoingMessage(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const classStr = ((el.className || "") + " " + (el.getAttribute("class") || "")).toLowerCase();
    if (
      classStr.includes("mine") ||
      classStr.includes("out") ||
      classStr.includes("self") ||
      classStr.includes("my-") ||
      classStr.includes("my_") ||
      classStr.includes("sent") ||
      classStr.includes("from-me")
    ) {
      return true;
    }
    if (el.getAttribute("align") === "right") return true;
    if (el.querySelector) {
      const match = el.querySelector(
        '[class*="mine"], [class*="out"], [class*="self"], [class*="my"], [class*="sent"], [align="right"], td[align="right"]'
      );
      if (match) return true;
    }
    if (el.closest) {
      const parent = el.closest('[class*="mine"], [class*="out"], [class*="self"], [align="right"]');
      if (parent) return true;
    }
    return false;
  }

  // 2. Отслеживание всплывающих уведомлений huEVO и сообщений в DOM
  let domNotificationObserver = null;
  let scanMutedDebounceTimer = null;
  function triggerMutedDialogsScan() {
    if (scanMutedDebounceTimer) return;
    scanMutedDebounceTimer = setTimeout(() => {
      scanMutedDebounceTimer = null;
      scanMutedDialogs();
    }, 400);
  }

  function initDomNotificationObserver() {
    if (domNotificationObserver) return;
    const target = document.body || document.documentElement;
    if (!target) return;

    domNotificationObserver = new MutationObserver(mutations => {
      for (let mIdx = 0; mIdx < mutations.length; mIdx++) {
        const m = mutations[mIdx];
        if (m.addedNodes && m.addedNodes.length > 0) {
          for (let i = 0; i < m.addedNodes.length; i++) {
            const node = m.addedNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node;

              // При появлении или обновлении списка диалогов/плашек замьюченности обновляем реестр
              if (el.querySelector && el.querySelector('.vk-dlg, .nim-dialog, .dialog_row, .gc-mute-bar, .hue-bell, [data-chat-mute]')) {
                triggerMutedDialogsScan();
              }

              // 1. Всплывающее уведомление huEVO (.hue-popup)
              if (el.classList && el.classList.contains("hue-popup")) {
                if (isChatMuted(el)) return;
                if (Date.now() - lastUserSendActionTime >= 2500) {
                  triggerCustomNotificationSound();
                }
                return;
              }
              if (el.querySelector && el.querySelector(".hue-popup")) {
                const pop = el.querySelector(".hue-popup");
                if (isChatMuted(pop)) return;
                if (Date.now() - lastUserSendActionTime >= 2500) {
                  triggerCustomNotificationSound();
                }
                return;
              }

              // 2. Новое сообщение в чате
              const isMsg = (el.id && (el.id.startsWith("msg-") || el.id.startsWith("msg_"))) ||
                            (el.classList && (
                              el.classList.contains("vk-msg-row") ||
                              el.classList.contains("hue-msg-row") ||
                              el.classList.contains("im-mess") ||
                              el.classList.contains("im_mess") ||
                              el.classList.contains("im_msg") ||
                              el.classList.contains("im-mess-stack")
                            ));
              if (isMsg) {
                // Если чат замьючен или отключен глобальный звук — ни в коем случае не играем звук!
                if (isChatMuted(el)) {
                  return;
                }
                // Если это исходящее сообщение пользователя или отправка была менее 2.5 сек назад — игнорируем!
                if (isOutgoingMessage(el) || (Date.now() - lastUserSendActionTime < 2500)) {
                  return;
                }
                triggerCustomNotificationSound();
                return;
              }

              // Проверка, если в DOM был добавлен контейнер, содержащий новое сообщение
              if (el.querySelector) {
                const subMsg = el.querySelector('.vk-msg-row, .hue-msg-row, .im-mess, .im_mess, [id^="msg-"], [id^="msg_"]');
                if (subMsg) {
                  if (isChatMuted(subMsg)) return;
                  if (isOutgoingMessage(subMsg) || (Date.now() - lastUserSendActionTime < 2500)) return;
                  triggerCustomNotificationSound();
                  return;
                }
              }
            }
          }
        }
      }
    });

    domNotificationObserver.observe(target, { childList: true, subtree: true });
  }

  // 3. Отслеживание счетчика уведомлений в шапке (mh-notif-count / mh-bell-badge)
  let prevNotifCount = -1;
  function checkNotificationBadge() {
    if (isSiteSoundOff()) return;
    // ВАЖНО: Проверяем исключительно колокольчик уведомлений в шапке, но не бейджи чатов (.vk-badge)!
    const badge = document.getElementById("mh-notif-count") ||
                  document.getElementById("mh-bell-badge") ||
                  document.querySelector(".mh-notif-badge, .mh-bell-badge");
    if (!badge) return;
    const count = parseInt(badge.textContent.trim(), 10) || 0;
    if (prevNotifCount >= 0 && count > prevNotifCount) {
      triggerCustomNotificationSound();
    }
    prevNotifCount = count;
  }

  // 4. Корректное скрытие панели реакций при выборе или клике мимо
  let reactionPickerCloserInitialized = false;
  function initReactionPickerCloser() {
    if (reactionPickerCloserInitialized) return;
    reactionPickerCloserInitialized = true;
    function hidePicker() {
      const pick = document.getElementById("hue-react-pick");
      if (pick) {
        pick.style.setProperty("display", "none", "important");
        pick.classList.add("hidden");
        pick.classList.add("d-none");
      }
    }

    document.addEventListener("click", ev => {
      const pick = document.getElementById("hue-react-pick");
      if (!pick) return;

      // Если кликнули на саму реакцию (кнопку внутри панели)
      if (ev.target && (ev.target.closest("#hue-react-pick button") || ev.target.closest("#hue-react-pick"))) {
        // Скрываем немедленно и контрольно с небольшой задержкой (чтобы клик успел зарегистрироваться соцсетью)
        setTimeout(hidePicker, 40);
        setTimeout(hidePicker, 180);
        return;
      }

      // Если кликнули мимо панели реакций и не по кнопке открытия реакций
      if (ev.target && !ev.target.closest("#hue-react-btn") && !ev.target.closest("[id*='react']") && !ev.target.closest("[class*='react']")) {
        hidePicker();
      }
    }, true);

    document.addEventListener("keydown", ev => {
      if (ev.key === "Escape") {
        hidePicker();
      }
    }, true);
  }

  // 5. Единая панель бокового меню (ТОЛЬКО при включенной настройке customTheme.sidebarCard)
  function updateSidebarPanel(settings) {
    const s = settings || currentSettings;
    const custom = (s && s.customTheme) || {};
    const isEnabled = Boolean(s && s.enabled);
    let activePreset = null;
    if (s && s.activeThemeId && window.HUEVO_THEMES && Array.isArray(window.HUEVO_THEMES.PRESET_THEMES)) {
      activePreset = window.HUEVO_THEMES.PRESET_THEMES.find(p => p.id === s.activeThemeId);
    }
    const isSidebarCard = isEnabled && (custom.sidebarCard === true || (activePreset && activePreset.effects && activePreset.effects.sidebarCard === true));

    const cell = document.getElementById("sidebar-cell");
    const targetRoot = document.documentElement;

    if (!isSidebarCard) {
      if (targetRoot) {
        targetRoot.removeAttribute("data-huevo-sidebar-card");
      }
      if (cell) {
        cell.style.removeProperty("vertical-align");
        cell.style.removeProperty("padding-top");
        cell.style.removeProperty("width");
        cell.style.removeProperty("min-width");
        cell.style.removeProperty("height");
        const panel = document.getElementById("huevo-sidebar-panel");
        if (panel) {
          while (panel.firstChild) {
            cell.insertBefore(panel.firstChild, panel);
          }
          panel.remove();
        }
      }
      return;
    }

    if (targetRoot) {
      targetRoot.setAttribute("data-huevo-sidebar-card", "true");
    }

    if (!cell) return;
    const nav = document.getElementById("sidebar-nav");
    if (!nav) return;

    cell.style.setProperty("vertical-align", "top", "important");
    cell.style.setProperty("padding-top", "13px", "important");
    cell.style.setProperty("width", "185px", "important");
    cell.style.setProperty("min-width", "185px", "important");
    cell.style.removeProperty("height");

    let panel = document.getElementById("huevo-sidebar-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "huevo-sidebar-panel";
      panel.className = "huevo-sidebar-panel";
      while (cell.firstChild) {
        panel.appendChild(cell.firstChild);
      }
      cell.appendChild(panel);
    } else {
      const orphans = Array.from(cell.childNodes).filter(n => n !== panel);
      for (const node of orphans) {
        panel.appendChild(node);
      }
    }
    panel.style.setProperty("box-sizing", "border-box", "important");
    panel.style.setProperty("margin-top", "0px", "important");
    panel.style.setProperty("width", "100%", "important");
    panel.style.setProperty("min-width", "185px", "important");
    panel.style.setProperty("padding", "12px 14px", "important");
    panel.style.removeProperty("height");
    panel.style.removeProperty("min-height");
  }

  let badgeIntervalStarted = false;
  function startBadgeCheckInterval() {
    if (badgeIntervalStarted) return;
    badgeIntervalStarted = true;
    setInterval(checkNotificationBadge, 2500);
  }

  function initAppFeatures() {
    if (currentSettings) {
      updateAlphabetTransform(currentSettings);
      updateHeaderLogoLayout(currentSettings);
    }
    updateSidebarPanel(currentSettings);
    scanMutedDialogs();
    initDomNotificationObserver();
    initReactionPickerCloser();
    startBadgeCheckInterval();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initAppFeatures();
    });
  } else {
    initAppFeatures();
  }

  window.addEventListener("load", () => {
    initAppFeatures();
  });

  let pendingSettings = null;
  let applyRafId = null;

  function scheduleApplySettings(settings) {
    pendingSettings = settings;
    if (applyRafId) return;
    applyRafId = requestAnimationFrame(() => {
      applyRafId = null;
      if (pendingSettings) {
        applySettings(pendingSettings);
        pendingSettings = null;
      }
    });
  }

  function handleLiveUpdate(msg) {
    if (!msg || !msg.key) return;
    const targetRoot = document.documentElement;
    if (!targetRoot) return;

    switch (msg.key) {
      case "bgOpacity": {
        const vid = document.getElementById(VIDEO_ID);
        const img = document.getElementById(WALLPAPER_ID);
        const val = String(msg.value);
        if (vid) vid.style.setProperty("opacity", val, "important");
        if (img) img.style.setProperty("opacity", val, "important");
        break;
      }
      case "bgOverlay": {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
          overlay.style.setProperty("background-color", `rgba(0, 0, 0, ${msg.value})`, "important");
        }
        break;
      }
      case "bgFilter": {
        const vid = document.getElementById(VIDEO_ID);
        const img = document.getElementById(WALLPAPER_ID);
        const blur = typeof msg.blur === "number" ? msg.blur : 0;
        const brightness = typeof msg.brightness === "number" ? msg.brightness : 100;
        if (blur > 0 || brightness !== 100) {
          const filterVal = `blur(${blur}px) brightness(${brightness}%)`;
          if (vid) vid.style.setProperty("filter", filterVal, "important");
          if (img) img.style.setProperty("filter", filterVal, "important");
        } else {
          if (vid) vid.style.removeProperty("filter");
          if (img) img.style.removeProperty("filter");
        }
        break;
      }
      case "cardOpacity": {
        const c = (window.HUEVO_THEMES && currentSettings) ? window.HUEVO_THEMES.getActiveColors(currentSettings) : {};
        const hex = msg.cardBg || c.cardBg || (currentSettings && currentSettings.customTheme && currentSettings.customTheme.cardBg) || "#FFFFFF";
        let cRgb = "255, 255, 255";
        if (hex && hex.startsWith("#")) {
          let h = hex.replace("#", "");
          if (h.length === 3) h = h.split("").map(x => x + x).join("");
          const num = parseInt(h, 16);
          if (!isNaN(num)) {
            cRgb = `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
          }
        }
        const rgba = `rgba(${cRgb}, ${msg.value})`;
        targetRoot.style.setProperty("--huevo-card-bg", rgba, "important");
        targetRoot.style.setProperty("--card", rgba, "important");
        targetRoot.style.setProperty("--dk-card", rgba, "important");
        break;
      }
      case "cardBlur": {
        const blurPx = Math.min(16, Math.max(0, msg.value));
        const backdrop = blurPx > 0 ? `blur(${blurPx}px)` : "none";
        targetRoot.style.setProperty("--huevo-card-backdrop", backdrop, "important");
        targetRoot.style.setProperty("--huevo-card-blur", `${blurPx}px`, "important");
        break;
      }
      case "borderRadius": {
        const rPx = `${Math.max(0, msg.value)}px`;
        targetRoot.style.setProperty("--huevo-radius", rPx, "important");
        targetRoot.style.setProperty("--radius", rPx, "important");
        const isHeaderRound = Boolean(currentSettings && currentSettings.customTheme && currentSettings.customTheme.headerRounding !== false);
        targetRoot.style.setProperty("--huevo-header-radius", isHeaderRound ? rPx : "0px", "important");
        break;
      }
      case "headerOpacity": {
        const c = (window.HUEVO_THEMES && currentSettings) ? window.HUEVO_THEMES.getActiveColors(currentSettings) : {};
        const hex = msg.headerBg || c.headerBg || (currentSettings && currentSettings.customTheme && currentSettings.customTheme.headerBg) || "#3A3A3A";
        let cRgb = "58, 58, 58";
        if (hex && hex.startsWith("#")) {
          let h = hex.replace("#", "");
          if (h.length === 3) h = h.split("").map(x => x + x).join("");
          const num = parseInt(h, 16);
          if (!isNaN(num)) {
            cRgb = `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
          }
        }
        const rgba = `rgba(${cRgb}, ${msg.value})`;
        targetRoot.style.setProperty("--huevo-header-bg", rgba, "important");
        targetRoot.style.setProperty("--head", rgba, "important");
        targetRoot.style.setProperty("--dk-head", rgba, "important");
        break;
      }
      case "headerBlur": {
        const blurPx = Math.min(25, Math.max(0, msg.value));
        const backdrop = blurPx > 0 ? `blur(${blurPx}px)` : "none";
        targetRoot.style.setProperty("--huevo-header-backdrop", backdrop, "important");
        targetRoot.style.setProperty("--huevo-header-blur", `${blurPx}px`, "important");
        break;
      }
      case "accent": {
        if (msg.value) {
          targetRoot.style.setProperty("--huevo-logo-color", msg.value, "important");
          if (window.HUEVO_THEMES && window.HUEVO_THEMES.getLogoFilter) {
            targetRoot.style.setProperty("--huevo-logo-filter", window.HUEVO_THEMES.getLogoFilter(msg.value), "important");
          }
        }
        break;
      }
      case "headerRounding": {
        const isRound = Boolean(msg.value);
        const rVal = isRound ? `${(currentSettings && currentSettings.customTheme && currentSettings.customTheme.borderRadius) || 4}px` : "0px";
        targetRoot.style.setProperty("--huevo-header-radius", rVal, "important");
        if (!isRound) {
          targetRoot.setAttribute("data-huevo-header-no-round", "true");
        } else {
          targetRoot.removeAttribute("data-huevo-header-no-round");
        }
        if (currentSettings && currentSettings.customTheme) {
          currentSettings.customTheme.headerRounding = isRound;
          scheduleApplySettings(currentSettings);
        }
        break;
      }
      case "badgeRounding": {
        const isRound = Boolean(msg.value);
        if (!isRound) {
          targetRoot.setAttribute("data-huevo-badge-no-round", "true");
        } else {
          targetRoot.removeAttribute("data-huevo-badge-no-round");
        }
        if (currentSettings && currentSettings.customTheme) {
          currentSettings.customTheme.badgeRounding = isRound;
          scheduleApplySettings(currentSettings);
        }
        break;
      }
      case "sidebarCard": {
        const isCard = Boolean(msg.value);
        if (currentSettings && currentSettings.customTheme) {
          currentSettings.customTheme.sidebarCard = isCard;
        }
        updateSidebarPanel(currentSettings);
        scheduleApplySettings(currentSettings);
        break;
      }
      case "chatBorders": {
        const isBorders = Boolean(msg.value);
        if (isBorders) {
          targetRoot.setAttribute("data-huevo-chat-borders", "true");
        } else {
          targetRoot.removeAttribute("data-huevo-chat-borders");
        }
        if (currentSettings && currentSettings.customTheme) {
          currentSettings.customTheme.chatBordersEnabled = isBorders;
          scheduleApplySettings(currentSettings);
        }
        break;
      }
    }
  }

  getStorage(["huevo_theme_settings"], function(res) {
    const settings = res.huevo_theme_settings || (window.HUEVO_THEMES ? window.HUEVO_THEMES.DEFAULT_SETTINGS : null);
    if (settings) {
      applySettings(settings);
    }
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.huevo_theme_settings && changes.huevo_theme_settings.newValue) {
        scheduleApplySettings(changes.huevo_theme_settings.newValue);
      }
    });
  }

  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg && msg.type === "HUEVO_LIVE_UPDATE") {
      handleLiveUpdate(msg);
      if (sendResponse) sendResponse({ status: "ok" });
    } else if (msg && msg.type === "HUEVO_APPLY_THEME") {
      scheduleApplySettings(msg.settings);
      if (sendResponse) sendResponse({ status: "ok" });
    }
  });
})();
