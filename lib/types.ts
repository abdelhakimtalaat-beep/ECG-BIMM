export type Role = 'admin' | 'bim_manager' | 'bim_coordinator' | 'viewer';
export type Status = 'Not Started' | 'In Progress' | 'On Hold' | 'Closed';
export const STATUSES: Status[] = ['Not Started', 'In Progress', 'On Hold', 'Closed'];
export const STATUS_COLORS: Record<Status, string> = {
  'Not Started': '#9AA5B1', 'In Progress': '#1F6FC9', 'On Hold': '#E8A317', Closed: '#2E9E5B',
};
export type ReelStatus = 'Not recorded' | 'Planned' | 'Completed' | 'Postponed' | 'Cancelled';
export const REEL_STATUSES: ReelStatus[] = ['Not recorded', 'Planned', 'Completed', 'Postponed', 'Cancelled'];

export interface Employee {
  id: string; employee_code: string | null; name: string; job_title: string;
  job_category: 'department_manager' | 'bim_manager' | 'bim_coordinator' | 'bim_specialist' | 'rd_engineer' | 'other';
  discipline: string | null; year_value: number | null; team_location: string | null; active: boolean; notes: string | null;
  reports_to: string | null; photo_id?: string | null;
}
export interface Project {
  id: string; project_no: string | null; name: string; cde: string | null; type: string | null;
  built_up_area: number | null; area_raw: string | null; area_note: string | null;
  status_raw: string | null; activity_raw: string | null; status: Status; status_source: 'mapping' | 'manual';
  notes: string | null; photo_id: string | null; source_rows: number[]; created_at: string; updated_at: string;
}
export interface Assignment { id: string; project_id: string; employee_id: string; role: 'manager' | 'coordinator' | 'member'; package: string | null; source_row: number | null }
export interface Reel {
  id: string; employee_id: string | null; presenter_code: string | null; presenter_name: string; weekday: string;
  session_date: string; topic: string | null; status: ReelStatus; notes: string | null; link: string | null; attachment_id: string | null;
}
export interface Capacity {
  max_projects_per_coordinator: number | null; max_projects_per_manager: number | null;
  max_area_per_coordinator: number | null; max_area_per_manager: number | null;
  hours_per_project: number | null; available_hours_per_person: number | null;
  imbalance_ratio: number; count_statuses: Status[];
}
export interface Settings { capacity: Capacity; alerts: { reel_reminder_days: number; outlier_area: number } }
export interface StatusMapping { id: string; source_status: string; activity_flag: string; target_status: Status; note: string | null }
export interface HistoryRow { project_id: string; old_status: Status | null; new_status: Status; changed_at: string; changed_by: string | null }
export interface Dataset {
  employees: Employee[]; projects: Project[]; assignments: Assignment[]; reels: Reel[];
  settings: Settings; mappings: StatusMapping[]; history: HistoryRow[];
}
export interface Me { id: string; email: string; full_name: string | null; role: Role; employee_id: string | null }

export interface Filters {
  q: string; manager: string[]; coordinator: string[]; member: string[]; status: Status[]; cde: string[]; type: string[];
  areaMin: number | null; areaMax: number | null; dateFrom: string | null; dateTo: string | null;
}
export const EMPTY_FILTERS: Filters = { q: '', manager: [], coordinator: [], member: [], status: [], cde: [], type: [], areaMin: null, areaMax: null, dateFrom: null, dateTo: null };
