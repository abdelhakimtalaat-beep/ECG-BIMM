-- Two more sign-in roles: R&D BIM Engineer and BIM Specialist (read-only like Viewer). Safe to run more than once.
alter type app_role add value if not exists 'rd_engineer';
alter type app_role add value if not exists 'bim_specialist';
