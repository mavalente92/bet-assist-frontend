import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import styles from './DashboardStats.module.css'; // Importa il CSS Module

// ----- Funzioni Helper di Formattazione -----

// Funzione helper per formattare numeri (es. P/L, ROI)
const formatNumber = (num, decimals = 2) => {
  if (typeof num !== 'number' || isNaN(num)) {
    return '-';
  }
  return num.toFixed(decimals);
};

// Funzione helper per formattare percentuali
const formatPercent = (num) => {
  if (typeof num !== 'number' || isNaN(num)) {
    return '-';
  }
  return `${num.toFixed(2)}%`;
};

// Funzione Helper per formattare valuta
const formatCurrency = (value) => {
  // Gestisce sia numeri che valori già formattati o stringhe valide
  if (typeof value === 'number' && !isNaN(value)) {
    return value.toFixed(2);
  } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
    // Se è una stringa che rappresenta un numero, formattala
    return parseFloat(value).toFixed(2);
  } else if (value === null || value === undefined || isNaN(value)) {
     // Restituisci '0.00' per null, undefined o NaN esplicito dopo un tentativo di conversione
     return '0.00';
  }
  // Se è già una stringa formattata o non numerica valida, restituiscila com'è
  // O potresti voler restituire 'N/A' o '-' a seconda del caso
  return value; // O gestisci diversamente se necessario
};

export default function DashboardStats({ session, refreshToggle }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      setErrorStats('');
      if (!session?.user?.id) {
         console.log("DashboardStats: No user ID, skipping fetch.");
         setLoadingStats(false);
         setStats(null); // Pulisci statistiche vecchie
         return;
      }
      try {
        const { data, error } = await supabase.rpc('get_user_base_stats', {
          p_user_id: session.user.id
        });

        if (error) {
          throw error;
        }

        console.log("Statistiche ricevute:", data); // Log per debug
        setStats(data); // Salva l'oggetto JSON restituito dalla funzione

      } catch (error) {
        console.error('Errore nel recupero delle statistiche:', error.message);
        setErrorStats(`Errore statistiche: ${error.message}`);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [session?.user?.id, refreshToggle]);

  // ----- JSX per visualizzare le statistiche -----
  return (
    <div className={styles.widget}>
      <h3>Dashboard Statistiche (Totali)</h3>
      {loadingStats && <p>Caricamento statistiche...</p>}
      {errorStats && <p style={{ color: 'red' }}>{errorStats}</p>}

      {!loadingStats && !errorStats && stats && (
        <div className={styles.grid}> {/* Usa un layout a griglia per le statistiche */}
          <StatCard title="Profitto/Perdita Totale" value={stats.total_profit_loss} currency="€" />
          <StatCard title="ROI" value={stats.roi} isPercentage={true} />
          <StatCard title="Turnover Totale" value={stats.total_turnover} currency="€" />
          <StatCard title="Scommesse Totali" value={stats.total_bets} />
          <StatCard title="Scommesse Vinte" value={stats.won_bets} />
          <StatCard title="Scommesse Perse" value={stats.lost_bets} />
          <StatCard title="Win Rate" value={stats.win_rate} isPercentage={true} />
          <StatCard title="Quota Media Giocata" value={stats.avg_odds_played} />
          <StatCard title="Quota Media Vinta" value={stats.avg_odds_won} />
          <StatCard title="Puntata Media" value={stats.avg_stake} currency="€" />
          <StatCard title="Scommesse Aperte" value={stats.open_bets} />
          <StatCard title="Scommesse Void" value={stats.void_bets} />
        </div>
      )}
       {!loadingStats && !errorStats && !stats && (
           <p>Nessuna statistica disponibile.</p>
       )}
    </div>
  );
}

// Componente interno riutilizzabile per mostrare una singola statistica
function StatCard({ title, value, currency = '', isPercentage = false }) {
  // Ora le funzioni di formattazione sono definite nello scope del modulo
  // e sono direttamente accessibili qui.

  let valueClass = styles.cardValue;
  let displayValue = 'N/A';
  const showCurrencySymbol = !!currency && !isPercentage; // Determina se mostrare il simbolo valuta basandosi sulla prop currency

  // Applica colore e formatta il valore
  if (typeof value === 'number' && !isNaN(value)) {
    if (isPercentage) {
      displayValue = formatPercent(value); // Usa la funzione formatPercent definita sopra
      // Nessun colore specifico per le percentuali (si potrebbe aggiungere se necessario)
    } else {
      // Applica colore per valori numerici non percentuali
      if (value > 0) {
        valueClass = `${styles.cardValue} ${styles.valuePositive}`;
      } else if (value < 0) {
        valueClass = `${styles.cardValue} ${styles.valueNegative}`;
      }

      // Formatta il valore (valuta o numero generico)
      if (showCurrencySymbol) {
        displayValue = formatCurrency(value); // Usa la funzione formatCurrency definita sopra
      } else {
        displayValue = formatNumber(value); // Usa la funzione formatNumber definita sopra
      }
    }
  } else if (value !== null && value !== undefined) {
    // Gestisce valori non numerici ma definiti (es. potrebbe essere '-' dalla funzione format)
    displayValue = value;
  }
  // Se value è null o undefined, displayValue rimane 'N/A' per default

  return (
    <div className={styles.card}>
      <span className={styles.cardTitle}>{title}</span>
      <span className={valueClass}>
        {displayValue}
        {/* Mostra il simbolo della valuta se specificato e non è una percentuale */}
        {showCurrencySymbol && <span className={styles.currency}>{currency}</span>}
      </span>
    </div>
  );
}
