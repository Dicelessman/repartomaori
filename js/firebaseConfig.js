// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// La configurazione Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDAs-B2Jk6PvQTb_S_bYfAiTDaQHnSF2EQ",
    authDomain: "repartapp-3f1a4.firebaseapp.com",
    projectId: "repartapp-3f1a4",
    storageBucket: "repartapp-3f1a4.firebasestorage.app",
    messagingSenderId: "1025798533836",
    appId: "1:1025798533836:web:c046ef07edf3669e7b8869"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); 