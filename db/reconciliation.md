# Import reconciliation report

Generated 2026-10-20T11:42:43

## Totals

- Workbook project rows read: 120
- Unique project records created: 119
- Assignments (one per person per project): 263
- Employees (org chart): 21
- Reel sessions: 16
- Projects with a valid numeric built-up area: 75
- Sum of valid built-up areas (unique projects): 133,322,194
- Issues: {'info': 87, 'warning': 30}

## Issues

### Error


### Warning

- **missing_project_no** · row 3 Wadi Yamm (DP01 & DP02 ) Landscape — Project has no project number (allowed; stays blank).
- **area_outlier** · row 28 INFRASTRUCTURE & LANDSCAPE DESIGN WORKS -TALAH PARK — Built-up area 53,000,000 is unusually large; check units/typo.
- **missing_project_no** · row 31 Wyoming Data Center — Project has no project number (allowed; stays blank).
- **area_outlier** · row 52 Alam Elroom — Built-up area 20,611,400 is unusually large; check units/typo.
- **missing_project_no** · row 62 GTR GB2(2024) — Project has no project number (allowed; stays blank).
- **area_non_numeric** · row 69 CFC Mall Renovation and Expansion — Built-up area: non-numeric text kept as note: 'Bid Support'
- **missing_coordinator** · row 69 CFC Mall Renovation and Expansion — No BIM Coordinator assigned in source.
- **missing_coordinator** · row 73 Ras El Hekma — No BIM Coordinator assigned in source.
- **missing_coordinator** · row 74 7068 Project Horus LESAFFRE — No BIM Coordinator assigned in source.
- **area_outlier** · row 88 SouthMED (TMG) — Built-up area 23,000,000 is unusually large; check units/typo.
- **area_outlier** · row 92 Modon OD01 East beach community — Built-up area 5,030,000 is unusually large; check units/typo.
- **area_non_numeric** · row 105 NEOM Sub station — Built-up area: non-numeric text kept as note: '2000 per site ( 5 Sites)'
- **area_non_numeric** · row 106 Hacienda Sidi Henish — Built-up area: non-numeric text kept as note: '51,000 for Hotel'
- **missing_project_no** · row 109 Port Said air port — Project has no project number (allowed; stays blank).
- **area_non_numeric** · row 113 Open Air Bridge — Built-up area: non-numeric text kept as note: 'Special case'
- **area_outlier** · row 120 Palm x — Built-up area 15,691,207 is unusually large; check units/typo.
- **duplicate_project_row** · 3389 ZED MADISON EAST — Same project number + name appears on rows [93, 123] under different managers/status (Hold vs Closed). Stored once; both assignments kept.
- **area_non_numeric** · row 124 Magna — Built-up area: non-numeric text kept as note: 'Special Case'
- **shared_project_no** · 2856 — Project number shared by distinct names (kept as separate project records / packages): Pavillion Phase 2 (row 30); TWIN HOUSE (row 36)
- **shared_project_no** · 3574 — Project number shared by distinct names (kept as separate project records / packages): Hacienda Waters (row 41); NOOR CITY-DISTRICT CENTERS 2 & 5 (row 54)
- **shared_project_no** · 3631 — Project number shared by distinct names (kept as separate project records / packages): Madinaty Central Park 1-1 (row 135); Madinaty Central Park Phase 1 Stage 1 (row 136); Madinaty Central Park Phase 2 (row 137)
- **same_name_different_no** · CFC Mall Renovation and Expansion — Same name with different project numbers: 3699 (row 59), I279 (row 69)
- **name_alias** · Nesrin Elgohary — Workbook name 'Nesrin Elgohary' matched to org-chart 'Nesrin Mahmoud'. Different surname in workbook (Elgohary) vs org chart (Mahmoud); matched by first name + role. Confirm.
- **name_alias** · Hagar Abelala — Workbook name 'Hagar Abelala' matched to org-chart 'Hagar Aboelala'. Spelling variant.
- **name_alias** · Mais Talaat — Workbook name 'Mais Talaat' matched to org-chart 'Mais Atwan'. Different surname in workbook (Talaat) vs org chart (Atwan); only one 'Mais' exists in the org chart. Confirm.
- **name_alias** · Fatma Edriss — Workbook name 'Fatma Edriss' matched to org-chart 'Fatma Idriss'. Spelling variant.
- **name_alias** · Mohamed Elzawawy — Workbook name 'Mohamed Elzawawy' matched to org-chart 'Mohamed Alzawawy'. Spelling variant.
- **missing_employee_id** · Mais Atwan — No employee ID in the org chart.
- **missing_employee_id** · Muhammed Ghareeb — No employee ID in the org chart.
- **reel_presenter_not_in_org** · C455 Reem Saied — Presenter appears in the Reel Plan but not in the org chart; kept as text, not linked to an employee.

