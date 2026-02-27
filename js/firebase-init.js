// js/firebase-init.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"; // <-- NOVO: Módulo de Login

// SUBSTITUA PELAS SUAS CHAVES DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDEwxbUsKFPF-PdeNiBIbbasg9r3a9SncI",
  authDomain: "mabyeventos-c2239.firebaseapp.com",
  projectId: "mabyeventos-c2239",
  storageBucket: "mabyeventos-c2239.firebasestorage.app",
  messagingSenderId: "976818853735",
  appId: "1:976818853735:web:786b0342dc6672091241c2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // <-- NOVO: Inicializa a autenticação

export { db, auth };