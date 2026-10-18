// Lid statuslari — server va web uchun yagona manba.

export const LEAD_STATUSES = ['new', 'no_answer', 'postponed', 'success', 'rejected', 'cancelled'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface StatusMeta {
  label: string;
  short: string;
  emoji: string;
  color: string;
  description: string;
  /** Yakuniy status — o'zgartirish uchun "Tahrirlash" kerak bo'ladi */
  final: boolean;
}

export const STATUS_META: Record<LeadStatus, StatusMeta> = {
  new: {
    label: 'Yangi',
    short: 'Yangi',
    emoji: '🔵',
    color: '#3b82f6',
    description: "Hali hech qanday amal bajarilmagan lid",
    final: false,
  },
  no_answer: {
    label: "Ko'tarmadi",
    short: "Ko'tarmadi",
    emoji: '⚪️',
    color: '#64748b',
    description: "Qo'ng'iroq qilindi, lekin mijoz javob bermadi. Bot qayta eslatadi",
    final: false,
  },
  postponed: {
    label: 'Keyinga qoldirildi',
    short: 'Keyinga',
    emoji: '🟡',
    color: '#eab308',
    description: "Sana tanlansa — o'sha kuni, sanasiz bo'lsa har 2 kunda bot eslatadi",
    final: false,
  },
  success: {
    label: 'Javob berildi — HA dedi',
    short: 'HA dedi',
    emoji: '🟢',
    color: '#16a34a',
    description: 'Muvaffaqiyatli: mijoz rozi bo\'ldi',
    final: true,
  },
  rejected: {
    label: "Javob berildi — YO'Q dedi",
    short: "YO'Q dedi",
    emoji: '🟠',
    color: '#f97316',
    description: "Mijoz bilan gaplashildi, lekin rad etdi",
    final: true,
  },
  cancelled: {
    label: 'Bekor qilindi',
    short: 'Bekor',
    emoji: '🔴',
    color: '#dc2626',
    description: "Lid bekor qilindi (noto'g'ri raqam, spam, takroriy va h.k.)",
    final: true,
  },
};

/** Xodim hali ishlashi kerak bo'lgan statuslar */
export const OPEN_STATUSES: LeadStatus[] = ['new', 'no_answer', 'postponed'];
export const FINAL_STATUSES: LeadStatus[] = ['success', 'rejected', 'cancelled'];

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === 'string' && (LEAD_STATUSES as readonly string[]).includes(v);
}

export type EventType =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'status_changed'
  | 'note'
  | 'reminder_sent'
  | 'sla_warning'
  | 'escalated'
  | 'admin_message'
  | 'flagged'
  | 'unflagged'
  | 'viewed';

export const EVENT_LABELS: Record<EventType, string> = {
  created: 'Lid tushdi',
  assigned: 'Xodimga biriktirildi',
  reassigned: 'Boshqa xodimga o\'tkazildi',
  status_changed: 'Status o\'zgardi',
  note: 'Izoh qo\'shildi',
  reminder_sent: 'Eslatma yuborildi',
  sla_warning: 'Javob kechikkani haqida ogohlantirildi',
  escalated: 'Adminlarga xabar berildi (kechikish)',
  admin_message: 'Admin xabar yubordi',
  flagged: 'Admin belgiladi',
  unflagged: 'Belgi olib tashlandi',
  viewed: 'Xodim ko\'rdi',
};

export type ActorType = 'employee' | 'admin' | 'system';

export type DistributionStrategy = 'round_robin' | 'least_loaded' | 'manual';

export const DISTRIBUTION_LABELS: Record<DistributionStrategy, string> = {
  round_robin: 'Navbatma-navbat (round-robin)',
  least_loaded: "Eng kam ochiq lidi bor xodimga",
  manual: "Qo'lda (admin biriktiradi)",
};

export interface GroupSettings {
  distribution: DistributionStrategy;
  /** Yangi lidga necha daqiqada javob berish kerak */
  slaMinutes: number;
  /** "Keyinga qoldirildi" (sanasiz) — necha kunda eslatish */
  postponeIntervalDays: number;
  /** "Ko'tarmadi" — necha soatdan keyin qayta eslatish */
  noAnswerRetryHours: number;
  /** Faqat telefon raqami bor xabarlarni lid deb hisoblash */
  requirePhone: boolean;
  /** Bir xil raqam qayta kelsa, oldingi xodimga biriktirish */
  stickyDuplicates: boolean;
  /** Lidlarni o'qish usuli: bot (Bot API) yoki userbot (MTProto) */
  ingestVia: 'bot' | 'userbot';
}

export const DEFAULT_GROUP_SETTINGS: GroupSettings = {
  distribution: 'round_robin',
  slaMinutes: 15,
  postponeIntervalDays: 2,
  noAnswerRetryHours: 3,
  requirePhone: true,
  stickyDuplicates: true,
  ingestVia: 'bot',
};
