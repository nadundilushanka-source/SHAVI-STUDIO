// Theme Logic - Enforce Dark Mode
const htmlElement = document.documentElement;
htmlElement.classList.add('dark');
localStorage.theme = 'dark';

// Remove toggle button if it exists in DOM
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
    themeToggleBtn.remove();
}

// Mobile Menu Logic
// Mobile Menu Logic
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling issues
            mobileMenu.classList.toggle('hidden');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!mobileMenuBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
                if (!mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                }
            }
        });
    }
});
// Re-enable transitions after load to prevent white flash
window.addEventListener('load', () => {
    document.body.classList.add('transition-colors', 'duration-300');
});
