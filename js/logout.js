import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { auth } from './firebaseConfig.js';

// Funzione per gestire il logout
export async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Errore durante il logout:', error);
        alert('Si è verificato un errore durante il logout. Riprova più tardi.');
    }
}

// Aggiungi l'event listener al pulsante di logout quando il documento è pronto
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}); 