import { checkAuth, isStaffApproved } from './auth.js';
import { doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import { showLoader, hideLoader, showToast } from './ui.js';

// Gestione dello stato
const state = {
    esploratoreData: null,
    sezioniContent: {},
    currentSezione: null,
    isLoading: false,
    error: null,
    lastUpdate: null
};

// Funzione per aggiornare lo stato
function updateState(newState) {
    Object.assign(state, newState);
    console.log('Stato aggiornato:', state);
}

// Sistema di cache avanzato
const CACHE_VERSION = 1;
const CACHE_NAME = `esploratore-cache-v${CACHE_VERSION}`;

// Sistema di notifiche
const NOTIFICATION_TYPES = {
    UPDATE: 'update',
    ERROR: 'error',
    SYNC: 'sync',
    CACHE: 'cache'
};

// Sistema di ricerca e filtro
const SEARCH_CONFIG = {
    debounceTime: 300,
    minSearchLength: 2,
    maxResults: 50
};

// Funzioni per la gestione della cache
async function initCache() {
    try {
        const db = await openDB();
        console.log('Cache inizializzata con successo');
        return db;
    } catch (error) {
        console.error('Errore nell\'inizializzazione della cache:', error);
        throw error;
    }
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CACHE_NAME, CACHE_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Crea gli store per i diversi tipi di dati
            if (!db.objectStoreNames.contains('esploratori')) {
                db.createObjectStore('esploratori', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('sezioni')) {
                db.createObjectStore('sezioni', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' });
            }
        };
    });
}

async function saveToCache(storeName, data) {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        if (Array.isArray(data)) {
            await Promise.all(data.map(item => store.put(item)));
        } else {
            await store.put(data);
        }
        
        await tx.complete;
        console.log(`Dati salvati in cache (${storeName})`);
    } catch (error) {
        console.error(`Errore nel salvataggio in cache (${storeName}):`, error);
    }
}

async function getFromCache(storeName, key) {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const data = await store.get(key);
        return data;
    } catch (error) {
        console.error(`Errore nel recupero dalla cache (${storeName}):`, error);
        return null;
    }
}

// Funzioni per la gestione delle notifiche
function showNotification(title, message, type = NOTIFICATION_TYPES.UPDATE) {
    // Verifica se le notifiche sono supportate
    if (!("Notification" in window)) {
        console.log("Questo browser non supporta le notifiche desktop");
        return;
    }

    // Verifica se le notifiche sono permesse
    if (Notification.permission === "granted") {
        createNotification(title, message, type);
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                createNotification(title, message, type);
            }
        });
    }
}

function createNotification(title, message, type) {
    const icon = getNotificationIcon(type);
    const notification = new Notification(title, {
        body: message,
        icon: icon,
        badge: icon,
        tag: type,
        requireInteraction: true
    });

    notification.onclick = function() {
        window.focus();
        this.close();
    };
}

function getNotificationIcon(type) {
    switch (type) {
        case NOTIFICATION_TYPES.UPDATE:
            return '/assets/icons/update.png';
        case NOTIFICATION_TYPES.ERROR:
            return '/assets/icons/error.png';
        case NOTIFICATION_TYPES.SYNC:
            return '/assets/icons/sync.png';
        case NOTIFICATION_TYPES.CACHE:
            return '/assets/icons/cache.png';
        default:
            return '/assets/icons/info.png';
    }
}

