import { Ban, CircleCheckBig, CircleX, Clock3, Ghost, Hourglass, PhoneMissed, Sparkles, type LucideIcon } from 'lucide-react';
import type { LeadStatus } from '@shared/statuses';

export const STATUS_ICON: Record<LeadStatus, LucideIcon> = {
  new: Sparkles,
  no_answer: PhoneMissed,
  thinking: Hourglass,
  postponed: Clock3,
  success: CircleCheckBig,
  rejected: CircleX,
  cancelled: Ban,
  fake: Ghost,
};
