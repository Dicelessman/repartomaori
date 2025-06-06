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

// Sistema di cache avanzato
const CACHE_VERSION = 2;
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

// Configurazione del sistema di retry
const RETRY_CONFIG = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffFactor: 2
};

// Configurazione del throttling
const THROTTLE_CONFIG = {
    search: 300,      // ms per la ricerca
    scroll: 100,      // ms per lo scroll
    resize: 200,      // ms per il resize
    update: 500       // ms per gli aggiornamenti UI
};

// Configurazione del sistema di backup
const BACKUP_CONFIG = {
    maxBackups: 5,
    autoBackupInterval: 30 * 60 * 1000, // 30 minuti
    backupStore: 'backups',
    metadataStore: 'backup_metadata'
};

// Configurazione per la modifica dei dati
const EDIT_CONFIG = {
    autoSaveDelay: 2000, // 2 secondi
    maxRetries: 3,
    validationRules: {
        nome: { required: true, minLength: 2 },
        cognome: { required: true, minLength: 2 },
        email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
        telefono: { pattern: /^\+?[\d\s-]{8,}$/ },
        codiceFiscale: { pattern: /^[A-Z]{6}[\d]{2}[A-Z][\d]{2}[A-Z][\d]{3}[A-Z]$/ }
    }
};

// Funzione per aggiornare lo stato
function updateState(newState) {
    Object.assign(state, newState);
    console.log('Stato aggiornato:', state);
}

// Funzione per ottenere l'icona
function getNotificationIcon(type) {
    const ICON_CONFIG = {
        update: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMSAxMXY0YTIgMiAwIDAgMS0yIDJINWEyIDIgMCAwIDEtMi0ydi00Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iNyAxMCAxMiAxNSAxNyAxMCI+PC9wb2x5bGluZT48cGF0aCBkPSJNMTIgMTVWNyI+PC9wYXRoPjwvc3ZnPg==',
        error: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIj48L2NpcmNsZT48bGluZSB4MT0iMTUiIHkxPSI5IiB4Mj0iOSIgeTI9IjE1Ij48L2xpbmU+PGxpbmUgeDE9IjkiIHkxPSI5IiB4Mj0iMTUiIHkyPSIxNSI+PC9saW5lPjwvc3ZnPg==',
        sync: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMyA0djZoLTYiPjwvcGF0aD48cGF0aCBkPSJNMjAgMTVhOSA5IDAgMSAxLTIuNjgtNi45NCI+PC9wYXRoPjwvc3ZnPg==',
        cache: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMSAxNnYtMmE0IDQgMCAwIDAtNC00SDVhNCA0IDAgMCAwLTQgNHYyIj48L3BhdGg+PHJlY3QgeD0iMyIgeT0iMTYiIHdpZHRoPSIxOCIgaGVpZ2h0PSI0IiByeD0iMiI+PC9yZWN0Pjwvc3ZnPg=='
    };
    return ICON_CONFIG[type] || ICON_CONFIG.update;
}

// Funzione per aprire il database
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
            // Crea gli store per i backup
            if (!db.objectStoreNames.contains(BACKUP_CONFIG.backupStore)) {
                db.createObjectStore(BACKUP_CONFIG.backupStore, { keyPath: 'timestamp' });
            }
            if (!db.objectStoreNames.contains(BACKUP_CONFIG.metadataStore)) {
                db.createObjectStore(BACKUP_CONFIG.metadataStore, { keyPath: 'id' });
            }
        };
    });
}

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

