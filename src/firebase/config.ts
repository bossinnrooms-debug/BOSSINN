import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
//THIS IS THE MAIN DB
const firebaseConfig = {
    apiKey: "AIzaSyAr6Wt7IvWpfO1Pvbn3H2T1TCA8FzjKzIE",
    authDomain: "boss-inn-nov.firebaseapp.com",
    projectId: "boss-inn-nov",
    storageBucket: "boss-inn-nov.firebasestorage.app",
    messagingSenderId: "782941346874",
    appId: "1:782941346874:web:786fe5204754317f0c6903",
    measurementId: "G-QYYJ63MC31"
  };

TESTING
// const firebaseConfig = {
//   apiKey: "AIzaSyAIxrA5uo64FQOq_RP1GnG8sNhhXJBaX2E",
//   authDomain: "boss-test-3d2f8.firebaseapp.com",
//   projectId: "boss-test-3d2f8",
//   storageBucket: "boss-test-3d2f8.firebasestorage.app",
//   messagingSenderId: "820395646920",
//   appId: "1:820395646920:web:38b8361365c00c74ce2afd",
//   measurementId: "G-HHBR54NKFM"
// };
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };
