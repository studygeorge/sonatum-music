/**
 * T-Bank Self-Employed API wrapper.
 *
 * Поддерживает два режима:
 *   - PROD: реальные запросы к T-Bank, если задан TBANK_SE_TOKEN
 *   - MOCK: без токена — синтетические ответы для разработки/тестов
 *
 * Все вызовы логируются в tbank_api_log (БД) с correlationId — это
 * критично для последующих разборок с банком при ошибках.
 *
 * Документация: https://developer.tbank.ru/docs/products/self-employed
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const TOKEN = process.env.TBANK_SE_TOKEN || '';
const BASE_URL_PROD = process.env.TBANK_SE_BASE_URL_PROD || 'https://business.tinkoff.ru/openapi/api';
const BASE_URL_SANDBOX = process.env.TBANK_SE_BASE_URL_SANDBOX || '';
const USE_SANDBOX = process.env.TBANK_SE_USE_SANDBOX === '1';

export const TBANK_MOCK = !TOKEN;
export const TBANK_BASE_URL = USE_SANDBOX && BASE_URL_SANDBOX ? BASE_URL_SANDBOX : BASE_URL_PROD;

// =============== Типы ===============

export type Address = {
  type?: 'Работы' | 'Жительства';
  country?: string; postalCode?: string; state?: string; city?: string;
  district?: string; settlement?: string; street?: string;
  house?: string; building?: string; construction?: string; apartment?: string;
};
export type DocumentItem = {
  type: 'Паспорт' | 'Загр. паспорт иностранного гр.' | 'Вид на жительство';
  serial?: string; number: string; date: string; organization?: string; expireDate?: string;
};

export type RecipientByRequisitesInput = {
  correlationId?: string;
  number?: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  inn: string;          // 12 цифр
  accountNumber: string;
  bik: string;
};

export type RecipientStatus =
  | 'DRAFT' | 'CREATED' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'ERROR' | 'UNKNOWN';

export type SelfEmployedStatus = 'NOT_REGISTERED' | 'ACTIVE' | 'SUSPENDED' | 'UNKNOWN';

export type RegistryPayment = {
  number: number;
  accountNumber: string;
  paymentPurpose: string;
  selfEmployedInfo: {
    firstName: string;
    lastName: string;
    middleName?: string;
    inn: string;
  };
  sum: number;                           // брутто в рублях, до удержания
  taxHolding: boolean;
  incomeType: 'FROM_LEGAL_ENTITY' | 'FROM_INDIVIDUAL' | 'FROM_FOREIGN_AGENCY';
};

export type CreateRegistryInput = {
  correlationId?: string;
  registryCreateType?: 'IGNORE_ERRORS' | 'FAIL_FAST';
  payments: RegistryPayment[];
};

// =============== Низкоуровневая обёртка ===============

function newCorrelationId(): string {
  return crypto.randomUUID();
}

async function logCall(args: {
  correlationId: string;
  method: string;
  endpoint: string;
  requestBody?: any;
  responseBody?: any;
  statusCode?: number;
  error?: string;
  isMock: boolean;
  durationMs: number;
}) {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO tbank_api_log
        (id, correlation_id, method, endpoint, request_body, response_body, status_code, error, is_mock, duration_ms)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)`,
      'tlog_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      args.correlationId, args.method, args.endpoint,
      args.requestBody ? JSON.stringify(args.requestBody) : null,
      args.responseBody ? JSON.stringify(args.responseBody) : null,
      args.statusCode ?? null, args.error ?? null,
      args.isMock, args.durationMs
    );
  } catch (e) {
    console.error('[TBANK_LOG] failed to write:', e);
  }
}

async function call<T = any>(method: 'GET' | 'POST', path: string, body?: any, correlationId?: string): Promise<T> {
  const cid = correlationId || (body?.correlationId as string) || newCorrelationId();
  const url = `${TBANK_BASE_URL}${path}`;
  const t0 = Date.now();

  if (TBANK_MOCK) {
    const mock = mockHandler(method, path, body, cid);
    await logCall({
      correlationId: cid, method, endpoint: path, requestBody: body,
      responseBody: mock, statusCode: 200, isMock: true, durationMs: Date.now() - t0,
    });
    return mock as T;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: method === 'POST' ? JSON.stringify({ ...(body || {}), correlationId: cid }) : undefined,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    await logCall({
      correlationId: cid, method, endpoint: path, requestBody: body,
      responseBody: json, statusCode: res.status,
      error: res.ok ? undefined : (json?.errorMessage || text.slice(0, 500)),
      isMock: false, durationMs: Date.now() - t0,
    });
    if (!res.ok) throw new Error(`T-Bank ${path} ${res.status}: ${json?.errorMessage || text.slice(0, 200)}`);
    return json as T;
  } catch (e: any) {
    await logCall({
      correlationId: cid, method, endpoint: path, requestBody: body,
      error: e?.message || String(e), isMock: false, durationMs: Date.now() - t0,
    });
    throw e;
  }
}

// =============== MOCK-обработчик ===============

// Внутренние счётчики, чтобы в MOCK эмулировать ID и статусы предсказуемо
let mockRecipientIdCounter = 1000;
let mockRegistryIdCounter = 9000;

function mockHandler(method: string, path: string, body: any, cid: string): any {
  // /api/v1/self-employed/recipients/add/by-requisites
  if (path.endsWith('/recipients/add/by-requisites')) {
    return { correlationId: cid };
  }
  if (path.endsWith('/recipients/add/by-requisites/result')) {
    return {
      correlationId: cid,
      status: 'CREATED',
      recipientId: String(++mockRecipientIdCounter),
    };
  }
  // /recipients/list
  if (path.endsWith('/recipients/list')) {
    return {
      correlationId: cid,
      recipients: [
        { recipientId: '1001', status: 'ACTIVE', selfEmployedStatus: 'ACTIVE' },
      ],
    };
  }
  // /payment-registry/create
  if (path.endsWith('/payment-registry/create')) {
    return { correlationId: cid };
  }
  if (path.endsWith('/payment-registry/create/result')) {
    return {
      correlationId: cid,
      status: 'CREATED',
      paymentRegistryId: ++mockRegistryIdCounter,
    };
  }
  // submit
  if (path.endsWith('/payment-registry/submit')) {
    return { correlationId: cid };
  }
  if (path.endsWith('/payment-registry/submit/result')) {
    return { correlationId: cid, status: 'ACCEPTED', paymentRegistryId: body?.paymentRegistryId || mockRegistryIdCounter };
  }
  // pay
  if (path.endsWith('/payment-registry/pay')) {
    return { correlationId: cid };
  }
  if (path.endsWith('/payment-registry/pay/result')) {
    return {
      correlationId: cid,
      status: 'EXECUTED',
      paymentRegistryId: body?.paymentRegistryId || mockRegistryIdCounter,
      count: 1,
      paymentResults: [{
        number: 1,
        paymentStatus: { value: 'EXECUTED' },
        accountNumber: '40817810900000000000',
        errors: [],
      }],
    };
  }
  // получение реестра
  if (/\/payment-registry\/\d+$/.test(path)) {
    const id = Number(path.split('/').pop());
    return { paymentRegistryId: id, status: 'EXECUTED' };
  }
  // receipts
  if (path.endsWith('/payment-registry/receipts')) {
    return { correlationId: cid };
  }
  if (path.endsWith('/payment-registry/receipts/result')) {
    return {
      correlationId: cid,
      status: 'FINISHED',
      receipts: [{
        number: 1,
        receiptUrl: `https://lknpd.nalog.ru/api/v1/receipt/mock-${cid}.pdf`,
      }],
    };
  }
  return { correlationId: cid, status: 'OK', mock: true };
}

// =============== Высокоуровневое API ===============

/** Добавить самозанятого по реквизитам (внешний банк или любой счёт). */
export async function addRecipientByRequisites(input: RecipientByRequisitesInput) {
  const cid = input.correlationId || newCorrelationId();
  await call('POST', '/v1/self-employed/recipients/add/by-requisites', {
    correlationId: cid,
    recipients: [{
      number: input.number ?? 1,
      firstName: input.firstName,
      lastName: input.lastName,
      middleName: input.middleName,
      inn: input.inn,
      bankInfo: {
        bik: input.bik,
        accountNumber: input.accountNumber,
      },
    }],
  }, cid);
  // По док-у: дальше нужно опросить /result для получения recipientId
  const result = await call<any>('GET', `/v1/self-employed/recipients/add/by-requisites/result?correlationId=${encodeURIComponent(cid)}`,
    undefined, cid);
  return {
    correlationId: cid,
    status: result?.status as 'CREATED' | 'ERROR' | 'QUEUED' | string,
    recipientId: result?.recipientId as string | undefined,
    raw: result,
  };
}

