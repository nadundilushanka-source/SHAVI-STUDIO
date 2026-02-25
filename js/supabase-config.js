
const supabaseUrl = "https://eynohdtpligflnxtmagh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5bm9oZHRwbGlnZmxueHRtYWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjI0MjUsImV4cCI6MjA4NzA5ODQyNX0.tchoaCpP--4TPUHo5F8GtOglh50QQI98mv74sIzUpGE";

// Initialize Supabase Client
// We use a different variable name to avoid conflict with the global 'supabase' object from the SDK
const _supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

// Expose globally
window.supabaseClient = _supabaseClient;
window.isSupabaseActive = !!_supabaseClient;

if (!_supabaseClient) {
    console.error("Supabase SDK not loaded. Check script tags in HTML.");
} else {
    console.log("Supabase Client Initialized via config.");
}
