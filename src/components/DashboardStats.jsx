import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function DashboardStats({ session }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      setErrorStats('');
      try {
        // Chiama la funzione SQL creata 'get_user_base_stats' passando l'user_id
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

    if (session) {
      fetchStats();
    }
  }, [session]); // Riesegue se la sessione cambia

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

  // ----- JSX per visualizzare le statistiche -----
  return (
    <div className="stats-widget" style={widgetStyle}>
      <h3>Dashboard Statistiche (Totali)</h3>
      {loadingStats && <p>Caricamento statistiche...</p>}
      {errorStats && <p style={{ color: 'red' }}>{errorStats}</p>}

      {!loadingStats && !errorStats && stats && (
        <div style={gridStyle}> {/* Usa un layout a griglia per le statistiche */}
          <StatCard title="Profitto/Perdita Totale" value={formatNumber(stats.total_profit_loss)} isPositive={stats.total_profit_loss > 0} isNegative={stats.total_profit_loss < 0} currency="€" />
          <StatCard title="ROI" value={formatPercent(stats.roi)} isPositive={stats.roi > 0} isNegative={stats.roi < 0} />
          <StatCard title="Turnover Totale" value={formatNumber(stats.total_turnover)} currency="€" />
          <StatCard title="Scommesse Totali" value={stats.total_bets} />
          <StatCard title="Scommesse Vinte" value={stats.won_bets} />
          <StatCard title="Scommesse Perse" value={stats.lost_bets} />
          <StatCard title="Win Rate" value={formatPercent(stats.win_rate)} />
          <StatCard title="Quota Media Giocata" value={formatNumber(stats.avg_odds_played)} />
          <StatCard title="Quota Media Vinta" value={formatNumber(stats.avg_odds_won)} />
          <StatCard title="Puntata Media" value={formatNumber(stats.avg_stake)} currency="€" />
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
function StatCard({ title, value, currency = '', isPositive = false, isNegative = false }) {
  const valueStyle = {
    fontSize: '1.5em',
    fontWeight: 'bold',
    color: isPositive ? 'green' : isNegative ? 'red' : '#333',
    display: 'block',
    marginTop: '5px',
  };

  const explicitTitleStyle = {
    ...titleStyle,
    color: '#555',
  };

  return (
    <div style={cardStyle}>
      <span style={explicitTitleStyle}>{title}</span>
      <span style={valueStyle}>
        {value} {currency}
      </span>
    </div>
  );
}

// Stili base (possono essere spostati in App.css)
const widgetStyle = {
  marginBottom: '30px',
  padding: '15px',
  border: '1px solid #eee',
  borderRadius: '5px',
  backgroundColor: '#f9f9f9',
};

const gridStyle = {
  display: 'grid',
  // Griglia responsive: 2 colonne su schermi piccoli, 3 su medi, 4 su grandi
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', // Adatta automaticamente le colonne
  gap: '15px', // Spazio tra le card
};

const cardStyle = {
  backgroundColor: '#fff',
  padding: '15px',
  border: '1px solid #ddd',
  borderRadius: '5px',
  textAlign: 'center', // Centra il contenuto della card
};

const titleStyle = {
  fontSize: '0.9em',
  display: 'block',
};
