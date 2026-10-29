-- Plot Area, and Scope split into Buildings scope (scope_items) and Site work scope (scope_site). Safe to run more than once.
alter table projects add column if not exists plot_area numeric;
alter table projects add column if not exists scope_site text[];
-- Infrastructure and Landscape move from the old single Scope into the Site work scope (only rows that still hold them).
update projects set
  scope_site = coalesce(scope_site, '{}') || array(select x from unnest(scope_items) x where x in ('Infrastructure','Landscape') and not x = any(coalesce(scope_site, '{}'))),
  scope_items = nullif(array(select x from unnest(scope_items) x where x not in ('Infrastructure','Landscape')), '{}')
where scope_items && array['Infrastructure','Landscape'];
