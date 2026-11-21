import { z } from 'zod';

// Shape of the summaries the browser sends after reading an ACC extract (see accSummary.ts). Totals only.
const n = z.number().finite().min(0); const counts = z.record(z.string().max(100), n);
const named = z.array(z.object({ name: z.string().max(200), count: n })).max(50);
export const accStatsSchema = z.object({
  project_id: z.string().min(8).max(100), name: z.string().max(300),
  issues: z.object({ total: n, open: n, closed: n, by_status: counts, by_type: named, by_root_cause: named, avg_close_days: n.nullable(), overdue: n, with_due_date: n,
    monthly: z.array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), opened: n, closed: n })).max(24) }),
  assignees: z.array(z.object({ key: z.string().max(120), name: z.string().max(200), kind: z.enum(['role', 'user', 'company', 'none']), total: n, by_status: counts })).max(60).optional(),
  matrix: z.array(z.object({ building: z.string().max(200), key: z.string().max(120), by_status: counts })).max(1500).optional(),
  locations: z.array(z.object({ key: z.string().max(120), name: z.string().max(400), building: z.string().max(200), total: n, by_status: counts })).max(200).optional(),
  review_detail: z.object({ total: n, in_progress: n, closed: n, void: n, overdue: n, avg_days: n.nullable(), docs: n, approved_docs: n, rejected_docs: n, by_status: counts,
    by_workflow: z.array(z.object({ name: z.string().max(200), total: n, in_progress: n, closed: n, void: n, approved_docs: n, rejected_docs: n })).max(30),
    monthly: z.array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), started: n, finished: n })).max(24),
    pending_tasks: z.array(z.object({ name: z.string().max(200), unclaimed: n, claimed: n })).max(20) }).optional(),
  reviews: z.object({ total: n, by_status: counts, open_tasks: n, unclaimed_tasks: n }), clashes: z.object({ tests: n, by_status: counts }), photos: n, meetings: n,
});
export const accUploadBody = z.object({ stats: z.array(accStatsSchema).min(1).max(500) });
