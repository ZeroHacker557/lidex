import type { ActorType, EventType, GroupSettings, LeadStatus } from '@shared/statuses';

export interface LeadField {
  key: string;
  value: string;
}

export interface Lead {
  id: string;
  seq: number;
  groupId: string;
  groupTitle: string;
  assignedEmployeeId: string | null;
  assignedAt: string | null;
  source: 'telegram' | 'userbot' | 'api' | 'manual';
  rawText: string;
  name: string | null;
  phone: string | null;
  phones: string[];
  telegramUsername: string | null;
  fields: LeadField[];
  status: LeadStatus;
  postponedUntil: string | null;
  nextReminderAt: string | null;
  reminderCount: number;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  flagged: boolean;
  flagNote: string | null;
  slaNotifiedAt: string | null;
  escalatedAt: string | null;
  firstActionAt: string | null;
  responseSeconds: number | null;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  lastNote: string | null;
  viewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadEvent {
  id: string;
  leadId: string;
  leadSeq: number;
  groupId: string;
  employeeId: string | null;
  actorType: ActorType;
  actorId: string | null;
  actorName: string;
  type: EventType;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus | null;
  text: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface StaffMessage {
  id: string;
  adminId: string;
  adminName: string;
  employeeId: string;
  leadId: string | null;
  leadSeq: number | null;
  leadName: string | null;
  type: 'info' | 'warning';
  text: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  ackAt: string | null;
  replyText: string | null;
}

export type RoadmapStep = 'firstStatus' | 'firstPostpone' | 'firstNote' | 'firstMessageRead';

export interface Employee {
  id: string;
  fullName: string;
  phone: string | null;
  keyHint: string;
  telegramId: number | null;
  telegramUsername: string | null;
  telegramName: string | null;
  groupIds: string[];
  isActive: boolean;
  acceptingLeads: boolean;
  onboardingDone: boolean;
  botBlocked: boolean;
  boundAt: string | null;
  lastSeenAt: string | null;
  progress?: Partial<Record<RoadmapStep, string>>;
  createdAt: string;
  online?: boolean;
  openLeads?: number;
}

export interface Group {
  id: string;
  title: string;
  chatId: number | null;
  chatType: 'group' | 'supergroup' | 'channel' | 'api';
  status: 'pending' | 'active' | 'disabled';
  ingestToken: string;
  settings: GroupSettings;
  botMember: boolean;
  leadCount: number;
  createdAt: string;
  updatedAt: string;
  employeeCount?: number;
  activeEmployeeCount?: number;
}

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: 'superadmin' | 'admin';
  groupIds: string[];
  telegramLinked: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface EmployeeStatsRow {
  id: string;
  fullName: string;
  isActive: boolean;
  acceptingLeads: boolean;
  bound: boolean;
  online: boolean;
  lastSeenAt: string | null;
  total: number;
  byStatus: Record<LeadStatus, number>;
  conversion: number;
  avgResponseSeconds: number | null;
  openNow: number;
  lateNew: number;
}

export interface Paged<T> {
  items: T[];
  nextCursor: string | null;
}

export interface InboxItem {
  id: string;
  groupId: string;
  groupTitle: string;
  chatId: number;
  messageId: number;
  text: string;
  from: string | null;
  isEdit: boolean;
  status: 'pending' | 'lead' | 'skipped' | 'failed';
  reason: string | null;
  leadId: string | null;
  leadSeq: number | null;
  attempts: number;
  messageDate: string;
  createdAt: string;
  processedAt: string | null;
}
