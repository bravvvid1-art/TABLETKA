import './styles.css';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const APP_VERSION = '1.0.1';
const MEDS_KEY = 'tabletka_meds_v1';
const LOG_KEY = 'tabletka_log_v1';

let medicines = JSON.parse(localStorage.getItem(MEDS_KEY) || '[]');
let logs = JSON.parse(localStorage.getItem(LOG_KEY) || '{}');
let currentTab = 'today';

const app = document.querySelector('#app');

const fmtDate = (d = new Date()) => d.toISOString().slice(0, 10);
const nowHM = () => new Date().toTimeString().slice(0, 5);

function save() {
  localStorage.setItem(MEDS_KEY, JSON.stringify(medicines));
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  render();
}

function statusFor(id) {
  return (logs[fmtDate()] || {})[id] || 'pending';
}

function setStatus(id, status) {
  logs[fmtDate()] = logs[fmtDate()] || {};
  logs[fmtDate()][id] = status;
  save();
}

function nextMedicine() {
  const sorted = [...medicines].sort((a, b) => a.time.localeCompare(b.time));
  return sorted.find(m => statusFor(m.id) === 'pending' && m.time >= nowHM()) ||
    sorted.find(m => statusFor(m.id) === 'pending');
}

function statusLabel(status) {
  if (status === 'taken') return '✅ Принято';
  if (status === 'skipped') return '❌ Пропущено';
  return '⏳ Ожидается';
}

function render() {
  app.innerHTML = `
    <header class="topbar">
      <div>
        <h1>ТАБЛЕТКА</h1>
        <p>Лекарства вовремя</p>
      </div>
      <span class="version">v${APP_VERSION}</span>
    </header>
    <main>
      ${currentTab === 'today' ? todayView() : ''}
      ${currentTab === 'add' ? addView() : ''}
      ${currentTab === 'meds' ? medsView() : ''}
      ${currentTab === 'settings' ? settingsView() : ''}
    </main>
    <nav class="bottom-nav">
      ${navButton('today','Сегодня','🏠')}
      ${navButton('add','Добавить','➕')}
      ${navButton('meds','Лекарства','💊')}
      ${navButton('settings','Настройки','⚙️')}
    </nav>
  `;
  wire();
}

function navButton(tab, label, icon) {
  return `<button data-tab="${tab}" class="${currentTab === tab ? 'active' : ''}"><span>${icon}</span>${label}</button>`;
}

function todayView() {
  const next = nextMedicine();
  const rows = medicines.length ? [...medicines].sort((a,b)=>a.time.localeCompare(b.time)).map(m => `
    <article class="dose-row">
      <div class="dose-time">${m.time}</div>
      <div class="dose-main"><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(m.dose || '')}</small></div>
      <div class="dose-status">${statusLabel(statusFor(m.id))}</div>
      <div class="dose-actions">
        <button class="ok" data-action="taken" data-id="${m.id}">Принял</button>
        <button class="neutral" data-action="snooze" data-id="${m.id}">+10 мин</button>
        <button class="skip" data-action="skipped" data-id="${m.id}">Пропустить</button>
      </div>
    </article>`).join('') : `<div class="empty">Добавьте первое лекарство и время приёма.</div>`;

  return `
    <section class="card hero">
      <span class="eyebrow">Следующий приём</span>
      <h2>${next ? escapeHtml(next.name) : 'На сегодня всё отмечено'}</h2>
      <p>${next ? `${next.time} • ${escapeHtml(next.dose || 'Пора принять лекарство')}` : 'Новых приёмов нет'}</p>
      ${next ? `<div class="hero-actions">
        <button class="hero-btn" data-action="taken" data-id="${next.id}">✓ Принял</button>
        <button class="hero-btn ghost" data-action="snooze" data-id="${next.id}">+10 минут</button>
      </div>` : ''}
    </section>
    <section class="card">
      <div class="section-title"><h3>Сегодня</h3><span>${medicines.length} приёмов</span></div>
      ${rows}
    </section>`;
}

function addView() {
  return `
    <section class="card">
      <h2>Новое лекарство</h2>
      <label>Название<input id="name" placeholder="Например, Кардиомагнил"></label>
      <label>Как принимать<input id="dose" placeholder="Например, 1 таблетка после еды"></label>
      <div class="grid2">
        <label>Время<input id="time" type="time" value="08:00"></label>
        <label>Курс<select id="days"><option value="7">7 дней</option><option value="10">10 дней</option><option value="14">14 дней</option><option value="30">30 дней</option><option value="0">Постоянно</option></select></label>
      </div>
      <label>Количество таблеток в упаковке<input id="qty" type="number" min="0" placeholder="Например, 30"></label>
      <button id="save-med" class="primary full">Сохранить лекарство</button>
      <p class="note">Дозировку и схему приёма пользователь вводит сам по назначению врача.</p>
    </section>`;
}

