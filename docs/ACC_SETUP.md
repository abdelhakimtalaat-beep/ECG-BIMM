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
