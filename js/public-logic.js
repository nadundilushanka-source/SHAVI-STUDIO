// public-site-logic.js
// Handles dynamic content loading for the public facing website with Supabase/Async support

const DATA_KEYS = {
    services: 'shavi_services',
    portfolio: 'shavi_portfolio',
    comments: 'shavi_comments',
    pricing: 'shavi_pricing',
    process: 'shavi_process',
    content: 'shavi_content',
    team: 'shavi_team'
};

// --- DATA ACCESS ---
// Modified to be Asynchronous to support Supabase
// --- DATA ACCESS ---
// Modified to use "Cache-First" strategy for speed
// 1. Try to get data from LocalStorage (Instant)
// 2. Return that immediately
// 3. Fetch from Supabase in background to update cache for next visit
async function getData(key) {
    // 1. Use DB Adapter (Supabase or LocalStorage Fallback)
    // We prioritize the Adapter because it handles the source of truth.
    if (typeof DB_ADAPTER !== 'undefined') {
        // If we want "Instant" feel on public site, we could check LocalStorage first, 
        // BUT we must allow the UI to update if the network has newer data.
        // For now, to satisfy "update quickly" (freshness), we await the adapter.
        // Supabase/Storage persistence makes this fast anyway.
        return await DB_ADAPTER.getAny(key);
    }

    // 2. Fallback
    const localData = localStorage.getItem(key);
    try {
        return localData ? JSON.parse(localData) : [];
    } catch (e) {
        return [];
    }
}

async function saveData(key, data) {
    if (typeof DB_ADAPTER !== 'undefined') {
        await DB_ADAPTER.saveAny(key, data);
        return;
    }
    localStorage.setItem(key, JSON.stringify(data));
}

// --- RENDER FUNCTIONS ---

// Render Services on services.html
async function loadServices() {
    const container = document.getElementById('services-container');
    if (!container) return; // Not on services page

    // SKELETON LOADING (3 placeholders)
    if (container.children.length === 0) {
        container.innerHTML = Array(3).fill(0).map(() => `
            <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div class="skeleton w-16 h-16 rounded-full mb-6"></div>
                <div class="skeleton w-3/4 h-8 mb-4"></div>
                <div class="skeleton w-full h-4 mb-2"></div>
                <div class="skeleton w-2/3 h-4"></div>
            </div>
        `).join('');
    }

    // Fetch Real Data
    let services = await getData(DATA_KEYS.services);
    console.log('Loaded Services:', services); // Debug Log

    // Default Fallback if no data (e.g. first visit without Admin Init)
    if (!services || services.length === 0) {
        services = [
            { title: 'Social Media Management', icon: 'fas fa-share-nodes', desc: 'Strategic content planning, profile optimization, and community engagement.', bgClass: 'bg-slate-800' },
            { title: 'Content Creation', icon: 'fas fa-palette', desc: 'Engaging content from graphics and videos to AI-powered creation.', bgClass: 'bg-slate-800' },
            { title: 'Branding & Visual Identity', icon: 'fas fa-pen-nib', desc: 'Complete brand identity design from logos to comprehensive guidelines.', bgClass: 'bg-slate-800' },
            { title: 'Digital Advertising', icon: 'fas fa-bullhorn', desc: 'Conversion-driven campaigns on Facebook, Instagram, and Google.', bgClass: 'bg-slate-800' }
        ];
    }

    // Check if we have data or fallback
    if (services && services.length > 0) {
        // Limit to 8 items on Homepage, show all on Services page
        const isHomePage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
        const displayServices = isHomePage ? services.slice(0, 8) : services;

        container.innerHTML = displayServices.map((service, index) => {
            // Default styles if not present in data
            const bgClass = service.bgClass || 'bg-blue-100 dark:bg-slate-700';
            const iconColorClass = service.colorClass || 'text-primary';

            return `
            <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl hover:shadow-2xl transition duration-300 transform hover:-translate-y-2 group"
                data-aos="fade-up" data-aos-delay="${index * 100}">
                <div class="w-16 h-16 ${bgClass} rounded-full flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
                    <i class="${service.icon || 'fas fa-star'} text-2xl ${iconColorClass} group-hover:text-white transition-colors"></i>
                </div>
                <h3 class="text-2xl font-bold mb-4">${service.title}</h3>
                <p class="text-slate-600 dark:text-slate-300 mb-6">${service.description || service.desc}</p>
            </div>
            </div>
            `;
        }).join('');

        // Refresh AOS to show new elements
        if (typeof AOS !== 'undefined') AOS.refresh();
    }
}

// Global to track current gallery state
let currentGallery = [];
let currentGalleryIndex = 0;
let portfolioUnsubscribe = null;
window.g_portfolioItems = []; // Global source of truth for rendered grid

