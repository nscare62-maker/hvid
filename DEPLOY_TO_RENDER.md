# HVID — Render Deployment

## Render service settings

- **Runtime:** Python 3
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn --workers 2 --threads 4 --timeout 120 --bind 0.0.0.0:$PORT app:app`
- **Health Check Path:** `/api/health`
- **Python version:** `3.11.11` (already pinned in `.python-version`)

Render provides the `$PORT` value automatically. Do not hard-code port 3000 in the Render start command.

## Required environment variables

Set these in Render → Environment:

```text
SECRET_KEY=<strong-random-secret>
JWT_SECRET_KEY=<another-strong-random-secret>
DATABASE_URL=<your-database-connection-url>
TEXTBEE_API_KEY=<your-textbee-api-key>
TEXTBEE_DEVICE_ID=<your-textbee-device-id>
ADMIN_KEY=<strong-admin-key>
RAZORPAY_KEY_ID=<your-razorpay-key-id>
RAZORPAY_KEY_SECRET=<your-razorpay-key-secret>
OTP_EXPIRY_MINUTES=20
MAX_OTP_ATTEMPTS=3
AUTO_CREATE_DB=false
```

`DATABASE_URL` examples:

```text
mysql+pymysql://USER:PASSWORD@HOST:3306/DATABASE
postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

## Important

- Never upload or commit `.env`.
- Never commit `.venv/`, `instance/*.db`, or `__pycache__/`.
- If an old database is already populated, keep `AUTO_CREATE_DB=false`.
- If this is a brand-new empty database, temporarily set `AUTO_CREATE_DB=true` for the first deployment so SQLAlchemy can create the tables, then set it back to `false`.
- For an existing database, run `python migrate_plan_purchases.py` once with the deployment environment variables before deploying the plan purchase update.
- `init_database.py` is a destructive MySQL setup script that drops existing tables. **Do not run it against a production database unless you intentionally want to delete the existing HVID data.**

## After deployment

Open:

```text
https://YOUR-SERVICE.onrender.com/api/health
```

A healthy deployment should return JSON containing:

```json
{"status":"ok","database":"ok"}
```

If the deployment still fails, open the failed Render deployment and inspect the first `ERROR`/`Traceback` section. The exact error determines whether the remaining issue is a dependency, database connection, environment variable, or application startup problem.
