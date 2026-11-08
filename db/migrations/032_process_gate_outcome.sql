-- Gate nodes (decision diamonds): the outcome (Yes / No) and its date, set when the gate is Completed
alter table process_nodes add column if not exists outcome text check (outcome in ('yes','no'));
alter table process_nodes add column if not exists outcome_date date;
