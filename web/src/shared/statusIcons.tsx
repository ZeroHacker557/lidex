import { Ban, CircleCheckBig, CircleX, Clock3, PhoneMissed, Sparkles, type LucideIcon } from 'lucide-react';
import type { LeadStatus } from '@shared/statuses';

export const STATUS_ICON: Record<LeadStatus, LucideIcon> = {
  new: Sparkles,
  no_answer: PhoneMissed,
  postponed: Clock3,
  success: CircleCheckBig,
  rejected: CircleX,
  cancelled: Ban,
};
