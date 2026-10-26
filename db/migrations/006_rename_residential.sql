-- Function factor "Residential" is now "Residential/Offices/Mixed Use". Safe to run more than once.
update projects set function_type = 'Residential/Offices/Mixed Use' where function_type = 'Residential';
