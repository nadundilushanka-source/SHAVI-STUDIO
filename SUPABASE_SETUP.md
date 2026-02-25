# How to Set Up Supabase for Your Website

To make your website dynamic and store your data/images, you need to connect it to Supabase.

## Step 1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com/) and sign in.
2. Click **"New Project"**.
3. Name your project (e.g., "shavi-studio").
4. Set a database password and choose a region near you (e.g., `Mumbai` or `Singapore` for Sri Lanka).
5. Click **"Create new project"**.

## Step 2: Set Up the Database Table
1. In the left sidebar, click **SQL Editor**.
2. Click **"+ New query"**.
3. Copy the content of the `fix_supabase_policies.sql` file from your project into this editor.
4. Click **Run**.
   - This will create the `app_storage` table and set up all necessary permissions.

## Step 3: Set Up Storage (for Images)
1. In the left sidebar, click **Storage**.
2. Click **"New bucket"**.
3. Name it `uploads`.
4. **IMPORTANT**: Make sure to set it to **"Public"**.
5. Click **Save**.

## Step 4: Get Your API Keys
1. In the left sidebar, click **Project Settings** (gear icon) -> **API**.
2. Copy the **Project URL**.
3. Copy the **`anon` `public`** key.

## Step 5: Update Your Code
1. Open the file `js/supabase-config.js` in your project folder.
2. Replace `supabaseUrl` and `supabaseKey` with the values you copied in Step 4.

```javascript
const supabaseUrl = "YOUR_SUPABASE_URL_HERE";
const supabaseKey = "YOUR_SUPABASE_ANON_KEY_HERE";
```

## Step 6: Test It!
1. Open your `admin.html`.
2. Login and make a change (e.g., add a service).
3. Open `index.html` or `services.html` in a different browser.
4. If you see the change, it's working!

---

**Troubleshooting:**
- If you get "Row Level Security" (RLS) errors, make sure you ran the SQL script in Step 2.
- If images aren't showing, ensure the `uploads` bucket in Storage is set to **Public**.
