// Admin Logic & Data Management
// Refactored for Supabase/Async Support

// --- DATA ACCESS HELPERS ---
// --- DATA ACCESS HELPERS ---
async function getData(key) {
    // 1. Use DB Adapter (Supabase or LocalStorage Fallback)
    // We prioritize the Adapter because it handles the source of truth.
    // In Supabase mode, it handles persistence.
    if (typeof DB_ADAPTER !== 'undefined') {
        return await DB_ADAPTER.getAny(key);
    }

    // 2. Fallback if Adapter missing
    const localData = localStorage.getItem(key);
    try {
        return localData ? JSON.parse(localData) : [];
    } catch (e) {
        return [];
    }
}

async function saveData(key, data) {
    try {
        if (typeof DB_ADAPTER !== 'undefined') {
            await DB_ADAPTER.saveAny(key, data);
            return;
        }
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Save Failed:', e);
        alert('Data Save Failed: ' + e.message);
    }
}

// --- AUTHENTICATION ---
// In a real app, this would use a database.
const ADMIN_CREDS = { user: 'Shavindi2003', pass: 'Shavindi2##3@' };

// --- SECURITY & LOGGING ---
// --- SECURITY & LOGGING ---
async function logLogin(username, success, details = {}) {
    if (!window.isSupabaseActive) return;

    try {
        let logs = await getData('shavi_security_logs') || [];

        // Get IP and Location (Optional)
        let location = 'Local/Unknown';
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            location = `${data.city}, ${data.country_name}`;
        } catch (e) { console.warn("Location fetch failed"); }

        const newLog = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            user: username,
            success: success,
            location: location,
            userAgent: navigator.userAgent,
            ...details
        };

        logs.unshift(newLog); // Add to front
        if (logs.length > 100) logs = logs.slice(0, 100); // Keep last 100

        await saveData('shavi_security_logs', logs);
    } catch (e) {
        console.error("Failed to log login:", e);
    }
}

async function checkBruteForce() {
    const attempts = JSON.parse(localStorage.getItem('login_attempts') || '[]');
    const now = Date.now();
    // Filter last 15 mins
    const recent = attempts.filter(t => now - t < 15 * 60 * 1000);

    if (recent.length >= 5) {
        throw new Error("Too many failed attempts. Try again in 15 minutes.");
    }

    localStorage.setItem('login_attempts', JSON.stringify(recent));
}

async function recordFailedAttempt() {
    const attempts = JSON.parse(localStorage.getItem('login_attempts') || '[]');
    attempts.push(Date.now());
    localStorage.setItem('login_attempts', JSON.stringify(attempts));
}

async function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('shavi_admin_logged_in');

    if (!isLoggedIn) {
        document.getElementById('loginModal').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        return;
    }

    // --- ACCESS CONTROL CHECK ---
    const currentUser = sessionStorage.getItem('shavi_admin_user') || '';
    const normalizedUser = currentUser.trim().toLowerCase();
    const isMaster = (
        normalizedUser === ADMIN_CREDS.user.toLowerCase() ||
        normalizedUser === 'nadundilushanka@gmail.com' ||
        normalizedUser === 'shavistudiolk@gmail.com'
    );

    // If not master, verify they still exist in DB
    if (!isMaster) {
        try {
            const admins = await getData('shavi_admins') || [];
            const exists = admins.some(a => a.email.toLowerCase() === normalizedUser);
            if (!exists) {
                console.warn("User no longer authorized. Logging out.");
                logout();
                return;
            }
        } catch (err) {
            console.error("Auth verification failed", err);
        }
    }

    // Critical Warning for Offline
    if (!window.isSupabaseActive) {
        // Offline logic...
    }

    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // Check Admin Button Visibility
    const btn = document.getElementById('btnAddAdmin');
    if (btn) {
        // Force show if master, otherwise hide
        btn.style.display = isMaster ? 'flex' : 'none';

        // Also check Global Button
        const globalBtn = document.getElementById('btnGlobalAddAdmin');
        if (globalBtn) {
            globalBtn.style.display = isMaster ? 'flex' : 'none';
        }
    }

    // Trigger Async Init
    initAdminData();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value.trim().toLowerCase();
    const p = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('loginError');

    try {
        await checkBruteForce();
    } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.classList.remove('hidden');
        return;
    }

    // 1. Check Hardcoded Logic
    let isAuthenticated = (u === ADMIN_CREDS.user.toLowerCase() && p === ADMIN_CREDS.pass);

    // 2. Check Additional Admins (Supabase List)
    if (!isAuthenticated) {
        try {
            const admins = await getData('shavi_admins') || [];
            const admin = admins.find(a => a.email.toLowerCase() === u && a.password === p);
            if (admin) isAuthenticated = true;
        } catch (err) {
            console.error("Admin DB check failed", err);
        }
    }

    if (isAuthenticated) {
        sessionStorage.setItem('shavi_admin_logged_in', 'true');
        // Reset Attempts
        localStorage.removeItem('login_attempts');
        sessionStorage.setItem('shavi_admin_user', u); // Store current user

        await logLogin(u, true); // Log Success
        checkAuth();
    } else {
        await recordFailedAttempt();
        await logLogin(u, false); // Log Failure
        errorMsg.textContent = "Invalid credentials";
        errorMsg.classList.remove('hidden');
    }
});

