import { z } from 'zod';
import { ApiError } from './auth';
import { TASK_STATUSES, commentMissing } from './tasks';

export const taskBody = z.object({
  title: z.string().trim().min(1).max(300),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  assignee_id: z.string().uuid().nullable(),
  status: z.enum(TASK_STATUSES),
  comment: z.string().trim().max(2000).nullable(),
});
export function checkComment(status: string, comment: string | null | undefined) {
  if (commentMissing(status, comment)) throw new ApiError(400, 'A comment is required when the status is Pending');
}
export function checkDates(s: string | null | undefined, d: string | null | undefined) {
  if (s && d && d < s) throw new ApiError(400, 'Due date cannot be before the start date');
}
