import { z } from 'zod';
import { needsAutoReply, vacationDays } from './vacations';
const ymd = /^\d{4}-\d{2}-\d{2}$/;

const opt = (n: number) => z.string().trim().max(n).nullish().transform((v) => v || null);
export const vacationBody = z.object({
  start_date: z.string().regex(ymd), end_date: z.string().regex(ymd),
  replacement_id: z.string().uuid('Select the replacement'),
  notes: opt(4000), location: z.string().trim().min(1, 'Enter the location during the vacation').max(300), auto_reply: z.boolean().optional(),
}).superRefine((b, ctx) => {
  const d = vacationDays(b.start_date, b.end_date);
  if (!d) ctx.addIssue({ code: 'custom', message: 'The end day must not be before the start day', path: ['end_date'] });
  else if (d > 366) ctx.addIssue({ code: 'custom', message: 'A vacation request cannot be longer than a year', path: ['end_date'] });
  else if (needsAutoReply(d) && !b.auto_reply) ctx.addIssue({ code: 'custom', message: 'Tick the automatic email reply statement', path: ['auto_reply'] });
});
export const decisionBody = z.object({ approve: z.boolean(), comment: opt(1000) });
