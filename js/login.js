import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { auth } from './firebaseConfig.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        // Effettua il login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Ottieni i dati dell'utente dal database
        const userDoc = await getDoc(doc(db, "utenti", user.uid));
        if (!userDoc.exists()) {
            throw new Error('Utente non trovato nel database');
        }

        const userData = userDoc.data();

        // Reindirizza in base al ruolo
        if (userData.staff && userData.approvato) {
            window.location.href = 'dashboard.html';
        } else {
            window.location.href = 'scheda.html';
        }

    } catch (error) {
        console.error('Errore durante il login:', error);
        let errorMessage = 'Si è verificato un errore durante il login.';
        
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'Email o password non validi.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Email non valida.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Troppi tentativi di accesso. Riprova più tardi.';
                break;
        }
        
        alert(errorMessage);
    }
}); 