### Info

- **subtotal_row** · BIM Teams!G13 — Subtotal formula '=SUM(G2:G4)' ignored (not a project). Its range does not cover the whole block above.
- **subtotal_row** · BIM Teams!G38 — Subtotal formula '=SUM(G15:G27)' ignored (not a project). Its range does not cover the whole block above.
- **subtotal_row** · BIM Teams!G55 — Subtotal formula '=SUM(G40:G45)' ignored (not a project). Its range does not cover the whole block above.
- **subtotal_row** · BIM Teams!G75 — Subtotal formula '=SUM(G57:G64)' ignored (not a project). Its range does not cover the whole block above.
- **subtotal_row** · BIM Teams!G82 — Subtotal formula '=SUM(G77:G80)' ignored (not a project). Its range does not cover the whole block above.
- **subtotal_row** · BIM Teams!G101 — Subtotal formula '=SUM(G84:G91)' ignored (not a project). Its range does not cover the whole block above.
- **subtotal_row** · BIM Teams!G127 — Subtotal formula '=SUM(G104:G112)' ignored (not a project). Its range does not cover the whole block above.
- **subtotal_row** · BIM Teams!G138 — Subtotal formula '=SUM(G130:G135)' ignored (not a project). Its range does not cover the whole block above.
- **missing_area** · row 3 Wadi Yamm (DP01 & DP02 ) Landscape — Built-up area missing.
- **missing_area** · row 12 Admin Building LIBYA — Built-up area missing.
- **missing_type** · row 12 Admin Building LIBYA — Type missing.
- **nonstandard_project_no** · row 17 New Plasma fractionation and Pilot Plant — Project number 'I477' is not a 4-digit number (kept as supplied).
- **nonstandard_project_no** · row 23 ENAR — Project number 'J421' is not a 4-digit number (kept as supplied).
- **missing_area** · row 24 Cotonou Cultural (QCC) — Built-up area missing.
- **nonstandard_project_no** · row 25 Med Log — Project number 'J798' is not a 4-digit number (kept as supplied).
- **missing_area** · row 25 Med Log — Built-up area missing.
- **missing_area** · row 27 WADI ROAD DESIGN COSULTANCY SERVICES — Built-up area missing.
- **missing_area** · row 29 MARASSI - RED SEA — Built-up area missing.
- **missing_area** · row 30 Pavillion Phase 2 — Built-up area missing.
- **missing_area** · row 31 Wyoming Data Center — Built-up area missing.
- **missing_area** · row 32 REHABILITATION OF ERCS'S — Built-up area missing.
- **missing_area** · row 33 RUA AL MADINAH SUPERBLOCK 5 — Built-up area missing.
- **missing_area** · row 35 Soul Gates In North Coast — Built-up area missing.
- **missing_area** · row 36 TWIN HOUSE — Built-up area missing.
- **nonstandard_project_no** · row 37 Alegeria Embassy — Project number 'j002' is not a 4-digit number (kept as supplied).
- **missing_area** · row 37 Alegeria Embassy — Built-up area missing.
- **area_cleaned** · row 44 KFUPM - COLLEGE OF DESIGN & BUILT ENVIRONMENT — Built-up area: cleaned from text '26347\xa0'
- **nonstandard_project_no** · row 48 EGSOC Cold Storage — Project number 'J584' is not a 4-digit number (kept as supplied).
- **missing_area** · row 51 Le Meridien — Built-up area missing.
- **missing_cde** · row 51 Le Meridien — CDE missing.
- **missing_type** · row 51 Le Meridien — Type missing.
- **nonstandard_project_no** · row 53 Stem Cell and Reg.Medicine — Project number 'J935' is not a 4-digit number (kept as supplied).
- **missing_area** · row 54 NOOR CITY-DISTRICT CENTERS 2 & 5 — Built-up area missing.
- **area_cleaned** · row 60 Jirian — Built-up area: formula result
- **missing_area** · row 62 GTR GB2(2024) — Built-up area missing.
- **area_cleaned** · row 64 Madinat Zayed (Al-DAFRAH - Abu Dhabi) — Built-up area: formula result
- **area_cleaned** · row 65 ZED EAST Cluster C14 — Built-up area: formula result
- **missing_area** · row 67 EIF Jeddah Shooting Range (JSR) — Built-up area missing.
- **missing_area** · row 68 EIF Riyad Shooting Range (RSR) — Built-up area missing.
- **nonstandard_project_no** · row 69 CFC Mall Renovation and Expansion — Project number 'I279' is not a 4-digit number (kept as supplied).
- **missing_type** · row 69 CFC Mall Renovation and Expansion — Type missing.
- **missing_area** · row 70 Marassi H Villa H1,H7,H8 — Built-up area missing.
- **missing_area** · row 72 Mostaqbal city — Built-up area missing.
- **nonstandard_project_no** · row 73 Ras El Hekma — Project number 'i333' is not a 4-digit number (kept as supplied).
- **missing_area** · row 73 Ras El Hekma — Built-up area missing.
- **area_cleaned** · row 80 Rwanda Heart Center — Built-up area: cleaned from text '12 815 '
- **nonstandard_project_no** · row 86 HSR - Blue Line x 16 station — Project number 'F903' is not a 4-digit number (kept as supplied).
- **nonstandard_project_no** · row 88 SouthMED (TMG) — Project number 'J277' is not a 4-digit number (kept as supplied).
- **missing_area** · row 89 Fort Capital Expansion — Built-up area missing.
- **missing_area** · row 96 DEPOT LINE 4 — Built-up area missing.
- **missing_area** · row 97 KKIA (Design Review) — Built-up area missing.
- **missing_area** · row 98 Service Nodes - The 10TH RING ROAD - Libya projects — Built-up area missing.
- **missing_area** · row 100 El Robiky 10th of Ramadan — Built-up area missing.
- **missing_area** · row 107 South Med Bridgs — Built-up area missing.
- **nonstandard_project_no** · row 108 Hamad General Hospital Safety Improvement RMP Main — Project number 'C202621' is not a 4-digit number (kept as supplied).
- **missing_area** · row 108 Hamad General Hospital Safety Improvement RMP Main — Built-up area missing.
- **missing_area** · row 109 Port Said air port — Built-up area missing.
- **nonstandard_project_no** · row 110 BANI YAS WEST — Project number '10222069' is not a 4-digit number (kept as supplied).
- **nonstandard_project_no** · row 111 Csix Revit — Project number 'BIM' is not a 4-digit number (kept as supplied).
- **missing_area** · row 111 Csix Revit — Built-up area missing.
- **missing_area** · row 112 Al Rehab Plot 14 — Built-up area missing.
- **missing_area** · row 114 Madinaty Plot 6 — Built-up area missing.
- **missing_area** · row 115 Madinaty Plot 18 — Built-up area missing.
- **missing_area** · row 116 Madinaty Plot 25 — Built-up area missing.
- **missing_area** · row 117 Al Rehab Plot 13 — Built-up area missing.
- **missing_area** · row 118 Al Rehab Plot 17 — Built-up area missing.
- **missing_area** · row 125 JDRC (Design Review) — Built-up area missing.
- **missing_area** · row 136 Madinaty Central Park Phase 1 Stage 1 — Built-up area missing.
- **missing_area** · row 137 Madinaty Central Park Phase 2 — Built-up area missing.
- **no_projects** · Muhammed Ghareeb — R&D BIM Engineer has no project assignments in the workbook.
- **no_projects** · Nada Ibrahim — BIM Specialist has no project assignments in the workbook.
- **status_values** · BIM Teams — Status values used: ['Closed', 'Hold', 'Open']. Sheet2 also lists 'Terminated' (unused).
- **reel_no_topic** · Ibrahim Elghannam 2026-08-23 — No topic in the source image yet.
- **reel_no_topic** · Moataz Belal 2026-08-26 — No topic in the source image yet.
- **reel_no_topic** · Rana Khaled 2026-08-30 — No topic in the source image yet.
- **reel_no_topic** · Sanaa Ahmed 2026-09-02 — No topic in the source image yet.
- **reel_no_topic** · Fatma Idriss 2026-09-06 — No topic in the source image yet.
- **reel_no_topic** · Nesrin Mahmoud 2026-09-09 — No topic in the source image yet.
- **reel_no_topic** · Mahmoud Hussien 2026-09-13 — No topic in the source image yet.
- **reel_no_topic** · Amal Zaghloul 2026-09-16 — No topic in the source image yet.
- **reel_no_topic** · Nahla Magdy 2026-09-20 — No topic in the source image yet.
- **reel_no_topic** · Reem Saied 2026-09-23 — No topic in the source image yet.
- **reel_no_topic** · Maha Hassan 2026-09-27 — No topic in the source image yet.
- **reel_no_topic** · Abdelrahman Radwan 2026-09-30 — No topic in the source image yet.
- **reel_no_topic** · Mahitab Yosri 2026-10-04 — No topic in the source image yet.
- **reel_no_topic** · Nada Ibrahim 2026-10-07 — No topic in the source image yet.
- **reel_status** · BIM Reel Plan — The source image has no status column. All sessions are loaded as 'Not recorded'; past sessions are NOT assumed Completed.
