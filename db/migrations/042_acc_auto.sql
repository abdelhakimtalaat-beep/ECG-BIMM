-- ACC: remember the day of the last automatic import (the daily import runs once, at 08:00 Cairo time)
alter table acc_connection add column if not exists last_auto_date text;
