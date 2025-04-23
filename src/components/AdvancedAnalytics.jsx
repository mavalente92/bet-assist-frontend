import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Riceve session come prop
export default function AdvancedAnalytics({ session, refreshToggle }) {
  console.log("AdvancedAnalytics received props - session exists:", !!session);

  const [statsBySport, setStatsBySport] = useState([]);
  const [statsByType, setStatsByType] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('sport'); // 'sport' o 'type'
  const [isUserPremium, setIsUserPremium] = useState(false); // Stato locale per status

  useEffect(() => {
    const checkStatusAndLoad = async () => {
      setLoading(true); // Inizia caricamento (per status e poi dati)
      setError('');
      setStatsBySport([]); // Pulisci dati vecchi
      setStatsByType([]);
      setIsUserPremium(false); // Assume non premium all'inizio

      // Add check for user ID
      if (!session?.user?.id) {
          console.log("AdvancedAnalytics: No user ID, skipping check.");
          setLoading(false);
          return;
      }

      let currentStatus = 'free';
      try {
          // 1. Recupera lo stato dell'utente
          console.log("AdvancedAnalytics: Checking user status...");
          const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('subscription_status')
              .eq('id', session.user.id) // Usa l'ID
              .single();

          if (profileError && profileError.code !== 'PGRST116') { // Ignora 'not found'
               throw profileError;
          }
          currentStatus = profileData?.subscription_status || 'free';
          setIsUserPremium(currentStatus === 'premium'); // Imposta stato locale
          console.log("AdvancedAnalytics: User status is", currentStatus);

          // 2. Se è premium, carica le statistiche avanzate
          if (currentStatus === 'premium') {
              console.log("AdvancedAnalytics: User is premium, loading advanced stats...");
              const fetchAdvancedStats = async (groupBy) => { // Funzione definita dentro
                  try {
                      const { data, error } = await supabase.rpc('get_user_advanced_stats', {
                        p_user_id: session.user.id, // Usa l'ID
                        p_group_by: groupBy
                      });
                      if (error) throw error;
                      return data || [];
                  } catch (err) {
                      console.error(`Errore recupero statistiche per ${groupBy}:`, err.message);
                      setError(prev => prev + ` Errore stats ${groupBy}: ${err.message}`);
                      return [];
                  }
              };

              const [sportData, typeData] = await Promise.all([
                  fetchAdvancedStats('sport'),
                  fetchAdvancedStats('bet_type')
              ]);
              setStatsBySport(sportData);
              setStatsByType(typeData);

          } else {
               console.log("AdvancedAnalytics: User is not premium, skipping advanced stats load.");
          }

      } catch (err) {
          console.error("AdvancedAnalytics: Error checking status or loading data:", err);
          setError(`Errore generale: ${err.message}`);
          setIsUserPremium(false); // Resetta in caso di errore
      } finally {
          setLoading(false); // Fine caricamento (status e/o dati)
      }
    };

    checkStatusAndLoad();
  // Change dependency from 'session' to 'session?.user?.id'
  }, [session?.user?.id, refreshToggle]);


  // Funzioni helper per formattare (possiamo importarle da un file comune in futuro)
  const formatNumber = (num, decimals = 2) => (typeof num === 'number' && !isNaN(num)) ? num.toFixed(decimals) : '-';
  const formatPercent = (num) => (typeof num === 'number' && !isNaN(num)) ? `${num.toFixed(2)}%` : '-';

  // Usa lo stato locale isUserPremium per il rendering condizionale
  if (!isUserPremium && !loading) { // Mostra messaggio solo se non premium E non stiamo caricando
    return (
       <div style={{ /* ... stile messaggio premium ... */ }}>
         <h3 style={{color: '#ef6c00'}}>Analisi Avanzate (Premium)</h3>
         <p style={{color: '#555'}}>Questa sezione è riservata agli utenti Premium.</p>
       </div>
     );
  }

  // Se è premium o stiamo ancora caricando, mostra il contenuto principale
  return (
    <div className="advanced-stats-widget" style={widgetStyleAdv}>
      <h3 style={{color: '#333'}}>Analisi Avanzate (Premium)</h3>

      {/* Tabs per Sport / Tipo */}
      <div style={tabsContainerStyle}>
          <button
              style={activeTab === 'sport' ? activeTabStyle : tabStyle}
              onClick={() => setActiveTab('sport')}>
              Per Sport
          </button>
          <button
              style={activeTab === 'type' ? activeTabStyle : tabStyle}
              onClick={() => setActiveTab('type')}>
              Per Tipo Scommessa
          </button>
      </div>

      {loading && <p style={{color: '#555'}}>Caricamento...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && isUserPremium && !error && ( // Condizione più stringente
        <div style={{ overflowX: 'auto', marginTop: '15px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyleAdv}>{activeTab === 'sport' ? 'Sport' : 'Tipo Scommessa'}</th>
                <th style={tableHeaderStyleAdv}>P/L Tot. (€)</th>
                <th style={tableHeaderStyleAdv}>ROI (%)</th>
                <th style={tableHeaderStyleAdv}># Scomm.</th>
                <th style={tableHeaderStyleAdv}># Vinte</th>
                <th style={tableHeaderStyleAdv}># Perse</th>
                <th style={tableHeaderStyleAdv}>Win Rate (%)</th>
                <th style={tableHeaderStyleAdv}>Quota Media</th>
                <th style={tableHeaderStyleAdv}>Quota Media Vinta</th>
                <th style={tableHeaderStyleAdv}>Turnover (€)</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'sport' ? statsBySport : statsByType).map((stat) => (
                <tr key={stat.grouping_key}>
                  <td style={tableCellStyleAdv}>{stat.grouping_key}</td>
                  <td style={{...tableCellStyleAdv, color: stat.total_profit_loss > 0 ? 'green' : stat.total_profit_loss < 0 ? 'red' : '#333', fontWeight: 'bold' }}>
                      {formatNumber(stat.total_profit_loss)}
                  </td>
                  <td style={{...tableCellStyleAdv, color: stat.roi > 0 ? 'green' : stat.roi < 0 ? 'red' : '#333' }}>
                      {formatPercent(stat.roi)}
                  </td>
                  <td style={tableCellStyleAdv}>{stat.total_bets}</td>
                  <td style={tableCellStyleAdv}>{stat.won_bets}</td>
                  <td style={tableCellStyleAdv}>{stat.lost_bets}</td>
                  <td style={tableCellStyleAdv}>{formatPercent(stat.win_rate)}</td>
                  <td style={tableCellStyleAdv}>{formatNumber(stat.avg_odds_played)}</td>
                  <td style={tableCellStyleAdv}>{formatNumber(stat.avg_odds_won)}</td>
                  <td style={tableCellStyleAdv}>{formatNumber(stat.total_turnover)}</td>
                </tr>
              ))}
              {/* Riga di riepilogo o messaggio se non ci sono dati? */}
              {(activeTab === 'sport' ? statsBySport : statsByType).length === 0 && (
                  <tr><td colSpan="10" style={{...tableCellStyleAdv, textAlign: 'center', fontStyle: 'italic', color: '#777'}}>Nessun dato disponibile per questo raggruppamento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Stili base (possono essere spostati in App.css o un file comune)
const widgetStyleAdv = {
  marginBottom: '30px',
  padding: '15px',
  border: '1px solid #eee',
  borderRadius: '5px',
  backgroundColor: '#f0f8ff', // Sfondo leggermente diverso per premium?
};

const tabsContainerStyle = {
    marginBottom: '15px',
    borderBottom: '1px solid #ccc',
};

const tabStyle = {
    padding: '8px 12px',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#007bff',
    borderBottom: '2px solid transparent',
    marginRight: '5px',
};

const activeTabStyle = {
    ...tabStyle,
    fontWeight: 'bold',
    color: '#333',
    borderBottom: '2px solid #007bff',
};


const tableHeaderStyleAdv = {
  borderBottom: '2px solid #ccc',
  padding: '8px',
  textAlign: 'left',
  backgroundColor: '#e9ecef', // Header leggermente diverso
  color: '#333', // Assicura visibilità
};

const tableCellStyleAdv = {
  borderBottom: '1px solid #eee',
  padding: '8px',
  textAlign: 'left',
  verticalAlign: 'top',
  color: '#333', // Assicura visibilità
}; 