// Adding New Admin Function
// Adding New Admin Function
async function addNewAdmin(email, password) {
    const currentUser = sessionStorage.getItem('shavi_admin_user') || '';
    const normalizedUser = currentUser.trim().toLowerCase();

    // Access Control (Case Insensitive)
    const isAllowed = (
        normalizedUser === 'nadundilushanka@gmail.com' ||
        normalizedUser === 'shavistudiolk@gmail.com' ||
        normalizedUser === 'shavindi2003'
    );

    if (!isAllowed) {
        alert(`ACCESS DENIED.\n\nOnly the Super Admins can add new administrators.`);
        return;
    }

    // Normalize email
    email = email.trim().toLowerCase();

    // Basic Validation
    if (!email.includes('@')) { alert("Invalid Email"); return; }
    if (password.length < 6) { alert("Password too short"); return; }

    try {
        // Check duplicate
        let admins = await getData('shavi_admins') || [];
        if (admins.find(a => a.email === email)) {
            alert("Admin with this email already exists.");
            return;
        }

        admins.push({
            id: Date.now(),
            email: email,
            password: password,
            addedAt: new Date(),
            addedBy: currentUser
        });

        await saveData('shavi_admins', admins);

        // --- EMAIL NOTIFICATION (Manual Trigger) ---
        // Use current URL exactly as is
        const adminLink = window.location.href;
        const linkNote = window.location.protocol === 'file:' ? '\n(Note: Copy the link above and paste into your browser)' : '';

        const subjectText = "You've been granted Admin Access - Shavi Studio";
        const bodyText = `Hello,\n\nYou have been granted administrator access to the Shavi Studio website.\n\nLogin Link:\n${adminLink}${linkNote}\n\nYour Credentials:\nUsername: ${email}\nPassword: ${password}\n\nPlease keep these safe.\n\nBest regards,\nShavi Studio Admin Team`;

        // Smart Link Generation
        let actionLink;
        const isGmailUser = normalizedUser.includes('@gmail.com') || normalizedUser === 'shavindi2003';

        if (isGmailUser) {
            actionLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`;
        } else {
            actionLink = `mailto:${email}?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`;
        }

        const btnLabel = isGmailUser ? 'Open Gmail' : 'Open Email App';
        const btnIcon = isGmailUser ? 'fab fa-google' : 'fas fa-envelope';
        const targetAttr = isGmailUser ? 'target="_blank"' : '';

        const form = document.querySelector('#adminSecurityModal form');
        if (form) {
            form.innerHTML = `
                <div class="text-center py-4 animate-fade-in">
                    <div class="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center mb-4 mx-auto justify-center">
                        <i class="fas fa-check text-3xl"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 dark:text-white mb-2">Admin Added!</h3>
                    
                    <a href="${actionLink}" ${targetAttr} class="block w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-cyan-400 transition-colors mb-4 shadow-lg flex items-center justify-center gap-2">
                        <i class="${btnIcon}"></i> ${btnLabel}
                    </a>
                    
                    <button type="button" onclick="location.reload()" class="text-slate-400 text-sm underline">
                        Done (Reload)
                    </button>
                </div>
            `;
        } else {
            alert(`Admin Added!\n\nPlease manually email credentials to: ${email}`);
            location.reload();
        }

        renderAdminList();
    } catch (e) {
        console.error(e);
        alert("Failed to add admin: " + e.message);
    }
}

async function renderAdminList() {
    const tbody = document.getElementById('adminUsersList');
    if (!tbody) return;

    try {
        const admins = await getData('shavi_admins') || [];
        // Sort DESC
        admins.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

        let html = '';
        // Always show Master
        html += `
            <tr class="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                <td class="px-6 py-4 font-bold text-slate-500">Shavindi2003 <span class="text-xs bg-slate-200 px-2 py-0.5 rounded ml-2">MASTER</span></td>
                <td class="px-6 py-4 text-xs text-slate-400 font-mono">•••••••••••••</td>
                <td class="px-6 py-4 text-xs text-slate-400">System Default</td>
                <td class="px-6 py-4 text-xs text-slate-400">Cannot Remove</td>
            </tr>
        `;

        html += admins.map((admin, index) => {
            const time = admin.addedAt ? new Date(admin.addedAt).toLocaleDateString() : 'Unknown';
            // Only show delete button if current user is allowed
            const currentUser = sessionStorage.getItem('shavi_admin_user') || '';
            const normalizedUser = currentUser.trim().toLowerCase();
            const canDelete = (
                normalizedUser === 'nadundilushanka@gmail.com' ||
                normalizedUser === 'shavistudiolk@gmail.com' ||
                normalizedUser === 'shavindi2003'
            );

            const deleteBtn = canDelete
                ? `<button onclick="removeAdmin(${admin.id})" class="text-red-500 hover:text-red-700 font-bold text-xs border border-red-200 hover:border-red-500 px-3 py-1 rounded transition-all">REMOVE</button>`
                : `<span class="text-slate-300 italic text-xs">Protected</span>`;

            const passId = `admin-pass-${index}`;

            return `
                <tr class="bg-white dark:bg-slate-800 border-b dark:border-slate-700">
                    <td class="px-6 py-4 font-medium">${admin.email}</td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            <input type="password" id="${passId}" value="${admin.password}" readonly class="bg-transparent border-none w-24 text-sm text-slate-500 focus:ring-0 cursor-default">
                            <button onclick="toggleInput('${passId}', this)" class="text-slate-400 hover:text-primary"><i class="fas fa-eye"></i></button>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-500">${time}</td>
                    <td class="px-6 py-4">${deleteBtn}</td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Error loading admins</td></tr>';
    }
}

async function removeAdmin(id) {
    if (!confirm("Are you sure you want to REVOKE access for this admin?")) return;

    const currentUser = sessionStorage.getItem('shavi_admin_user') || '';
    const normalizedUser = currentUser.trim().toLowerCase();

    if (
        normalizedUser !== 'nadundilushanka@gmail.com' &&
        normalizedUser !== 'shavistudiolk@gmail.com' &&
        normalizedUser !== 'shavindi2003'
    ) {
        alert("Action Denied.");
        return;
    }

    try {
        let admins = await getData('shavi_admins') || [];
        admins = admins.filter(a => a.id !== id);
        await saveData('shavi_admins', admins);
        renderAdminList();
    } catch (e) {
        alert("Failed to remove admin.");
    }
}

function toggleInput(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function logout() {
    sessionStorage.removeItem('shavi_admin_logged_in');
    sessionStorage.removeItem('shavi_admin_user');
    location.reload();
}

// --- DATA MANAGEMENT ---
// Default Data Definitions
const defaultServices = [
    { id: 1, title: '3D Animation', desc: 'High-quality 3D modeling and animation for products, characters, and architectural visualization.', icon: 'fas fa-cube', colorClass: 'text-primary', bgClass: 'bg-blue-100 dark:bg-slate-700' },
    { id: 2, title: '2D Animation', desc: 'Engaging 2D explainer videos, character animations, and motion comics to tell your story.', icon: 'fas fa-pencil-alt', colorClass: 'text-secondary', bgClass: 'bg-pink-100 dark:bg-slate-700' },
    { id: 3, title: 'Motion Graphics', desc: 'Dynamic motion graphics for logos, intro sequences, and promotional videos.', icon: 'fas fa-film', colorClass: 'text-purple-600', bgClass: 'bg-purple-100 dark:bg-slate-700' },
    { id: 4, title: 'Video Editing', desc: 'Professional video editing, color grading, and post-production services.', icon: 'fas fa-video', colorClass: 'text-primary', bgClass: 'bg-green-100 dark:bg-slate-700' },
    { id: 5, title: 'Concept Art', desc: 'Creative concept art and character design to visualize your ideas before production.', icon: 'fas fa-paint-brush', colorClass: 'text-orange-600', bgClass: 'bg-orange-100 dark:bg-slate-700' },
    { id: 6, title: 'VR / AR Content', desc: 'Immersive Virtual and Augmented Reality experiences for modern platforms.', icon: 'fas fa-vr-cardboard', colorClass: 'text-blue-600', bgClass: 'bg-blue-100 dark:bg-slate-700' }
];

const defaultPortfolio = [
    { id: 1, title: 'Neon City 3D', category: '3d', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', isVideo: false },
    { id: 2, title: 'Character Design', category: 'char', url: 'https://images.unsplash.com/photo-1635322966219-b75ed3a90533?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', isVideo: false },
    { id: 3, title: 'Tech Intro', category: 'motion', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', isVideo: false },
    { id: 4, title: 'Product Viz', category: '3d', url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', isVideo: false },
    { id: 5, title: 'Explainer Video', category: '2d', url: 'https://images.unsplash.com/photo-1558655146-d09347e92766?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', isVideo: false },
    { id: 6, title: 'Abstract Art', category: '3d', url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', isVideo: false }
];

const defaultComments = [
    { id: 1, user: 'John Smith', text: 'The team at SHAVI STUDIO exceeded our expectations. The 3D architectural walkthrough was simply stunning.', rating: 5, status: 'approved' },
    { id: 2, user: 'Sarah Jones', text: 'Highly professional and creative. They took our vague idea and turned it into a captivating explainer video.', rating: 5, status: 'approved' },
    { id: 3, user: 'Michael Brown', text: 'Fast turnaround time and excellent communication. The character design for our game was spot on.', rating: 5, status: 'approved' }
];

const defaultPricing = [
    { id: 1, category: 'Video Production', name: 'Starter', price: '$499', unit: '/ project', features: ['Up to 30 Seconds', '1080p HD Resolution', 'Standard Assets', 'Royalty-Free Music', '2 Revisions'], isPopular: false },
    { id: 2, category: 'Video Production', name: 'Professional', price: '$999', unit: '/ project', features: ['Up to 90 Seconds', '4K Ultra HD', 'Custom Characters', 'Professional Voiceover', 'Unlimited Revisions'], isPopular: true },
    { id: 3, category: 'Video Production', name: 'Enterprise', price: 'Custom', unit: '', features: ['Full Series Production', 'Dedicated Art Director', 'Cinematic Quality', 'Source Files Included', 'Priority Support'], isPopular: false }
];

const defaultProcess = [
    { id: 1, step: 1, phase: 'Discovery', title: 'Consultation', desc: 'We discuss your vision, goals, and requirements to understand exactly what you need.', imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' },
    { id: 2, step: 2, phase: 'Strategy', title: 'Script & Storyboard', desc: 'Our creative team develops a unique concept and compelling script for your animation.', imageUrl: 'https://images.unsplash.com/photo-1626785774573-4b79931bfd54?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' },
    { id: 3, step: 3, phase: 'Creation', title: 'Production', desc: 'This is where the magic happens. We bring the characters and scenes to life through animation.', imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' },
    { id: 4, step: 4, phase: 'Launch', title: 'Final Delivery', desc: 'We deliver the final polished animation in your preferred format, ready to share with the world.', imageUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' }
];

const defaultTeam = [
    { id: 1, name: 'Pasan Shavinda', role: 'Co-Founder & Managing Director', specialization: 'Video Production, Video Editing & Graphic Design', desc: 'Video production, editing, and graphic design, ensuring every project meets the highest creative and quality standards.', imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?fit=crop&w=500&q=80' },
    { id: 2, name: 'Shavindi Manodya', role: 'Co-Founder / Creative Director', specialization: 'Creative Concepts, Ads Campaign Planning & Brand Identity Design', desc: 'Develops creative ideas, plans high-impact ad campaigns, and designs logos and brand identities, combining artistic vision with performance driven strategy.', imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?fit=crop&w=500&q=80' },
    { id: 3, name: 'Maneesha Chamodi', role: 'Voice Artist Specialist', specialization: 'Advertisement Voice | Dubbing | Voice Over', desc: 'Provides professional voice services for advertisements, dubbing, and voice over projects, bringing brands to life through sound.', imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?fit=crop&w=500&q=80' },
    { id: 4, name: 'Nadun Dilushanka', role: 'Web Developer & AI Content Specialist', specialization: 'Web Development & AI Content', desc: 'Focused on building modern websites and creating AI-powered content that helps brands grow online.', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fit=crop&w=500&q=80' },
    { id: 5, name: 'Viharshana Dedigamuwa', role: 'Content & SEO Specialist', specialization: 'Website Content | Blog Writing | SEO', desc: 'Crafts website content, blogs, and SEO-optimized captions while telling compelling brand stories, driving online visibility and audience engagement.', imageUrl: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?fit=crop&w=500&q=80' }
];

const defaultContent = {
    homeHeroTagline: 'Build Your Digital Brand 🚀',
    homeHeroTitle: 'Build Your Digital Brand with Confidence',
    homeHeroSubtitle: 'Where Strategy Meets Creativity. We create stunning digital experiences, branding, and content that bring your vision to life.',
    homeHeroImage: 'https://images.unsplash.com/photo-1626544827763-d516dce335ca?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    homeStatsCount: '50+',

    // About Page Content
    aboutHeadline: 'Where Strategy Meets Creativity',
    aboutSubheadline: "We're a passionate team of digital strategists, designers, and marketers dedicated to helping brands thrive in the digital world.",
    aboutStoryTitle: 'From Passion to Purpose',
    aboutStoryText: "Founded in 2023 by a twin brother and sister, Shavi Studio began with a passion for design. From humble creative beginnings, we've grown into a full-service digital agency, dedicated to helping brands build their identity and thrive online.\n\nCreativity is at our core.",
    aboutMission: 'To empower brands with creative, impactful digital solutions that elevate their presence and connect them with the right audience.',
    aboutVision: 'To be a top-tier digital agency delivering innovative, results-driven design and marketing solutions that elevate brands in the digital space.',

    // Stats
    stat1Num: '50+', stat1Label: 'Projects Completed',
    stat2Num: '30+', stat2Label: 'Happy Clients',
    stat3Num: '3+', stat3Label: 'Years Experience',
    stat4Num: '100K+', stat4Label: 'Impressions Generated',

    // Values
    aboutValuesTitle: 'Our Values',
    aboutValuesText: 'We focus on creativity, strategy, and results.',

    contactPhone: '+94 77 557 4661',
    contactEmail: 'shavistudiolk@gmail.com',
    contactAddress: 'Colombo, Sri Lanka',
    homeServicesTitle: 'Services That Drive Results',
    homeServicesSubtitle: 'From strategy to execution, we provide comprehensive digital solutions that elevate your brand.',
    homeCtaTitle: 'Ready to Transform Your Brand?',
    homeCtaText: "Let's create something extraordinary together. Start your journey to digital excellence today.",
    homeCtaButtonText: 'Start a Project',
    footerAboutText: 'Where Strategy Meets Creativity. We help brands grow through bold ideas, smart design, and digital mastery.',
    socialFacebook: '#',
    socialInstagram: '#',
    socialTiktok: '#',
    socialYoutube: '#'
};

const defaultCategories = [
    { value: '3d', label: '3D Animation' },
    { value: '2d', label: '2D Animation' },
    { value: 'vfx', label: 'VFX' },
    { value: 'motion', label: 'Motion Graphics' },
    { value: 'char', label: 'Character Design' }
];

// --- INITIALIZATION ---
async function initAdminData() {
    try {
        // 0. Connection Test
        if (window.isSupabaseActive) {
            console.log("Supabase active, initializing data...");
        } else {
            console.warn("Supabase not active, using LocalStorage");
        }

        // Parallel Data Fetch & Seed (Much Faster)
        const collections = [
            { key: 'shavi_services', default: defaultServices },
            { key: 'shavi_portfolio', default: defaultPortfolio },
            { key: 'shavi_comments', default: defaultComments },
            { key: 'shavi_pricing', default: defaultPricing },
            { key: 'shavi_process', default: defaultProcess },
            { key: 'shavi_team', default: defaultTeam },
            { key: 'shavi_content', default: defaultContent },
            { key: 'shavi_portfolio_categories', default: defaultCategories },
            { key: 'shavi_admins', default: [] }, // Initialize admins list
            { key: 'shavi_security_logs', default: [] }
        ];

        // Fire all requests at once
        await Promise.all(collections.map(async (col) => {
            let data = await getData(col.key);
            if (!data || (Array.isArray(data) && data.length === 0)) {
                // Special check for admins, don't overwrite if not empty array but null
                if (col.key === 'shavi_admins' && data !== null) return;

                console.log(`Seeding default data for ${col.key}`);
                await saveData(col.key, col.default);
            } else if (col.key === 'shavi_team') {
                // Check if new members are missing (e.g. Viharshana id:5) and append them
                const existingIds = new Set(data.map(d => d.id));
                let added = false;
                col.default.forEach(defMember => {
                    if (!existingIds.has(defMember.id)) {
                        data.push(defMember);
                        added = true;
                    }
                });
                if (added) await saveData('shavi_team', data);
            }
        }));

        // Initial load of all items to local cache
        await loadData();

        // Render Dashboard ONLY (Lazy load others)
        renderDashboard();

        if (window.isSupabaseActive) {
            const dashboard = document.getElementById('dashboard');
            // Remove any old warnings
            const oldWarning = dashboard.querySelector('.bg-red-600');
            if (oldWarning) oldWarning.remove();

            // UI is now in HTML, just confirm status
            const statusDot = document.getElementById('status-dot');
            if (statusDot) statusDot.classList.add('bg-green-500', 'animate-pulse');
        }

    } catch (error) {
        console.error("Critical Init Error:", error);
        alert("Failed to initialize data: " + error.message);
    }
}

// FORCE SYNC FUNCTION
async function forceSync() {
    if (!window.isSupabaseActive) {
        alert("Offline Mode: Cannot sync.");
        return;
    }

    const icon = document.getElementById('force-sync-icon');
    if (icon) icon.classList.add('fa-spin');

    try {
        await Promise.all([
            getData('shavi_services'), // Trigger refetch
            getData('shavi_portfolio'),
            getData('shavi_team')
        ]);

        document.getElementById('last-sync-time').innerText = new Date().toLocaleTimeString();
        // show toast or mini notification
    } catch (e) {
        console.error("Sync failed", e);
        alert("Sync error");
    } finally {
        if (icon) icon.classList.remove('fa-spin');
    }
}




async function loadData() {
    await renderServices();
    await renderCategories();
    await renderPortfolio();
    await renderComments();
    await renderPricing();
    await renderProcess();
    await renderTeam();
    await renderContentForms();
}

// --- CRUD OPERATIONS ---

// Generic Delete
async function deleteItem(type, id) {
    if (!confirm('Are you sure?')) return;
    const key = `shavi_${type}`;
    let list = await getData(key);
    list = list.filter(i => i.id !== id);
    await saveData(key, list);
    console.log(`Deleted ${id} from ${key}`);
    loadData();
}

// --- PROJECT NAMES (Formerly Categories) ---
async function renderCategories() {
    let list = await getData('shavi_portfolio_categories');
    const select = document.getElementById('portfolioCategory');
    if (!select) return;

    // Fix: If no project names exist, initialize defaults
    if (!list || list.length === 0) {
        console.warn("No project names found. Initializing defaults.");
        list = [
            { value: '3d-animation', label: '3D Animation' },
            { value: 'vfx', label: 'VFX' },
            { value: 'graphic-design', label: 'Graphic Design' },
            { value: 'video-editing', label: 'Video Editing' }
        ];
        await saveData('shavi_portfolio_categories', list);
    }

    const currentVal = select.value;
    select.innerHTML = list.map(c => `<option value="${c.value}">${c.label}</option>`).join('');

    // Restore selection if valid
    if (currentVal && list.some(c => c.value === currentVal)) {
        select.value = currentVal;
    }
}

// --- UTILITY: Image Compression ---
// Conserve bandwidth and storage by resizing large uploads
function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale down
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Return compressed Base64
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => reject(new Error("Image load error"));
        };
        reader.onerror = (err) => reject(err);
    });
}

async function openCategoryManager() {
    openModal('categoryModal');
    renderCategoryManagerList();
}

async function renderCategoryManagerList() {
    const list = await getData('shavi_portfolio_categories');
    const container = document.getElementById('categoryList');
    if (!container) return;

    container.innerHTML = list.map((c, index) => `
        <div class="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 p-3 rounded border dark:border-slate-600 group">
            <span class="font-medium">${c.label}</span>
            <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onclick="promptRenameCategory(${index})" class="text-blue-500 hover:text-blue-700" title="Rename Project Name"><i class="fas fa-edit"></i></button>
                 <button onclick="deleteCategory(${index})" class="text-red-500 hover:text-red-700" title="Delete Project Name & Group"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

async function handleCategoryAdd(e) {
    e.preventDefault();
    const form = e.target;
    const newName = form.newCatName.value.trim();

    if (newName) {
        const newValue = newName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        let list = await getData('shavi_portfolio_categories');

        if (list.find(c => c.value === newValue)) {
            alert('Project Name already exists!');
            return;
        }

        list.push({ value: newValue, label: newName });
        await saveData('shavi_portfolio_categories', list);

        form.reset();
        renderCategoryManagerList();
        renderCategories();
    }
}

async function deleteCategory(index) {
    if (!confirm('Delete this Project Name? Existing media items under this name will be moved to the "Other Projects" group.')) return;
    let list = await getData('shavi_portfolio_categories');
    list.splice(index, 1);
    await saveData('shavi_portfolio_categories', list);
    renderCategoryManagerList();
    renderCategories();
    renderPortfolio(); // Refresh view
}

async function promptRenameCategory(index) {
    let list = await getData('shavi_portfolio_categories');
    const cat = list[index];
    const oldVal = cat.value;
    const newName = prompt('Rename Project Name:', cat.label);
    if (newName && newName.trim() !== '') {
        const newVal = newName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        cat.label = newName.trim();
        cat.value = newVal;
        list[index] = cat;

        await saveData('shavi_portfolio_categories', list);

        // SYNC PORTFOLIO ITEMS
        let portfolio = await getData('shavi_portfolio');
        let changed = false;
        portfolio.forEach(item => {
            if (item.category === oldVal) {
                item.category = newVal;
                changed = true;
            }
        });

        if (changed) {
            await saveData('shavi_portfolio', portfolio);
            portfolioData = portfolio; // Update global cache
        }

        renderCategoryManagerList();
        renderCategories();
        renderPortfolio(); // Refresh view to show new group names
    }
}

async function editProjectNameByLabel(label) {
    let list = await getData('shavi_portfolio_categories');
    const index = list.findIndex(c => c.label === label);
    if (index > -1) {
        promptRenameCategory(index);
    } else {
        // Handle "Other Projects" or edge cases where label doesn't match entry
        const newName = prompt('Rename this group:', label);
        if (newName && newName.trim() !== '') {
            const newVal = newName.toLowerCase().replace(/[^a-z0-9]/g, '-');

            // Add to categories
            list.push({ value: newVal, label: newName.trim() });
            await saveData('shavi_portfolio_categories', list);

            // Sync portfolio items that were in the old group
            let portfolio = await getData('shavi_portfolio');
            let changed = false;
            portfolio.forEach(item => {
                // If it was "Other" (no category) or matched the raw label
                if (!item.category || item.category === label || item.category === label.toLowerCase().replace(/ /g, '-')) {
                    item.category = newVal;
                    changed = true;
                }
            });

            if (changed) {
                await saveData('shavi_portfolio', portfolio);
                portfolioData = portfolio;
            }

            renderCategories();
            renderPortfolio();
        }
    }
}

async function addNewCategory() {
    const newLabel = prompt("Enter new Project Name:");
    if (newLabel && newLabel.trim() !== "") {
        const newValue = newLabel.toLowerCase().replace(/[^a-z0-9]/g, '-');
        let list = await getData('shavi_portfolio_categories');

        if (list.find(c => c.value === newValue)) {
            alert('Project Name already exists!');
            return;
        }

        list.push({ value: newValue, label: newLabel.trim() });
        await saveData('shavi_portfolio_categories', list);
        renderCategories();

        const select = document.getElementById('portfolioCategory');
        if (select) select.value = newValue;
    }
}

// --- GENERIC EDIT ---
async function editItem(type, id) {
    const key = `shavi_${type}`;
    const list = await getData(key);
    const item = list.find(i => i.id === id);
    if (!item) return;

    if (type === 'services') {
        const form = document.querySelector('form[onsubmit="handleServiceSubmit(event)"]');
        form.reset();
        document.getElementById('serviceModalTitle').innerText = 'Edit Service';
        document.getElementById('serviceEditId').value = item.id;
        form.title.value = item.title;
        form.description.value = item.description || item.desc;
        form.icon.value = item.icon;
        document.getElementById('selectedIcon').value = item.icon;
        const iconName = document.getElementById('iconName');
        if (iconName) iconName.textContent = item.icon;
        form.imageUrl.value = item.imageUrl || '';
        openModal('serviceModal');
    } else if (type === 'pricing') {
        const form = document.querySelector('form[onsubmit="handlePricingSubmit(event)"]');
        form.reset();
        document.getElementById('pricingModalTitle').innerText = 'Edit Pricing Plan';
        document.getElementById('pricingEditId').value = item.id;
        if (form.category) form.category.value = item.category || '';
        form.name.value = item.name;
        form.price.value = item.price;
        form.unit.value = item.unit;
        form.features.value = item.features.join('\n');
        if (form.isPopular) form.isPopular.checked = !!item.isPopular;
        openModal('pricingModal');
    } else if (type === 'process') {
        const form = document.querySelector('form[onsubmit="handleProcessSubmit(event)"]');
        form.reset();
        document.getElementById('processModalTitle').innerText = 'Edit Step';
        document.getElementById('processEditId').value = item.id;
        form.step.value = item.step;
        form.phase.value = item.phase;
        form.title.value = item.title;
        form.description.value = item.desc;
        toggleProcessMediaType('url');
        form.imageUrl.value = item.imageUrl || '';
        openModal('processModal');
    } else if (type === 'portfolio') {
        const form = document.querySelector('form[onsubmit="handlePortfolioSubmit(event)"]');
        form.reset();
        document.getElementById('portfolioModalTitle').innerText = 'Edit Project Details';
        document.getElementById('portfolioEditId').value = item.id;
        form.title.value = item.title;
        form.category.value = item.category;
        form.isVideo.checked = !!item.isVideo;
        toggleVideoCover();
        toggleMediaType('url');
        form.mediaUrl.value = item.url;

        // Show Manage Files Link
        const manageContainer = document.getElementById('portfolio-manage-files-container');
        if (manageContainer) {
            manageContainer.classList.remove('hidden');
            const btn = document.getElementById('btn-manage-files');
            if (btn) btn.onclick = () => { closeModal('portfolioModal'); editPortfolioSet(item.id); };
        }

        openModal('portfolioModal');
    } else if (type === 'team') {
        const form = document.querySelector('form[onsubmit="handleTeamSubmit(event)"]');
        form.reset();
        document.getElementById('teamModalTitle').innerText = 'Edit Team Member';
        document.getElementById('teamEditId').value = item.id;
        form.name.value = item.name;
        form.role.value = item.role;
        form.specialization.value = item.specialization;
        form.desc.value = item.desc;
        const fileLabel = form.querySelector('label');
        if (fileLabel) {
            fileLabel.innerText = item.imageUrl ? `Current Photo Set (Upload new to replace)` : `Profile Photo (Upload from Device)`;
        }
        openModal('teamModal');
    }
}

// --- TEAM ---
function prepareAddPortfolio() {
    const form = document.querySelector('form[onsubmit="handlePortfolioSubmit(event)"]');
    if (form) form.reset();
    document.getElementById('portfolioEditId').value = '';
    document.getElementById('portfolioModalTitle').innerText = 'Add Portfolio Item';

    // Hide Manage Files Link (Only relevant for editing existing projects)
    const manageContainer = document.getElementById('portfolio-manage-files-container');
    if (manageContainer) manageContainer.classList.add('hidden');

    // Reset UI State
    if (typeof toggleMediaType === 'function') toggleMediaType('file');
    const preview = document.getElementById('img-preview');
    if (preview) preview.classList.add('hidden');
    const videoPreview = document.getElementById('video-preview');
    if (videoPreview) videoPreview.classList.add('hidden');

    // Ensure categories are loaded
    renderCategories();

    openModal('portfolioModal');
}
function prepareAddTeam() {
    const form = document.querySelector('form[onsubmit="handleTeamSubmit(event)"]');
    if (form) {
        form.reset();
        // Clear file input specifically if needed, likely covered by reset()
        const fileInput = form.querySelector('input[type="file"][name="mediaFile"]');
        if (fileInput) {
            fileInput.value = '';
        }
    }
    const editIdField = document.getElementById('teamEditId');
    const modalTitle = document.getElementById('teamModalTitle');

    if (editIdField) editIdField.value = '';
    if (modalTitle) modalTitle.innerText = 'Add Team Member';

    openModal('teamModal');
}

async function renderTeam() {
    let list = await getData('shavi_team');
    const container = document.getElementById('teamList');
    if (!container) return;

    container.innerHTML = list.map(item => `
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden flex flex-col items-center p-6 text-center relative group h-full">
             <div class="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="editItem('team', ${item.id})" class="text-blue-500 hover:text-blue-700"><i class="fas fa-edit"></i></button>
                <button onclick="deleteItem('team', ${item.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
             </div>
             <img src="${item.imageUrl || 'https://via.placeholder.com/150'}" class="w-32 h-32 rounded-full object-cover mb-4 border-4 border-primary/20">
             <h3 class="font-bold text-lg mb-1">${item.name}</h3>
             <span class="text-primary text-sm font-bold uppercase mb-2 block">${item.role}</span>
             <span class="text-xs text-slate-400 mb-4 block">${item.specialization}</span>
             <p class="text-slate-600 dark:text-slate-400 text-sm">${item.desc}</p>
        </div>
    `).join('');
}

async function handleTeamSubmit(e) {
    e.preventDefault();
    const form = e.target;
    // UI State
    const inputFileBlock = document.getElementById('team-input-file');
    const isFileMode = inputFileBlock && !inputFileBlock.classList.contains('hidden'); // Assuming we add toggle later or just force file
    // For now, based on user request, we enforce file upload or existing URL if not changed.

    const editId = document.getElementById('teamEditId').value;
    const file = form.mediaFile.files[0];

    const performSave = async (imgUrl) => {
        try {
            const newItem = {
                id: editId ? parseInt(editId) : Date.now(),
                name: form.name.value,
                role: form.role.value,
                specialization: form.specialization.value,
                desc: form.desc.value,
                imageUrl: imgUrl || ''
            };

            let list = await getData('shavi_team');

            if (editId) {
                const index = list.findIndex(i => i.id === parseInt(editId));
                if (index > -1) {
                    // If no new image, keep old one
                    if (!imgUrl) newItem.imageUrl = list[index].imageUrl;
                    list[index] = newItem;
                }
            } else {
                list.push(newItem);
            }

            await saveData('shavi_team', list);

            form.reset();
            document.getElementById('teamEditId').value = '';
            closeModal('teamModal');
            renderTeam();
            alert('Team member saved!');
        } catch (err) {
            console.error(err);
            alert('Save Failed: ' + err.message);
        }
    };

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                // Optional: Compress if too big, but for now strict check or rely on compressImage
                // compressImage already exists below, so we let it handle optimization
            }
            try {
                const compressedImg = await compressImage(file);
                await performSave(compressedImg);
            } catch (err) { alert(err.message); }
        } else {
            // No new file, save with empty string (or logic above handles keeping old)
            // If edit mode and no file, it keeps old. If new and no file, it's empty.
            await performSave(null);
        }
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// --- SERVICES ---
async function renderServices() {
    const list = await getData('shavi_services');
    const container = document.getElementById('servicesList');
    container.innerHTML = list.map(item => `
        <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg relative group">
            <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="editItem('services', ${item.id})" class="text-blue-400 hover:text-blue-600"><i class="fas fa-edit"></i></button>
                <button onclick="deleteItem('services', ${item.id})" class="text-red-400 hover:text-red-600"><i class="fas fa-trash"></i></button>
            </div>
            <i class="${item.icon} text-4xl text-primary mb-4"></i>
            <h3 class="text-xl font-bold mb-2">${item.title}</h3>
            <p class="text-slate-600 dark:text-slate-400 text-sm">${item.desc || item.description}</p>
        </div>
    `).join('');
}

async function handleServiceSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const editId = document.getElementById('serviceEditId').value;

    const newItem = {
        id: editId ? parseInt(editId) : Date.now(),
        title: form.title.value,
        description: form.description.value,
        icon: form.icon.value || 'fas fa-star',
        imageUrl: form.imageUrl.value || ''
    };

    let list = await getData('shavi_services');

    if (editId) {
        const index = list.findIndex(i => i.id === parseInt(editId));
        if (index > -1) list[index] = newItem;
    } else {
        list.push(newItem);
    }

    await saveData('shavi_services', list);

    form.reset();
    document.getElementById('serviceEditId').value = '';
    document.getElementById('serviceModalTitle').innerText = 'Add New Service';
    closeModal('serviceModal');
    renderServices();
}

// --- PORTFOLIO ---
// Global cache to prevent race conditions
let portfolioData = [];

async function renderPortfolio(data = null) {
    let list = data;
    if (!list) {
        // Only fetch if no data provided
        list = await getData('shavi_portfolio');
    }
    // Update global cache
    portfolioData = list || [];

    // Resolve category labels
    let categoriesList = [];
    try {
        categoriesList = await getData('shavi_portfolio_categories') || [];
    } catch (e) { }

    const container = document.getElementById('portfolioList');
    if (!container) return;

    // Show loading state if empty and first time
    if (portfolioData.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div><p class="text-slate-500">Checking for projects...</p></div>';
    }

    try {
        if (portfolioData.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-20 text-slate-500">No projects found. Add your first project using the "Add Media" button.</div>';
            return;
        }

        // 1. Group items by their raw category first
        const groupedByRaw = {};
        portfolioData.forEach(item => {
            const rawValue = item.category || 'other-projects';
            if (!groupedByRaw[rawValue]) groupedByRaw[rawValue] = [];
            groupedByRaw[rawValue].push(item);
        });

        // 2. Define Section Order based on categoriesList
        const sectionOrder = categoriesList.map(c => ({
            id: c.value,
            label: c.label,
            items: groupedByRaw[c.value] || []
        }));

        // Add "Other" if there are items not in the official category list
        const definedValues = categoriesList.map(c => c.value);
        const otherItems = portfolioData.filter(item => !definedValues.includes(item.category || ''));
        if (otherItems.length > 0) {
            sectionOrder.push({
                id: 'other-projects',
                label: 'Other Projects',
                items: otherItems
            });
        }

        let html = '';
        sectionOrder.forEach((sec) => {
            if (sec.items.length === 0) return;

            // Sort items WITHIN the section by update time
            sec.items.sort((a, b) => (b.updatedAt || b.id || 0) - (a.updatedAt || a.id || 0));

            const catName = String(sec.label || 'Other Projects');
            const itemsInSec = sec.items;
            const hasMore = itemsInSec.length > 3;

            // Category Header for Admin
            html += `
        <div class="col-span-full border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 mt-8 first:mt-0 flex justify-between items-center group">
            <div class="flex items-center gap-4">
                <h3 class="text-xl font-bold text-primary">${catName}</h3>
                <button onclick="editProjectNameByLabel('${catName.replace(/'/g, "\\'")}')" 
                        class="text-slate-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100" 
                        title="Rename Group">
                    <i class="fas fa-edit text-sm"></i>
                </button>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-xs text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">${itemsInSec.length} Items</span>
                ${hasMore ? `<button onclick="toggleAdminSection('${sec.id}')" id="btn-admin-${sec.id}" class="text-xs font-bold text-primary hover:underline">View All</button>` : ''}
            </div>
        </div>
        `;

            html += `<div class="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="admin-grid-${sec.id}">`;

            itemsInSec.forEach((item, idx) => {
                const galleryCount = item.gallery ? item.gallery.length : 1;
                const displayClass = idx >= 3 ? 'hidden' : '';

                html += `
            <div class="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden relative group border border-slate-100 dark:border-slate-700 portfolio-admin-item ${displayClass}" data-admin-sec="${sec.id}">
                 <!-- Top Actions -->
                 <div class="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-800/90 p-2 rounded-lg backdrop-blur-sm shadow-md">
                    <button onclick="editItem('portfolio', ${item.id})" class="text-blue-500 hover:text-blue-700" title="Edit Details"><i class="fas fa-edit"></i></button>
                    <button onclick="editPortfolioSet(${item.id})" class="text-green-500 hover:text-green-700" title="Manage Files"><i class="fas fa-images"></i></button>
                    <button onclick="deleteItem('portfolio', ${item.id})" class="text-red-500 hover:text-red-700" title="Delete Project"><i class="fas fa-trash"></i></button>
                 </div>

                <div class="h-48 overflow-hidden relative">
                    ${item.isVideo
                        ? `<div class="w-full h-full relative">
                        <img src="${item.coverUrl || 'https://via.placeholder.com/400x300?text=No+Cover'}" class="w-full h-full object-cover opacity-80">
                        <div class="absolute inset-0 flex items-center justify-center bg-black/30">
                            <i class="fas fa-video text-3xl text-white"></i>
                        </div>
                    </div>`
                        : `<img src="${item.url}" class="w-full h-full object-cover">`
                    }
                    ${galleryCount > 1 ? `<div class="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm"><i class="fas fa-layer-group text-primary mr-1"></i> ${galleryCount} Files</div>` : ''}
                </div>
                <div class="p-4">
                    <h3 class="font-bold truncate text-slate-800 dark:text-white" title="${item.title}">${item.title}</h3>
                    <span class="text-xs uppercase tracking-wider text-primary font-bold mt-1 block">${catName}</span>
                </div>
            </div>
            `;
            });

            html += `</div>`;
        });
        if (html === '') {
            container.innerHTML = '<div class="col-span-full text-center py-20 text-slate-500">Wait... Projects were detected but couldn\'t be grouped correctly. Try renaming them.</div>';
        } else {
            container.innerHTML = html;
        }

    } catch (err) {
        console.error("Portfolio Render Error:", err);
        container.innerHTML = `<div class="col-span-full text-center py-20 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
            <i class="fas fa-exclamation-triangle text-3xl mb-4 text-red-600"></i>
            <p class="font-bold text-lg">Display Error</p>
            <p class="text-sm opacity-70 mb-4">${err.message}</p>
            <button onclick="location.reload()" class="px-6 py-2 bg-red-600 text-white rounded-lg font-bold">Retry</button>
        </div>`;
    }
}

function toggleAdminSection(secId) {
    const grid = document.getElementById(`admin-grid-${secId}`);
    const btn = document.getElementById(`btn-admin-${secId}`);
    if (!grid) return;

    const items = grid.querySelectorAll('.portfolio-admin-item');
    const isExpanding = btn.innerText === 'View All';

    items.forEach((item, idx) => {
        if (idx >= 3) {
            if (isExpanding) item.classList.remove('hidden');
            else item.classList.add('hidden');
        }
    });

    btn.innerText = isExpanding ? 'Show Less' : 'View All';
}


async function editPortfolioSet(id) {
    // Use cache to prevent stale reads during background saves
    const list = portfolioData;
    const item = list.find(i => i.id === id);
    if (!item) return;

    const modal = document.getElementById('editSetModal');
    const container = document.getElementById('editSetList');

    const gallery = item.gallery || [{ url: item.url, coverUrl: item.coverUrl, isVideo: item.isVideo }];

    container.innerHTML = gallery.map((media, idx) => `
        <div class="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            <img src="${media.isVideo ? (media.coverUrl || 'https://via.placeholder.com/400x300?text=Video') : media.url}" class="w-full h-full object-cover">
            <button onclick="deleteFromSet(${item.id}, ${idx})" class="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700">
                <i class="fas fa-times"></i>
            </button>
            ${media.isVideo ? '<div class="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded">Video</div>' : ''}
        </div>
    `).join('');

    modal.classList.remove('hidden');
}

async function deleteFromSet(projectId, itemIndex) {
    if (!confirm('Remove this file from the project?')) return;
    let list = await getData('shavi_portfolio');
    const index = list.findIndex(i => i.id === projectId);
    if (index === -1) return;

    let item = list[index];
    let gallery = item.gallery || [{ url: item.url, coverUrl: item.coverUrl, isVideo: item.isVideo }];

    if (gallery.length <= 1) {
        alert("Cannot delete the last item. Delete the whole project instead.");
        return;
    }

    gallery.splice(itemIndex, 1);
    item.gallery = gallery;
    item.coverUrl = gallery[0].coverUrl;
    item.isVideo = gallery[0].isVideo;
    item.updatedAt = Date.now(); // Update timestamp on delete

    list[index] = item;
    await saveData('shavi_portfolio', list);

    renderPortfolio();
    editPortfolioSet(projectId);
}

// Handler: Submit Portfolio
async function handlePortfolioSubmit(e) {
    e.preventDefault();
    const form = e.target;
    // UI State
    const inputFileBlock = document.getElementById('input-file');
    const isFileMode = inputFileBlock && !inputFileBlock.classList.contains('hidden');
    const isVideo = form.isVideo.checked;
    const editId = document.getElementById('portfolioEditId').value;

    const performSave = async (mainUrl, coverUrl) => {
        try {
            const title = form.title.value.trim();
            const category = form.category.value;
            if (!title) { alert('Please enter a project title.'); return; }
            if (!editId && !mainUrl && !isFileMode) { console.error("No media provided"); return; } // Safety

            // Use CACHE for consistency
            let list = portfolioData;
            if (!list || list.length === 0) list = await getData('shavi_portfolio');

            // EDIT MODE
            if (editId) {
                const index = list.findIndex(i => i.id === parseInt(editId));
                if (index > -1) {
                    const item = list[index];
                    item.title = title;
                    item.category = category;
                    if (mainUrl) {
                        item.url = mainUrl;
                        item.coverUrl = coverUrl || mainUrl;
                        item.isVideo = isVideo;
                        // Update 0th gallery item
                        if (item.gallery && item.gallery.length > 0) {
                            item.gallery[0] = { url: item.url, coverUrl: item.coverUrl, isVideo: item.isVideo };
                        } else {
                            item.gallery = [{ url: item.url, coverUrl: item.coverUrl, isVideo: item.isVideo }];
                        }
                    }
                    item.updatedAt = Date.now(); // Update timestamp
                    list[index] = item;
                    saveData('shavi_portfolio', list); // Background save
                    form.reset();
                    document.getElementById('portfolioEditId').value = '';
                    closeModal('portfolioModal');
                    renderPortfolio(list);
                    return;
                }
            }

            // NEW ITEM MODE
            const newMedia = { url: mainUrl, coverUrl: coverUrl || mainUrl, isVideo: isVideo };

            // Critical Validation: Ensure we actually have an image URL
            if (!newMedia.url || newMedia.url.length < 20) {
                alert("Image processing failed. Please try again with a valid image.");
                return;
            }

            // CHECK FOR EXISTING SET (Same Project Name and Media Label)
            const existingIndex = list.findIndex(i =>
                i.title.trim().toLowerCase() === title.trim().toLowerCase() &&
                i.category === category
            );

            if (existingIndex > -1) {
                const existing = list[existingIndex];
                if (!existing.gallery) {
                    existing.gallery = [{ url: existing.url, coverUrl: existing.coverUrl || existing.url, isVideo: existing.isVideo }];
                }

                // Add new media to the START of the gallery (so it appears first in lightbox)
                existing.gallery.unshift(newMedia);

                // Update the Main Cover if it has a valid thumbnail
                const hasValidCover = !newMedia.isVideo || (newMedia.coverUrl && newMedia.coverUrl !== newMedia.url);
                if (hasValidCover) {
                    existing.url = newMedia.url;
                    existing.coverUrl = newMedia.coverUrl;
                    existing.isVideo = newMedia.isVideo;
                }

                existing.updatedAt = Date.now();
                list[existingIndex] = existing;
            } else {
                const newItem = {
                    id: Date.now(),
                    updatedAt: Date.now(),
                    title: title,
                    category: category,
                    url: mainUrl,
                    coverUrl: coverUrl || mainUrl,
                    isVideo: isVideo,
                    gallery: [newMedia]
                };
                list.unshift(newItem);
            }

            // Sync global cache immediately
            portfolioData = list;

            saveData('shavi_portfolio', list);
            form.reset();
            closeModal('portfolioModal');
            renderPortfolio(list);

        } catch (err) {
            console.error(err);
            alert('Save Failed: ' + err.message);
        }
    };

    // Media Processing
    const processMain = async () => {
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            if (editId) {
                const hasFile = isFileMode && form.mediaFile.files.length > 0;
                const hasUrl = !isFileMode && form.mediaUrl.value.trim() !== '';
                if (!hasFile && !hasUrl) {
                    await performSave(null, null); // Just metadata update
                    return;
                }
            }

            if (isFileMode) {
                const file = form.mediaFile.files[0];
                if (!file) { throw new Error('Please select an image file.'); }

                // Client-side Size Validation (2MB)
                if (file.size > 2 * 1024 * 1024) {
                    throw new Error('File is too large! Please choose an image under 2MB.');
                }

                // Upload Main File
                const publicUrl = await uploadFileToSupabase(file, 'portfolio');

                // Handle optional cover
                if (isVideo && form.coverFile.files.length > 0) {
                    const cover = form.coverFile.files[0];
                    if (cover.size > 2 * 1024 * 1024) {
                        throw new Error('Cover image is too large! Max 2MB.');
                    }
                    const coverUrl = await uploadFileToSupabase(cover, 'portfolio-covers');
                    await performSave(publicUrl, coverUrl);
                } else {
                    await performSave(publicUrl, null);
                }
            } else {
                const url = form.mediaUrl.value.trim();
                if (!url) { throw new Error('URL Required'); }
                // Handle optional cover (File Upload for cover even if Main is URL)
                if (isVideo && form.coverFile.files.length > 0) {
                    const cover = form.coverFile.files[0];
                    if (cover.size > 2 * 1024 * 1024) {
                        throw new Error('Cover image is too large! Max 2MB.');
                    }
                    const coverUrl = await uploadFileToSupabase(cover, 'portfolio-covers');
                    await performSave(url, coverUrl);
                } else {
                    await performSave(url, null);
                }
            }
        } catch (err) {
            alert(err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    };

    processMain();
}

// --- COMMENTS ---
async function renderComments() {
    const list = await getData('shavi_comments');
    const container = document.getElementById('commentsList');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500">No comments found.</td></tr>';
        return;
    }

    container.innerHTML = list.map(item => `
        <tr>
            <td class="px-6 py-4 font-medium">${item.user || 'Anonymous'}</td>
            <td class="px-6 py-4 text-sm">${item.text}</td>
            <td class="px-6 py-4 text-yellow-500">${'★'.repeat(item.rating)}</td>
            <td class="px-6 py-4"><span class="px-2 py-1 rounded-full text-xs ${item.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${item.status}</span></td>
            <td class="px-6 py-4">
                ${item.status === 'pending' ? `<button onclick="updateComment(${item.id}, 'approved')" class="text-green-500 hover:text-green-700 mr-2"><i class="fas fa-check"></i></button>` : ''}
                <button onclick="editComment(${item.id})" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteItem('comments', ${item.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function updateComment(id, status) {
    let list = await getData('shavi_comments');
    const item = list.find(i => i.id === id);
    if (item) {
        item.status = status;
        await saveData('shavi_comments', list);
        renderComments();
    }
}

async function editComment(id) {
    let list = await getData('shavi_comments');
    const item = list.find(i => i.id === id);
    if (!item) return;
    const newText = prompt("Edit Review Text:", item.text);
    if (newText !== null) {
        item.text = newText;
        await saveData('shavi_comments', list);
        renderComments();
    }
}

// --- PRICING ---
async function renderPricing() {
    const list = await getData('shavi_pricing');
    const container = document.getElementById('pricingList');
    if (!container) return;

    const categories = {};
    list.forEach(item => {
        const cat = item.category || 'Other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
    });

    let html = '';
    for (let cat in categories) {
        html += `
        <div class="col-span-full border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 mt-8 first:mt-0 flex justify-between items-center group">
            <h3 class="text-2xl font-bold text-primary">${cat}</h3>
            <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onclick="addPlanToCategory('${cat.replace(/'/g, "\\'")}')" class="text-green-500 hover:text-green-600 bg-white dark:bg-slate-800 rounded px-2 py-1 shadow text-sm font-bold flex items-center gap-1" title="Add Plan to this Category"><i class="fas fa-plus"></i></button>
                 <button onclick="renamePricingCategory('${cat.replace(/'/g, "\\'")}')" class="text-blue-500 hover:text-blue-600 bg-white dark:bg-slate-800 rounded px-2 py-1 shadow" title="Rename Title"><i class="fas fa-edit"></i></button>
                 <button onclick="deletePricingCategory('${cat.replace(/'/g, "\\'")}')" class="text-red-500 hover:text-red-600 bg-white dark:bg-slate-800 rounded px-2 py-1 shadow" title="Delete ALL plans in title"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        `;
        html += categories[cat].map(item => {
            const isPop = item.isPopular;
            const bgClasses = isPop
                ? 'bg-[#1e293b] border border-primary'
                : 'bg-white dark:bg-slate-800 border-2 border-transparent';

            const titleColor = isPop ? 'text-white' : 'text-slate-800 dark:text-slate-200';
            const priceColor = 'text-primary';
            const textColor = isPop ? 'text-slate-400' : 'text-slate-600 dark:text-slate-400';

            return `
            <div class="${bgClasses} p-6 rounded-xl shadow-lg relative group">
                <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/50 p-1 rounded backdrop-blur">
                    <button onclick="editItem('pricing', ${item.id})" class="text-blue-400 hover:text-blue-300 px-2"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteItem('pricing', ${item.id})" class="text-red-400 hover:text-red-300 px-2"><i class="fas fa-trash"></i></button>
                </div>
                <h3 class="text-xl font-bold mb-2 ${titleColor}">${item.name}</h3>
                <div class="text-4xl font-bold mb-4 ${priceColor}">${item.price} <span class="text-sm text-slate-500 font-normal">${item.unit}</span></div>
                <ul class="text-sm space-y-2 ${textColor} font-light tracking-wide">
                    ${item.features.map(f => `<li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> ${f}</li>`).join('')}
                </ul>
            </div>
            `;
        }).join('');
    }
    container.innerHTML = html;
}

function addPlanToCategory(cat) {
    const form = document.querySelector('form[onsubmit="handlePricingSubmit(event)"]');
    form.reset();
    document.getElementById('pricingModalTitle').innerText = 'Add Pricing Plan';
    document.getElementById('pricingEditId').value = '';
    if (form.category) form.category.value = cat;
    if (form.isPopular) form.isPopular.checked = false;
    openModal('pricingModal');
}

async function handlePricingSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const editId = document.getElementById('pricingEditId').value;

    const newItem = {
        id: editId ? parseInt(editId) : Date.now(),
        category: form.category.value,
        name: form.name.value,
        price: form.price.value,
        unit: form.unit.value,
        features: form.features.value.split('\n').filter(line => line.trim() !== ''),
        isPopular: form.isPopular ? form.isPopular.checked : false
    };

    let list = await getData('shavi_pricing');
    if (editId) {
        const index = list.findIndex(i => i.id === parseInt(editId));
        if (index > -1) {
            list[index] = newItem;
        }
    } else {
        list.push(newItem);
    }

    await saveData('shavi_pricing', list);
    form.reset();
    document.getElementById('pricingEditId').value = '';
    closeModal('pricingModal');
    renderPricing();
}

async function renamePricingCategory(oldCat) {
    const newCat = prompt("Rename Plan Title/Category:", oldCat);
    if (!newCat || newCat.trim() === '' || newCat === oldCat) return;

    let list = await getData('shavi_pricing');
    list.forEach(item => {
        if ((item.category || 'Other') === oldCat) {
            item.category = newCat.trim();
        }
    });
    await saveData('shavi_pricing', list);
    renderPricing();
}

async function deletePricingCategory(cat) {
    if (!confirm(`Are you sure you want to delete ALL plans under "${cat}"?`)) return;

    let list = await getData('shavi_pricing');
    list = list.filter(item => (item.category || 'Other') !== cat);
    await saveData('shavi_pricing', list);
    renderPricing();
}

// --- PROCESS ---
async function renderProcess() {
    let list = await getData('shavi_process');
    const container = document.getElementById('processList');
    if (!container) return;
    list.sort((a, b) => a.step - b.step);
    container.className = 'grid grid-cols-1 gap-6';

    container.innerHTML = list.map(item => `
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row relative group border border-slate-100 dark:border-slate-700">
             <div class="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="editItem('process', ${item.id})" class="bg-white/90 p-2 rounded-full text-blue-500 hover:text-blue-700 shadow-sm"><i class="fas fa-edit"></i></button>
                <button onclick="deleteItem('process', ${item.id})" class="bg-white/90 text-red-500 p-2 rounded-full hover:bg-red-500 hover:text-white shadow-sm"><i class="fas fa-trash"></i></button>
             </div>
            <div class="md:w-1/3 aspect-video md:aspect-auto relative shrink-0">
                <img src="${item.imageUrl || 'https://via.placeholder.com/300x200'}" class="w-full h-full object-cover">
                <div class="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    ${item.phase ? `Phase: ${item.phase}` : 'No Phase'}
                </div>
            </div>
            <div class="p-6 flex flex-col justify-center flex-grow">
                <div class="flex items-center gap-3 mb-2">
                    <div class="w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center text-sm shadow-md shadow-primary/30">${item.step}</div>
                    <h4 class="font-bold text-lg">${item.title}</h4>
                </div>
                <p class="text-slate-600 dark:text-slate-400 text-sm mb-3">${item.desc}</p>
            </div>
        </div>
    `).join('');
}

async function handleProcessSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const isFile = !document.getElementById('process-input-file').classList.contains('hidden');
    const editId = document.getElementById('processEditId').value;

    let list = await getData('shavi_process');
    let oldItem = editId ? list.find(i => i.id === parseInt(editId)) : null;

    const saveProcess = async (imageUrl) => {
        const newItem = {
            id: editId ? parseInt(editId) : Date.now(),
            step: parseInt(form.step.value),
            phase: form.phase.value || '',
            title: form.title.value,
            imageUrl: imageUrl || (oldItem ? oldItem.imageUrl : ''),
            desc: form.description.value
        };

        if (editId) {
            const index = list.findIndex(i => i.id === parseInt(editId));
            if (index > -1) list[index] = newItem;
        } else {
            list.push(newItem);
        }

        await saveData('shavi_process', list);
        form.reset();
        document.getElementById('processEditId').value = '';
        closeModal('processModal');
        toggleProcessMediaType('file');
        renderProcess();
    };

    if (isFile) {
        const file = form.mediaFile.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = function () { saveProcess(reader.result); };
            reader.readAsDataURL(file);
        } else {
            if (editId && oldItem) saveProcess(oldItem.imageUrl);
            else alert('Select an image.');
        }
    } else {
        const url = form.imageUrl.value;
        if (url) saveProcess(url);
        else if (editId && oldItem) saveProcess(oldItem.imageUrl);
        else alert('Enter URL.');
    }
}

// --- CONTENT PAGE ---
async function renderContentForms() {
    const data = await getData('shavi_content');
    // Helper
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    if (!data) return;

    setVal('homeHeroTagline', data.homeHeroTagline);
    setVal('homeHeroTitle', data.homeHeroTitle);
    setVal('homeHeroSubtitle', data.homeHeroSubtitle);
    setVal('homeHeroImage', data.homeHeroImage);
    setVal('homeStatsCount', data.homeStatsCount);
    // Correct mapping for About Content
    setVal('aboutHeadline', data.aboutHeadline);
    setVal('aboutSubheadline', data.aboutSubheadline);
    setVal('aboutStoryTitle', data.aboutStoryTitle);
    setVal('aboutStoryText', data.aboutStoryText);
    setVal('aboutMission', data.aboutMission);
    setVal('aboutVision', data.aboutVision);

    setVal('stat1Num', data.stat1Num);
    setVal('stat1Label', data.stat1Label);
    setVal('stat2Num', data.stat2Num);
    setVal('stat2Label', data.stat2Label);
    setVal('stat3Num', data.stat3Num);
    setVal('stat3Label', data.stat3Label);
    setVal('stat4Num', data.stat4Num);
    setVal('stat4Label', data.stat4Label);
    setVal('aboutValuesTitle', data.aboutValuesTitle); // New
    setVal('aboutValuesText', data.aboutValuesText);   // New

    // Services Header, CTA, Footer
    setVal('homeServicesTitle', data.homeServicesTitle);
    setVal('homeServicesSubtitle', data.homeServicesSubtitle);
    setVal('homeCtaTitle', data.homeCtaTitle);
    setVal('homeCtaText', data.homeCtaText);
    setVal('homeCtaButtonText', data.homeCtaButtonText);
    setVal('footerAboutText', data.footerAboutText);
    setVal('socialFacebook', data.socialFacebook);
    setVal('socialInstagram', data.socialInstagram);
    setVal('socialTiktok', data.socialTiktok);
    setVal('socialYoutube', data.socialYoutube);

    setVal('contactPhone', data.contactPhone);
    setVal('contactEmail', data.contactEmail);
    setVal('contactAddress', data.contactAddress);
}

async function handleContentSubmit(e) {
    if (e) e.preventDefault();
    const form = document.getElementById('contentForm'); // Ensure we get the form explicitly
    if (!form) return;

    const saveContent = async (heroImgVal) => {
        const content = {
            homeHeroTagline: form.homeHeroTagline.value,
            homeHeroTitle: form.homeHeroTitle.value,
            homeHeroSubtitle: form.homeHeroSubtitle.value,
            homeHeroImage: heroImgVal,
            homeStatsCount: form.homeStatsCount.value,

            // About
            aboutHeadline: form.aboutHeadline.value,
            aboutSubheadline: form.aboutSubheadline.value,
            aboutStoryTitle: form.aboutStoryTitle.value,
            aboutStoryText: form.aboutStoryText.value,
            aboutMission: form.aboutMission.value,
            aboutVision: form.aboutVision.value,
            aboutValuesTitle: form.aboutValuesTitle.value,
            aboutValuesText: form.aboutValuesText.value,

            // Stats
            stat1Num: form.stat1Num.value,
            stat1Label: form.stat1Label.value,
            stat2Num: form.stat2Num.value,
            stat2Label: form.stat2Label.value,
            stat3Num: form.stat3Num.value,
            stat3Label: form.stat3Label.value,
            stat4Num: form.stat4Num.value,
            stat4Label: form.stat4Label.value,

            // Services Header & CTA
            homeServicesTitle: form.homeServicesTitle.value,
            homeServicesSubtitle: form.homeServicesSubtitle.value,
            homeCtaTitle: form.homeCtaTitle.value,
            homeCtaText: form.homeCtaText.value,
            homeCtaButtonText: form.homeCtaButtonText.value,

            // Footer & Social
            footerAboutText: form.footerAboutText.value,
            socialFacebook: form.socialFacebook.value,
            socialInstagram: form.socialInstagram.value,
            socialTiktok: form.socialTiktok.value,
            socialYoutube: form.socialYoutube.value,

            // Contact
            contactPhone: form.contactPhone.value,
            contactEmail: form.contactEmail.value,
            contactAddress: form.contactAddress.value
        };
        await saveData('shavi_content', content);
        alert('Site content updated!');
    };

    // simplified check
    const isHeroFile = document.getElementById('homeHeroImageFileGroup') && !document.getElementById('homeHeroImageFileGroup').classList.contains('hidden');
    if (isHeroFile && form.homeHeroImageFile.files.length > 0) {
        const reader = new FileReader();
        reader.onloadend = function () { saveContent(reader.result); };
        reader.readAsDataURL(form.homeHeroImageFile.files[0]);
    } else {
        saveContent(form.homeHeroImage.value);
    }
}

// Reuse utils
function toggleHomeHeroMediaType(type) {
    const fileGroup = document.getElementById('homeHeroImageFileGroup');
    const urlGroup = document.getElementById('homeHeroImageUrlGroup');
    const btnFile = document.getElementById('btn-hero-file');
    const btnUrl = document.getElementById('btn-hero-url');
    if (type === 'file') {
        fileGroup.classList.remove('hidden'); urlGroup.classList.add('hidden');
        btnFile.classList.add('text-primary', 'border-primary'); btnFile.classList.remove('text-slate-500', 'border-transparent');
        btnUrl.classList.remove('text-primary', 'border-primary'); btnUrl.classList.add('text-slate-500', 'border-transparent');
    } else {
        fileGroup.classList.add('hidden'); urlGroup.classList.remove('hidden');
        btnUrl.classList.add('text-primary', 'border-primary'); btnUrl.classList.remove('text-slate-500', 'border-transparent');
        btnFile.classList.remove('text-primary', 'border-primary'); btnFile.classList.add('text-slate-500', 'border-transparent');
    }
}
async function switchTab(tabId) {
    if (!tabId) return;

    // 1. Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    // 2. Show selected tab
    const selected = document.getElementById(tabId + '-tab');
    if (selected) {
        selected.classList.remove('hidden');
    }

    // 3. Highlight Sidebar Button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        // Reset state
        btn.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-primary', 'shadow-md');

        // Check if this button matches the tab
        const onclickVal = btn.getAttribute('onclick');
        if (onclickVal && onclickVal.includes(`'${tabId}'`)) {
            btn.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-primary', 'shadow-md');
        }
    });

    // 4. Lazy Load Data
    console.log(`Switching to tab: ${tabId}`);
    switch (tabId) {
        case 'services': await renderServices(); break;
        case 'portfolio':
            await renderCategories();
            await renderPortfolio();
            break;
        case 'comments': await renderComments(); break;
        case 'pricing': await renderPricing(); break;
        case 'process': await renderProcess(); break;
        case 'team': await renderTeam(); break;
        case 'content': await renderContentForms(); break;
        case 'security':
            await renderAdminList();
            await renderSecurityLogs();
            break;
    }
}

