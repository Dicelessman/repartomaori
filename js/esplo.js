import { checkAuth, isStaffApproved } from './auth.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import { showLoader, hideLoader, showToast } from './ui.js';

// Variabili globali per mantenere i dati
let esploratoreData = null;
let sezioniContent = {};
let currentSezione = null;

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

// Funzione per creare gli elementi della sezione anagrafici
function createAnagraficiSection() {
    const container = document.createElement('div');
    container.className = 'space-y-6';
    
    // Data di nascita
    const dataNascitaGroup = document.createElement('div');
    dataNascitaGroup.className = 'flex justify-between items-center';
    dataNascitaGroup.innerHTML = `
        <div class="flex-1">
            <h3 class="text-lg font-medium">Data di Nascita</h3>
            <p id="dataNascitaDisplay" class="text-gray-600">-</p>
        </div>
        <input type="date" id="dataNascitaEdit" class="hidden border rounded px-2 py-1">
    `;
    container.appendChild(dataNascitaGroup);

    // Codice fiscale
    const codiceFiscaleGroup = document.createElement('div');
    codiceFiscaleGroup.className = 'flex justify-between items-center';
    codiceFiscaleGroup.innerHTML = `
        <div class="flex-1">
            <h3 class="text-lg font-medium">Codice Fiscale</h3>
            <p id="codiceFiscaleDisplay" class="text-gray-600">-</p>
        </div>
        <input type="text" id="codiceFiscaleEdit" class="hidden border rounded px-2 py-1">
    `;
    container.appendChild(codiceFiscaleGroup);

    // Indirizzo
    const indirizzoGroup = document.createElement('div');
    indirizzoGroup.className = 'flex justify-between items-center';
    indirizzoGroup.innerHTML = `
        <div class="flex-1">
            <h3 class="text-lg font-medium">Indirizzo</h3>
            <p id="indirizzoDisplay" class="text-gray-600">-</p>
        </div>
        <input type="text" id="indirizzoEdit" class="hidden border rounded px-2 py-1">
    `;
    container.appendChild(indirizzoGroup);

    // Telefono
    const telefonoGroup = document.createElement('div');
    telefonoGroup.className = 'flex justify-between items-center';
    telefonoGroup.innerHTML = `
        <div class="flex-1">
            <h3 class="text-lg font-medium">Telefono</h3>
            <p id="telefonoDisplay" class="text-gray-600">-</p>
        </div>
        <input type="tel" id="telefonoEdit" class="hidden border rounded px-2 py-1">
    `;
    container.appendChild(telefonoGroup);

    return container;
}

// Funzione per caricare il contenuto di una sezione
async function loadSezioneContent(sezione) {
    if (!sezioniContent[sezione]) {
        console.log('Caricamento contenuto sezione:', sezione);
        if (sezione === 'anagrafici') {
            sezioniContent[sezione] = createAnagraficiSection();
        } else {
            const response = await fetch(`sezioni/${sezione}.html`);
            if (!response.ok) throw new Error('Sezione non trovata');
            sezioniContent[sezione] = await response.text();
        }
    }
    return sezioniContent[sezione];
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
            console.log('Popolamento sezione contatti');
            const datiContatti = esploratore.datiScheda?.contatti || {};
            console.log('Dati contatti completi:', datiContatti);
            
            if (datiContatti.genitore1) {
                const gen1 = datiContatti.genitore1;
                const genitore1Display = document.getElementById('genitore1Display');
                if (genitore1Display) {
                    genitore1Display.innerHTML = `
                        <div>${gen1.nome || '-'}</div>
                        <div>${gen1.email || '-'}</div>
                        <div>${gen1.numero || '-'}</div>
                    `;
                    console.log('Genitore 1 display aggiornato:', gen1);
                }
            }

            if (datiContatti.genitore2) {
                const gen2 = datiContatti.genitore2;
                const genitore2Display = document.getElementById('genitore2Display');
                if (genitore2Display) {
                    genitore2Display.innerHTML = `
                        <div>${gen2.nome || '-'}</div>
                        <div>${gen2.email || '-'}</div>
                        <div>${gen2.numero || '-'}</div>
                    `;
                    console.log('Genitore 2 display aggiornato:', gen2);
                }
            }
            break;

        case 'sanitarie':
            console.log('Popolamento sezione sanitarie');
            const datiSanitari = esploratore.datiScheda?.sanitarie || {};
            console.log('Dati sanitari completi:', datiSanitari);
            
            const gruppoSanguignoDisplay = document.getElementById('gruppoSanguignoDisplay');
            if (gruppoSanguignoDisplay) {
                gruppoSanguignoDisplay.textContent = datiSanitari.gruppoSanguigno || '-';
                console.log('Gruppo sanguigno display aggiornato:', datiSanitari.gruppoSanguigno);
            }

            const intolleranzeDisplay = document.getElementById('intolleranzeDisplay');
            if (intolleranzeDisplay) {
                intolleranzeDisplay.textContent = datiSanitari.intolleranze || '-';
                console.log('Intolleranze display aggiornato:', datiSanitari.intolleranze);
            }

            const allergieDisplay = document.getElementById('allergieDisplay');
            if (allergieDisplay) {
                allergieDisplay.textContent = datiSanitari.allergie || '-';
                console.log('Allergie display aggiornato:', datiSanitari.allergie);
            }

            const farmaciDisplay = document.getElementById('farmaciDisplay');
            if (farmaciDisplay) {
                farmaciDisplay.textContent = datiSanitari.farmaci || '-';
                console.log('Farmaci display aggiornato:', datiSanitari.farmaci);
            }
            break;

        case 'progressione':
            console.log('Popolamento sezione progressione');
            const datiProgressione = esploratore.datiScheda?.progressione || {};
            console.log('Dati progressione completi:', datiProgressione);
            
            const promessaDisplay = document.getElementById('promessaDisplay');
            if (promessaDisplay) {
                promessaDisplay.textContent = datiProgressione.promessa || '-';
                console.log('Promessa display aggiornato:', datiProgressione.promessa);
            }

            const brevettoDisplay = document.getElementById('brevettoDisplay');
            if (brevettoDisplay) {
                brevettoDisplay.textContent = datiProgressione.brevetto || '-';
                console.log('Brevetto display aggiornato:', datiProgressione.brevetto);
            }

            const specialitaDisplay = document.getElementById('specialitaDisplay');
            if (specialitaDisplay) {
                specialitaDisplay.textContent = datiProgressione.specialita || '-';
                console.log('Specialità display aggiornato:', datiProgressione.specialita);
            }

            const cordaDisplay = document.getElementById('cordaDisplay');
            if (cordaDisplay) {
                cordaDisplay.textContent = datiProgressione.corda || '-';
                console.log('Corda display aggiornato:', datiProgressione.corda);
            }
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
        
        // Se i dati non sono presenti, caricali da Firebase
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

        // Carica il contenuto della sezione
        const content = await loadSezioneContent(sezione);
        
        // Aggiorna il contenuto
        const container = document.getElementById('sezioneContent');
        container.innerHTML = '';
        if (sezione === 'anagrafici') {
            container.appendChild(content);
        } else {
            container.innerHTML = content;
        }
        
        // Aspetta che il DOM sia aggiornato
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Popola i campi
        await loadSezioneData(sezione, esploratoreData);
        currentSezione = sezione;
        hideLoader();
    } catch (error) {
        console.error('Errore nel caricamento della sezione:', error);
        showToast('Errore nel caricamento della sezione', 'error');
        hideLoader();
    }
}; 