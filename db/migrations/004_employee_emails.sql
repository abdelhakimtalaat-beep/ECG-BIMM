-- Employee work e-mail addresses (used to create portal users). Safe to run more than once.
-- Run once in the Supabase SQL Editor. Each address is matched to the employee by the exact name stored in the portal.
alter table employees add column if not exists email text;
create unique index if not exists employees_email_uq on employees (lower(email)) where email is not null;

update employees set email = 'Amal.Zaghloul@ecgsa.com' where name = 'Amal Zaghloul';  -- Amal Zaghloul Mahmoud
update employees set email = 'Mais.Talaat@ecgsa.com' where name = 'Mais Atwan';  -- Mais Talaat Awad
update employees set email = 'Mohamed.Elzawawy@ecgsa.com' where name = 'Mohamed Alzawawy';  -- Mohamed Samir Elzawawy
update employees set email = 'Nahla.Magdy@ecgsa.com' where name = 'Nahla Magdy';  -- Nahla Magdy Elsayed
update employees set email = 'Abdelrahman.Radwan@ecgsa.com' where name = 'Abdelrahman Radwan';  -- Abdelrahman Mohamed Radwan
update employees set email = 'Hagar.Aboelala@ecgsa.com' where name = 'Hagar Aboelala';  -- Hagar Aboelala Ahmed
update employees set email = 'Maha.Hassan@ecgsa.com' where name = 'Maha Hassan';  -- Maha Hassan Saleh
update employees set email = 'Mariam.Samuel@ecgsa.com' where name = 'Mariam Samuel';  -- Mariam Samuel Rizk
update employees set email = 'Nada.Mibrahim@ecgsa.com' where name = 'Nada Ibrahim';  -- Nada Mohamed Ibrahim
update employees set email = 'Abdelhakim.Talaat@ecgsa.com' where name = 'Abdelhakim Talaat';  -- Abdelhakim Talaat
update employees set email = 'Fatma.Idris@ecgsa.com' where name = 'Fatma Idriss';  -- Fatma Idris Saeed
update employees set email = 'Ibrahim.Abdelfattah@ecgsa.com' where name = 'Ibrahim Elghannam';  -- Ibrahim Abdelfattah Elgannam
update employees set email = 'Ibrahim.Afify@ecgsa.com' where name = 'Ibrahim Afify';  -- Ibrahim Mohamed Afify
update employees set email = 'Mahitab.Yosri@ecgsa.com' where name = 'Mahitab Yosri';  -- Mahitab Yosri Elnemr
update employees set email = 'Mahmoud.Ahussien@ecgsa.com' where name = 'Mahmoud Hussien';  -- Mahmoud Ahmed Hussien
update employees set email = 'Mahmoud.MMohamed@ecgsa.com' where name = 'Mahmoud Mostafa';  -- Mahmoud Mostafa Mohamed
update employees set email = 'Moataz.Belal@ecgsa.com' where name = 'Moataz Belal';  -- Moataz Belal Beder
update employees set email = 'Muhammed.Ghareeb@ecgsa.com' where name = 'Muhammed Ghareeb';  -- Muhammed Elsayed Ghareeb
update employees set email = 'Nesrin.Mahmoud@ecgsa.com' where name = 'Nesrin Mahmoud';  -- Nesrin Mahmoud Elgohary
update employees set email = 'Rana.Khaled@ecgsa.com' where name = 'Rana Khaled';  -- Rana Khaled hassan
update employees set email = 'Sanaa.Bastawesy@ecgsa.com' where name = 'Sanaa Ahmed';  -- Sanaa Ahmed Bastawesy

-- Check: should list 21 employees with an e-mail and none missing.
-- select name, email from employees order by name;
