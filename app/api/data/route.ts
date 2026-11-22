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
    if (me.is_guest) { // general access: project data only when a tab that needs it is enabled
      const any = (...t: string[]) => t.some((x) => canSeeTab(me, x));
      if (!any('/projects', '/projects/map', '/', '/teams', '/acc-stats', '/process-map', '/org', '/tasks')) { data.projects = []; data.assignments = []; }
      if (!any('/projects', '/projects/map', '/')) data.history = [];
    }
    return ok({ me, data }); });
}
