import { checkAuth, isStaffApproved } from './auth.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import { showLoader, hideLoader, showToast } from './ui.js';

// Variabile globale per mantenere i dati dell'esploratore
let esploratoreData = null;

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

        esploratoreData = esploratoreDoc.data();
        console.log('Dati esploratore recuperati:', esploratoreData);
        console.log('Struttura completa dei dati:', JSON.stringify(esploratoreData, null, 2));
        
        // Aggiorna l'header con i dati dell'esploratore
        document.getElementById('nomeCompleto').textContent = `${esploratoreData.nome} ${esploratoreData.cognome}`;
        document.getElementById('emailLink').textContent = esploratoreData.email;
        document.getElementById('emailLink').href = `mailto:${esploratoreData.email}`;

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
            await loadSezioneData('anagrafici', esploratoreData);
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
    console.log('Popolamento dati per sezione:', sezione);
    console.log('Dati disponibili:', esploratore);
    
    // Popola i campi con i dati dell'esploratore
    switch (sezione) {
        case 'anagrafici':
            console.log('Popolamento sezione anagrafici');
            const datiAnagrafici = esploratore.datiScheda?.anagrafici || {};
            console.log('Dati anagrafici completi:', datiAnagrafici);
            
            // Formatta la data di nascita se presente
            const dataNascita = datiAnagrafici.dataNascita ? new Date(datiAnagrafici.dataNascita).toLocaleDateString('it-IT') : '-';
            console.log('Data nascita formattata:', dataNascita);
            
            // Verifica che gli elementi esistano prima di modificarli
            const dataNascitaDisplay = document.getElementById('dataNascitaDisplay');
            const dataNascitaEdit = document.getElementById('dataNascitaEdit');
            if (dataNascitaDisplay) {
                dataNascitaDisplay.textContent = dataNascita;
                console.log('Data nascita display aggiornato:', dataNascita);
            }
            if (dataNascitaEdit) {
                dataNascitaEdit.value = datiAnagrafici.dataNascita || '';
                console.log('Data nascita edit aggiornato:', datiAnagrafici.dataNascita);
            }

            const codiceFiscaleDisplay = document.getElementById('codiceFiscaleDisplay');
            const codiceFiscaleEdit = document.getElementById('codiceFiscaleEdit');
            if (codiceFiscaleDisplay) {
                codiceFiscaleDisplay.textContent = datiAnagrafici.codiceFiscale || '-';
                console.log('Codice fiscale display aggiornato:', datiAnagrafici.codiceFiscale);
            }
            if (codiceFiscaleEdit) {
                codiceFiscaleEdit.value = datiAnagrafici.codiceFiscale || '';
                console.log('Codice fiscale edit aggiornato:', datiAnagrafici.codiceFiscale);
            }

            const indirizzoDisplay = document.getElementById('indirizzoDisplay');
            const indirizzoEdit = document.getElementById('indirizzoEdit');
            if (indirizzoDisplay) {
                indirizzoDisplay.textContent = datiAnagrafici.indirizzo || '-';
                console.log('Indirizzo display aggiornato:', datiAnagrafici.indirizzo);
            }
            if (indirizzoEdit) {
                indirizzoEdit.value = datiAnagrafici.indirizzo || '';
                console.log('Indirizzo edit aggiornato:', datiAnagrafici.indirizzo);
            }

            const telefonoDisplay = document.getElementById('telefonoDisplay');
            const telefonoEdit = document.getElementById('telefonoEdit');
            if (telefonoDisplay) {
                telefonoDisplay.textContent = datiAnagrafici.telefono || '-';
                console.log('Telefono display aggiornato:', datiAnagrafici.telefono);
            }
            if (telefonoEdit) {
                telefonoEdit.value = datiAnagrafici.telefono || '';
                console.log('Telefono edit aggiornato:', datiAnagrafici.telefono);
            }
            break;

        case 'contatti':
            // Popola i dati dei genitori
            const datiContatti = esploratore.datiScheda?.contatti || {};
            if (datiContatti.genitore1) {
                const gen1 = datiContatti.genitore1;
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

            if (datiContatti.genitore2) {
                const gen2 = datiContatti.genitore2;
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
            break;

        case 'sanitarie':
            const datiSanitari = esploratore.datiScheda?.sanitarie || {};
            document.getElementById('gruppoSanguignoDisplay').textContent = datiSanitari.gruppoSanguigno || '-';
            if (document.getElementById('gruppoSanguignoEdit')) {
                document.getElementById('gruppoSanguignoEdit').value = datiSanitari.gruppoSanguigno || '';
            }

            document.getElementById('intolleranzeDisplay').textContent = datiSanitari.intolleranze || '-';
            if (document.getElementById('intolleranzeEdit')) {
                document.getElementById('intolleranzeEdit').value = datiSanitari.intolleranze || '';
            }

            document.getElementById('allergieDisplay').textContent = datiSanitari.allergie || '-';
            if (document.getElementById('allergieEdit')) {
                document.getElementById('allergieEdit').value = datiSanitari.allergie || '';
            }

            document.getElementById('farmaciDisplay').textContent = datiSanitari.farmaci || '-';
            if (document.getElementById('farmaciEdit')) {
                document.getElementById('farmaciEdit').value = datiSanitari.farmaci || '';
            }
            break;

        case 'progressione':
            const datiProgressione = esploratore.datiScheda?.progressione || {};
            document.getElementById('promessaDisplay').textContent = datiProgressione.promessa || '-';
            document.getElementById('brevettoDisplay').textContent = datiProgressione.brevetto || '-';
            document.getElementById('specialitaDisplay').textContent = datiProgressione.specialita || '-';
            document.getElementById('cordaDisplay').textContent = datiProgressione.corda || '-';
            break;
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
        showLoader();
        console.log('Caricamento sezione:', sezione);
        console.log('Dati esploratore disponibili:', esploratoreData);
        
        if (!esploratoreData) {
            console.log('Dati non presenti, ricarico da Firebase');
            const urlParams = new URLSearchParams(window.location.search);
            const esploratoreId = urlParams.get('id');
            const esploratoreRef = doc(db, "utenti", esploratoreId);
            const esploratoreDoc = await getDoc(esploratoreRef);
            esploratoreData = esploratoreDoc.data();
            console.log('Dati ricaricati:', esploratoreData);
        }
        
        // Verifica che i dati siano presenti prima di procedere
        if (!esploratoreData || !esploratoreData.datiScheda) {
            console.error('Dati mancanti o incompleti:', esploratoreData);
            throw new Error('Dati esploratore incompleti');
        }

        // Carica l'HTML della sezione
        const response = await fetch(`sezioni/${sezione}.html`);
        if (!response.ok) throw new Error('Sezione non trovata');
        const content = await response.text();
        
        // Aggiorna il contenuto
        const container = document.getElementById('sezioneContent');
        container.innerHTML = content;
        
        // Aspetta che il DOM sia aggiornato
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Popola i campi
        await loadSezioneData(sezione, esploratoreData);
        hideLoader();
    } catch (error) {
        console.error('Errore nel caricamento della sezione:', error);
        showToast('Errore nel caricamento della sezione', 'error');
        hideLoader();
    }
}; 