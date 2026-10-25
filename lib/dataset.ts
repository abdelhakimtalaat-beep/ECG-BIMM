import { q } from './db';
import type { Dataset, Settings } from './types';

export async function loadDataset(): Promise<Dataset> {
  const [employees, projects, assignments, reels, settingsRows, mappings, history] = await Promise.all([
    q(`select e.id,e.employee_code,e.name,e.job_title,e.job_category,e.discipline,e.year_value,e.team_location,e.active,e.notes,e.photo_id,e.cv_id,(select a.filename from attachments a where a.id=e.cv_id) as cv_filename,e.email,
              r.manager_id as reports_to
       from employees e left join reporting_relationships r on r.employee_id=e.id and r.valid_to is null
       order by e.name`),
    q(`select id,project_no,name,cde,type,deltek_number,project_manager,technical_manager,client,built_up_area::float8 as built_up_area,area_raw,area_note,status_raw,activity_raw,status,status_source,notes,photo_id,source_rows,created_at,updated_at
       from projects order by project_no nulls last, name`),
    q(`select id,project_id,employee_id,role,package,source_row from project_assignments`),
    q(`select id,employee_id,presenter_code,presenter_name,weekday,session_date::text as session_date,topic,software,status,notes,link,attachment_id from reel_sessions order by session_date,presenter_name`),
    q(`select key,value from app_settings`),
    q(`select id,source_status,activity_flag,target_status,note from status_mappings order by source_status,activity_flag`),
    q(`select project_id,old_status,new_status,changed_at,changed_by from project_status_history order by changed_at`),
  ]);
  const s: any = {};
  for (const r of settingsRows) s[r.key] = r.value;
  const settings: Settings = {
    capacity: { max_projects_per_coordinator: null, max_projects_per_manager: null, max_area_per_coordinator: null, max_area_per_manager: null,
      hours_per_project: null, available_hours_per_person: null, imbalance_ratio: 1.5, count_statuses: ['In Progress', 'Not Started'], ...(s.capacity || {}) },
    alerts: { reel_reminder_days: 7, outlier_area: 5000000, ...(s.alerts || {}) },
  };
  return { employees, projects, assignments, reels, settings, mappings, history } as Dataset;
}
