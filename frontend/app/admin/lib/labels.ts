// Единые переводы enum-значений на русский для админки.
// Используется во всех страницах /admin/* — единая логика для статусов.

export const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: 'Опубликован',
  APPROVED:  'Одобрено',
  ACTIVE:    'Активен',
  RESOLVED:  'Решено',
  PENDING:   'На модерации',
  DRAFT:     'Черновик',
  ARCHIVED:  'В архиве',
  CANCELED:  'Отменён',
  DELETED:   'Удалён',
  REJECTED:  'Отклонён',
  SUSPENDED: 'Заблокирован',
  EXPIRED:   'Истёк',
  PAST_DUE:  'Просрочен',
};

export const TIER_LABEL: Record<string, string> = {
  FREE:    'Бесплатно',
  PREMIUM: 'Премиум',
  STUDENT: 'Студент',
  B2B:     'B2B',
};

export const TX_TYPE_LABEL: Record<string, string> = {
  EARNING:    'Доход',
  WITHDRAWAL: 'Вывод',
  PURCHASE:   'Покупка',
};

export const REPORT_TARGET_LABEL: Record<string, string> = {
  TRACK:   'трек',
  COMMENT: 'комментарий',
  USER:    'пользователь',
};

export const REPORT_REASON_LABEL: Record<string, string> = {
  COPYRIGHT:     'Авторские права',
  INAPPROPRIATE: 'Неприемлемый контент',
  METADATA:      'Неверные метаданные',
  TECHNICAL:     'Технические проблемы',
  OTHER:         'Другое',
};

export const B2B_TYPE_LABEL: Record<string, string> = {
  LICENSE:  'Лицензия',
  ACADEMIC: 'Образование',
  OTHER:    'Другое',
};

export const AUDIO_TYPE_LABEL: Record<string, string> = {
  FULL:         'Полная',
  INSTRUMENTAL: 'Минусовка',
  BOTH:         'Полная + минусовка',
};

export const VERIFY_LABEL: Record<string, string> = {
  PENDING:  'На проверке',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
};

export const ROLE_LABEL: Record<string, string> = {
  USER:        'Слушатель',
  ARTIST:      'Артист',
  ADMIN:       'Администратор',
  SUPER_ADMIN: 'Суперадмин',
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  BEGINNER:     'начальный',
  INTERMEDIATE: 'средний',
  ADVANCED:     'продвинутый',
};

/** Перевести любой статус, fallback — оригинал. */
export function ruStatus(s?: string | null): string {
  if (!s) return '—';
  return STATUS_LABEL[s] || s;
}
export function ruRole(s?: string | null): string {
  if (!s) return '—';
  return ROLE_LABEL[s] || s;
}
