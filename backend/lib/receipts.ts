/**
 * Скачивание чеков ФНС от Т-Банка в наше локальное хранилище.
 * Файлы — /app/public/uploads/receipts/{userId}/{payoutId}.pdf
 * Публичный URL — /uploads/receipts/{userId}/{payoutId}.pdf (раздаётся nginx)
 */
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = '/app/public/uploads/receipts';

/**
 * Скачивает чек по url и сохраняет в локальное хранилище.
 * Возвращает публичный путь (`/uploads/receipts/...`) или null если упало.
 */
export async function saveReceiptFile(payoutId: string, userId: string, url: string): Promise<string | null> {
  try {
    const dir = path.join(ROOT, userId);
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${payoutId}.pdf`);
    const pub = `/uploads/receipts/${userId}/${payoutId}.pdf`;

    // Если уже скачан — не качаем повторно
    try { await fs.access(file); return pub; } catch {}

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`fetch failed ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(file, buf);
    return pub;
  } catch (e) {
    console.error('[receipts.saveReceiptFile]', e);
    return null;
  }
}