async function loadPortfolio() {
    const container = document.getElementById('portfolio-container');
    if (!container) return;

    // SKELETON LOADING (Only if empty)
    if (container.children.length === 0) {
        container.innerHTML = Array(6).fill(0).map(() => `
            <div class="rounded-2xl aspect-video overflow-hidden relative">
                <div class="skeleton w-full h-full absolute inset-0"></div>
            </div>
        `).join('');
    }

    const renderItems = async (items) => {
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-slate-500">No projects found.</div>';
            return;
        }

        // Resolve category labels for headers
        let categoriesList = [];
        try {
            categoriesList = await getData('shavi_portfolio_categories') || [];
        } catch (e) { }

        // 1. Group items by their raw category first
        const groupedByRaw = {};
        items.forEach(item => {
            const rawCat = item.category || 'other-projects';
            if (!groupedByRaw[rawCat]) groupedByRaw[rawCat] = [];
            groupedByRaw[rawCat].push(item);
        });

        // 2. Determine Section Order based on categoriesList
        const sectionOrder = categoriesList.map(c => ({
            id: c.value,
            label: c.label,
            items: groupedByRaw[c.value] || []
        }));

        // Add "Other" if there are items not in the official category list
        const definedValues = categoriesList.map(c => c.value);
        const otherItems = items.filter(item => !definedValues.includes(item.category || ''));
        if (otherItems.length > 0) {
            sectionOrder.push({
                id: 'other-projects',
                label: 'Other Projects',
                items: otherItems
            });
        }

        // 3. Rebuild the Global Items array based on this SECTION logic
        // This ensures the Lightbox follows the exact visual order (Section 1 -> Section 2...)
        const orderedItems = [];
        sectionOrder.forEach(sec => {
            if (sec.items.length > 0) {
                // Sort items WITHIN the section by update time
                sec.items.sort((a, b) => (b.updatedAt || b.id || 0) - (a.updatedAt || a.id || 0));
                orderedItems.push(...sec.items);
            }
        });
        window.g_portfolioItems = orderedItems;

        let html = '';
        sectionOrder.forEach((sec) => {
            if (sec.items.length === 0) return;

            const catLabel = sec.label;
            const itemsInSec = sec.items;
            const hasMore = itemsInSec.length > 3;

            // Category Header
            html += `
            <div class="col-span-full text-center mt-16 mb-8 first:mt-0" data-aos="fade-up">
                <h2 class="text-3xl font-bold text-slate-800 dark:text-white capitalize">${catLabel}</h2>
                <div class="w-16 h-1 bg-primary mx-auto mt-4 rounded-full"></div>
            </div>
            `;

            // Grid Container for this category
            html += `<div class="col-span-full grid md:grid-cols-2 lg:grid-cols-3 gap-6" id="grid-${sec.id}">`;

            itemsInSec.forEach((item, idx) => {
                const globalIdx = orderedItems.indexOf(item);
                const imgSrc = item.isVideo ? (item.coverUrl || 'https://via.placeholder.com/800x600?text=Video') : item.url;
                const galleryCount = item.gallery ? item.gallery.length : 1;
                const badgeHtml = galleryCount > 1
                    ? `<div class="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full z-20 flex items-center gap-1 border border-white/20">
                         <i class="fas fa-layer-group text-primary"></i> +${galleryCount - 1}
                       </div>`
                    : '';

                // Toggle visibility for items > 3
                const displayClass = idx >= 3 ? 'hidden' : '';

                html += `
                <div class="portfolio-item ${displayClass} group relative overflow-hidden rounded-2xl aspect-video cursor-pointer" 
                     data-aos="zoom-in" data-category="${item.category}" onclick="openLightboxFromIndex(${globalIdx})" data-sec-item="${sec.id}">
                     ${badgeHtml}
                    <img src="${imgSrc}" alt="${item.title}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                    
                    ${item.isVideo ? `
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-primary transition-colors duration-300">
                            <i class="fas fa-play text-2xl text-white ml-1"></i>
                        </div>
                    </div>
                    ` : `
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div class="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
                            <i class="fas fa-expand-alt"></i>
                        </div>
                    </div>
                    `}

                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 z-20">
                        <h3 class="text-white text-xl font-bold">${item.title}</h3>
                        <span class="text-primary text-sm font-bold uppercase tracking-wider mt-1">${catLabel}</span>
                    </div>
                </div>
                `;
            });

            html += `</div>`; // End Grid Container

            if (hasMore) {
                html += `
                <div class="col-span-full text-center mt-8" id="btn-container-${sec.id}">
                    <button onclick="revealAllItems('${sec.id}')" class="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-bold text-sm transition-all hover:scale-105 active:scale-95">
                        View All Projects in ${catLabel}
                    </button>
                </div>
                `;
            }
        });

        container.innerHTML = html;

        // Refresh AOS
        if (typeof AOS !== 'undefined') AOS.refresh();
    };

    // 1. Try Cache for Instant Render
    try {
        const cached = localStorage.getItem(DATA_KEYS.portfolio);
        if (cached) await renderItems(JSON.parse(cached));
    } catch (e) { }

    // 2. Fetch Fresh Data (Supabase)
    try {
        const items = await getData(DATA_KEYS.portfolio); // This calls DB_ADAPTER.getAny -> Supabase
        if (items && Array.isArray(items) && items.length > 0) {
            await renderItems(items);
            // Update Cache
            localStorage.setItem(DATA_KEYS.portfolio, JSON.stringify(items));
        } else if (items && Array.isArray(items) && items.length === 0) {
            await renderItems([]); // Explicitly show empty state
        } else if (items === null) {
            // If Supabase returned null (e.g. no key found), and we have no cache shown
            if (container.querySelector('.skeleton')) {
                await renderItems([]); // Stop skeletons
            }
        }
    } catch (e) {
        console.error("Portfolio Load Error:", e);
        if (container.querySelector('.skeleton')) {
            await renderItems([]);
        }
    }
}

