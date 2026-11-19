# ACC connection – one-time setup

1. https://aps.autodesk.com → sign in → **Create app** → type **Traditional Web App**, API: *Data Management API* (and *Autodesk Construction Cloud* APIs if listed).
   Callback URL: `https://<your portal address>/api/acc/callback` (Administration > ACC shows the exact address).
2. In ACC **Account Admin → Custom Integrations → Add**: paste the app's *Client ID* (an Account Admin does this once).
3. Vercel → Project → Settings → Environment Variables (never in GitHub):
   - `APS_CLIENT_ID`, `APS_CLIENT_SECRET` – from the Autodesk app
   - `CRON_SECRET` – any long random text (Vercel sends it with the daily job)
   Then **Redeploy**.
4. Run `db/migrations/038_acc.sql` in the Supabase SQL Editor (before deploying).
5. Portal → Administration → **ACC** → **Connect ACC** → sign in with your Autodesk account → allow.
6. Press **Request extract now**, wait some minutes, press **Import now**. After that the portal imports every day at 03:00 UTC.
7. Portfolio → open a project → **ACC statistics** → choose its ACC project (projects whose number starts the ACC project name are linked automatically).

The portal sees only the ACC projects that the signed-in account may extract.

## Recommended way: schedule the extract inside ACC (no request limit)

1. In ACC, open the project as **Project Admin** > **Data Connector** (Insight) > **Schedule extraction**: choose **Daily**, a start time (for example 01:00), all services, and save.
2. In the portal, **Administration > ACC > Choose projects**: tick the projects to track and save.
3. The portal imports the newest finished extract of every tracked project by itself every day (Vercel Cron in `vercel.json`, `0 3 * * *` = 03:00 UTC = 05:00 Cairo). Keep the ACC schedule earlier than that time. To change the import time, edit the cron expression (it is in UTC) and push.
4. **Import now** does the same at any moment. The portal only reads; it creates no request at Autodesk, so Autodesk's daily request limit does not apply.