// Funzione per inizializzare il sistema di backup
async function initBackupSystem() {
    try {
        const db = await openDB();
        console.log('Sistema di backup inizializzato');
        return true;
    } catch (error) {
        console.error('Errore nell\'inizializzazione del sistema di backup:', error);
        return false;
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

// Funzione per calcolare il delay del retry
function calculateRetryDelay(attempt) {
    const delay = Math.min(
        RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt),
        RETRY_CONFIG.maxDelay
    );
    return delay + Math.random() * 1000; // Aggiunge jitter per evitare thundering herd
}

// Funzione per eseguire operazioni con retry
async function executeWithRetry(operation, operationName) {
    let lastError;
    
    for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            console.warn(`Tentativo ${attempt + 1}/${RETRY_CONFIG.maxAttempts} fallito per ${operationName}:`, error);
            
            if (attempt < RETRY_CONFIG.maxAttempts - 1) {
                const delay = calculateRetryDelay(attempt);
                console.log(`Riprovo tra ${Math.round(delay/1000)} secondi...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw new Error(`Operazione ${operationName} fallita dopo ${RETRY_CONFIG.maxAttempts} tentativi: ${lastError.message}`);
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
        
        // Inizializza prima il database con la nuova versione
        await initBackupSystem();
        
        // Poi inizializza la cache
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
        
        // Aggiungi l'interfaccia dei backup solo dopo che tutto è stato inizializzato
        document.body.appendChild(createBackupInterface());
        await updateBackupInterface();

        // Imposta il backup automatico
        setInterval(async () => {
            if (state.esploratoreData) {
                await createBackup(esploratoreId);
                await updateBackupInterface();
            }
        }, BACKUP_CONFIG.autoBackupInterval);
        
        updateState({ isLoading: false });
        hideLoader();
        hideLoadingIndicator();

    } catch (error) {
        console.error('Errore durante l\'inizializzazione della scheda:', error);
        updateState({ error, isLoading: false });
        showNotification(
            'Errore di Inizializzazione',
            'Si è verificato un errore durante l\'inizializzazione della scheda',
            NOTIFICATION_TYPES.ERROR
        );
        hideLoader();
        hideLoadingIndicator();
    }
}

// Funzione per caricare i dati dell'esploratore
async function loadEsploratoreData(esploratoreId) {
    try {
        console.log('Caricamento dati esploratore:', esploratoreId);
        
        const data = await executeWithRetry(
            async () => {
                const esploratoreRef = doc(db, "utenti", esploratoreId);
                const esploratoreDoc = await getDoc(esploratoreRef);
                
                if (!esploratoreDoc.exists()) {
                    throw new Error('Esploratore non trovato');
                }
                
                return esploratoreDoc.data();
            },
            'caricamento dati esploratore'
        );

        console.log('Dati esploratore recuperati:', data);
        console.log('Struttura completa dei dati:', JSON.stringify(data, null, 2));
        
        // Aggiorna lo stato con i nuovi dati
        updateState({
            esploratoreData: data,
            lastUpdate: new Date()
        });
        
        // Aggiorna l'header con i dati dell'esploratore
        document.getElementById('nomeCompleto').textContent = `${data.nome} ${data.cognome}`;
        document.getElementById('emailLink').textContent = data.email;
        document.getElementById('emailLink').href = `mailto:${data.email}`;

        // Mostra i controlli staff se l'utente è staff approvato
        const isApproved = await executeWithRetry(
            () => isStaffApproved(),
            'verifica permessi staff'
        );
        
        if (isApproved) {
            document.getElementById('staffControls').classList.remove('hidden');
        }

        // Mostra il contenuto prima di caricare le sezioni
        document.getElementById('schedaContent').classList.remove('hidden');
        document.getElementById('loading').classList.add('hidden');

        // Carica la prima sezione (anagrafici) e gestisci gli errori individualmente
        try {
            await loadSezioneData('anagrafici', data);
        } catch (error) {
            console.error('Errore nel caricamento della sezione anagrafici:', error);
            showNotification(
                'Errore nel caricamento della sezione anagrafici',
                'Riprovo automaticamente...',
                NOTIFICATION_TYPES.ERROR
            );
            
            // Retry automatico per il caricamento della sezione
            await executeWithRetry(
                () => loadSezioneData('anagrafici', data),
                'caricamento sezione anagrafici'
            );
        }

    } catch (error) {
        console.error('Errore durante il caricamento dei dati:', error);
        showNotification(
            'Errore di Caricamento',
            'Impossibile caricare i dati. Riprova più tardi.',
            NOTIFICATION_TYPES.ERROR
        );
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
            <input type="date" id="dataNascitaEdit" class="hidden border rounded px-2 py-1">
        </div>
        <button class="edit-btn text-primary hover:text-primary-dark" data-field="dataNascita">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
        </button>
    `;
    container.appendChild(dataNascitaGroup);

    // Codice fiscale
    const codiceFiscaleGroup = document.createElement('div');
    codiceFiscaleGroup.className = 'flex justify-between items-center';
    codiceFiscaleGroup.innerHTML = `
        <div class="flex-1">
            <h3 class="text-lg font-medium">Codice Fiscale</h3>
            <p id="codiceFiscaleDisplay" class="text-gray-600">-</p>
            <input type="text" id="codiceFiscaleEdit" class="hidden border rounded px-2 py-1">
        </div>
        <button class="edit-btn text-primary hover:text-primary-dark" data-field="codiceFiscale">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
        </button>
    `;
    container.appendChild(codiceFiscaleGroup);

    // Indirizzo
    const indirizzoGroup = document.createElement('div');
    indirizzoGroup.className = 'flex justify-between items-center';
    indirizzoGroup.innerHTML = `
        <div class="flex-1">
            <h3 class="text-lg font-medium">Indirizzo</h3>
            <p id="indirizzoDisplay" class="text-gray-600">-</p>
            <input type="text" id="indirizzoEdit" class="hidden border rounded px-2 py-1">
        </div>
        <button class="edit-btn text-primary hover:text-primary-dark" data-field="indirizzo">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
        </button>
    `;
    container.appendChild(indirizzoGroup);

    // Telefono
    const telefonoGroup = document.createElement('div');
    telefonoGroup.className = 'flex justify-between items-center';
    telefonoGroup.innerHTML = `
        <div class="flex-1">
            <h3 class="text-lg font-medium">Telefono</h3>
            <p id="telefonoDisplay" class="text-gray-600">-</p>
            <input type="tel" id="telefonoEdit" class="hidden border rounded px-2 py-1">
        </div>
        <button class="edit-btn text-primary hover:text-primary-dark" data-field="telefono">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
        </button>
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
        await executeWithRetry(
            async () => {
                const esploratoreRef = doc(db, "utenti", esploratoreId);
                await updateDoc(esploratoreRef, data);
            },
            'salvataggio dati'
        );
        
        // Crea un backup dopo il salvataggio
        await createBackup(esploratoreId);
        
        showNotification(
            'Salvataggio Completato',
            'I dati sono stati salvati con successo',
            NOTIFICATION_TYPES.SYNC
        );
    } catch (error) {
        console.error('Errore durante il salvataggio dei dati:', error);
        showNotification(
            'Errore di Salvataggio',
            'Impossibile salvare i dati. Riprova più tardi.',
            NOTIFICATION_TYPES.ERROR
        );
        throw error;
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
        throttledHandleSearchResults(results);
    });
    
    filterType.addEventListener('change', async () => {
        const query = searchInput.value;
        const filter = filterType.value;
        const filters = filter ? { [filter]: query } : {};
        const results = await searchData(query, filters);
        throttledHandleSearchResults(results);
    });
    
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        filterType.value = '';
        searchContainer.querySelector('#searchResults').classList.add('hidden');
    });

    return searchContainer;
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
        throttledUpdateNavigationStyle(sezione);
        
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
    if (!data) {
        console.error('Dati mancanti per la sezione:', sezione);
        return;
    }

    // Aggiungi gli event listener per la modifica
    const editButtons = document.querySelectorAll('.edit-btn');
    editButtons.forEach(btn => {
        const fieldId = btn.dataset.field;
        btn.addEventListener('click', () => enableEdit(fieldId));
    });

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

// Funzione per popolare la sezione anagrafici
async function populateAnagrafici(data) {
    const datiAnagrafici = data.datiScheda?.anagrafici || {};
    
    // Aggiorna i campi con i dati
    document.getElementById('dataNascitaDisplay').textContent = 
        datiAnagrafici.dataNascita ? new Date(datiAnagrafici.dataNascita).toLocaleDateString('it-IT') : '-';
    document.getElementById('codiceFiscaleDisplay').textContent = datiAnagrafici.codiceFiscale || '-';
    document.getElementById('indirizzoDisplay').textContent = datiAnagrafici.indirizzo || '-';
    document.getElementById('telefonoDisplay').textContent = datiAnagrafici.telefono || '-';
}

// Funzione per popolare la sezione contatti
async function populateContatti(data) {
    const datiContatti = data.datiScheda?.contatti || {};
    
    if (datiContatti.genitore1) {
        const gen1 = datiContatti.genitore1;
        document.getElementById('genitore1Display').innerHTML = `
            <div>${gen1.nome || '-'}</div>
            <div>${gen1.email || '-'}</div>
            <div>${gen1.numero || '-'}</div>
        `;
    }

    if (datiContatti.genitore2) {
        const gen2 = datiContatti.genitore2;
        document.getElementById('genitore2Display').innerHTML = `
            <div>${gen2.nome || '-'}</div>
            <div>${gen2.email || '-'}</div>
            <div>${gen2.numero || '-'}</div>
        `;
    }
}

// Funzione per popolare la sezione sanitarie
async function populateSanitarie(data) {
    const datiSanitari = data.datiScheda?.sanitarie || {};
    
    document.getElementById('gruppoSanguignoDisplay').textContent = datiSanitari.gruppoSanguigno || '-';
    document.getElementById('intolleranzeDisplay').textContent = datiSanitari.intolleranze || '-';
    document.getElementById('allergieDisplay').textContent = datiSanitari.allergie || '-';
    document.getElementById('farmaciDisplay').textContent = datiSanitari.farmaci || '-';
}

// Funzione per popolare la sezione progressione
async function populateProgressione(data) {
    const datiProgressione = data.datiScheda?.progressione || {};
    
    document.getElementById('promessaDisplay').textContent = datiProgressione.promessa || '-';
    document.getElementById('brevettoDisplay').textContent = datiProgressione.brevetto || '-';
    document.getElementById('specialitaDisplay').textContent = datiProgressione.specialita || '-';
    document.getElementById('cordaDisplay').textContent = datiProgressione.corda || '-';
}

// Funzioni per la gestione dei backup
async function createBackup(esploratoreId) {
    try {
        if (!state.esploratoreData) {
            throw new Error('Nessun dato da salvare');
        }

        const timestamp = Date.now();
        const backup = {
            timestamp,
            esploratoreId,
            data: state.esploratoreData,
            version: '1.0',
            metadata: {
                lastUpdate: state.lastUpdate,
                currentSezione: state.currentSezione
            }
        };

        // Salva il backup
        await saveToCache(BACKUP_CONFIG.backupStore, backup);

        // Aggiorna i metadati
        const metadata = {
            id: esploratoreId,
            lastBackup: timestamp,
            backupCount: await getBackupCount(esploratoreId) + 1
        };
        await saveToCache(BACKUP_CONFIG.metadataStore, metadata);

        // Rimuovi i backup vecchi se necessario
        await cleanupOldBackups(esploratoreId);

        showNotification(
            'Backup Completato',
            'I dati sono stati salvati con successo',
            NOTIFICATION_TYPES.SYNC
        );

        return backup;
    } catch (error) {
        console.error('Errore durante la creazione del backup:', error);
        showNotification(
            'Errore di Backup',
            'Impossibile creare il backup dei dati',
            NOTIFICATION_TYPES.ERROR
        );
        throw error;
    }
}

async function getBackupCount(esploratoreId) {
    try {
        const db = await openDB();
        const tx = db.transaction(BACKUP_CONFIG.backupStore, 'readonly');
        const store = tx.objectStore(BACKUP_CONFIG.backupStore);
        const backups = await store.getAll();
        return backups.filter(b => b.esploratoreId === esploratoreId).length;
    } catch (error) {
        console.error('Errore nel conteggio dei backup:', error);
        return 0;
    }
}

async function cleanupOldBackups(esploratoreId) {
    try {
        const db = await openDB();
        const tx = db.transaction(BACKUP_CONFIG.backupStore, 'readwrite');
        const store = tx.objectStore(BACKUP_CONFIG.backupStore);
        const backups = await store.getAll();
        
        // Filtra i backup per esploratore e ordina per timestamp
        const explorerBackups = backups
            .filter(b => b.esploratoreId === esploratoreId)
            .sort((a, b) => b.timestamp - a.timestamp);
        
        // Rimuovi i backup in eccesso
        if (explorerBackups.length > BACKUP_CONFIG.maxBackups) {
            const toDelete = explorerBackups.slice(BACKUP_CONFIG.maxBackups);
            await Promise.all(toDelete.map(backup => store.delete(backup.timestamp)));
            console.log(`Rimossi ${toDelete.length} backup vecchi`);
        }
    } catch (error) {
        console.error('Errore nella pulizia dei backup vecchi:', error);
    }
}

async function restoreFromBackup(timestamp) {
    try {
        const db = await openDB();
        const tx = db.transaction(BACKUP_CONFIG.backupStore, 'readonly');
        const store = tx.objectStore(BACKUP_CONFIG.backupStore);
        const backup = await store.get(timestamp);

        if (!backup) {
            throw new Error('Backup non trovato');
        }

        // Aggiorna lo stato con i dati del backup
        updateState({
            esploratoreData: backup.data,
            lastUpdate: new Date(backup.metadata.lastUpdate),
            currentSezione: backup.metadata.currentSezione
        });

        // Aggiorna l'UI
        if (backup.metadata.currentSezione) {
            await caricaSezione(backup.metadata.currentSezione);
        }

        showNotification(
            'Ripristino Completato',
            'I dati sono stati ripristinati con successo',
            NOTIFICATION_TYPES.SYNC
        );

        return backup;
    } catch (error) {
        console.error('Errore durante il ripristino del backup:', error);
        showNotification(
            'Errore di Ripristino',
            'Impossibile ripristinare il backup',
            NOTIFICATION_TYPES.ERROR
        );
        throw error;
    }
}

// Funzione per creare l'interfaccia di gestione backup
function createBackupInterface() {
    const container = document.createElement('div');
    container.className = 'backup-interface fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 w-96';
    container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Gestione Backup</h3>
            <button id="closeBackupInterface" class="text-gray-500 hover:text-gray-700">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">Ultimo backup:</span>
                <span id="lastBackupTime" class="text-sm font-medium">-</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">Backup disponibili:</span>
                <span id="backupCount" class="text-sm font-medium">-</span>
            </div>
            <div class="space-y-2">
                <button id="createBackupBtn" class="w-full bg-primary text-white py-2 px-4 rounded hover:bg-primary-dark transition-colors">
                    Crea Backup
                </button>
                <button id="showBackupsBtn" class="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300 transition-colors">
                    Visualizza Backup
                </button>
            </div>
        </div>
        <div id="backupList" class="mt-4 hidden">
            <h4 class="text-sm font-medium mb-2">Lista Backup</h4>
            <div id="backupListContent" class="space-y-2 max-h-60 overflow-y-auto"></div>
        </div>
    `;

    // Aggiungi gli event listener
    const closeBtn = container.querySelector('#closeBackupInterface');
    const createBackupBtn = container.querySelector('#createBackupBtn');
    const showBackupsBtn = container.querySelector('#showBackupsBtn');
    const backupList = container.querySelector('#backupList');

    closeBtn.addEventListener('click', () => {
        container.remove();
    });

    createBackupBtn.addEventListener('click', async () => {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const esploratoreId = urlParams.get('id');
            await createBackup(esploratoreId);
            await updateBackupInterface();
        } catch (error) {
            console.error('Errore durante la creazione del backup:', error);
        }
    });

    showBackupsBtn.addEventListener('click', async () => {
        backupList.classList.toggle('hidden');
        if (!backupList.classList.contains('hidden')) {
            await updateBackupList();
        }
    });

    return container;
}

// Funzione per aggiornare l'interfaccia dei backup
async function updateBackupInterface() {
    const lastBackupTime = document.getElementById('lastBackupTime');
    const backupCount = document.getElementById('backupCount');
    
    if (!lastBackupTime || !backupCount) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const esploratoreId = urlParams.get('id');
        
        const db = await openDB();
        const tx = db.transaction(BACKUP_CONFIG.metadataStore, 'readonly');
        const store = tx.objectStore(BACKUP_CONFIG.metadataStore);
        const metadata = await store.get(esploratoreId);

        if (metadata) {
            lastBackupTime.textContent = new Date(metadata.lastBackup).toLocaleString('it-IT');
            backupCount.textContent = metadata.backupCount;
        } else {
            lastBackupTime.textContent = 'Nessun backup';
            backupCount.textContent = '0';
        }
    } catch (error) {
        console.error('Errore nell\'aggiornamento dell\'interfaccia backup:', error);
    }
}

// Funzione per aggiornare la lista dei backup
async function updateBackupList() {
    const backupListContent = document.getElementById('backupListContent');
    if (!backupListContent) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const esploratoreId = urlParams.get('id');
        
        const db = await openDB();
        const tx = db.transaction(BACKUP_CONFIG.backupStore, 'readonly');
        const store = tx.objectStore(BACKUP_CONFIG.backupStore);
        const backups = await store.getAll();
        
        const explorerBackups = backups
            .filter(b => b.esploratoreId === esploratoreId)
            .sort((a, b) => b.timestamp - a.timestamp);

        backupListContent.innerHTML = explorerBackups.map(backup => `
            <div class="backup-item bg-gray-50 p-3 rounded flex justify-between items-center">
                <div class="text-sm">
                    <div class="font-medium">${new Date(backup.timestamp).toLocaleString('it-IT')}</div>
                    <div class="text-gray-500">Versione: ${backup.version}</div>
                </div>
                <button class="restore-backup-btn bg-primary text-white px-3 py-1 rounded text-sm hover:bg-primary-dark transition-colors"
                        data-timestamp="${backup.timestamp}">
                    Ripristina
                </button>
            </div>
        `).join('');

        // Aggiungi gli event listener per i pulsanti di ripristino
        backupListContent.querySelectorAll('.restore-backup-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const timestamp = parseInt(btn.dataset.timestamp);
                try {
                    await restoreFromBackup(timestamp);
                    showNotification(
                        'Ripristino Completato',
                        'I dati sono stati ripristinati con successo',
                        NOTIFICATION_TYPES.SYNC
                    );
                } catch (error) {
                    console.error('Errore durante il ripristino:', error);
                }
            });
        });
    } catch (error) {
        console.error('Errore nell\'aggiornamento della lista backup:', error);
    }
}