function revealAllItems(secId) {
    const grid = document.getElementById(`grid-${secId}`);
    const btnContainer = document.getElementById(`btn-container-${secId}`);
    if (!grid) return;

    // Show all hidden items in this grid
    const hiddenItems = grid.querySelectorAll('.portfolio-item.hidden');
    hiddenItems.forEach(item => {
        item.classList.remove('hidden');
        // Re-trigger AOS for newly shown items
        if (typeof AOS !== 'undefined') {
            item.setAttribute('data-aos', 'fade-up');
        }
    });

    // Refresh AOS
    if (typeof AOS !== 'undefined') AOS.refresh();

    // Remove the View All button
    if (btnContainer) {
        btnContainer.classList.add('hidden');
    }
}

// Lightbox Functions
function openLightboxFromIndex(index) {
    // 1. USE GLOBAL SOURCE OF TRUTH (Fixes mismatch)
    const items = window.g_portfolioItems;

    if (!items || !items[index]) {
        console.error("Lightbox Error: Item not found at index", index);
        return;
    }

    const item = items[index];

    // Build Gallery Array
    if (item.gallery && item.gallery.length > 0) {
        currentGallery = item.gallery;
    } else {
        // Fallback for items without gallery structure
        currentGallery = [{
            url: item.url,
            coverUrl: item.coverUrl,
            isVideo: item.isVideo
        }];
    }
    currentGalleryIndex = 0;

    // Initialize Lightbox Elements
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    // Ensure Video Container
    let videoContainer = document.getElementById('lightbox-video-container');
    if (!videoContainer) {
        videoContainer = document.createElement('div');
        videoContainer.id = 'lightbox-video-container';
        videoContainer.className = 'w-full max-w-4xl aspect-video hidden rounded-lg shadow-2xl overflow-hidden bg-black';
        videoContainer.onclick = (e) => e.stopPropagation();
        const img = document.getElementById('lightbox-img');
        if (img) lightbox.insertBefore(videoContainer, img);
        else lightbox.appendChild(videoContainer);
    }

    // Ensure Navigation Arrows
    let navControls = document.getElementById('lightbox-nav');
    if (!navControls) {
        navControls = document.createElement('div');
        navControls.id = 'lightbox-nav';
        navControls.className = 'absolute inset-0 flex items-center justify-between pointer-events-none px-4 z-50';
        navControls.innerHTML = `
            <button id="lb-prev-btn" onclick="prevImage(event)" class="pointer-events-auto bg-black/50 text-white p-4 rounded-full hover:bg-primary hover:text-black transition-colors transform hover:scale-110 focus:outline-none backdrop-blur-sm">
                <i class="fas fa-chevron-left text-2xl"></i>
            </button>
            <button id="lb-next-btn" onclick="nextImage(event)" class="pointer-events-auto bg-black/50 text-white p-4 rounded-full hover:bg-primary hover:text-black transition-colors transform hover:scale-110 focus:outline-none backdrop-blur-sm">
                <i class="fas fa-chevron-right text-2xl"></i>
            </button>
        `;
        lightbox.appendChild(navControls);
    }

    // Ensure Info Bar
    let infoBar = document.getElementById('lightbox-info');
    if (!infoBar) {
        infoBar = document.createElement('div');
        infoBar.id = 'lightbox-info';
        infoBar.className = 'absolute bottom-6 left-0 right-0 text-center text-white pointer-events-none z-50';
        lightbox.appendChild(infoBar);
    }

    // --- NEW: Attach Navigation Events (Keyboard & Touch) ---
    document.addEventListener('keydown', handleLightboxKeys);

    // Swipe Support
    let touchStartX = 0;
    let touchEndX = 0;
    lightbox.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        if (touchEndX < touchStartX - 50) nextImage(); // Swipe Left -> Next
        if (touchEndX > touchStartX + 50) prevImage(); // Swipe Right -> Prev
    }
    // ----------------------------------------------------

    updateLightboxImage();

    lightbox.classList.remove('hidden');
    setTimeout(() => {
        lightbox.classList.remove('opacity-0');
        const img = document.getElementById('lightbox-img');
        if (img) img.classList.remove('scale-95');
    }, 10);
}

function handleLightboxKeys(e) {
    if (document.getElementById('lightbox').classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'Escape') closeLightbox();
}