function medsView() {
  return `
    <section class="card">
      <div class="section-title"><h2>Мои лекарства</h2><button class="soft" data-tab="add">+ Добавить</button></div>
      ${medicines.length ? medicines.map(m => `
        <article class="med-card">
          <div><strong>${escapeHtml(m.name)}</strong><small>${m.time} • ${m.days ? `${m.days} дней` : 'постоянно'}${m.qty ? ` • ${m.qty} шт.` : ''}</small></div>
          <button class="delete" data-delete="${m.id}">Удалить</button>
        </article>`).join('') : '<div class="empty">Лекарств пока нет.</div>'}
    </section>`;
}

function settingsView() {
  return `
    <section class="card">
      <h2>Уведомления</h2>
      <p>Разрешите приложению напоминать о лекарствах даже когда оно свёрнуто.</p>
      <button id="perm" class="primary">Разрешить уведомления</button>
    </section>
    <section class="card">
      <h2>Обновления</h2>
      <p>При запуске приложение проверяет наличие новой версии.</p>
      <button id="check-update" class="soft">Проверить обновление</button>
      <p class="note">Android не разрешает приложению незаметно устанавливать новый APK. При новой версии появится кнопка «Обновить», после чего откроется страница свежего релиза.</p>
    </section>`;
}

function wire() {
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { currentTab = b.dataset.tab; render(); });
  document.querySelector('#save-med')?.addEventListener('click', addMedicine);
  document.querySelectorAll('[data-action]').forEach(b => b.onclick = () => action(b.dataset.action, Number(b.dataset.id)));
  document.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => removeMedicine(Number(b.dataset.delete)));
  document.querySelector('#perm')?.addEventListener('click', requestNotificationPermission);
  document.querySelector('#check-update')?.addEventListener('click', () => checkForUpdate(true));
}

async function addMedicine() {
  const name = document.querySelector('#name').value.trim();
  const dose = document.querySelector('#dose').value.trim();
  const time = document.querySelector('#time').value;
  const days = Number(document.querySelector('#days').value);
  const qty = Number(document.querySelector('#qty').value || 0);
  if (!name) return alert('Введите название лекарства.');

  const med = { id: Date.now(), name, dose, time, days, qty, createdAt: new Date().toISOString() };
  medicines.push(med);
  save();
  await scheduleNotification(med);
  currentTab = 'today';
  render();
}

async function requestNotificationPermission() {
  try {
    const result = await LocalNotifications.requestPermissions();
    alert(result.display === 'granted' ? 'Уведомления разрешены.' : 'Разрешение на уведомления не выдано.');
  } catch {
    alert('Не удалось запросить разрешение на уведомления.');
  }
}

async function scheduleNotification(med, plusMinutes = 0) {
  if (!Capacitor.isNativePlatform()) return;
  const [hh, mm] = med.time.split(':').map(Number);
  const when = new Date();
  when.setHours(hh, mm + plusMinutes, 0, 0);
  if (when <= new Date()) when.setDate(when.getDate() + 1);
  try {
    await LocalNotifications.schedule({ notifications: [{
      id: Number(String(med.id).slice(-9)),
      title: 'ТАБЛЕТКА — время приёма',
      body: `${med.name}${med.dose ? ` • ${med.dose}` : ''}`,
      schedule: { at: when, allowWhileIdle: true },
      sound: 'default',
      actionTypeId: '',
      extra: { medicineId: med.id }
    }] });
  } catch (e) {
    console.error(e);
  }
}

async function action(type, id) {
  const med = medicines.find(m => m.id === id);
  if (!med) return;
  if (type === 'snooze') {
    await scheduleNotification(med, 10);
    alert('Напоминание перенесено на 10 минут.');
    return;
  }
  setStatus(id, type);
}

function removeMedicine(id) {
  if (!confirm('Удалить лекарство из расписания?')) return;
  medicines = medicines.filter(m => m.id !== id);
  save();
}

async function checkForUpdate(showCurrent = false) {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    const remote = await response.json();
    if (remote.version && remote.version !== APP_VERSION) {
      if (confirm(`Доступна версия ${remote.version}. Открыть обновление?`)) {
        window.open(remote.releaseUrl, '_blank');
      }
    } else if (showCurrent) {
      alert(`Установлена актуальная версия ${APP_VERSION}.`);
    }
  } catch {
    if (showCurrent) alert('Не удалось проверить обновление.');
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

render();
checkForUpdate(false);
