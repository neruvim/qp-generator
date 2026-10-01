import '@fontsource-variable/golos-text';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { parseCount } from './random';
import { initialState, LotteryStore, openDatabase, type State } from './storage';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><a class="brand" href="./" aria-label="Очередной лототрон — главная"><img src="./icon.svg" alt="" width="36" height="36"><span class="lottery-title" aria-hidden="true">Очередной <span class="lottery-word">ло<span class="title-letter"><span class="title-t">т</span><span class="title-x">х</span></span>отрон</span></span></a>
    <div id="status-control" class="status-control" data-state="preparing">
      <span id="offline" class="status" role="status">Подготовка офлайн…</span>
      <button id="status-toggle" class="status-toggle" type="button" aria-label="Статус: Подготовка офлайн…" aria-expanded="false" aria-controls="status-popover"></button>
      <div id="status-popover" class="status-popover" hidden>Подготовка офлайн…</div>
    </div></header>
  <main>
    <div id="access" class="notice" role="status">Загрузка сохранённого розыгрыша…</div>
    <div id="error" class="error" role="alert" hidden></div>
    <section id="setup" hidden>
      <div class="intro"><p class="eyebrow">Пусть решает случай</p><h1>У каждого —<br><span>свой шанс.</span></h1><p class="lead">Один клик. Один номер. Без повторов.</p></div>
      <form id="start-form" class="panel setup-panel" novalidate>
        <h2>Сколько вас сегодня?</h2>
        <label for="count">Количество участников</label>
        <input id="count" name="count" inputmode="numeric" type="text" autocomplete="off" aria-describedby="count-hint error">
        <p id="count-hint" class="muted">В розыгрыше участвуют все номера от 1 до указанного числа.</p>
        <button class="primary" id="start" type="submit">Начать розыгрыш</button>
      </form>
    </section>
    <section id="draw-screen" aria-label="Розыгрыш" hidden>
      <div class="draw-layout">
        <div class="result-card"><span id="result-label" hidden>Ваш счастливый номер</span>
          <div id="number" aria-hidden="true"></div><span id="result-note">Первый номер уже ждёт своего момента</span>
        </div>
        <p id="announcement" class="sr-only" role="status" aria-live="polite"></p>
        <button id="draw" class="primary">Выбрать номер</button>
        <aside class="panel history-panel" aria-label="История розыгрыша">
        <div class="history-heading"><h2>Уже выпали</h2><span class="history-order">От нового к старому</span></div>
        <p id="empty-history" class="empty">Здесь будут отображаться выбранные номера.</p>
        <ol id="history"></ol>
        <nav id="pagination" aria-label="Страницы истории" hidden><button id="prev" class="small" aria-label="Предыдущая страница">←</button><span id="page-label"></span><button id="next" class="small" aria-label="Следующая страница">→</button></nav>
        <p id="remaining"></p>
        </aside>
      </div>
      <div class="bottom-actions">
        <div class="reset-row"><button id="reset" class="secondary">Начать заново</button><span class="muted">Новый розыгрыш — новые шансы.</span></div>
        <div class="draw-settings"><div class="controls"><label class="toggle"><input id="animation" type="checkbox" role="switch"><span class="switch" aria-hidden="true"></span>Анимация</label></div>
          <p id="reduced-motion" class="muted" hidden>Движение уменьшено в настройках устройства.</p>
        </div>
      </div>
    </section>
    <details class="help">
      <summary>Небольшая инструкция</summary>
      <div class="help-content">
      <p><strong>Как пользоваться.</strong> Введите количество участников и нажмите «Начать розыгрыш». Кнопка «Выбрать номер» выдаёт случайный номер от 1 до указанного числа, каждый следующий — без повторов. Последние результаты появляются в начале истории.</p>
      <p>Переключатель «Анимация» включает секундный перебор чисел и не влияет на результат. Чтобы изменить количество участников или провести новый розыгрыш, нажмите «Начать заново» и подтвердите сброс истории.</p>
      <p><strong>Статусы сверху.</strong> Они показывают готовность приложения к работе без сети, а не наличие интернета:</p>
      <ul>
        <li><strong>«Подготовка офлайн…»</strong> — сохраняются необходимые ресурсы.</li>
        <li><strong>«Готов к работе»</strong> — подготовка завершена, приложение можно открывать и использовать без интернета.</li>
        <li><strong>«Офлайн не подготовлен»</strong> — подготовка не удалась. Проверьте подключение и повторно откройте приложение.</li>
        <li><strong>«Офлайн недоступен»</strong> — браузер или способ открытия страницы не поддерживает работу без сети. Попробуйте открыть сайт в Safari или Chrome.</li>
      </ul>
      <p><strong>Установка на iPhone (iOS).</strong> Откройте сайт в Safari, нажмите «Поделиться» (или «Ещё» → «Поделиться») → «На экран Домой». Если есть переключатель «Открыть как веб-приложение», включите его. Нажмите «Добавить». Если нужного пункта нет, найдите его через «Редактировать действия» в меню «Поделиться».</p>
      <p><strong>Установка на Android.</strong> Откройте сайт в Chrome и нажмите меню с тремя точками → «Установить и создать ярлык» → «Установить». В зависимости от версии браузера пункт может называться «Установить приложение» или «Добавить на главный экран». Подтвердите установку.</p>
      <p>После установки запускайте приложение с его значка. Если ссылка открылась внутри мессенджера, сначала перенесите её в Safari или Chrome. Установка необязательна — можно пользоваться сайтом в браузере.</p>
      <p>Розыгрыш продолжается после перезагрузки страницы. Управление доступно только в одной вкладке: чтобы продолжить в другой, закройте первую.</p>
      <p>Розыгрыш сохраняется в этом браузере на этом устройстве. Очистка данных сайта или их удаление браузером удалит историю.</p>
      </div>
    </details>
    <p id="update" class="notice" hidden>Доступна новая версия. Она будет применена после закрытия всех вкладок приложения. Текущий розыгрыш сохранён.</p>
  </main>
  <footer><span>Очередной лототрон</span><span>Всё честно. Всё случайно.</span></footer>
  <dialog id="reset-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">Сбросить розыгрыш?</h2><p>История выбранных номеров будет удалена.</p><div class="dialog-actions"><button id="cancel" class="secondary" autofocus>Отмена</button><button id="confirm" class="primary">Сбросить</button></div></dialog>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let state: State = { ...initialState };
