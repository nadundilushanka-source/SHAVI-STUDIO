
// Database Adapter for Shavi Studio
// Uses Supabase (app_storage table) for data persistence

const DB_ADAPTER = {
    // GET Data
    async get(collectionName) {
        return this.getAny(collectionName);
    },

    // SAVE Data
    async save(collectionName, data) {
        return this.saveAny(collectionName, data);
    },

    async getAny(key) {
        if (!window.supabaseClient) {
            console.warn("Supabase not initialized, using LocalStorage fallback.");
            const local = localStorage.getItem(key);
            return local ? JSON.parse(local) : null;
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('app_storage')
                .select('value')
                .eq('key', key)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                console.warn(`[Supabase] Error fetching ${key}:`, error.message);
                return null;
            }

            return data ? data.value : null;

        } catch (e) {
            console.error(`[Adapter] Fetch Error ${key}:`, e);
            return null;
        }
    },

    async saveAny(key, data) {
        localStorage.setItem(key, JSON.stringify(data));

        if (!window.supabaseClient) return;

        try {
            const { error } = await window.supabaseClient
                .from('app_storage')
                .upsert({ key: key, value: data }, { onConflict: 'key' });

            if (error) {
                console.error(`[Supabase] Save Error ${key}:`, error.message);
                throw error;
            }

            console.log(`[Supabase] Saved ${key} successfully.`);

        } catch (e) {
            console.error(`[Adapter] Save Critical Error ${key}:`, e);
            throw e;
        }
    }
};

// Global Helper for Image Uploads
async function uploadFileToSupabase(file, folder = 'misc') {
    if (!window.supabaseClient) throw new Error("Supabase not connected");

    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

    const { data, error } = await window.supabaseClient.storage
        .from('uploads')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) throw error;

    // Get Public URL
    const { data: { publicUrl } } = window.supabaseClient.storage
        .from('uploads')
        .getPublicUrl(fileName);

    return publicUrl;
}