function updateLightboxImage() {
    const item = currentGallery[currentGalleryIndex];
    const img = document.getElementById('lightbox-img');
    const videoContainer = document.getElementById('lightbox-video-container');
    const navControls = document.getElementById('lightbox-nav');
    const infoBar = document.getElementById('lightbox-info');

    if (!item) return;

    // Show/Hide Nav Buttons logic
    if (navControls) {
        // Always show nav if gallery has > 1 item
        navControls.style.display = currentGallery.length > 1 ? 'flex' : 'none';
    }

    // Update Counter
    if (infoBar) {
        infoBar.innerHTML = currentGallery.length > 1
            ? `<span class="bg-black/50 px-3 py-1 rounded-full backdrop-blur-md text-sm font-bold tracking-wider">${currentGalleryIndex + 1} / ${currentGallery.length}</span>`
            : '';
    }

    // Handle Content Type
    if (item.isVideo) {
        if (img) img.classList.add('hidden');
        if (videoContainer) {
            videoContainer.classList.remove('hidden');
            const cover = item.coverUrl || 'https://via.placeholder.com/800x600?text=Video+Cover';
            videoContainer.innerHTML = `
                <div class="relative w-full h-full flex items-center justify-center cursor-pointer group" onclick="playCurrentVideo()">
                    <img src="${cover}" class="w-full h-full object-cover pointer-events-none rounded-lg">
                    <div class="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors rounded-lg">
                         <div class="w-20 h-20 bg-white/20 backdrop-blur-md border border-white/50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                             <i class="fas fa-play text-white text-3xl ml-1"></i>
                        </div>
                    </div>
                </div>
            `;
        }
    } else {
        if (videoContainer) {
            videoContainer.classList.add('hidden');
            videoContainer.innerHTML = '';
        }
        if (img) {
            img.classList.remove('hidden');
            img.src = item.url;
        }
    }
}

function playCurrentVideo() {
    const item = currentGallery[currentGalleryIndex];
    if (!item || !item.isVideo) return;
    window.open(item.url, '_blank');
}

function nextImage(e) {
    if (e) e.stopPropagation();
    if (currentGallery.length <= 1) return;
    currentGalleryIndex = (currentGalleryIndex + 1) % currentGallery.length;
    updateLightboxImage();
}

function prevImage(e) {
    if (e) e.stopPropagation();
    if (currentGallery.length <= 1) return;
    currentGalleryIndex = (currentGalleryIndex - 1 + currentGallery.length) % currentGallery.length;
    updateLightboxImage();
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const videoContainer = document.getElementById('lightbox-video-container');

    // Remove event listener
    document.removeEventListener('keydown', handleLightboxKeys);

    if (lightbox) {
        lightbox.classList.add('opacity-0');
        if (img) img.classList.add('scale-95');

        setTimeout(() => {
            lightbox.classList.add('hidden');
            if (img) img.src = '';
            if (videoContainer) {
                videoContainer.innerHTML = '';
                videoContainer.classList.add('hidden');
            }
        }, 300);
    }
}

// Render Testimonials/Comments
// Render Testimonials/Comments (Carousel Mode)
let currentSlide = 0;
let totalSlides = 0;
let slideInterval;

// XSS Protection Helper
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- HOMEPAGE CAROUSEL ---
async function loadHomeTestimonials() {
    const container = document.getElementById('home-testimonials-carousel');
    if (!container) return; // Only on index.html

    const allComments = await getData(DATA_KEYS.comments);
    // Filter: Approved AND (Rating 4 or 5)
    // If user's own new comment is pending, they won't see it immediately here, but system says "Submitted for review".
    // User asked "4 stars review its not showw in home page". It must be APPROVED first.
    // To show immediately (risky but requested "fix problem"), we could show pending IF it's in localStorage session? No, just stick to approved.
    const comments = allComments.filter(c => c.status === 'approved' && c.rating >= 4);

    if (comments.length > 0) {
        totalSlides = comments.length;
        // Stop current logic to use new 3D logic
        container.innerHTML = comments.map((comment, index) => {
            const stars = Array(5).fill(0).map((_, i) =>
                `<i class="fas fa-star ${i < comment.rating ? 'text-yellow-400' : 'text-slate-600'}"></i>`
            ).join('');

            const safeUser = escapeHtml(comment.user);
            const safeText = escapeHtml(comment.text);

            return `
            <div class="testimonial-slide absolute inset-0 transition-opacity duration-700 ease-in-out ${index === 0 ? 'opacity-100 block' : 'opacity-0 hidden'} flex items-center justify-center p-4 perspective-1000">
                <div class="bg-[#111]/90 backdrop-blur-md p-8 md:p-12 rounded-3xl shadow-2xl border border-gray-800 text-center max-w-2xl mx-auto transform transition-all duration-500 hover:scale-105 hover:rotate-0 rotate-x-2 group preserve-3d">
                    
                    <!-- Floating Avatar -->
                    <div class="w-20 h-20 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 shadow-lg shadow-primary/30 relative z-20 translate-z-10 group-hover:translate-z-20 transition-transform duration-500">
                        ${safeUser.charAt(0).toUpperCase()}
                    </div>

                    <!-- Stars -->
                    <div class="mb-4 text-xl translate-z-5 group-hover:translate-z-10 transition-transform duration-500">${stars}</div>
                    
                    <!-- Text -->
                    <p class="text-slate-300 text-lg md:text-xl italic mb-8 leading-relaxed relative z-10 translate-z-5 group-hover:translate-z-10 transition-transform duration-500">"${safeText}"</p>
                    
                    <!-- User Info -->
                    <h4 class="font-bold text-white text-xl translate-z-5">${safeUser}</h4>
                    <span class="text-primary text-sm font-medium uppercase tracking-wider translate-z-5">Happy Client</span>
                    
                    <!-- 3D Quote Icon -->
                    <i class="fas fa-quote-right absolute bottom-4 right-8 text-8xl text-white/5 pointer-events-none -translate-z-10"></i>
                </div>
            </div>
            `;
        }).join('');

        container.style.perspective = "1000px"; // Ensure container has perspective
        startAutoSlide();
    } else {
        container.innerHTML = '<div class="text-center text-slate-500 py-20">No featured reviews yet.</div>';
    }
}