// Funzione per abilitare la modifica di un campo
function enableEdit(fieldId) {
    const displayElement = document.getElementById(`${fieldId}Display`);
    const editElement = document.getElementById(`${fieldId}Edit`);
    
    if (!displayElement || !editElement) return;
    
    displayElement.classList.add('hidden');
    editElement.classList.remove('hidden');
    editElement.focus();
    
    // Aggiungi pulsanti di conferma/annullamento
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex gap-2 mt-2';
    buttonContainer.innerHTML = `
        <button class="save-btn bg-primary text-white px-3 py-1 rounded text-sm hover:bg-primary-dark transition-colors">
            Salva
        </button>
        <button class="cancel-btn bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300 transition-colors">
            Annulla
        </button>
    `;
    
    editElement.parentNode.appendChild(buttonContainer);
    
    // Gestisci il salvataggio
    const saveBtn = buttonContainer.querySelector('.save-btn');
    saveBtn.addEventListener('click', async () => {
        try {
            const newValue = editElement.value;
            if (await validateField(fieldId, newValue)) {
                await saveField(fieldId, newValue);
                displayElement.textContent = formatFieldValue(fieldId, newValue);
                disableEdit(fieldId);
            }
        } catch (error) {
            console.error('Errore durante il salvataggio:', error);
            showNotification(
                'Errore di Salvataggio',
                'Impossibile salvare le modifiche',
                NOTIFICATION_TYPES.ERROR
            );
        }
    });
    
    // Gestisci l'annullamento
    const cancelBtn = buttonContainer.querySelector('.cancel-btn');
    cancelBtn.addEventListener('click', () => {
        editElement.value = displayElement.textContent;
        disableEdit(fieldId);
    });
}