// Funzione per sincronizzare i dati con Firebase
function syncWithFirebase(esploratoreId) {
    const esploratoreRef = doc(db, "utenti", esploratoreId);
    
    return onSnapshot(esploratoreRef, async (doc) => {
        if (doc.exists()) {
            const newData = doc.data();
            const oldData = state.esploratoreData;
            
            updateState({
                esploratoreData: newData,
                lastUpdate: new Date()
            });
            
            // Salva i dati in cache
            await saveToCache('esploratori', {
                id: esploratoreId,
                data: newData,
                timestamp: Date.now()
            });
            
            // Verifica se ci sono cambiamenti significativi
            if (oldData && hasSignificantChanges(oldData, newData)) {
                showNotification(
                    'Aggiornamento Dati',
                    'Sono stati rilevati aggiornamenti nei dati dell\'esploratore',
                    NOTIFICATION_TYPES.UPDATE
                );
            }
            
            // Aggiorna la sezione corrente se presente
            if (state.currentSezione) {
                caricaSezione(state.currentSezione);
            }
        }
    }, async (error) => {
        console.error('Errore nella sincronizzazione:', error);
        updateState({ error });
        
        // In caso di errore, prova a recuperare i dati dalla cache
        const cachedData = await getFromCache('esploratori', esploratoreId);
        if (cachedData) {
            updateState({
                esploratoreData: cachedData.data,
                lastUpdate: new Date(cachedData.timestamp)
            });
            showNotification(
                'Utilizzo Dati in Cache',
                'I dati sono stati recuperati dalla cache locale',
                NOTIFICATION_TYPES.CACHE
            );
        } else {
            showNotification(
                'Errore di Sincronizzazione',
                'Impossibile recuperare i dati. Riprova più tardi.',
                NOTIFICATION_TYPES.ERROR
            );
        }
    });
}

// Funzione per verificare cambiamenti significativi
function hasSignificantChanges(oldData, newData) {
    // Verifica i campi principali
    const fieldsToCheck = [
        'nome', 'cognome', 'email',
        'datiScheda.anagrafici',
        'datiScheda.contatti',
        'datiScheda.sanitarie',
        'datiScheda.progressione'
    ];

    return fieldsToCheck.some(field => {
        const oldValue = getNestedValue(oldData, field);
        const newValue = getNestedValue(newData, field);
        return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    });
}

// Funzione di utilità per accedere a valori annidati
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