// --- REVIEWS PAGE GRID (ALL REVIEWS) ---
async function loadAllReviews() {
    const container = document.getElementById('reviews-page-grid');
    if (!container) return; // Only on testimonials.html

    // Skeleton
    if (container.children.length === 0) {
        container.innerHTML = Array(3).fill(0).map(() => `
            <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 h-64 animate-pulse">
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                    <div class="space-y-2">
                        <div class="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        <div class="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                </div>
                <div class="space-y-3">
                    <div class="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div class="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
            </div>
        `).join('');
    }

    const allComments = await getData(DATA_KEYS.comments);
    // Show ALL approved comments (1-5 stars)
    const comments = allComments.filter(c => c.status === 'approved');

    if (comments.length > 0) {
        // Sort by newest first (assuming id is timestamp)
        comments.sort((a, b) => b.id - a.id);

        container.innerHTML = comments.map(comment => {
            const stars = Array(5).fill(0).map((_, i) =>
                `<i class="fas fa-star ${i < comment.rating ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'}"></i>`
            ).join('');

            const safeUser = escapeHtml(comment.user);
            const safeText = escapeHtml(comment.text);

            return `
            <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-slate-100 dark:border-white/5 flex flex-col h-full" data-aos="fade-up">
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-full flex items-center justify-center text-slate-600 dark:text-white font-bold text-xl shadow-inner">
                        ${safeUser.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-800 dark:text-white">${safeUser}</h4>
                        <div class="text-sm mt-1 flex gap-1">${stars}</div>
                    </div>
                </div>
                <!-- Scrollable text if too long -->
                <div class="relative flex-grow">
                     <i class="fas fa-quote-left text-primary/20 text-4xl absolute -top-2 -left-2"></i>
                     <p class="text-slate-600 dark:text-slate-300 italic relative z-10 pl-4 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">"${safeText}"</p>
                </div>
                <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400 text-right">
                    Verified Client
                </div>
            </div>
            `;
        }).join('');

        if (typeof AOS !== 'undefined') AOS.refresh();
    } else {
        container.innerHTML = '<div class="col-span-full text-center text-slate-500 py-20 text-xl">No reviews yet. Be the first to leave one!</div>';
    }
}

// Carousel Controls
function showSlide(index) {
    const slides = document.querySelectorAll('.testimonial-slide');
    if (slides.length === 0) return;

    slides.forEach((slide, i) => {
        if (i === index) {
            slide.classList.remove('hidden', 'opacity-0');
            slide.classList.add('block', 'opacity-100');
        } else {
            slide.classList.add('hidden', 'opacity-0');
            slide.classList.remove('block', 'opacity-100');
        }
    });
}

window.nextSlide = function () { // Expose to global scope for HTML onclick
    if (totalSlides <= 1) return;
    currentSlide = (currentSlide + 1) % totalSlides;
    showSlide(currentSlide);
    resetAutoSlide();
};

window.prevSlide = function () {
    if (totalSlides <= 1) return;
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    showSlide(currentSlide);
    resetAutoSlide();
};

function startAutoSlide() {
    if (slideInterval) clearInterval(slideInterval);
    slideInterval = setInterval(window.nextSlide, 5000);
}

function resetAutoSlide() {
    clearInterval(slideInterval);
    startAutoSlide();
}

