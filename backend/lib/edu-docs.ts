/**
 * Генерация юридических документов EDU.
 * Использует pdfkit + DejaVu Sans (кириллица).
 *
 * Реквизиты лицензиара (ООО "Сонатум") берутся из ENV:
 *   SONATUM_COMPANY_NAME, SONATUM_INN, SONATUM_KPP, SONATUM_OGRN,
 *   SONATUM_LEGAL_ADDRESS, SONATUM_BANK_NAME, SONATUM_BANK_ACCOUNT,
 *   SONATUM_BANK_CORR, SONATUM_BANK_BIK, SONATUM_DIRECTOR_NAME, SONATUM_DIRECTOR_ROLE.
 * Если переменных нет — подставляются осмысленные дефолты (пометка «уточняется»).
 */

import path from 'path';
import PDFDocument from 'pdfkit';
import { prisma } from '@/lib/prisma';

export type DocKind = 'CONTRACT' | 'INVOICE' | 'ACT';

const KIND_PREFIX: Record<DocKind, string> = {
  CONTRACT: 'L',
  INVOICE: 'INV',
  ACT: 'A',
};

const KIND_TITLE: Record<DocKind, string> = {
  CONTRACT: 'Лицензионный договор',
  INVOICE: 'Счёт на оплату',
  ACT: 'Акт оказанных услуг',
};

// Реквизиты лицензиара
function licensor() {
  return {
    companyName: process.env.SONATUM_COMPANY_NAME || 'ООО «Сонатум»',
    inn: process.env.SONATUM_INN || '(ИНН уточняется)',
    kpp: process.env.SONATUM_KPP || '(КПП уточняется)',
    ogrn: process.env.SONATUM_OGRN || '(ОГРН уточняется)',
    legalAddress: process.env.SONATUM_LEGAL_ADDRESS || '(юридический адрес уточняется)',
    bankName: process.env.SONATUM_BANK_NAME || '(банк уточняется)',
    bankAccount: process.env.SONATUM_BANK_ACCOUNT || '(р/с уточняется)',
    bankCorr: process.env.SONATUM_BANK_CORR || '(к/с уточняется)',
    bankBik: process.env.SONATUM_BANK_BIK || '(БИК уточняется)',
    directorName: process.env.SONATUM_DIRECTOR_NAME || 'Сатошевич Г. С.',
    directorRole: process.env.SONATUM_DIRECTOR_ROLE || 'Генеральный директор',
  };
}

/**
 * Получить или выпустить документ для учреждения за указанный год.
 * Идемпотентно — повторный вызов вернёт существующий номер.
 */
