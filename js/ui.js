// Gestione del tema
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle?.querySelector('i');

// Controlla il tema salvato
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');
if (themeIcon) {
    updateThemeIcon(savedTheme);
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        if (themeIcon) {
            updateThemeIcon(isDark ? 'dark' : 'light');
        }
    });
}

function updateThemeIcon(theme) {
    if (themeIcon) {
        themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// Gestione delle notifiche toast
export function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white`;
    
    toast.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;

    toastContainer.appendChild(toast);

    // Anima l'entrata
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 100);

    // Rimuovi dopo 3 secondi
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Gestione del menu mobile
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    // Chiudi il menu mobile quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (!mobileMenuBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
            mobileMenu.classList.add('hidden');
        }
    });
}

// Gestione del loader
export function showLoader() {
    const loader = document.getElementById('loader');
    const dashboardContent = document.getElementById('dashboardContent');
    if (loader) loader.classList.remove('hidden');
    if (dashboardContent) dashboardContent.classList.add('hidden');
}

export function hideLoader() {
    const loader = document.getElementById('loader');
    const dashboardContent = document.getElementById('dashboardContent');
    if (loader) loader.classList.add('hidden');
    if (dashboardContent) dashboardContent.classList.remove('hidden');
} 