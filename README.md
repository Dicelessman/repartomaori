# CursorScout - Web App per Reparto Scout

Una web app responsive per la gestione del reparto scout, sviluppata con HTML, JavaScript vanilla e Tailwind CSS.

## 🚀 Funzionalità

- **Autenticazione e Ruoli**
  - Login/registrazione con Firebase Authentication
  - Gestione ruoli (staff/esploratore)
  - Approvazione manuale per lo staff

- **Gestione Schede**
  - Dati anagrafici
  - Contatti (con chiamata/WhatsApp)
  - Informazioni sanitarie
  - Progressione scout
  - Specialità
  - Eventi
  - Documenti

- **Dashboard Staff**
  - Lista esploratori
  - Ricerca
  - Gestione schede

## 🛠️ Tecnologie

- HTML5
- JavaScript (ES6+)
- Tailwind CSS
- Firebase
  - Authentication
  - Firestore
- GitHub Pages (deploy)

## 📦 Installazione

1. Clona la repository:
   ```bash
   git clone https://github.com/tuousername/cursorscout.git
   ```

2. Configura Firebase:
   - Crea un progetto su [Firebase Console](https://console.firebase.google.com)
   - Abilita Authentication e Firestore
   - Copia la configurazione nel file `js/firebaseConfig.js`

3. Deploy su GitHub Pages:
   - Abilita GitHub Pages nella repository
   - Configura il branch `main` come sorgente

## 🔒 Sicurezza

- Autenticazione tramite Firebase
- Protezione dei percorsi basata sui ruoli
- Verifica dell'approvazione staff
- Logout automatico in caso di accesso non valido

## 📱 Responsive Design

L'app è ottimizzata per:
- Smartphone
- Tablet
- Desktop

## 🔄 Funzionalità Future

- Backup locale e sincronizzazione offline
- Gestione eventi
- Dashboard riepilogativa
- Statistiche

## 📄 Licenza

MIT License 