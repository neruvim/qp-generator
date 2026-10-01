import { parseCount, randomBelow } from './random';

export interface State {
  active: boolean;
  total: number;
  remaining: number;
  last: number | null;
  animation: boolean;
}
export const initialState: State = { active: false, total: 150, remaining: 150, last: null, animation: true };
export interface Entry { order: number; value: number }

const request = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export async function openDatabase(name = 'qp-generator'): Promise<IDBDatabase> {
  const req = indexedDB.open(name, 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    db.createObjectStore('state');
    db.createObjectStore('swaps');
    db.createObjectStore('history', { keyPath: 'order' });
  };
  const db = await request(req);
  db.onversionchange = () => db.close();
  return db;
}

export class LotteryStore {
  constructor(private db: IDBDatabase) {}

  private async transaction<T>(mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>): Promise<T> {
    const tx = this.db.transaction(['state', 'swaps', 'history'], mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Сохранение отменено.'));
      tx.onerror = () => { /* onabort reports the final outcome */ };
    });
    try {
      const result = await work(tx);
      await done;
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* already finished */ }
      await done.catch(() => {});
      throw error;
    }
  }

  read(): Promise<State> {
    return this.transaction('readonly', async tx =>
      (await request(tx.objectStore('state').get('current'))) ?? { ...initialState });
  }

  start(total: number): Promise<State> {
    parseCount(String(total));
    return this.transaction('readwrite', async tx => {
      const store = tx.objectStore('state');
      const old: State = (await request(store.get('current'))) ?? initialState;
      if (old.active) throw new Error('Розыгрыш уже начат.');
      const next = { ...old, active: true, total, remaining: total, last: null };
      tx.objectStore('swaps').clear();
      tx.objectStore('history').clear();
      store.put(next, 'current');
      return next;
    });
  }

  draw(pick = randomBelow): Promise<State> {
    return this.transaction('readwrite', async tx => {
      const store = tx.objectStore('state');
      const current: State = await request(store.get('current'));
      if (!current?.active || current.remaining === 0) throw new Error('Нет доступных номеров.');
      const index = pick(current.remaining);
      if (!Number.isSafeInteger(index) || index < 0 || index >= current.remaining) throw new Error('Ошибка генератора.');
      const tail = current.remaining - 1;
      const swaps = tx.objectStore('swaps');
      const chosen: number = (await request(swaps.get(index))) ?? index;
      const replacement: number = (await request(swaps.get(tail))) ?? tail;
      if (index !== tail) swaps.put(replacement, index);
      swaps.delete(tail);
      const next = { ...current, remaining: tail, last: chosen + 1 };
      tx.objectStore('history').add({ order: current.total - tail, value: next.last });
      store.put(next, 'current');
      return next;
    });
  }

  reset(): Promise<State> {
    return this.transaction('readwrite', async tx => {
      const store = tx.objectStore('state');
      const current: State = (await request(store.get('current'))) ?? initialState;
      const next = { ...current, active: false, remaining: current.total, last: null };
      tx.objectStore('history').clear();
      tx.objectStore('swaps').clear();
      store.put(next, 'current');
      return next;
    });
  }

  setAnimation(animation: boolean): Promise<State> {
    return this.transaction('readwrite', async tx => {
      const store = tx.objectStore('state');
      const current: State = (await request(store.get('current'))) ?? initialState;
      const next = { ...current, animation };
      store.put(next, 'current');
      return next;
    });
  }

  history(page: number, size = 50): Promise<Entry[]> {
    return this.transaction('readonly', async tx => {
      const current: State = (await request(tx.objectStore('state').get('current'))) ?? initialState;
      const lastOrder = current.total - current.remaining - page * size;
      if (lastOrder < 1) return [];
      const entries: Entry[] = await request(tx.objectStore('history')
        .getAll(IDBKeyRange.bound(Math.max(1, lastOrder - size + 1), lastOrder), size));
      return entries.reverse();
    });
  }
}
