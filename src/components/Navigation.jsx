import React from 'react';
import styles from './Navigation.module.css';

// Definiamo le tab qui per facilitare la gestione
const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bets', label: 'Scommesse' },
  { id: 'tools', label: 'Strumenti' },
  { id: 'profile', label: 'Profilo' },
];

function Navigation({ activeTab, onTabChange }) {
  return (
    <nav className={styles.navContainer}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={activeTab === tab.id ? styles.activeTabButton : styles.tabButton}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default Navigation; 