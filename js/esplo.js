import { checkAuth, isStaffApproved } from './auth.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import { showLoader, hideLoader, showToast } from './ui.js';

// Funzione per inizializzare la scheda
async function initScheda() {
    try {
        showLoader();
        
        // Verifica autenticazione
        const user = await checkAuth();
        if (!user) {
            hideLoader();
            window.location.href = 'login.html';
            return;
        }

        // Ottieni l'ID dell'esploratore dall'URL
        const urlParams = new URLSearchParams(window.location.search);
        const esploratoreId = urlParams.get('id');

        if (!esploratoreId) {
            hideLoader();
            showToast('ID esploratore non specificato', 'error');
            window.location.href = 'dashboard.html';
            return;
        }

        // Carica i dati dell'esploratore
        await loadEsploratoreData(esploratoreId);
        hideLoader();

    } catch (error) {
        console.error('Errore durante l\'inizializzazione della scheda:', error);
        showToast('Si è verificato un errore durante il caricamento della scheda. Riprova più tardi.', 'error');
        hideLoader();
    }
}

// Funzione per caricare i dati dell'esploratore
async function loadEsploratoreData(esploratoreId) {
    try {
        const esploratoreRef = doc(db, "utenti", esploratoreId);
        const esploratoreDoc = await getDoc(esploratoreRef);

        if (!esploratoreDoc.exists()) {
            showToast('Esploratore non trovato', 'error');
            window.location.href = 'dashboard.html';
            return;
        }

        const esploratore = esploratoreDoc.data();
        
        // Aggiorna l'header con i dati dell'esploratore
        document.getElementById('nomeCompleto').textContent = `${esploratore.nome} ${esploratore.cognome}`;
        document.getElementById('emailLink').textContent = esploratore.email;
        document.getElementById('emailLink').href = `mailto:${esploratore.email}`;

        // Mostra i controlli staff se l'utente è staff approvato
        const isApproved = await isStaffApproved();
        if (isApproved) {
            document.getElementById('staffControls').classList.remove('hidden');
        }

        // Mostra il contenuto prima di caricare le sezioni
        document.getElementById('schedaContent').classList.remove('hidden');

        // Carica la prima sezione (anagrafici) e gestisci gli errori individualmente
        try {
            await loadSezioneData('anagrafici', esploratore);
        } catch (error) {
            console.error('Errore nel caricamento della sezione anagrafici:', error);
            showToast('Errore nel caricamento della sezione anagrafici', 'error');
        }

    } catch (error) {
        console.error('Errore durante il caricamento dei dati:', error);
        showToast('Errore durante il caricamento dei dati. Riprova più tardi.', 'error');
        throw error;
    }
}

// Funzione per caricare i dati di una sezione
async function loadSezioneData(sezione, esploratore) {
    const container = document.getElementById('sezioneContent');
    try {
        showLoader();
        const response = await fetch(`sezioni/${sezione}.html`);
        if (!response.ok) throw new Error('Sezione non trovata');
        const content = await response.text();
        container.innerHTML = content;

        // Popola i campi con i dati dell'esploratore
        switch (sezione) {
            case 'anagrafici':
                document.getElementById('dataNascitaDisplay').textContent = esploratore.dataNascita || '-';
                document.getElementById('codiceFiscaleDisplay').textContent = esploratore.codiceFiscale || '-';
                document.getElementById('indirizzoDisplay').textContent = esploratore.indirizzo || '-';
                document.getElementById('telefonoDisplay').textContent = esploratore.telefono || '-';
                break;
            case 'contatti':
                // Popola i dati dei genitori
                break;
            case 'sanitarie':
                document.getElementById('gruppoSanguignoDisplay').textContent = esploratore.gruppoSanguigno || '-';
                document.getElementById('intolleranzeDisplay').textContent = esploratore.intolleranze || '-';
                document.getElementById('allergieDisplay').textContent = esploratore.allergie || '-';
                document.getElementById('farmaciDisplay').textContent = esploratore.farmaci || '-';
                break;
            case 'progressione':
                document.getElementById('promessaDisplay').textContent = esploratore.promessa || '-';
                document.getElementById('brevettoDisplay').textContent = esploratore.brevetto || '-';
                document.getElementById('specialitaDisplay').textContent = esploratore.specialita || '-';
                document.getElementById('cordaDisplay').textContent = esploratore.corda || '-';
                break;
            // Aggiungi altri casi per le altre sezioni
        }
        hideLoader();
    } catch (error) {
        console.error(`Errore nel caricamento della sezione ${sezione}:`, error);
        container.innerHTML = '<div class="p-4 text-red-600">Errore nel caricamento della sezione</div>';
        hideLoader();
    }
}

// Funzione per salvare i dati
async function saveData(esploratoreId, data) {
    try {
        const esploratoreRef = doc(db, "utenti", esploratoreId);
        await updateDoc(esploratoreRef, data);
        showToast('Dati salvati con successo', 'success');
    } catch (error) {
        console.error('Errore durante il salvataggio dei dati:', error);
        showToast('Errore durante il salvataggio dei dati. Riprova più tardi.', 'error');
    }
}

// Inizializza la scheda quando il documento è pronto
document.addEventListener('DOMContentLoaded', initScheda);

// Esponi le funzioni necessarie globalmente
window.caricaSezione = async function(sezione) {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const esploratoreId = urlParams.get('id');
        const esploratoreRef = doc(db, "utenti", esploratoreId);
        const esploratoreDoc = await getDoc(esploratoreRef);
        const esploratore = esploratoreDoc.data();
        await loadSezioneData(sezione, esploratore);
    } catch (error) {
        console.error('Errore nel caricamento della sezione:', error);
        showToast('Errore nel caricamento della sezione', 'error');
        hideLoader();
    }
}; 