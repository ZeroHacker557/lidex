import type { ActorType, EventType, GroupSettings, LeadStatus } from '../../../shared/statuses.js';

export type AdminRole = 'superadmin' | 'admin';

export interface Admin {
  username: string;
  usernameLower: string;
  passwordHash: string;
  fullName: string;
  role: AdminRole;
  /** Oddiy admin faqat shu guruhlarni ko'radi (superadmin — hammasini) */
  groupIds: string[];
  telegramId: number | null;
  telegramLinkToken: string | null;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export type GroupStatus = 'pending' | 'active' | 'disabled';

export interface Group {
  title: string;
  /** Telegram chat id (Bot API formatida, masalan -1001234567890). API manbalarida null */
  chatId: number | null;
  chatType: 'group' | 'supergroup' | 'channel' | 'api';
  status: GroupStatus;
  /** HTTP orqali lid yuborish uchun maxfiy token */
  ingestToken: string;
  settings: GroupSettings;
  lastAssignedEmployeeId: string | null;
  botMember: boolean;
  leadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  fullName: string;
  phone: string | null;
  keyHash: string;
  /** Kalitning oxirgi 4 belgisi — adminga ko'rsatish uchun */
  keyHint: string;
  telegramId: number | null;
  telegramUsername: string | null;
  telegramName: string | null;
  groupIds: string[];
  isActive: boolean;
  /** Vaqtincha lid qabul qilmaslik (ta'til, tushlik) */
  acceptingLeads: boolean;
  onboardingDone: boolean;
  botBlocked: boolean;
  boundAt: Date | null;
  lastSeenAt: Date | null;
  lastDigestDate: string | null;
  /** Yangi xodim yo'l xaritasi (onboarding roadmap) bosqichlari */
  progress?: Partial<Record<RoadmapStep, Date>>;
  createdAt: Date;
  createdBy: string | null;
}

export type RoadmapStep = 'firstStatus' | 'firstPostpone' | 'firstNote' | 'firstMessageRead';

export type LeadSource = 'telegram' | 'userbot' | 'api' | 'manual';

export interface LeadField {
  key: string;
  value: string;
}

export interface Lead {
  /** Inson o'qiy oladigan raqam (#1024) */
  seq: number;
  groupId: string;
  groupTitle: string;
  assignedEmployeeId: string | null;
  assignedAt: Date | null;
  source: LeadSource;
  sourceChatId: number | null;
  sourceMessageId: number | null;
  rawText: string;
  name: string | null;
  phone: string | null;
  phones: string[];
  telegramUsername: string | null;
  fields: LeadField[];
  status: LeadStatus;
  postponedUntil: Date | null;
  nextReminderAt: Date | null;
  reminderCount: number;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  flagged: boolean;
  flagNote: string | null;
  slaNotifiedAt: Date | null;
  escalatedAt: Date | null;
  firstActionAt: Date | null;
  responseSeconds: number | null;
  statusChangedAt: Date | null;
  statusChangedBy: string | null;
  lastNote: string | null;
  viewedAt: Date | null;
  searchTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadEvent {
  leadId: string;
  leadSeq: number;
  groupId: string;
  /** Lid qaysi xodimga tegishli (faollik jurnalini xodim bo'yicha filtrlash uchun) */
  employeeId: string | null;
  actorType: ActorType;
  actorId: string | null;
  actorName: string;
  type: EventType;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus | null;
  text: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

export type MessageType = 'info' | 'warning';

export interface StaffMessage {
  adminId: string;
  adminName: string;
  employeeId: string;
  leadId: string | null;
  leadSeq: number | null;
  leadName: string | null;
  type: MessageType;
  text: string;
  createdAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  ackAt: Date | null;
  replyText: string | null;
}
