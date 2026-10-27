-- Function factor "Residential/Offices/Mixed Use" is now "Residential/Offices/Mixed Use/Other". Safe to run more than once.
update projects set function_type = 'Residential/Offices/Mixed Use/Other' where function_type = 'Residential/Offices/Mixed Use';
