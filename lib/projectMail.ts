// Text of the "you were assigned to a project" e-mail (pure; unit tested).
export interface AssignedMail { name: string; role: 'manager' | 'coordinator'; isNew: boolean; by: string; url?: string | null;
  project: { name: string; project_no?: string | null; client?: string | null; type?: string | null; city?: string | null; country?: string | null; status?: string | null; built_up_area?: number | null };
  managers: string[]; coordinators: string[] }
export const ROLE_LABEL = { manager: 'BIM Manager', coordinator: 'BIM Coordinator' } as const;
export function assignedMail(a: AssignedMail): { subject: string; text: string } {
  const p = a.project; const role = ROLE_LABEL[a.role]; const title = `${p.project_no ? p.project_no + ' · ' : ''}${p.name}`;
  const place = [p.city, p.country].filter(Boolean).join(', ');
  const lines = [`Hello ${a.name},`, '',
    a.isNew ? `A new project was created in the ECG BIM Portal and you were assigned as ${role}.` : `You were assigned as ${role} on a project in the ECG BIM Portal.`, '',
    `Project: ${p.name}`, ...(p.project_no ? [`Project No.: ${p.project_no}`] : []), ...(p.client ? [`Client: ${p.client}`] : []), ...(p.type ? [`Type: ${p.type}`] : []), ...(place ? [`Location: ${place}`] : []),
    ...(p.status ? [`Status: ${p.status}`] : []), ...(p.built_up_area ? [`Built-up area: ${Math.round(p.built_up_area).toLocaleString('en-US')} m²`] : []),
    `Your role: ${role}`, `BIM Manager: ${a.managers.join(', ') || '—'}`, `BIM Coordinator(s): ${a.coordinators.join(', ') || '—'}`, `Assigned by: ${a.by}`, '',
    'Next steps: open the project, add its contents (buildings) under "Project contents", then track the work on the BIM Process Map.',
    ...(a.url ? ['', `Open the portal: ${a.url}`] : [])];
  return { subject: `${a.isNew ? 'New project' : 'Project assignment'}: ${title} — you are ${role}`, text: lines.join('\n') };
}