// Funzione per disabilitare la modifica di un campo
function disableEdit(fieldId) {
    const displayElement = document.getElementById(`${fieldId}Display`);
    const editElement = document.getElementById(`${fieldId}Edit`);
    
    if (!displayElement || !editElement) return;
    
    displayElement.classList.remove('hidden');
    editElement.classList.add('hidden');
    
    // Rimuovi i pulsanti
    const buttonContainer = editElement.parentNode.querySelector('.flex.gap-2');
    if (buttonContainer) {
        buttonContainer.remove();
    }
}

// Funzione per validare un campo
async function validateField(fieldId, value) {
    const rules = EDIT_CONFIG.validationRules[fieldId];
    if (!rules) return true;
    
    if (rules.required && !value) {
        showNotification(
            'Campo Obbligatorio',
            `Il campo ${fieldId} è obbligatorio`,
            NOTIFICATION_TYPES.ERROR
        );
        return false;
    }
    
    if (rules.minLength && value.length < rules.minLength) {
        showNotification(
            'Lunghezza Minima',
            `Il campo ${fieldId} deve contenere almeno ${rules.minLength} caratteri`,
            NOTIFICATION_TYPES.ERROR
        );
        return false;
    }
    
    if (rules.pattern && !rules.pattern.test(value)) {
        showNotification(
            'Formato Non Valido',
            `Il formato del campo ${fieldId} non è valido`,
            NOTIFICATION_TYPES.ERROR
        );
        return false;
    }
    
    return true;
}