// Funzione per inizializzare la scheda
async function initScheda() {
    try {
        updateState({ isLoading: true });
        showLoader();
        showLoadingIndicator();
        
        // Inizializza la cache
        await initCache();
        
        // Verifica autenticazione
        const user = await checkAuth();
        if (!user) {
            hideLoader();
            hideLoadingIndicator();
            window.location.href = 'login.html';
            return;
        }

        // Ottieni l'ID dell'esploratore dall'URL
        const urlParams = new URLSearchParams(window.location.search);
        const esploratoreId = urlParams.get('id');

        if (!esploratoreId) {
            hideLoader();
            hideLoadingIndicator();
            showToast('ID esploratore non specificato', 'error');
            window.location.href = 'dashboard.html';
            return;
        }

        // Prova prima a recuperare i dati dalla cache
        const cachedData = await getFromCache('esploratori', esploratoreId);
        if (cachedData) {
            updateState({
                esploratoreData: cachedData.data,
                lastUpdate: new Date(cachedData.timestamp)
            });
            showToast('Dati caricati dalla cache', 'info');
        }

        // Inizia la sincronizzazione con Firebase
        const unsubscribe = syncWithFirebase(esploratoreId);

        // Carica i dati iniziali
        await loadEsploratoreData(esploratoreId);
        
        // Precarica la prima sezione (anagrafici) e la successiva (contatti)
        await preloadSezione('anagrafici');
        await preloadSezione('contatti');
        
        // Carica la prima sezione
        await caricaSezione('anagrafici');
        
        updateState({ isLoading: false });
        hideLoader();
        hideLoadingIndicator();

    } catch (error) {
        console.error('Errore durante l\'inizializzazione della scheda:', error);
        updateState({ error, isLoading: false });
        showToast('Si è verificato un errore durante il caricamento della scheda. Riprova più tardi.', 'error');
        hideLoader();
        hideLoadingIndicator();
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
    try {
        // Prova prima a recuperare dalla cache
        const cachedContent = await getFromCache('sezioni', sezione);
        if (cachedContent) {
            console.log(`Contenuto recuperato dalla cache: ${sezione}`);
            return cachedContent.data;
        }

        // Se non è in cache, carica normalmente
        console.log('Caricamento contenuto sezione:', sezione);
        let content;
        if (sezione === 'anagrafici') {
            content = createAnagraficiSection();
        } else {
            const response = await fetch(`sezioni/${sezione}.html`);
            if (!response.ok) throw new Error('Sezione non trovata');
            content = await response.text();
        }

        // Salva in cache
        await saveToCache('sezioni', {
            id: sezione,
            data: content,
            timestamp: Date.now()
        });

        return content;
    } catch (error) {
        console.error(`Errore nel caricamento della sezione ${sezione}:`, error);
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
        showNotification(
            'Salvataggio Completato',
            'I dati sono stati salvati con successo',
            NOTIFICATION_TYPES.SYNC
        );
    } catch (error) {
        console.error('Errore durante il salvataggio dei dati:', error);
        showNotification(
            'Errore di Salvataggio',
            'Si è verificato un errore durante il salvataggio dei dati',
            NOTIFICATION_TYPES.ERROR
        );
    }
}

// Aggiungi queste funzioni per il lazy loading
async function preloadSezione(sezione) {
    if (!state.sezioniContent[sezione]) {
        try {
            const content = await loadSezioneContent(sezione);
            updateState({
                sezioniContent: {
                    ...state.sezioniContent,
                    [sezione]: content
                }
            });
            console.log(`Sezione ${sezione} precaricata`);
        } catch (error) {
            console.error(`Errore nel precaricamento della sezione ${sezione}:`, error);
        }
    }
}

function getSezioniAdiacenti(sezioneCorrente) {
    const sezioni = ['anagrafici', 'contatti', 'sanitarie', 'progressione'];
    const index = sezioni.indexOf(sezioneCorrente);
    const adiacenti = [];
    
    if (index > 0) adiacenti.push(sezioni[index - 1]);
    if (index < sezioni.length - 1) adiacenti.push(sezioni[index + 1]);
    
    return adiacenti;
}

// Aggiungi queste funzioni per le animazioni
function fadeOut(element) {
    return new Promise(resolve => {
        element.style.transition = 'opacity 0.3s ease-out';
        element.style.opacity = '0';
        setTimeout(resolve, 300);
    });
}

function fadeIn(element) {
    return new Promise(resolve => {
        element.style.transition = 'opacity 0.3s ease-in';
        element.style.opacity = '1';
        setTimeout(resolve, 300);
    });
}

function showLoadingIndicator() {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.className = 'fixed top-0 left-0 w-full h-1 bg-blue-500 transition-all duration-300';
    loadingIndicator.style.transform = 'scaleX(0)';
    document.body.appendChild(loadingIndicator);
    
    // Anima la barra di caricamento
    requestAnimationFrame(() => {
        loadingIndicator.style.transform = 'scaleX(0.7)';
    });
}

function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.transform = 'scaleX(1)';
        setTimeout(() => {
            loadingIndicator.remove();
        }, 300);
    }
}