/** Список получателей + статус самозанятости. Звать не чаще 1р/10мин. */
export async function listRecipients(recipientIds?: string[]) {
  const cid = newCorrelationId();
  return call<any>('POST', '/v1/self-employed/recipients/list', {
    correlationId: cid,
    recipientIds,
  }, cid);
}

/** Создать платёжный реестр (черновик). */
export async function createRegistry(input: CreateRegistryInput) {
  const cid = input.correlationId || newCorrelationId();
  await call('POST', '/v1/self-employed/payment-registry/create', {
    correlationId: cid,
    registryCreateType: input.registryCreateType || 'IGNORE_ERRORS',
    payments: input.payments,
  }, cid);
  const result = await call<any>('GET', `/v1/self-employed/payment-registry/create/result?correlationId=${encodeURIComponent(cid)}`,
    undefined, cid);
  return {
    correlationId: cid,
    status: result?.status,
    paymentRegistryId: result?.paymentRegistryId as number | undefined,
    raw: result,
  };
}

/** Подписать реестр (DRAFT → ACCEPTED). */
export async function submitRegistry(paymentRegistryId: number, correlationId?: string) {
  const cid = correlationId || newCorrelationId();
  await call('POST', '/v1/self-employed/payment-registry/submit',
    { correlationId: cid, paymentRegistryId }, cid);
  const result = await call<any>('GET', `/v1/self-employed/payment-registry/submit/result?correlationId=${encodeURIComponent(cid)}`,
    undefined, cid);
  return { correlationId: cid, status: result?.status, raw: result };
}

