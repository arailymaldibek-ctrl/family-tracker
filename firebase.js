// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBke0TW9xetNae_gDBtx5s4PlfwI661sVQ",
  authDomain: "fam-tracker-bc2cb.firebaseapp.com",
  databaseURL: "https://fam-tracker-bc2cb-default-rtdb.firebaseio.com",
  projectId: "fam-tracker-bc2cb",
  storageBucket: "fam-tracker-bc2cb.firebasestorage.app",
  messagingSenderId: "68756420447",
  appId: "1:68756420447:web:f56876afc8d733c7daa8ea",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, onValue, update, remove };