// Funzioni di utilità per la ricerca
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function normalizeString(str) {
    return str.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// Funzione di ricerca
const searchData = debounce(async (query, filters = {}) => {
    try {
        if (!query || query.length < SEARCH_CONFIG.minSearchLength) {
            return [];
        }

        const normalizedQuery = normalizeString(query);
        const results = [];
        const data = state.esploratoreData;

        function searchInObject(obj, path = '') {
            if (!obj || typeof obj !== 'object') return;

            Object.entries(obj).forEach(([key, value]) => {
                const currentPath = path ? `${path}.${key}` : key;

                if (filters[currentPath] !== undefined && 
                    filters[currentPath] !== value) {
                    return;
                }

                if (typeof value === 'string') {
                    const normalizedValue = normalizeString(value);
                    if (normalizedValue.includes(normalizedQuery)) {
                        results.push({
                            path: currentPath,
                            value: value,
                            context: getContext(obj, key)
                        });
                    }
                } else if (typeof value === 'object') {
                    searchInObject(value, currentPath);
                }
            });
        }

        searchInObject(data);
        return results.slice(0, SEARCH_CONFIG.maxResults);
    } catch (error) {
        console.error('Errore durante la ricerca:', error);
        showNotification(
            'Errore di Ricerca',
            'Si è verificato un errore durante la ricerca',
            NOTIFICATION_TYPES.ERROR
        );
        return [];
    }
}, SEARCH_CONFIG.debounceTime);

function getContext(obj, key) {
    const context = {};
    Object.entries(obj).forEach(([k, v]) => {
        if (k !== key && typeof v === 'string') {
            context[k] = v;
        }
    });
    return context;
}

// Funzione per filtrare i dati
function filterData(data, filters) {
    return Object.entries(filters).reduce((filtered, [key, value]) => {
        if (value === undefined || value === '') return filtered;
        
        const normalizedValue = normalizeString(value);
        return filtered.filter(item => {
            const itemValue = getNestedValue(item, key);
            return itemValue && normalizeString(itemValue).includes(normalizedValue);
        });
    }, data);
}

// Funzione per creare l'interfaccia di ricerca
function createSearchInterface() {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container mb-4';
    searchContainer.innerHTML = `
        <div class="flex gap-4">
            <div class="flex-1">
                <input type="text" 
                       id="searchInput" 
                       class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                       placeholder="Cerca nei dati...">
            </div>
            <div class="flex gap-2">
                <select id="filterType" class="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Tutti i campi</option>
                    <option value="nome">Nome</option>
                    <option value="cognome">Cognome</option>
                    <option value="email">Email</option>
                    <option value="datiScheda.anagrafici">Dati Anagrafici</option>
                    <option value="datiScheda.contatti">Contatti</option>
                    <option value="datiScheda.sanitarie">Dati Sanitari</option>
                    <option value="datiScheda.progressione">Progressione</option>
                </select>
                <button id="clearSearch" 
                        class="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400">
                    Pulisci
                </button>
            </div>
        </div>
        <div id="searchResults" class="mt-4 hidden">
            <div class="bg-white rounded-lg shadow-lg p-4">
                <h3 class="text-lg font-semibold mb-2">Risultati della ricerca</h3>
                <div id="resultsList" class="space-y-2"></div>
            </div>
        </div>
    `;

    // Aggiungi gli event listener
    const searchInput = searchContainer.querySelector('#searchInput');
    const filterType = searchContainer.querySelector('#filterType');
    const clearSearch = searchContainer.querySelector('#clearSearch');
    
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        const filter = filterType.value;
        const filters = filter ? { [filter]: query } : {};
        const results = await searchData(query, filters);
        handleSearchResults(results);
    });
    
    filterType.addEventListener('change', async () => {
        const query = searchInput.value;
        const filter = filterType.value;
        const filters = filter ? { [filter]: query } : {};
        const results = await searchData(query, filters);
        handleSearchResults(results);
    });
    
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        filterType.value = '';
        searchContainer.querySelector('#searchResults').classList.add('hidden');
    });

    return searchContainer;
}

// Funzione per gestire i risultati della ricerca
function handleSearchResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    const resultsList = document.getElementById('resultsList');
    
    if (!results.length) {
        resultsContainer.classList.add('hidden');
        return;
    }

    resultsList.innerHTML = results.map(result => `
        <div class="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
             onclick="navigateToResult('${result.path}')">
            <div class="font-medium">${result.value}</div>
            <div class="text-sm text-gray-600">
                ${Object.entries(result.context)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ')}
            </div>
        </div>
    `).join('');

    resultsContainer.classList.remove('hidden');
}