export async function ensureDocument(opts: {
  institutionId: string;
  kind: DocKind;
  year: number;
  amountKopecks?: number | null;
  periodFrom?: Date | null;
  periodTo?: Date | null;
}) {
  const { institutionId, kind, year } = opts;

  // Уже выпущен?
  const [existing] = (await prisma.$queryRawUnsafe(
    `SELECT * FROM edu_documents WHERE institution_id = $1 AND kind = $2 AND year = $3 LIMIT 1`,
    institutionId, kind, year
  )) as any[];
  if (existing) {
    return {
      id: existing.id,
      number: existing.number,
      seq: existing.seq,
      year: existing.year,
      issuedAt: existing.issued_at,
      amountKopecks: existing.amount_kopecks ? Number(existing.amount_kopecks) : null,
      periodFrom: existing.period_from,
      periodTo: existing.period_to,
    };
  }

  // Атомарно увеличиваем счётчик и выпускаем
  return await prisma.$transaction(async (tx) => {
    // INSERT ON CONFLICT для счётчика
    await tx.$executeRawUnsafe(
      `INSERT INTO edu_doc_counters (kind, year, last_seq) VALUES ($1, $2, 1)
       ON CONFLICT (kind, year) DO UPDATE SET last_seq = edu_doc_counters.last_seq + 1`,
      kind, year
    );
    const [row] = (await tx.$queryRawUnsafe(
      `SELECT last_seq FROM edu_doc_counters WHERE kind = $1 AND year = $2`,
      kind, year
    )) as any[];
    const seq = row.last_seq;
    const number = `${KIND_PREFIX[kind]}-${year}-${String(seq).padStart(4, '0')}`;
    const id = 'ed_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    await tx.$executeRawUnsafe(
      `INSERT INTO edu_documents (id, institution_id, kind, year, seq, number, amount_kopecks, period_from, period_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      id, institutionId, kind, year, seq, number,
      opts.amountKopecks ?? null,
      opts.periodFrom ?? null,
      opts.periodTo ?? null
    );

    return { id, number, seq, year, issuedAt: new Date(), amountKopecks: opts.amountKopecks ?? null, periodFrom: opts.periodFrom ?? null, periodTo: opts.periodTo ?? null };
  });
}

const FONT_REG = path.join(process.cwd(), 'lib', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(process.cwd(), 'lib', 'fonts', 'DejaVuSans-Bold.ttf');

function setupDoc(): InstanceType<typeof PDFDocument> {
  // КРИТИЧНО: пробрасываем наш TTF как initial font, иначе pdfkit пытается
  // открыть Helvetica.afm из node_modules/pdfkit/js/data, которого нет в
  // standalone-сборке Next.js → ENOENT.
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    font: FONT_REG,
    info: { Title: 'Sonatum EDU', Author: 'Сонатум', Producer: 'Sonatum Music' },
  } as any);
  doc.registerFont('reg', FONT_REG);
  doc.registerFont('bold', FONT_BOLD);
  doc.font('reg').fontSize(10);
  return doc;
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatAmount(kopecks: number | null | undefined) {
  if (kopecks == null) return '—';
  const rub = Math.floor(kopecks / 100);
  const kop = kopecks % 100;
  return `${rub.toLocaleString('ru-RU')} руб. ${String(kop).padStart(2, '0')} коп.`;
}

function amountInWords(rubles: number): string {
  // Простая прописью на сотни тысяч (достаточно для лицензий)
  const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const onesFem = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

  function under1000(n: number, fem = false): string {
    const parts: string[] = [];
    const h = Math.floor(n / 100);
    if (h) parts.push(hundreds[h]);
    const rest = n % 100;
    if (rest >= 10 && rest < 20) parts.push(teens[rest - 10]);
    else {
      const t = Math.floor(rest / 10);
      const o = rest % 10;
      if (t) parts.push(tens[t]);
      if (o) parts.push(fem ? onesFem[o] : ones[o]);
    }
    return parts.join(' ');
  }

  if (rubles === 0) return 'ноль';
  const millions = Math.floor(rubles / 1_000_000);
  const thousands = Math.floor((rubles % 1_000_000) / 1000);
  const rest = rubles % 1000;
  const out: string[] = [];
  if (millions) {
    const w = under1000(millions);
    const last = millions % 100 >= 11 && millions % 100 <= 14 ? 'миллионов' :
                 millions % 10 === 1 ? 'миллион' :
                 millions % 10 >= 2 && millions % 10 <= 4 ? 'миллиона' : 'миллионов';
    out.push(`${w} ${last}`);
  }
  if (thousands) {
    const w = under1000(thousands, true);
    const last = thousands % 100 >= 11 && thousands % 100 <= 14 ? 'тысяч' :
                 thousands % 10 === 1 ? 'тысяча' :
                 thousands % 10 >= 2 && thousands % 10 <= 4 ? 'тысячи' : 'тысяч';
    out.push(`${w} ${last}`);
  }
  if (rest) out.push(under1000(rest));
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function header(doc: any, title: string, number: string, dateStr: string) {
  doc.font('bold').fontSize(16).text(`${title} № ${number}`, { align: 'left' });
  doc.font('reg').fontSize(10).text(`от ${dateStr} · «Сонатум»`, { align: 'left' });
  doc.moveDown(0.5);
  doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor('#000').lineWidth(0.5).stroke();
  doc.moveDown(0.8);
}

function section(doc: any, label: string) {
  doc.moveDown(0.6);
  doc.font('bold').fontSize(11).text(label.toUpperCase(), { align: 'left' });
  doc.font('reg').fontSize(10);
  doc.moveDown(0.3);
}

function row(doc: any, label: string, value: string) {
  const y = doc.y;
  doc.font('reg').fillColor('#666').text(label, 56, y, { width: 200, continued: false });
  doc.font('reg').fillColor('#000').text(value || '—', 256, y, { width: 283 });
  doc.moveDown(0.2);
}

function paragraph(doc: any, text: string) {
  doc.font('reg').fontSize(10).fillColor('#000').text(text, { align: 'justify', lineGap: 2 });
  doc.moveDown(0.4);
}

function signatures(doc: any, partyA: { title: string; name: string; role: string }, partyB: { title: string; name: string; role: string }) {
  doc.moveDown(1.5);
  const y = doc.y;
  const w = 230;
  // Лицензиар
  doc.font('bold').fontSize(10).fillColor('#000').text(partyA.title, 56, y, { width: w });
  doc.font('reg').fontSize(9).fillColor('#666').text(partyA.role, 56, doc.y, { width: w });
  doc.moveDown(2);
  doc.font('reg').fontSize(10).fillColor('#000').text(`______________ / ${partyA.name} /`, 56, doc.y, { width: w });
  doc.text('М.П.', 56, doc.y, { width: w });

  // Лицензиат
  doc.font('bold').fontSize(10).fillColor('#000').text(partyB.title, 309, y, { width: w });
  doc.font('reg').fontSize(9).fillColor('#666').text(partyB.role || 'Руководитель', 309, y + 14, { width: w });
  doc.font('reg').fontSize(10).fillColor('#000').text(`______________ / ${partyB.name} /`, 309, y + 50, { width: w });
  doc.text('М.П.', 309, doc.y, { width: w });
}

async function streamToBuffer(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

// === CONTRACT ===
export async function renderContractPdf(inst: any, docRec: { number: string; issuedAt: Date; amountKopecks: number | null }) {
  const doc = setupDoc();
  const L = licensor();

  header(doc, KIND_TITLE.CONTRACT, docRec.number, formatDate(docRec.issuedAt));
  paragraph(doc, `${L.companyName}, именуемое в дальнейшем «Лицензиар», в лице ${L.directorRole.toLowerCase()} ${L.directorName}, действующего на основании Устава, с одной стороны, и ${inst.full_name || '—'}, именуемое в дальнейшем «Лицензиат», в лице ${inst.contact_role ? inst.contact_role.toLowerCase() + ' ' : ''}${inst.contact_name || '—'}, действующего на основании Устава, с другой стороны, заключили настоящий Договор о нижеследующем.`);

  section(doc, '1. Предмет договора');
  paragraph(doc, '1.1. Лицензиар предоставляет Лицензиату простую (неисключительную) лицензию на использование контента платформы «Сонатум» (далее — «Платформа») в образовательных целях в рамках уставной деятельности Лицензиата.');
  paragraph(doc, '1.2. Лицензия включает право Лицензиата и его уполномоченных пользователей (преподаватели и учащиеся) на: прослушивание музыкальных произведений, чтение и скачивание нот (при включении нотного архива), создание учебных и личных плейлистов, чтение текстов произведений и аннотаций.');
  paragraph(doc, '1.3. Любое использование контента вне образовательных целей, в том числе публичное исполнение, тиражирование, передача третьим лицам, требует отдельного разрешения и не входит в предмет настоящего Договора.');

  section(doc, '2. Срок действия и состав лицензии');
  row(doc, 'Период действия', `${formatDate(inst.paid_at)} — ${formatDate(inst.expires_at)}`);
  row(doc, 'Количество преподавателей', String(inst.teacher_count || 0));
  row(doc, 'Количество учащихся', String(inst.student_count || 0));
  row(doc, 'Нотный архив', inst.with_sheets ? 'Включён' : 'Не включён');
  row(doc, 'Сумма лицензионного вознаграждения', docRec.amountKopecks ? formatAmount(docRec.amountKopecks) : '—');

  section(doc, '3. Реквизиты сторон');
  doc.font('bold').fontSize(10).text('Лицензиар:', 56, doc.y, { width: 230 });
  const yL = doc.y;
  doc.font('reg').fontSize(9);
  doc.text(L.companyName, 56, yL + 4, { width: 230 });
  doc.text(`ИНН ${L.inn} · КПП ${L.kpp}`, 56, doc.y, { width: 230 });
  doc.text(`ОГРН ${L.ogrn}`, 56, doc.y, { width: 230 });
  doc.text(L.legalAddress, 56, doc.y, { width: 230 });
  doc.text(L.bankName, 56, doc.y, { width: 230 });
  doc.text(`Р/с ${L.bankAccount}`, 56, doc.y, { width: 230 });
  doc.text(`К/с ${L.bankCorr} · БИК ${L.bankBik}`, 56, doc.y, { width: 230 });

  doc.font('bold').fontSize(10).text('Лицензиат:', 309, yL - 14, { width: 230 });
  doc.font('reg').fontSize(9);
  doc.text(inst.full_name || '—', 309, yL + 4, { width: 230 });
  doc.text(`ИНН ${inst.inn || '—'}`, 309, doc.y, { width: 230 });
  doc.text(inst.legal_address || '—', 309, doc.y, { width: 230 });
  doc.text(`Контакт: ${inst.contact_name || '—'}${inst.contact_role ? ', ' + inst.contact_role : ''}`, 309, doc.y, { width: 230 });
  doc.text(`Email: ${inst.contact_email || '—'} · Тел.: ${inst.contact_phone || '—'}`, 309, doc.y, { width: 230 });

  signatures(doc,
    { title: 'ЛИЦЕНЗИАР', name: L.directorName, role: L.directorRole },
    { title: 'ЛИЦЕНЗИАТ', name: inst.contact_name || '—', role: inst.contact_role || 'Руководитель' }
  );

  return streamToBuffer(doc);
}

// === INVOICE ===
export async function renderInvoicePdf(inst: any, docRec: { number: string; issuedAt: Date; amountKopecks: number | null }) {
  const doc = setupDoc();
  const L = licensor();
  const kopecks = docRec.amountKopecks || 0;
  const rub = Math.floor(kopecks / 100);
  const kop = kopecks % 100;

  header(doc, KIND_TITLE.INVOICE, docRec.number, formatDate(docRec.issuedAt));

  section(doc, 'Поставщик');
  row(doc, 'Наименование', L.companyName);
  row(doc, 'ИНН / КПП', `${L.inn} / ${L.kpp}`);
  row(doc, 'Юридический адрес', L.legalAddress);
  row(doc, 'Расчётный счёт', L.bankAccount);
  row(doc, 'Банк', L.bankName);
  row(doc, 'Корр. счёт / БИК', `${L.bankCorr} / ${L.bankBik}`);

  section(doc, 'Плательщик');
  row(doc, 'Наименование', inst.full_name || '—');
  row(doc, 'ИНН', inst.inn || '—');
  row(doc, 'Юридический адрес', inst.legal_address || '—');

  section(doc, 'Назначение платежа');
  paragraph(doc, `Оплата по лицензионному договору на доступ к платформе «Сонатум» в образовательных целях. Период: ${formatDate(inst.paid_at)} — ${formatDate(inst.expires_at)}. Без НДС.`);

  section(doc, 'К оплате');
  const tableY = doc.y;
  doc.font('bold').fontSize(10);
  doc.text('№', 56, tableY, { width: 30 });
  doc.text('Наименование услуги', 86, tableY, { width: 290 });
  doc.text('Кол-во', 376, tableY, { width: 50, align: 'right' });
  doc.text('Сумма, ₽', 426, tableY, { width: 113, align: 'right' });
  doc.moveTo(56, doc.y + 4).lineTo(539, doc.y + 4).stroke();
  doc.moveDown(0.6);

  const lineY = doc.y;
  doc.font('reg').fontSize(10);
  doc.text('1', 56, lineY, { width: 30 });
  doc.text('Подписка «Сонатум Edu» (годовая)', 86, lineY, { width: 290 });
  doc.text('1', 376, lineY, { width: 50, align: 'right' });
  doc.text(formatAmount(kopecks).replace(' руб.', '').replace(' коп.', ''), 426, lineY, { width: 113, align: 'right' });
  doc.moveDown(1);
  doc.moveTo(56, doc.y).lineTo(539, doc.y).stroke();
  doc.moveDown(0.4);

  doc.font('bold').fontSize(11);
  doc.text('Итого к оплате:', 86, doc.y, { width: 290 });
  doc.text(formatAmount(kopecks), 376, doc.y - 14, { width: 163, align: 'right' });

  doc.moveDown(0.8);
  doc.font('reg').fontSize(9).fillColor('#555');
  paragraph(doc, `Сумма прописью: ${amountInWords(rub)} рублей ${String(kop).padStart(2, '0')} коп. Без НДС.`);

  signatures(doc,
    { title: 'Руководитель', name: L.directorName, role: L.directorRole },
    { title: 'Главный бухгалтер', name: L.directorName, role: 'Главный бухгалтер' }
  );

  return streamToBuffer(doc);
}

// === ACT ===
export async function renderActPdf(inst: any, docRec: { number: string; issuedAt: Date; amountKopecks: number | null; periodFrom?: Date | null; periodTo?: Date | null }) {
  const doc = setupDoc();
  const L = licensor();

  header(doc, KIND_TITLE.ACT, docRec.number, formatDate(docRec.issuedAt));
  paragraph(doc, `Мы, нижеподписавшиеся, ${L.companyName} (Исполнитель), в лице ${L.directorRole.toLowerCase()} ${L.directorName}, с одной стороны, и ${inst.full_name || '—'} (Заказчик), в лице ${inst.contact_role ? inst.contact_role.toLowerCase() + ' ' : ''}${inst.contact_name || '—'}, с другой стороны, составили настоящий Акт о том, что Исполнитель оказал, а Заказчик принял следующие услуги:`);

  section(doc, 'Перечень услуг');
  const tY = doc.y;
  doc.font('bold').fontSize(10);
  doc.text('№', 56, tY, { width: 30 });
  doc.text('Наименование', 86, tY, { width: 290 });
  doc.text('Период', 376, tY, { width: 80, align: 'center' });
  doc.text('Сумма', 456, tY, { width: 83, align: 'right' });
  doc.moveTo(56, doc.y + 4).lineTo(539, doc.y + 4).stroke();
  doc.moveDown(0.6);

  const lineY = doc.y;
  doc.font('reg').fontSize(10);
  doc.text('1', 56, lineY, { width: 30 });
  doc.text('Доступ к платформе «Сонатум» (Edu) и сопутствующие сервисы', 86, lineY, { width: 290 });
  const period = `${docRec.periodFrom ? formatDate(docRec.periodFrom) : formatDate(inst.paid_at)} — ${docRec.periodTo ? formatDate(docRec.periodTo) : formatDate(inst.expires_at)}`;
  doc.text(period, 376, lineY, { width: 80, align: 'center' });
  doc.text(formatAmount(docRec.amountKopecks || 0).replace(' руб.', '').replace(' коп.', ''), 456, lineY, { width: 83, align: 'right' });
  doc.moveDown(1.5);
  doc.moveTo(56, doc.y).lineTo(539, doc.y).stroke();
  doc.moveDown(0.4);

  doc.font('bold').fontSize(11);
  doc.text('Итого:', 86, doc.y, { width: 290 });
  doc.text(formatAmount(docRec.amountKopecks || 0), 376, doc.y - 14, { width: 163, align: 'right' });

  doc.moveDown(0.6);
  doc.font('reg').fontSize(10);
  paragraph(doc, 'Услуги оказаны в полном объёме и в срок. Заказчик претензий по качеству и срокам не имеет.');
  paragraph(doc, 'Настоящий Акт составлен в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой из сторон.');

  signatures(doc,
    { title: 'ИСПОЛНИТЕЛЬ', name: L.directorName, role: L.directorRole },
    { title: 'ЗАКАЗЧИК', name: inst.contact_name || '—', role: inst.contact_role || 'Руководитель' }
  );

  return streamToBuffer(doc);
}

export async function renderDocPdf(kind: DocKind, inst: any, docRec: any): Promise<Buffer> {
  if (kind === 'CONTRACT') return renderContractPdf(inst, docRec);
  if (kind === 'INVOICE') return renderInvoicePdf(inst, docRec);
  if (kind === 'ACT') return renderActPdf(inst, docRec);
  throw new Error(`Unknown document kind: ${kind}`);
}
