import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppEntry from './conponents/AppEntry';
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebaseの設定
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_DATABASE_URL,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGE_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
getDatabase(app);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppEntry />
  </React.StrictMode>
);