// --- SECURITY LOGS ---
async function renderSecurityLogs() {
    const tbody = document.getElementById('securityLogsList');
    if (!tbody) return;

    if (!window.isSupabaseActive) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Logs unavailable in Offline Mode</td></tr>';
        return;
    }

    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Loading...</td></tr>';

    try {
        const logs = await getData('shavi_security_logs') || [];

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">No logs found.</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const time = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown';
            const statusClass = log.success ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
            const statusText = log.success ? 'Success' : 'Failed';

            return `
                <tr class="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td class="px-6 py-4 font-mono text-[10px] sm:text-xs">${time}</td>
                    <td class="px-6 py-4 font-bold">${log.user}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold ${statusClass}">${statusText}</span></td>
                    <td class="px-6 py-4 text-sm">${log.location || '-'}</td>
                    <td class="px-6 py-4 text-[10px] text-slate-500 truncate max-w-[100px] sm:max-w-xs" title="${log.userAgent}">${log.userAgent}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Error loading logs</td></tr>';
    }
}
// The previous code didn't highlight specific button based on ID, so we skip complex highlighting logic for now 
// or rely on the onClick adding classes if implemented elsewhere, but the previous code removed classes.
// Let's just fix the Data Loading.)

// Lazy Load Data

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// Icons and UI
const iconList = ['fas fa-paint-brush', 'fas fa-palette', 'fas fa-pen-nib', 'fas fa-pencil-alt', 'fas fa-layer-group', 'fas fa-film', 'fas fa-video', 'fas fa-camera', 'fas fa-play-circle', 'fas fa-code', 'fas fa-laptop-code', 'fas fa-desktop', 'fas fa-mobile-alt', 'fas fa-star', 'fas fa-users', 'fas fa-rocket'];
function renderIcons() {
    const grid = document.getElementById('iconGrid'); if (!grid) return;
    grid.innerHTML = iconList.map(icon => `<div onclick="selectIcon('${icon}')" class="icon-option p-2 rounded cursor-pointer hover:bg-primary/20 text-center text-xl text-slate-600 dark:text-slate-300" title="${icon}"><i class="${icon}"></i></div>`).join('');
}
function selectIcon(i) {
    document.getElementById('selectedIcon').value = i;
    document.getElementById('iconName').textContent = i;
}
function filterIcons() {
    // simplified
}
document.addEventListener('DOMContentLoaded', renderIcons);

// Clean up helper
// Clean up helper
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const cvs = document.createElement('canvas');
                let w = img.width; let h = img.height;
                if (w > 800) { h *= 800 / w; w = 800; }
                cvs.width = w; cvs.height = h;
                const ctx = cvs.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = cvs.toDataURL('image/jpeg', 0.6);
                if (dataUrl && dataUrl.length > 100) {
                    resolve(dataUrl);
                } else {
                    reject(new Error("Image compression failed"));
                }
            };
            img.onerror = () => reject(new Error("Invalid image file"));
        };
        reader.onerror = () => reject(new Error("File read error"));
    });
}
// Button toggle helpers with UI feedback
function toggleMediaType(t) {
    const fi = document.getElementById('input-file');
    const ui = document.getElementById('input-url');
    const btnFile = document.getElementById('btn-file');
    const btnUrl = document.getElementById('btn-url');

    if (t === 'file') {
        fi.classList.remove('hidden'); ui.classList.add('hidden');
        btnFile.classList.add('text-primary', 'border-primary'); btnFile.classList.remove('text-slate-500', 'border-transparent');
        btnUrl.classList.remove('text-primary', 'border-primary'); btnUrl.classList.add('text-slate-500', 'border-transparent');
    } else {
        fi.classList.add('hidden'); ui.classList.remove('hidden');
        btnUrl.classList.add('text-primary', 'border-primary'); btnUrl.classList.remove('text-slate-500', 'border-transparent');
        btnFile.classList.remove('text-primary', 'border-primary'); btnFile.classList.add('text-slate-500', 'border-transparent');
    }
}

function toggleProcessMediaType(t) {
    const fi = document.getElementById('process-input-file');
    const ui = document.getElementById('process-input-url');
    const btnFile = document.getElementById('btn-process-file');
    const btnUrl = document.getElementById('btn-process-url');

    if (t === 'file') {
        fi.classList.remove('hidden'); ui.classList.add('hidden');
        btnFile.classList.add('text-primary', 'border-primary'); btnFile.classList.remove('text-slate-500', 'border-transparent');
        btnUrl.classList.remove('text-primary', 'border-primary'); btnUrl.classList.add('text-slate-500', 'border-transparent');
    } else {
        fi.classList.add('hidden'); ui.classList.remove('hidden');
        btnUrl.classList.add('text-primary', 'border-primary'); btnUrl.classList.remove('text-slate-500', 'border-transparent');
        btnFile.classList.remove('text-primary', 'border-primary'); btnFile.classList.add('text-slate-500', 'border-transparent');
    }
}

function toggleVideoCover() {
    const c = document.getElementById('input-cover');
    if (document.getElementById('isVideoCheck').checked) c.classList.remove('hidden'); else c.classList.add('hidden');
}
function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) { document.documentElement.classList.remove('dark'); localStorage.theme = 'light'; }
    else { document.documentElement.classList.add('dark'); localStorage.theme = 'dark'; }
}

function clearSystemStorage() {
    if (confirm('Clear all data?')) { localStorage.clear(); location.reload(); }
}

// Missing function fix
// Missing function fix
async function renderDashboard() {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // Only force switch to services if we are still on the default view
    // (i.e., user hasn't clicked another tab while data was loading)
    const visibleTab = document.querySelector('.tab-content:not(.hidden)');

    // If no tab is visible OR services tab is visible (default state), load services
    // If another tab (like security) is visible, do NOT switch away
    if (!visibleTab || visibleTab.id === 'services-tab') {
        switchTab('services');
    }
}

// --- PERIODIC SECURITY CHECK ---
// Automatically logs out users if they are removed from the database by an owner
setInterval(async () => {
    // Only check if online and logged in
    if (!window.isSupabaseActive) return;

    const isLoggedIn = sessionStorage.getItem('shavi_admin_logged_in');
    if (!isLoggedIn) return;

    const currentUser = sessionStorage.getItem('shavi_admin_user') || '';
    const normalizedUser = currentUser.trim().toLowerCase();

    // Skip check for Master Admins
    const isMaster = (
        normalizedUser === ADMIN_CREDS.user.toLowerCase() ||
        normalizedUser === 'nadundilushanka@gmail.com' ||
        normalizedUser === 'shavistudiolk@gmail.com'
    );
    if (isMaster) return;

    try {
        // Silent verification using Supabase Adapter
        const admins = await getData('shavi_admins') || [];
        const exists = admins.some(a => a.email.toLowerCase() === normalizedUser);

        if (!exists) {
            // User NO LONGER EXISTS
            alert("⛔ ACCESS REVOKED ⛔\n\nYour administrator privileges have been removed by the owner.\nYou will now be logged out.");
            logout();
        }
    } catch (e) {
        // Ignore network errors during background check
        console.warn("Background auth check skipped", e);
    }
}, 10000);

// Initial Auth Check
checkAuth();

if (localStorage.theme === 'dark') document.documentElement.classList.add('dark');