/** Оплатить реестр (ACCEPTED → EXECUTED). */
export async function payRegistry(paymentRegistryId: number, correlationId?: string) {
  const cid = correlationId || newCorrelationId();
  await call('POST', '/v1/self-employed/payment-registry/pay',
    { correlationId: cid, paymentRegistryId }, cid);
  const result = await call<any>('GET', `/v1/self-employed/payment-registry/pay/result?correlationId=${encodeURIComponent(cid)}`,
    undefined, cid);
  return {
    correlationId: cid,
    status: result?.status,
    paymentResults: result?.paymentResults || [],
    raw: result,
  };
}

/** Получить состояние реестра. Финальные статусы: EXECUTED/PART_EXEC/REJECTED/CANCELLED/DELETED. */
export async function getRegistry(paymentRegistryId: number) {
  return call<any>('GET', `/v1/self-employed/payment-registry/${paymentRegistryId}`);
}

/** Запросить формирование чеков ФНС после успешной выплаты. */
export async function fiscalizeReceipts(paymentRegistryId: number, correlationId?: string) {
  const cid = correlationId || newCorrelationId();
  await call('POST', '/v1/self-employed/payment-registry/receipts',
    { correlationId: cid, paymentRegistryId }, cid);
  const result = await call<any>('GET',
    `/v2/self-employed/payment-registry/receipts/result?correlationId=${encodeURIComponent(cid)}`,
    undefined, cid);
  return {
    correlationId: cid,
    status: result?.status,            // FINISHED / IN_PROGRESS / ERROR
    receipts: result?.receipts || [],  // [{ number, receiptUrl }]
    raw: result,
  };
}

/** Главный helper для маппинга T-Bank статуса в наш self_employed_status. */
export function mapRecipientStatus(tbank: { status?: string; selfEmployedStatus?: string }): SelfEmployedStatus {
  const se = (tbank?.selfEmployedStatus || '').toUpperCase();
  if (se === 'ACTIVE') return 'ACTIVE';
  if (se === 'SUSPENDED') return 'SUSPENDED';
  if (se === 'NOT_REGISTERED' || se === 'DRAFT') return 'NOT_REGISTERED';
  return 'UNKNOWN';
}

export { newCorrelationId };
