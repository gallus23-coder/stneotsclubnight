# Club Night — Supabase + Netlify Setup

## Files in this package

| File | Purpose |
|------|---------|
| `index.html` | Updated app with Supabase wired in |
| `netlify.toml` | Netlify build/redirect config |
| `supabase_schema.sql` | Run once in Supabase SQL editor |

---

## Step 1 — Create a Supabase project

1. Go to https://supabase.com and create a new project
2. Once it's ready, open **SQL Editor** and paste + run the contents of `supabase_schema.sql`
   - This creates all tables, enables Row Level Security, and seeds the original player/court data

---

## Step 2 — Get your API keys

In your Supabase project go to **Project Settings → API** and copy:
- **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
- **anon / public key**

---

## Step 3 — Add your keys to index.html

Open `index.html` and find these two lines near the top of the `<script>` tag:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Replace the placeholder strings with your real values.

---

## Step 4 — Deploy to Netlify

### Option A — Netlify UI (drag & drop)
1. Go to https://app.netlify.com → **Add new site → Deploy manually**
2. Drag the folder containing these files onto the drop zone
3. Done ✅

### Option B — Connect a Git repo
1. Push these files to a GitHub/GitLab repo
2. In Netlify: **Add new site → Import an existing project**
3. Select your repo — Netlify will detect `netlify.toml` automatically
4. No build command needed, publish directory is `.`

---

## Realtime sync

The app subscribes to Supabase Realtime, so any change (player joins a court,
score recorded, etc.) automatically updates every open browser tab — great for
running the app on a display screen at the club while someone manages it on
their phone.

---

## Tightening security (optional, for later)

The current RLS policies allow anyone to read and write. Once you're ready to
add authentication, replace the open policies in Supabase with user-specific
ones, e.g.:

```sql
-- Only authenticated users can write
create policy "auth write" on players
  for insert with check (auth.role() = 'authenticated');
```