// Funzione per navigare al risultato
window.navigateToResult = function(path) {
    const [section, ...rest] = path.split('.');
    if (section === 'datiScheda') {
        const targetSection = rest[0];
        caricaSezione(targetSection);
        
        // Evidenzia il campo trovato
        setTimeout(() => {
            const element = document.querySelector(`[data-field="${rest.join('.')}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight');
                setTimeout(() => element.classList.remove('highlight'), 2000);
            }
        }, 500);
    }
};

// Modifica la funzione caricaSezione per includere l'interfaccia di ricerca
const originalCaricaSezione = window.caricaSezione;
window.caricaSezione = async function(sezione) {
    try {
        updateState({ isLoading: true });
        showLoader();
        showLoadingIndicator();
        
        const container = document.getElementById('sezioneContent');
        
        // Aggiungi l'interfaccia di ricerca se non esiste
        if (!document.querySelector('.search-container')) {
            container.insertBefore(createSearchInterface(), container.firstChild);
        }

        // Verifica che i dati siano presenti prima di procedere
        if (!state.esploratoreData || !state.esploratoreData.datiScheda) {
            console.error('Dati mancanti o incompleti:', state.esploratoreData);
            throw new Error('Dati esploratore incompleti');
        }

        // Fade out della sezione corrente
        if (container.children.length > 0) {
            await fadeOut(container);
        }

        // Carica la sezione corrente
        if (!state.sezioniContent[sezione]) {
            const content = await loadSezioneContent(sezione);
            updateState({
                sezioniContent: {
                    ...state.sezioniContent,
                    [sezione]: content
                }
            });
        }
        
        // Aggiorna il contenuto
        container.innerHTML = '';
        if (sezione === 'anagrafici') {
            container.appendChild(state.sezioniContent[sezione]);
        } else {
            container.innerHTML = state.sezioniContent[sezione];
        }
        
        // Popola i campi della sezione corrente
        await populateSezione(sezione, state.esploratoreData);
        
        // Fade in della nuova sezione
        await fadeIn(container);
        
        // Precarica le sezioni adiacenti
        const sezioniAdiacenti = getSezioniAdiacenti(sezione);
        sezioniAdiacenti.forEach(sezioneAdiacente => {
            preloadSezione(sezioneAdiacente);
        });
        
        // Aggiorna lo stato e nascondi i loader
        updateState({ 
            currentSezione: sezione,
            isLoading: false
        });
        hideLoader();
        hideLoadingIndicator();

        // Aggiorna lo stile del menu di navigazione
        updateNavigationStyle(sezione);
        
    } catch (error) {
        console.error('Errore nel caricamento della sezione:', error);
        updateState({ error, isLoading: false });
        showNotification(
            'Errore di Caricamento',
            'Si è verificato un errore durante il caricamento della sezione',
            NOTIFICATION_TYPES.ERROR
        );
        hideLoader();
        hideLoadingIndicator();
    }
};

// Funzione per popolare una sezione
async function populateSezione(sezione, data) {
    switch (sezione) {
        case 'anagrafici':
            await populateAnagrafici(data);
            break;
        case 'contatti':
            await populateContatti(data);
            break;
        case 'sanitarie':
            await populateSanitarie(data);
            break;
        case 'progressione':
            await populateProgressione(data);
            break;
    }
}

// Funzione per aggiornare lo stile del menu di navigazione
function updateNavigationStyle(sezioneCorrente) {
    const navButtons = document.querySelectorAll('nav button');
    navButtons.forEach(button => {
        const sezione = button.getAttribute('data-sezione');
        if (sezione === sezioneCorrente) {
            button.classList.add('text-white', 'bg-primary');
            button.classList.remove('text-gray-600');
        } else {
            button.classList.remove('text-white', 'bg-primary');
            button.classList.add('text-gray-600');
        }
    });
}

// Inizializza la scheda quando il documento è pronto
document.addEventListener('DOMContentLoaded', initScheda);

// ... rest of the existing code ... 