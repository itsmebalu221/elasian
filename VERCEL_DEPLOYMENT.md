# Vercel Deployment Instructions

## Critical Issues Fixed for Vercel

### 1. **Database Configuration**
Your `.env` file has `DB_HOST=localhost` which **won't work** on Vercel.

Update your `.env` file with your Hostinger database details:
```env
DB_HOST=your-hostinger-hostname.hostinger.com  # NOT localhost!
DB_USER=u571557595_test_elysian
DB_PASSWORD=Hitam@2026
DB_NAME=u571557595_student_forms  # Check if it has the prefix
DB_PORT=3306
```

**How to find your Hostinger database host:**
1. Login to Hostinger control panel
2. Go to Databases → MySQL Databases
3. Find your database hostname (usually looks like `sql123.hostinger.com`)
4. Also verify the exact database name (may have a prefix like `u571557595_`)

### 2. **Vercel Environment Variables**
Add these in your Vercel project settings (Settings → Environment Variables):

```
# Firebase
FIREBASE_API_KEY=AIzaSyCJOKZsFVoV77wXVhi9Q71-2EDP4jdtLFc
FIREBASE_AUTH_DOMAIN=elasian.firebaseapp.com
FIREBASE_PROJECT_ID=elasian

# Session
SESSION_SECRET=your_super_secret_session_key_change_in_production_12345

# Database (UPDATE THESE!)
DB_HOST=your-hostinger-hostname.hostinger.com
DB_USER=u571557595_test_elysian
DB_PASSWORD=Hitam@2026
DB_NAME=u571557595_student_forms
DB_PORT=3306

# Server
PORT=3000
NODE_ENV=production
APP_URL=https://elasian.vercel.app

# Cashfree
CASHFREE_APP_ID=TEST3895941a8fe6b7ceb127bac731495983
CASHFREE_SECRET_KEY=TEST60e767f554456e03ea6fff5b0542472ace53f21d
CASHFREE_ENV=SANDBOX

# Vercel Flag
VERCEL=1
```

### 3. **Session Issues (MOST IMPORTANT!)**

**Problem:** Vercel serverless functions don't maintain sessions between requests.

**Solution Applied:**
- Updated `server.js` with serverless-compatible session config
- Added `sameSite: 'none'` for cross-origin cookies
- Set proper domain for Vercel deployment

**If login still doesn't work:**
The issue is likely that sessions aren't persisting. You may need to:
- Use JWT tokens instead of sessions (requires code refactor)
- Or use an external session store like Redis (Upstash Redis works with Vercel)

### 4. **Hostinger MySQL Connection**

**Important:** Hostinger may block external database connections by default.

**To allow Vercel to connect:**
1. Login to Hostinger control panel
2. Go to Databases → Remote MySQL
3. You need to allow connections from **all IPs** (`%` or `0.0.0.0/0`) because Vercel uses dynamic IPs
4. This might not be available on all Hostinger plans

**If Hostinger doesn't allow remote connections:**
You'll need to migrate to a different database:
- **PlanetScale** (free tier, works perfectly with Vercel)
- **Railway** (MySQL hosting)
- **Neon** (Postgres, but requires code changes)
- **Vercel Postgres** (built-in, requires code changes)

### 5. **Firebase Configuration**

Make sure Firebase has your Vercel domain authorized:
1. Go to Firebase Console → Authentication → Settings
2. Add to **Authorized domains**: `elasian.vercel.app`
3. Also add any preview URLs if testing: `*.vercel.app`

### 6. **Cashfree Configuration**

Update Cashfree dashboard:
1. Go to Cashfree Dashboard → Developers → Webhooks
2. Set webhook URL: `https://elasian.vercel.app/api/payment/webhook`
3. Update return URL in Cashfree settings if needed

## Deployment Steps

1. **Fix Database Host**
   ```bash
   # Update .env with correct Hostinger hostname
   DB_HOST=sql123.hostinger.com  # Get from Hostinger
   ```

2. **Commit and Push**
   ```bash
   git add .
   git commit -m "Fix Vercel deployment configuration"
   git push
   ```

3. **Set Environment Variables in Vercel**
   - Go to your Vercel project
   - Settings → Environment Variables
   - Add all variables from the list above

4. **Redeploy**
   - Vercel will auto-deploy on push
   - Or manually trigger: Deployments → Redeploy

## Testing After Deployment

1. Check health: `https://elasian.vercel.app/health`
2. Try login: `https://elasian.vercel.app/login.html`
3. Check browser console for errors
4. Check Vercel function logs for backend errors

## Common Errors & Solutions

### Error: "Connection timeout" or "ETIMEDOUT"
- **Cause:** Can't connect to Hostinger database
- **Solution:** Verify DB_HOST is correct and remote connections are allowed

### Error: "Session not found" or constant login redirects
- **Cause:** Sessions don't work in serverless
- **Solution:** Need to implement JWT auth or use Redis for sessions

### Error: "Access denied for user"
- **Cause:** Database credentials wrong or host blocking
- **Solution:** Double-check credentials and remote access settings

### Error: "Unknown database"
- **Cause:** Database name is wrong
- **Solution:** Check if database name has prefix like `u571557595_student_forms`

## Alternative: Use Better Database for Vercel

If Hostinger doesn't work, migrate to PlanetScale (free):

1. Create account at planetscale.com
2. Create new database
3. Get connection string
4. Update these env vars:
   ```
   DB_HOST=aws.connect.psdb.cloud
   DB_USER=<from_planetscale>
   DB_PASSWORD=<from_planetscale>
   DB_NAME=<your_db_name>
   ```
5. PlanetScale works perfectly with Vercel serverless

## Need Help?

Check Vercel function logs:
- Go to Vercel Dashboard → Your Project → Logs
- Look for errors during API calls

The main issue is likely:
1. ❌ Database host is localhost (needs Hostinger remote host)
2. ❌ Hostinger blocking remote connections
3. ❌ Sessions not persisting in serverless environment
