import { checkAuth, isStaffApproved } from './auth.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';
import { showLoader, hideLoader, showToast } from './ui.js';
import { createUserWithEmailAndPassword, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Funzione per inizializzare la dashboard
async function initDashboard() {
    try {
        showLoader();
        
        // Verifica autenticazione
        const user = await checkAuth();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Verifica se l'utente è staff approvato
        const isApproved = await isStaffApproved();
        if (!isApproved) {
            window.location.href = 'scheda.html';
            return;
        }

        // Carica i dati della dashboard
        await loadDashboardData();
        hideLoader();

    } catch (error) {
        console.error('Errore durante l\'inizializzazione della dashboard:', error);
        showToast('Si è verificato un errore durante il caricamento della dashboard. Riprova più tardi.', 'error');
        hideLoader();
    }
}

// Funzione per caricare i dati della dashboard
async function loadDashboardData() {
    try {
        // Carica le schede degli utenti
        const schedeQuery = query(collection(db, "utenti"));
        const schedeSnapshot = await getDocs(schedeQuery);
        
        const schedeContainer = document.getElementById('schede-container');
        schedeContainer.innerHTML = '';

        schedeSnapshot.forEach((doc) => {
            const scheda = doc.data();
            const schedaElement = createSchedaElement(doc.id, scheda);
            schedeContainer.appendChild(schedaElement);
        });

    } catch (error) {
        console.error('Errore durante il caricamento dei dati:', error);
        showToast('Errore durante il caricamento dei dati. Riprova più tardi.', 'error');
        throw error;
    }
}

// Funzione per creare l'elemento scheda
function createSchedaElement(id, scheda) {
    const div = document.createElement('div');
    div.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200';
    
    // Determina l'icona in base al ruolo
    const icon = scheda.staff && scheda.approvato 
        ? `<i class="fas fa-star text-primary"></i>`
        : `<i class="fas fa-user text-primary"></i>`;

    div.innerHTML = `
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${scheda.nome} ${scheda.cognome}</h3>
                <div class="flex items-center space-x-2">
                    ${icon}
                    <span class="text-sm ${scheda.approvato ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}">
                        ${scheda.approvato ? 'Approvato' : 'In attesa'}
                    </span>
                </div>
            </div>
            <div class="flex flex-col space-y-2">
                <button onclick="window.location.href='scheda.html?id=${id}'" 
                        class="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:bg-primary-dark dark:hover:bg-primary">
                    <i class="fas fa-eye mr-2"></i>Visualizza Scheda
                </button>
                <button onclick="window.location.href='esplo.html?id=${id}'" 
                        class="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:bg-primary-dark dark:hover:bg-primary">
                    <i class="fas fa-compass mr-2"></i>Nuova Scheda
                </button>
            </div>
        </div>
    `;
    return div;
}

// Gestione del modal per aggiungere un nuovo esploratore
const addExplorerBtn = document.getElementById('addExplorerBtn');
const addExplorerModal = document.getElementById('addExplorerModal');
const cancelAddExplorer = document.getElementById('cancelAddExplorer');
const addExplorerForm = document.getElementById('addExplorerForm');
const confirmAddExplorer = document.getElementById('confirmAddExplorer');

// Apri il modal
addExplorerBtn.addEventListener('click', () => {
    addExplorerModal.classList.remove('hidden');
});

// Chiudi il modal
cancelAddExplorer.addEventListener('click', () => {
    addExplorerModal.classList.add('hidden');
    addExplorerForm.reset();
});

// Gestione dell'invio del form
confirmAddExplorer.addEventListener('click', async () => {
    const nome = document.getElementById('nome').value.trim();
    const cognome = document.getElementById('cognome').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!nome || !cognome || !email || !password) {
        showToast('Tutti i campi sono obbligatori', 'error');
        return;
    }

    try {
        showLoader();
        // Crea l'utente su Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Crea il documento dell'esploratore su Firestore
        const explorerData = {
            nome,
            cognome,
            email,
            staff: false,
            approvato: false,
            createdAt: new Date()
        };
        await setDoc(doc(db, 'utenti', user.uid), explorerData);

        // Aggiorna la dashboard
        await loadDashboardData();
        addExplorerModal.classList.add('hidden');
        addExplorerForm.reset();
        showToast('Esploratore aggiunto con successo', 'success');
    } catch (error) {
        console.error('Errore durante l\'aggiunta dell\'esploratore:', error);
        showToast('Errore durante l\'aggiunta dell\'esploratore. Riprova più tardi.', 'error');
    } finally {
        hideLoader();
    }
});

// Inizializza la dashboard quando il documento è pronto
document.addEventListener('DOMContentLoaded', initDashboard); 