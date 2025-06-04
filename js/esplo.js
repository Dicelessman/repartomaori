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
        console.log('Caricamento dati esploratore:', esploratoreId);
        const esploratoreRef = doc(db, "utenti", esploratoreId);
        const esploratoreDoc = await getDoc(esploratoreRef);

        if (!esploratoreDoc.exists()) {
            showToast('Esploratore non trovato', 'error');
            window.location.href = 'dashboard.html';
            return;
        }

        const esploratore = esploratoreDoc.data();
        console.log('Dati esploratore recuperati:', esploratore);
        
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
        document.getElementById('loading').classList.add('hidden');

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
    console.log('Caricamento sezione:', sezione, 'con dati:', esploratore);
    const container = document.getElementById('sezioneContent');
    try {
        const response = await fetch(`sezioni/${sezione}.html`);
        if (!response.ok) throw new Error('Sezione non trovata');
        const content = await response.text();
        container.innerHTML = content;

        // Popola i campi con i dati dell'esploratore
        switch (sezione) {
            case 'anagrafici':
                console.log('Popolamento sezione anagrafici');
                // Formatta la data di nascita se presente
                const dataNascita = esploratore.dataNascita ? new Date(esploratore.dataNascita).toLocaleDateString('it-IT') : '-';
                console.log('Data nascita:', dataNascita);
                document.getElementById('dataNascitaDisplay').textContent = dataNascita;
                if (document.getElementById('dataNascitaEdit')) {
                    document.getElementById('dataNascitaEdit').value = esploratore.dataNascita || '';
                }

                console.log('Codice fiscale:', esploratore.codiceFiscale);
                document.getElementById('codiceFiscaleDisplay').textContent = esploratore.codiceFiscale || '-';
                if (document.getElementById('codiceFiscaleEdit')) {
                    document.getElementById('codiceFiscaleEdit').value = esploratore.codiceFiscale || '';
                }

                console.log('Indirizzo:', esploratore.indirizzo);
                document.getElementById('indirizzoDisplay').textContent = esploratore.indirizzo || '-';
                if (document.getElementById('indirizzoEdit')) {
                    document.getElementById('indirizzoEdit').value = esploratore.indirizzo || '';
                }

                console.log('Telefono:', esploratore.telefono);
                document.getElementById('telefonoDisplay').textContent = esploratore.telefono || '-';
                if (document.getElementById('telefonoEdit')) {
                    document.getElementById('telefonoEdit').value = esploratore.telefono || '';
                }
                break;

            case 'contatti':
                // Popola i dati dei genitori
                if (esploratore.genitori) {
                    // Genitore 1
                    if (esploratore.genitori.genitore1) {
                        const gen1 = esploratore.genitori.genitore1;
                        document.getElementById('genitore1Display').innerHTML = `
                            <div>${gen1.nome || '-'}</div>
                            <div>${gen1.email || '-'}</div>
                            <div>${gen1.numero || '-'}</div>
                        `;
                        if (document.getElementById('genitore1NomeEdit')) {
                            document.getElementById('genitore1NomeEdit').value = gen1.nome || '';
                            document.getElementById('genitore1EmailEdit').value = gen1.email || '';
                            document.getElementById('genitore1NumeroEdit').value = gen1.numero || '';
                        }
                    }

                    // Genitore 2
                    if (esploratore.genitori.genitore2) {
                        const gen2 = esploratore.genitori.genitore2;
                        document.getElementById('genitore2Display').innerHTML = `
                            <div>${gen2.nome || '-'}</div>
                            <div>${gen2.email || '-'}</div>
                            <div>${gen2.numero || '-'}</div>
                        `;
                        if (document.getElementById('genitore2NomeEdit')) {
                            document.getElementById('genitore2NomeEdit').value = gen2.nome || '';
                            document.getElementById('genitore2EmailEdit').value = gen2.email || '';
                            document.getElementById('genitore2NumeroEdit').value = gen2.numero || '';
                        }
                    }
                }
                break;

            case 'sanitarie':
                document.getElementById('gruppoSanguignoDisplay').textContent = esploratore.gruppoSanguigno || '-';
                if (document.getElementById('gruppoSanguignoEdit')) {
                    document.getElementById('gruppoSanguignoEdit').value = esploratore.gruppoSanguigno || '';
                }

                document.getElementById('intolleranzeDisplay').textContent = esploratore.intolleranze || '-';
                if (document.getElementById('intolleranzeEdit')) {
                    document.getElementById('intolleranzeEdit').value = esploratore.intolleranze || '';
                }

                document.getElementById('allergieDisplay').textContent = esploratore.allergie || '-';
                if (document.getElementById('allergieEdit')) {
                    document.getElementById('allergieEdit').value = esploratore.allergie || '';
                }

                document.getElementById('farmaciDisplay').textContent = esploratore.farmaci || '-';
                if (document.getElementById('farmaciEdit')) {
                    document.getElementById('farmaciEdit').value = esploratore.farmaci || '';
                }
                break;

            case 'progressione':
                document.getElementById('promessaDisplay').textContent = esploratore.promessa || '-';
                document.getElementById('brevettoDisplay').textContent = esploratore.brevetto || '-';
                document.getElementById('specialitaDisplay').textContent = esploratore.specialita || '-';
                document.getElementById('cordaDisplay').textContent = esploratore.corda || '-';
                break;
        }
    } catch (error) {
        console.error(`Errore nel caricamento della sezione ${sezione}:`, error);
        container.innerHTML = '<div class="p-4 text-red-600">Errore nel caricamento della sezione</div>';
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