// Load Pricing (Pricing Page)
async function loadPricing() {
    const container = document.getElementById('pricing-grid');
    if (!container) return;

    // SKELETON LOADING (3 placeholders)
    if (container.children.length === 0) {
        container.innerHTML = Array(3).fill(0).map(() => `
            <div class="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-100 dark:border-slate-700">
                <div class="skeleton w-1/3 h-6 mb-4"></div>
                <div class="skeleton w-1/2 h-10 mb-6"></div>
                <div class="space-y-4 mb-8">
                    <div class="skeleton w-full h-4"></div>
                    <div class="skeleton w-full h-4"></div>
                    <div class="skeleton w-full h-4"></div>
                    <div class="skeleton w-2/3 h-4"></div>
                </div>
                <div class="skeleton w-full h-12 rounded-lg"></div>
            </div>
        `).join('');
    }

    const items = await getData(DATA_KEYS.pricing);
    if (items && items.length > 0) {
        const categories = {};
        items.forEach(item => {
            const cat = item.category || 'Other Plans';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });

        let html = '';
        for (let cat in categories) {
            html += `
            <div class="col-span-full text-center mt-16 mb-8 first:mt-0" data-aos="fade-up">
                <h2 class="text-3xl font-bold text-slate-800 dark:text-white capitalize">${cat}</h2>
                <div class="w-16 h-1 bg-primary mx-auto mt-4 rounded-full"></div>
            </div>
            `;
            html += categories[cat].map((item, index) => {
                const isPop = item.isPopular;
                const cardClasses = isPop
                    ? 'bg-[#1e293b] rounded-2xl p-8 flex flex-col hover:scale-105 transition-transform duration-300 border border-primary relative transform md:-translate-y-4 shadow-[0_0_30px_rgba(51,204,255,0.1)]'
                    : 'bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl flex flex-col hover:scale-105 transition-transform duration-300 border border-transparent';

                const badgeHtml = isPop
                    ? '<div class="absolute top-0 right-0 bg-primary text-black text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-2xl uppercase tracking-wider">POPULAR</div>'
                    : '';

                const titleColor = isPop ? 'text-primary' : 'text-slate-800 dark:text-slate-300';
                const priceColor = isPop ? 'text-white' : 'text-slate-900 dark:text-white';
                const textColor = isPop ? 'text-slate-200' : 'text-slate-600 dark:text-slate-400';
                const checkColor = 'text-green-500';

                const btnClasses = isPop
                    ? 'bg-primary text-black hover:bg-cyan-400'
                    : 'border-2 border-primary text-primary hover:bg-primary hover:text-white';

                return `
                    <div class="${cardClasses}" data-aos="fade-up" data-aos-delay="${index * 100}">
                        ${badgeHtml}
                        <h3 class="text-xl font-bold mb-4 ${titleColor}">${item.name}</h3>
                        <div class="text-4xl font-bold mb-6 ${priceColor}">${item.price} <span class="text-base text-slate-400 font-normal">${item.unit}</span></div>
                        <ul class="space-y-4 mb-8 flex-grow">
                            ${item.features.map(f => `<li class="flex items-center gap-3"><i class="fas fa-check ${checkColor}"></i> <span class="${textColor}">${f}</span></li>`).join('')}
                        </ul>
                        <a href="contact.html" class="block text-center py-3 ${btnClasses} rounded-lg font-bold transition-all">Choose Plan</a>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = html;

        if (typeof AOS !== 'undefined') AOS.refresh();
    }
}

// Load Process (How It Works Page)
async function loadProcess() {
    const container = document.getElementById('process-container');
    if (!container) return;

    let items = await getData(DATA_KEYS.process);
    if (items && items.length > 0) {
        items.sort((a, b) => a.step - b.step);

        // Vertical Line HTML (Hidden on mobile, absolute center)
        const verticalLine = `<div class="hidden md:block absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-slate-700"></div>`;

        const itemsHtml = items.map((item, index) => {
            const isImageLeft = index % 2 !== 0; // Index 0 (Step 1) -> Image Right (isImageLeft=false). Index 1 (Step 2) -> Image Left (isImageLeft=true).

            // Text Component
            const textAlignClass = isImageLeft ? 'md:text-left pl-0 md:pl-16' : 'md:text-right pr-0 md:pr-16';
            const orderClass = isImageLeft ? 'order-2 md:order-3' : 'order-2 md:order-1';

            const textContent = `
                <div class="md:w-5/12 text-center ${textAlignClass} ${orderClass} flex flex-col justify-center">
                    <h3 class="text-3xl font-bold mb-3 text-white">${item.title}</h3>
                    <p class="text-slate-400 leading-relaxed relative z-20 text-lg">${item.desc}</p>
                </div>
            `;

            // Image Component
            const imgOrderClass = isImageLeft ? 'order-3 md:order-1 pr-0 md:pr-16' : 'order-3 md:order-3 pl-0 md:pl-16';
            const rotationClass = isImageLeft ? 'rotate-2 hover:rotate-0' : '-rotate-2 hover:rotate-0';

            const imgContent = `
                <div class="md:w-5/12 ${imgOrderClass} mb-12 md:mb-0">
                     <div class="bg-[#1B2232] p-3 rounded-2xl shadow-2xl transform transition-transform duration-500 hover:scale-[1.02] ${rotationClass}">
                        <div class="relative overflow-hidden rounded-xl aspect-[16/9]">
                             <img src="${item.imageUrl || 'https://via.placeholder.com/600x400'}" 
                                class="w-full h-full object-cover">
                        </div>
                         <div class="pt-4 pb-2 px-2">
                            <span class="text-[#00e676] font-bold text-sm tracking-wide">Phase ${item.step}: ${item.phase || item.title}</span>
                         </div>
                     </div>
                </div>
            `;

            // Circle Component
            const circleContent = `
                <div class="md:w-2/12 flex justify-center order-1 md:order-2 mb-8 md:mb-0 relative z-10">
                    <div class="w-16 h-16 bg-[#111111] border-[3px] border-[#00e676] rounded-full flex items-center justify-center text-2xl font-bold text-[#00e676] shadow-[0_0_20px_rgba(0,230,118,0.2)] z-10 transition-all duration-300 cursor-pointer hover:scale-110 hover:shadow-[0_0_40px_rgba(0,230,118,0.8)] hover:bg-[#00e676] hover:text-[#111111]">
                        ${item.step}
                    </div>
                </div>
            `;

            return `
            <div class="flex flex-col md:flex-row items-center justify-between mb-32 relative w-full">
                ${isImageLeft ? imgContent : textContent}
                ${circleContent}
                ${isImageLeft ? textContent : imgContent}
            </div>
            `;
        }).join('');

        container.innerHTML = verticalLine + itemsHtml;

        // Refresh AOS to detect new elements
        if (typeof AOS !== 'undefined') {
            setTimeout(() => AOS.refresh(), 100);
        }
    }
}

// Load About Stats
async function loadAboutStats() {
    const container = document.getElementById('about-stats');
    if (!container) return;

    const data = await getData(DATA_KEYS.content);
    if (!data || !data.stat1Num) return;

    // Define stats with specific colors matching design
    const stats = [
        { num: data.stat1Num, label: data.stat1Label, color: 'text-primary' },
        { num: data.stat2Num, label: data.stat2Label, color: 'text-accent' },
        { num: data.stat3Num, label: data.stat3Label, color: 'text-green-600' },
        { num: data.stat4Num, label: data.stat4Label, color: 'text-green-400' }
    ];

    container.innerHTML = stats.map(stat => `
        <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg text-center transform hover:scale-105 transition-transform duration-300 border border-transparent hover:border-primary/20">
            <div class="text-4xl font-bold ${stat.color} mb-2">${stat.num}</div>
            <div class="text-sm text-slate-500 font-medium uppercase tracking-wider">${stat.label}</div>
        </div>
    `).join('');
}

// --- PUBLIC ACTIONS ---

// Load Home Page Content
// Load Home Page Content
async function loadHomeContent() {
    const data = await getData(DATA_KEYS.content);
    if (!data) return;

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.innerHTML = val.replace(/\n/g, '<br>');
    };

    // Hero Section
    setText('home-hero-tagline', data.homeHeroTagline);
    // setText('home-hero-title', data.homeHeroTitle);
    setText('home-hero-subtitle', data.homeHeroSubtitle);

    // Hero Image
    if (data.homeHeroImage) {
        const heroImg = document.getElementById('home-hero-image');
        if (heroImg) heroImg.src = data.homeHeroImage;
    }

    // Projects Count
    if (data.homeStatsCount) {
        const countEl = document.getElementById('home-stats-count');
        if (countEl) countEl.innerText = data.homeStatsCount;
    }

    // Services Section
    setText('home-services-title', data.homeServicesTitle);
    setText('home-services-subtitle', data.homeServicesSubtitle);

    // CTA Section
    // setText('home-cta-title', data.homeCtaTitle);
    setText('home-cta-text', data.homeCtaText);
    setText('home-cta-btn', `${data.homeCtaButtonText || 'Start a Project'} <i class="fas fa-arrow-right ml-2"></i>`);
}

// Load Contact Info
async function loadContactInfo() {
    const data = await getData(DATA_KEYS.content);
    if (!data) return;

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.innerHTML = val.replace(/\n/g, '<br>');
    };

    // Main Contact Page
    setText('contact-phone-display', data.contactPhone);
    setText('contact-email-display', data.contactEmail);
    setText('contact-address-display', data.contactAddress);

    // Footer (on all pages)
    setText('footer-phone', data.contactPhone);
    setText('footer-email', data.contactEmail);
    setText('footer-address', data.contactAddress);

    // Footer About & Socials
    setText('footer-about-text', data.footerAboutText);

    const setHref = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.href = val || '#';
    };
    setHref('facebook-link', data.socialFacebook);
    setHref('instagram-link', data.socialInstagram);
    setHref('tiktok-link', data.socialTiktok);
    setHref('youtube-link', data.socialYoutube);
}


// Load Team
// Global listener variable
let teamUnsubscribe = null;

async function loadTeam() {
    const container = document.getElementById('team-container');
    if (!container) return;

    const renderTeamItems = (team) => {
        if (!team || team.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-slate-500">No team members found.</div>';
            return;
        }

        // Flexible Grid Layout: First row 2 items, others 3 items
        container.className = "grid grid-cols-1 md:grid-cols-6 gap-8";

        container.innerHTML = team.map((member, index) => {
            // Logic: Index 0,1 -> col-span-3 (2 per row). Index 2+ -> col-span-2 (3 per row).
            const colSpanClass = index < 2 ? 'md:col-span-3' : 'md:col-span-2';

            return `
            <div class="${colSpanClass} bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl hover:shadow-2xl transition duration-300 transform hover:-translate-y-2 text-center group h-full flex flex-col items-center"
                data-aos="fade-up" data-aos-delay="${index * 100}">
                <div class="relative w-32 h-32 mx-auto mb-6">
                    <img src="${member.imageUrl || 'https://via.placeholder.com/300'}" alt="${member.name}" 
                        class="w-full h-full object-cover rounded-full border-4 border-primary/20 group-hover:border-primary transition-colors duration-300 shadow-lg"
                        loading="lazy">
                    <div class="absolute inset-0 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                
                <h3 class="text-2xl font-bold mb-1 group-hover:text-primary transition-colors">${member.name}</h3>
                <span class="block text-primary font-bold text-sm uppercase tracking-wider mb-2">${member.role}</span>
                <span class="block text-xs text-slate-400 font-medium mb-4 min-h-[1rem]">${member.specialization}</span>
                
                <p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed flex-grow">${member.desc}</p>
            </div>
        `}).join('');

        // Refresh AOS animations
        if (typeof AOS !== 'undefined') AOS.refresh();
    };

    // 1. FAST LOAD from Cache (Instant)
    const key = DATA_KEYS.team || 'shavi_team';
    const cached = localStorage.getItem(key);
    if (cached) {
        try {
            renderTeamItems(JSON.parse(cached));
        } catch (e) { console.error("Cache Parse Error:", e); }
    } else {
        // Only show SKELETON if no cache
        container.innerHTML = Array(4).fill(0).map(() => `
            <div class="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 flex flex-col items-center">
                 <div class="skeleton w-32 h-32 rounded-full mb-6"></div>
                 <div class="skeleton w-3/4 h-8 mb-4"></div>
                 <div class="skeleton w-1/2 h-4 mb-2"></div>
                 <div class="skeleton w-full h-24"></div>
            </div>
        `).join('');
    }

    // 2. FRESH LOAD from DB (Background)
    try {
        const freshTeam = await getData(key);
        if (freshTeam && freshTeam.length > 0) {
            renderTeamItems(freshTeam);
            // Update Cache
            localStorage.setItem(key, JSON.stringify(freshTeam));
        }
    } catch (e) {
        console.error("Background Team Refresh Error:", e);
    }
}

// Load About Content (Specific)
async function loadAboutPageContent() {
    const data = await getData(DATA_KEYS.content);
    if (!data) return;

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.innerHTML = val.replace(/\n/g, '<br>');
    };

    setText('about-headline', data.aboutHeadline);
    setText('about-subheadline', data.aboutSubheadline);
    setText('about-story-title', data.aboutStoryTitle);
    setText('about-story-text', data.aboutStoryText);
    setText('about-mission', data.aboutMission);
    setText('about-vision', data.aboutVision);
    setText('about-values-title', data.aboutValuesTitle); // New
    setText('about-values-text', data.aboutValuesText);   // New
}


// --- PUBLIC ACTIONS ---

async function submitComment(e) {
    if (e) e.preventDefault();
    const form = document.getElementById('commentForm');
    if (!form) return;

    const newComment = {
        id: Date.now(),
        user: form.name.value,
        text: form.message.value,
        rating: parseInt(form.rating.value) || 5,
        status: 'pending' // pending approval
    };

    const comments = await getData(DATA_KEYS.comments);
    comments.push(newComment);
    await saveData(DATA_KEYS.comments, comments);

    alert('Thank you! Your feedback has been submitted for review.');
    form.reset();
}



// --- PROFESSIONAL TECH BACKGROUND (ALL PAGES) ---
function initTechBackground() {
    // Avoid duplicates
    if (document.getElementById('tech-bg-canvas')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'tech-bg-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1'; // Behind everything
    canvas.style.pointerEvents = 'none'; // Allow clicks through
    canvas.style.background = 'transparent';
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

    // Settings
    const particleCount = 60; // Not too heavy
    const connectDistance = 150;
    const speed = 0.3;

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * speed;
            this.vy = (Math.random() - 0.5) * speed;
            this.size = Math.random() * 2 + 1; // 1-3px
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Bounce
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(51, 204, 255, 0.3)'; // Cyan
            ctx.fill();
        }
    }

    function init() {
        resize();
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Draw Connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < connectDistance) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(51, 204, 255, ${0.15 * (1 - dist / connectDistance)})`;
                    ctx.lineWidth = 1;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }

        // Update & Draw Particles
        particles.forEach(p => {
            p.update();
            p.draw();
        });

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    init();
    animate();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Fire all async loaders
    loadHomeContent();
    loadServices();
    loadPortfolio();
    loadHomeTestimonials(); // Homepage Carousel
    loadAllReviews();       // Reviews Page Grid
    loadPricing();
    loadProcess();
    loadAboutStats();
    loadContactInfo();

    // New Loaders
    loadTeam();
    loadAboutPageContent();



    // Init Universal Background
    initTechBackground();

    const commentForm = document.getElementById('commentForm');
    if (commentForm) commentForm.addEventListener('submit', submitComment);

    // Refresh AOS immediately after all async calls are fired to catch skeletons
    if (typeof AOS !== 'undefined') AOS.refresh();

    // Final refresh to ensure layout is stable
    setTimeout(() => {
        if (typeof AOS !== 'undefined') AOS.refresh();
    }, 500);
});
