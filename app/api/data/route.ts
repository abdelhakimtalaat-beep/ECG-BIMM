import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { loadDataset } from '@/lib/dataset';
import { canSeeTab, isTabRestricted } from '@/lib/tabs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return handle(async () => { const me = await requireUser(); const data = await loadDataset();
    if (isTabRestricted(me)) { // a limited read-only user only receives the data of the tabs he may open
      const any = (...t: string[]) => t.some((x) => canSeeTab(me, x));
      if (!any('/tasks')) { data.tasks = []; data.task_areas = []; }
      if (!any('/tasks', '/teams')) data.teams = [];
      if (!any('/reels', '/')) data.reels = [];
      if (!any('/contacts', '/org', '/teams', '/tasks', '/meetings')) data.employees = data.employees.map((e) => ({ ...e, email: null, mobile: null, ext: null }));
    }
    return ok({ me, data }); });
}