let store: LotteryStore;
let owner = false;
let busy = false;
let page = 0;
let historyVersion = 0;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const statusToggle = el<HTMLButtonElement>('status-toggle');
function closeStatus() {
  el('status-popover').hidden = true;
  statusToggle.setAttribute('aria-expanded', 'false');
}
statusToggle.addEventListener('click', () => {
  const open = el('status-popover').hidden;
  el('status-popover').hidden = !open;
  statusToggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('pointerdown', event => {
  if (!el('status-control').contains(event.target as Node)) closeStatus();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !el('status-popover').hidden) {
    closeStatus();
    statusToggle.focus();
  }
});
document.addEventListener('focusin', event => {
  if (!el('status-control').contains(event.target as Node)) closeStatus();
});
matchMedia('(max-width: 720px)').addEventListener('change', closeStatus);
const help = document.querySelector<HTMLDetailsElement>('.help')!;
const helpContent = document.querySelector<HTMLElement>('.help-content')!;
let helpExpanded = false;
let helpAnimation: Animation | undefined;

help.querySelector('summary')!.addEventListener('click', event => {
  event.preventDefault();
  helpExpanded = !helpExpanded;
  const height = help.open ? helpContent.getBoundingClientRect().height : 0;
  const opacity = help.open ? getComputedStyle(helpContent).opacity : '0';
  helpAnimation?.cancel();
  helpAnimation = undefined;
  if (motion.matches) {
    help.open = helpExpanded;
    return;
  }
  help.open = true;
  const current = helpContent.animate([
    { height: `${height}px`, opacity },
    { height: `${helpExpanded ? helpContent.scrollHeight : 0}px`, opacity: helpExpanded ? 1 : 0 },
  ], { duration: 240, easing: 'ease-in-out', fill: 'both' });
  helpAnimation = current;
  current.onfinish = () => {
    if (helpAnimation !== current) return;
    help.open = helpExpanded;
    current.cancel();
    helpAnimation = undefined;
  };
});
motion.addEventListener('change', () => {
  if (motion.matches && helpAnimation) {
    helpAnimation.cancel();
    helpAnimation = undefined;
    help.open = helpExpanded;
  }
});
const dialog = el<HTMLDialogElement>('reset-dialog');
const count = el<HTMLInputElement>('count');
const animation = el<HTMLInputElement>('animation');
const titleLetter = document.querySelector<HTMLElement>('.title-letter')!;
let titleTimer: number | undefined;

function updateTitleEffect() {
  if (!owner || document.hidden || motion.matches) {
    window.clearTimeout(titleTimer);
    titleTimer = undefined;
    titleLetter.classList.remove('is-swapped');
    return;
  }
  if (titleTimer !== undefined) return;
  // Decorative timing is independent of the lottery's cryptographic generator.
  titleTimer = window.setTimeout(() => {
    titleLetter.classList.add('is-swapped');
    titleTimer = window.setTimeout(() => {
      titleLetter.classList.remove('is-swapped');
      titleTimer = undefined;
      updateTitleEffect();
    }, 200);
  }, 1000 + Math.floor(Math.random() * 4001));
}
document.addEventListener('visibilitychange', updateTitleEffect);
motion.addEventListener('change', updateTitleEffect);

function error(message = '') {
  el('error').textContent = message;
  el('error').hidden = !message;
}

function renderNumber(value: number | null) {
  const text = value === null ? '' : String(value);
  el('number').textContent = text;
  el('number').style.setProperty('--digits', String(Math.max(3, text.length)));
}

function render() {
  el('setup').hidden = !owner || state.active;
  el('draw-screen').hidden = !owner || !state.active;
  renderNumber(state.last);
  el('result-label').hidden = state.last === null;
  const drawn = state.total - state.remaining;
  el('remaining').textContent = `Осталось ${state.remaining} из ${state.total}`;
  el('draw').textContent = state.remaining === 0 ? 'Розыгрыш завершён' : state.last === null ? 'Выбрать номер' : 'Выбрать следующий';
  el('result-note').textContent = state.last === null ? 'Первый номер уже ждёт своего момента' : `Номер ${drawn} из ${state.total}`;
  if (!busy) animation.checked = state.animation;
  if (!busy) el('announcement').textContent = state.last === null ? '' : `Выбран номер ${state.last}. Осталось ${state.remaining} из ${state.total}.`;
  el('reduced-motion').hidden = !motion.matches;
  for (const id of ['start', 'draw', 'reset', 'animation']) {
    (el(id) as HTMLButtonElement | HTMLInputElement).disabled = !owner || busy || (id === 'draw' && state.remaining === 0);
  }
  updateTitleEffect();
}

async function renderHistory() {
  const version = ++historyVersion;
  const entries = await store.history(page);
  if (version !== historyVersion) return;
  const list = el<HTMLOListElement>('history');
  list.style.setProperty('--history-digits', String(String(state.total).length));
  list.replaceChildren(...entries.map(entry => {
    const item = document.createElement('li');
    item.textContent = String(entry.value);
    item.title = `Выбор № ${entry.order}`;
    item.setAttribute('aria-label', `Выбор ${entry.order}: ${entry.value}`);
    return item;
  }));
  list.reversed = true;
  list.start = entries[0]?.order ?? 1;
  list.scrollTop = 0;
  const pages = Math.ceil((state.total - state.remaining) / 50);
  el('empty-history').hidden = entries.length > 0;
  el('pagination').hidden = pages <= 1;
  el('page-label').textContent = `${page + 1} / ${pages}`;
  el<HTMLButtonElement>('prev').disabled = page === 0;
  el<HTMLButtonElement>('next').disabled = page + 1 >= pages;
}

async function action(work: () => Promise<void>) {
  if (busy || !owner) return;
  busy = true;
  error();
  render();
  try { await work(); }
  catch (cause) {
    console.error(cause);
    error('Не удалось сохранить или прочитать данные. Последнее подтверждённое состояние сохранено. Проверьте свободное место и доступ браузера к данным, затем повторите действие.');
  } finally { busy = false; render(); }
}

el('start-form').addEventListener('submit', event => {
  event.preventDefault();
  let total: number;
  try { total = parseCount(count.value); count.removeAttribute('aria-invalid'); }
  catch (cause) { error((cause as Error).message); count.setAttribute('aria-invalid', 'true'); count.focus(); return; }
  void action(async () => { state = await store.start(total); page = 0; await renderHistory(); render(); el('draw').focus(); });
});

el('draw').addEventListener('click', () => void action(async () => {
  state = await store.draw(); // Committed before any decorative animation or result display.
  if (state.animation && !motion.matches) {
    el('result-note').textContent = 'Выбираем…';
    el('number').classList.add('rolling');
    const started = performance.now();
    await new Promise<void>(resolve => {
      const frame = () => {
        if (performance.now() - started >= 1000 || document.hidden || motion.matches) return resolve();
        renderNumber(1 + Math.floor(Math.random() * Math.min(state.total, 999)));
        setTimeout(frame, 70);
      };
      frame();
    });
    el('number').classList.remove('rolling');
  }
  render();
  el('announcement').textContent = `Выбран номер ${state.last}. Осталось ${state.remaining} из ${state.total}.`;
  el('number').animate([{ opacity: .5 }, { opacity: 1 }], { duration: motion.matches ? 0 : 350 });
  page = 0;
  await renderHistory();
}));

animation.addEventListener('change', () => {
  const enabled = animation.checked;
  void action(async () => { state = await store.setAnimation(enabled); });
});
el('reset').addEventListener('click', () => { if (!busy && owner) dialog.showModal(); });
el('cancel').addEventListener('click', () => dialog.close());
el('confirm').addEventListener('click', () => {
  dialog.close();
  void action(async () => { state = await store.reset(); page = 0; count.value = String(state.total); await renderHistory(); render(); count.focus(); });
});
for (const [id, delta] of [['prev', -1], ['next', 1]] as const) {
  el(id).addEventListener('click', () => {
    page += delta;
    void renderHistory().catch(() => error('Не удалось прочитать историю. Перезагрузите приложение.'));
  });
}
motion.addEventListener('change', () => { if (!busy) render(); });

async function boot() {
  if (!navigator.locks || !window.isSecureContext) throw new Error('Для работы нужен современный браузер и HTTPS (или localhost).');
  store = new LotteryStore(await openDatabase());
  el('access').textContent = 'Розыгрыш открыт в другой вкладке. Закройте её — управление появится здесь автоматически.';
  await navigator.locks.request('qp-generator-controller', async () => {
    state = await store.read();
    owner = true;
    el('access').hidden = true;
    count.value = String(state.total);
    page = 0;
    render();
    await renderHistory();
    await new Promise<void>(resolve => window.addEventListener('pagehide', () => {
      owner = false;
      render();
      resolve();
    }, { once: true }));
  });
}
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
void boot().catch(cause => {
  owner = false;
  render();
  el('access').hidden = false;
  el('access').textContent = 'Не удалось открыть розыгрыш.';
  error(`${(cause as Error).message} Проверьте доступ к хранилищу и перезагрузите страницу.`);
});

function setStatus(text: string, state: 'ready' | 'error' | 'unavailable') {
  el('offline').textContent = text;
  el('status-popover').textContent = text;
  el('status-control').dataset.state = state;
  statusToggle.setAttribute('aria-label', `Статус: ${text}`);
}
function offlineReady() {
  setStatus('Готов к работе', 'ready');
}
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady: offlineReady,
    onNeedRefresh: () => { el('update').hidden = false; },
    onRegisterError: () => { setStatus('Офлайн не подготовлен', 'error'); },
  });
  // An active worker only exists after successful installation of the full precache.
  void navigator.serviceWorker.ready.then(() => offlineReady());
} else { setStatus('Офлайн недоступен', 'unavailable'); }
