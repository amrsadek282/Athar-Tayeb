/* Application behavior: rendering, audio, tasbeeh, theme, sharing and utilities. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = { theme: 'athar-theme', total: 'athar-total', rounds: 'athar-rounds', sound: 'athar-sound' };
  const state = { surah: 'fatiha', fontSize: 1.55, zikrIndex: 0, count: 0, total: 0, rounds: 0, sound: true, audioPlaying: false, audioContext: null, toastTimer: null };
  const surahLabels = { fatiha: 'سورة الفاتحة', kursi: 'آية الكرسي وخواتيم البقرة', mulk: 'سورة الملك', yasin: 'سورة يس', ikhlas: 'الإخلاص والمعوذتان' };

  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function safeGet(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; } }
  function safeSet(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* Storage may be unavailable in private browsing. */ } }
  function loadPreferences() {
    state.total = Number(safeGet(STORAGE.total, 0)) || 0;
    state.rounds = Number(safeGet(STORAGE.rounds, 0)) || 0;
    state.sound = safeGet(STORAGE.sound, 'true') !== 'false';
    const theme = safeGet(STORAGE.theme, 'dark'); document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  }
  function saveTasbeeh() { safeSet(STORAGE.total, state.total); safeSet(STORAGE.rounds, state.rounds); safeSet(STORAGE.sound, state.sound); }

  function renderSurahTabs() {
    const host = $('#surahTabs'); host.innerHTML = '';
    Object.entries(quranData).forEach(([key, item]) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = `surah-tab${key === state.surah ? ' active' : ''}`;
      button.textContent = surahLabels[key] || item.title; button.setAttribute('aria-pressed', String(key === state.surah));
      button.addEventListener('click', () => selectSurah(key)); host.append(button);
    });
  }
  function selectSurah(key) {
    if (!quranData[key]) return;
    state.surah = key; const item = quranData[key];
    $('#surahTitle').textContent = item.title; $('#surahDescription').textContent = item.desc;
    const host = $('#quranText'); host.innerHTML = '';
    item.verses.forEach((verse, index) => {
      const span = document.createElement('span'); span.className = 'verse'; span.textContent = verse + ' ';
      host.append(span);
      const marker = document.createElement('span'); marker.className = 'verse-number'; marker.textContent = String(index + 1); marker.setAttribute('aria-label', `مقطع ${index + 1}`); host.append(marker, document.createTextNode(' '));
    });
    const audio = $('#quranAudio'); audio.pause(); audio.src = item.audioUrl; state.audioPlaying = false; updateAudioButton(); renderSurahTabs();
  }
  async function toggleAudio() {
    const audio = $('#quranAudio');
    if (state.audioPlaying) { audio.pause(); state.audioPlaying = false; updateAudioButton(); return; }
    try { await audio.play(); state.audioPlaying = true; updateAudioButton(); }
    catch { toast('تعذّر تشغيل التلاوة. تحقق من اتصال الإنترنت.'); }
  }
  function updateAudioButton() { $('#audioIcon').textContent = state.audioPlaying ? 'Ⅱ' : '▶'; $('#audioLabel').textContent = state.audioPlaying ? 'إيقاف مؤقت' : 'استمع للتلاوة'; }

  function renderZikrOptions() {
    const host = $('#zikrOptions'); host.innerHTML = '';
    zikrOptions.forEach((item, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = `zikr-option${index === state.zikrIndex ? ' active' : ''}`;
      const text = document.createElement('span'); text.textContent = item.text;
      const meta = document.createElement('small'); meta.textContent = `${item.target} مرة للدورة`;
      button.append(text, meta); button.setAttribute('aria-pressed', String(index === state.zikrIndex));
      button.addEventListener('click', () => { state.zikrIndex = index; state.count = 0; renderZikrOptions(); updateCounter(); }); host.append(button);
    });
    $('#activeZikr').textContent = zikrOptions[state.zikrIndex].text;
  }
  function updateCounter() {
    const target = zikrOptions[state.zikrIndex].target; const circumference = 2 * Math.PI * 105;
    $('#countValue').textContent = state.count; $('#countTarget').textContent = `من ${target}`;
    $('#totalCount').textContent = state.total; $('#roundCount').textContent = state.rounds;
    $('#ringProgress').style.strokeDasharray = circumference; $('#ringProgress').style.strokeDashoffset = circumference * (1 - state.count / target);
  }
  function clickSound() {
    if (!state.sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return;
      if (!state.audioContext) state.audioContext = new AudioContext();
      const ctx = state.audioContext; if (ctx.state === 'suspended') ctx.resume();
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(); oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(580, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + .045);
      gain.gain.setValueAtTime(.055, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .055);
      oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + .06);
    } catch { /* Audio feedback is optional. */ }
  }
  function incrementCount() {
    const target = zikrOptions[state.zikrIndex].target; state.count += 1; state.total += 1; clickSound();
    if (navigator.vibrate) navigator.vibrate(22);
    if (state.count >= target) { state.count = 0; state.rounds += 1; toast('أتممت دورة ذكر، تقبّل الله منك.'); if (navigator.vibrate) navigator.vibrate([35, 45, 35]); }
    updateCounter(); saveTasbeeh();
  }
  function renderDuas() {
    const host = $('#duasGrid'); host.innerHTML = '';
    duasData.forEach(dua => {
      const card = document.createElement('article'); card.className = 'dua-card';
      const top = document.createElement('div'); top.className = 'dua-top';
      const category = document.createElement('span'); category.className = 'dua-category'; category.textContent = dua.category;
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'copy-button'; copy.textContent = 'نسخ الدعاء'; copy.addEventListener('click', () => copyText(dua.text));
      top.append(category, copy);
      const text = document.createElement('p'); text.className = 'dua-text'; text.textContent = dua.text;
      const bottom = document.createElement('div'); bottom.className = 'dua-bottom';
      const hint = document.createElement('span'); hint.textContent = 'شارك بالدعاء';
      const amen = document.createElement('button'); amen.type = 'button'; amen.className = 'amen-button'; amen.textContent = 'آمين يا رب';
      amen.addEventListener('click', () => { amen.disabled = true; amen.textContent = 'آمين، تقبّل الله'; toast('اللهم آمين، تقبّل الله دعاءك.'); });
      bottom.append(hint, amen); card.append(top, text, bottom); host.append(card);
    });
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('تم نسخ الدعاء.'); }
    catch {
      const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select();
      try { document.execCommand('copy'); toast('تم نسخ الدعاء.'); } catch { toast('تعذّر النسخ من هذا المتصفح.'); } field.remove();
    }
  }
  async function sharePage() {
    const shareData = { title: document.title, text: 'مساحة للقرآن والذكر والدعاء، إهداءً لروح المهندس ممدوح معبد رحمه الله.', url: location.href };
    if (navigator.share) { try { await navigator.share(shareData); } catch { /* User cancelled sharing. */ } }
    else await copyText(location.href);
  }
  function bindEvents() {
    $('#themeButton').addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; safeSet(STORAGE.theme, next); });
    $('#shareButton').addEventListener('click', sharePage);
    $('#playAudioButton').addEventListener('click', toggleAudio);
    $('#quranAudio').addEventListener('ended', () => { state.audioPlaying = false; updateAudioButton(); toast('انتهت التلاوة، تقبّل الله.'); });
    $('#quranAudio').addEventListener('pause', () => { state.audioPlaying = false; updateAudioButton(); });
    $('#fontUp').addEventListener('click', () => { state.fontSize = Math.min(2.4, state.fontSize + .1); $('#quranText').style.fontSize = `${state.fontSize}rem`; });
    $('#fontDown').addEventListener('click', () => { state.fontSize = Math.max(1.15, state.fontSize - .1); $('#quranText').style.fontSize = `${state.fontSize}rem`; });
    $('#readingDone').addEventListener('click', () => toast('نسأل الله أن يتقبل منك ويجعلها في ميزان الحسنات.'));
    $('#countButton').addEventListener('click', incrementCount);
    $('#resetCount').addEventListener('click', () => { state.count = 0; updateCounter(); toast('تمت إعادة الدورة الحالية.'); });
    $('#dedicateCount').addEventListener('click', () => toast('اللهم تقبّل الذكر واجعله دعاءً ورحمةً له.'));
    window.addEventListener('keydown', event => { if (event.code === 'Space' && !['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName) && !event.repeat) { event.preventDefault(); incrementCount(); } });
  }
  function init() {
    loadPreferences(); renderSurahTabs(); selectSurah('fatiha'); renderZikrOptions(); updateCounter(); renderDuas(); bindEvents();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