// Funzione per formattare il valore di un campo
function formatFieldValue(fieldId, value) {
    if (!value) return '-';
    
    switch (fieldId) {
        case 'dataNascita':
            return new Date(value).toLocaleDateString('it-IT');
        case 'telefono':
            return value.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
        default:
            return value;
    }
}

// Funzione per salvare un campo
async function saveField(fieldId, value) {
    const urlParams = new URLSearchParams(window.location.search);
    const esploratoreId = urlParams.get('id');
    
    if (!esploratoreId) {
        throw new Error('ID esploratore non trovato');
    }
    
    // Determina il percorso del campo nei dati
    const [sezione, campo] = fieldId.split(/(?=[A-Z])/).map(s => s.toLowerCase());
    const updatePath = `datiScheda.${sezione}.${campo}`;
    
    // Prepara l'oggetto di aggiornamento
    const updateData = {
        [updatePath]: value,
        lastUpdate: new Date().toISOString()
    };
    
    // Salva i dati
    await saveData(esploratoreId, updateData);
    
    // Aggiorna lo stato locale
    const newData = { ...state.esploratoreData };
    setNestedValue(newData, updatePath, value);
    updateState({ esploratoreData: newData });
}

// Funzione di utilità per impostare un valore annidato
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
}

// Funzione per sincronizzare i dati con Firebase
function syncWithFirebase(esploratoreId) {
    const esploratoreRef = doc(db, "utenti", esploratoreId);
    let retryCount = 0;
    let pendingUpdate = false;
    
    return onSnapshot(esploratoreRef, 
        async (doc) => {
            retryCount = 0;
            if (doc.exists()) {
                const newData = doc.data();
                const oldData = state.esploratoreData;
                
                // Evita aggiornamenti non necessari
                if (JSON.stringify(oldData) === JSON.stringify(newData)) {
                    return;
                }
                
                // Usa requestAnimationFrame per gli aggiornamenti UI
                if (!pendingUpdate) {
                    pendingUpdate = true;
                    requestAnimationFrame(() => {
                        updateState({
                            esploratoreData: newData,
                            lastUpdate: new Date()
                        });
                        
                        // Salva i dati in cache
                        saveToCache('esploratori', {
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
                        
                        pendingUpdate = false;
                    });
                }
            }
        },
        async (error) => {
            console.error('Errore nella sincronizzazione:', error);
            retryCount++;
            
            if (retryCount <= RETRY_CONFIG.maxAttempts) {
                const delay = calculateRetryDelay(retryCount - 1);
                console.log(`Tentativo di riconnessione ${retryCount}/${RETRY_CONFIG.maxAttempts} tra ${Math.round(delay/1000)} secondi...`);
                
                showNotification(
                    'Riconnessione in corso',
                    `Tentativo ${retryCount} di ${RETRY_CONFIG.maxAttempts}`,
                    NOTIFICATION_TYPES.SYNC
                );
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return syncWithFirebase(esploratoreId);
            }
            
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
        }
    );
}

// Funzione di throttling
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Ottimizzazione della funzione handleSearchResults
const throttledHandleSearchResults = throttle((results) => {
    scheduleUpdate(() => {
        const resultsContainer = document.getElementById('searchResults');
        const resultsList = document.getElementById('resultsList');
        
        if (!results.length) {
            resultsContainer.classList.add('hidden');
            return;
        }

        // Usa DocumentFragment per migliori performance
        const fragment = document.createDocumentFragment();
        results.forEach(result => {
            const div = document.createElement('div');
            div.className = 'p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer';
            div.onclick = () => navigateToResult(result.path);
            div.innerHTML = `
                <div class="font-medium">${result.value}</div>
                <div class="text-sm text-gray-600">
                    ${Object.entries(result.context)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' | ')}
                </div>
            `;
            fragment.appendChild(div);
        });

        resultsList.innerHTML = '';
        resultsList.appendChild(fragment);
        resultsContainer.classList.remove('hidden');
    });
}, THROTTLE_CONFIG.search);

// Ottimizzazione della funzione updateNavigationStyle
const throttledUpdateNavigationStyle = throttle((sezioneCorrente) => {
    scheduleUpdate(() => {
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
    });
}, THROTTLE_CONFIG.update);

// Inizializza la scheda quando il documento è pronto
document.addEventListener('DOMContentLoaded', initScheda); 