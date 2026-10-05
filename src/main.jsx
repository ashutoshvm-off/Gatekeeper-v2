import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './typography.css';
import './scanner-layout.css';
import './college-branding.css';
import './navigation.css';
import './system-status.css';
import './queue.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
