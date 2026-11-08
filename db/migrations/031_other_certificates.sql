-- Other certificates of an employee: [{name, provider, doc_id}] (doc_id = the uploaded file in employee_documents). Safe to run more than once.
alter table employees add column if not exists other_certificates jsonb not null default '[]'::jsonb;
