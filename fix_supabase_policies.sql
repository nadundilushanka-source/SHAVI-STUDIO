-- Copy and paste this code into the SQL Editor in your Supabase Dashboard to fix the permission errors.

-- 1. Create the database table for storing text data (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.app_storage (
    key TEXT PRIMARY KEY,
    value JSONB
);

-- 2. Enable Row Level Security on the table
ALTER TABLE public.app_storage ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy to allow anyone (anon) to READ data
CREATE POLICY "Allow Public Select" 
ON public.app_storage 
FOR SELECT 
USING (true);

-- 4. Create a policy to allow anyone (anon) to INSERT/UPDATE/DELETE data
-- (Since your admin panel is client-side, we accept public writes for now)
CREATE POLICY "Allow Public Access" 
ON public.app_storage 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. Fix Storage Permissions for the 'uploads' bucket
-- Allow anyone to upload (INSERT) files to the 'uploads' bucket
CREATE POLICY "Allow Public Uploads" 
ON storage.objects 
FOR INSERT 
WITH CHECK ( bucket_id = 'uploads' );

-- Allow anyone to update/delete their uploads (optional, good for management)
CREATE POLICY "Allow Public Update" 
ON storage.objects 
FOR UPDATE 
USING ( bucket_id = 'uploads' );

CREATE POLICY "Allow Public Delete" 
ON storage.objects 
FOR DELETE 
USING ( bucket_id = 'uploads' );

-- Ensure the bucket is public (for viewing images) - usually done in settings but policy ensures read access
CREATE POLICY "Allow Public Read Storage" 
ON storage.objects 
FOR SELECT 
USING ( bucket_id = 'uploads' );
