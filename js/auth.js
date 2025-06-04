import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { auth } from './firebaseConfig.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import { showToast } from './ui.js';

// Funzione per verificare se l'utente è autenticato
export async function checkAuth() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                resolve(null);
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, "utenti", user.uid));
                if (!userDoc.exists()) {
                    showToast('Utente non trovato nel database', 'error');
                    resolve(null);
                    return;
                }

                const userData = userDoc.data();
                resolve({
                    uid: user.uid,
                    ...userData
                });
            } catch (error) {
                showToast('Errore durante la verifica dell\'utente', 'error');
                reject(error);
            }
        });
    });
}

// Funzione per verificare se l'utente è staff approvato
export async function isStaffApproved() {
    try {
        const user = await checkAuth();
        return user && user.staff && user.approvato;
    } catch (error) {
        showToast('Errore durante la verifica dei permessi', 'error');
        return false;
    }
}

// Funzione per verificare se l'utente è il proprietario della scheda
export async function isOwner(userId) {
    try {
        const user = await checkAuth();
        return user && user.uid === userId;
    } catch (error) {
        showToast('Errore durante la verifica dei permessi', 'error');
        return false;
    }
}

// Funzione per reindirizzare in base al ruolo
export async function redirectBasedOnRole() {
    try {
        const user = await checkAuth();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        if (user.staff && user.approvato) {
            window.location.href = 'dashboard.html';
        } else {
            window.location.href = 'scheda.html';
        }
    } catch (error) {
        showToast('Errore durante il reindirizzamento', 'error');
        window.location.href = 'login.html';
    }
} 