import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
// Sposta Cell import qui
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import styles from './DashboardCharts.module.css'; // Importa il CSS Module

// Funzione helper per formattare date sull'asse X
const formatDateTick = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' });
  } catch (e) {
    return dateString;
  }
};

export default function DashboardCharts({ session, refreshToggle }) {
  const [plData, setPlData] = useState([]);
  const [statsBySport, setStatsBySport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const loadChartData = async () => {
      if (!session?.user?.id) {
        setLoading(false);
        setPlData([]);
        setStatsBySport([]);
        setIsPremium(false);
        return;
      }

      setLoading(true);
      setError('');
      let premiumStatus = false; // Assume free initially

      try {
        // Fetch in parallel: profile status, PL over time, and (conditionally) stats by sport
        const profilePromise = supabase
          .from('profiles')
          .select('subscription_status')
          .eq('id', session.user.id)
          .single();

        const plPromise = supabase.rpc('get_profit_loss_over_time', { p_user_id: session.user.id });

        // Check profile status first
        const { data: profileData, error: profileError } = await profilePromise;
        if (profileError && profileError.code !== 'PGRST116') throw profileError;
        premiumStatus = profileData?.subscription_status === 'premium';
        setIsPremium(premiumStatus);

        // Prepare the promise for stats by sport only if premium
        let statsPromise = Promise.resolve({ data: [], error: null }); // Default empty promise
        if (premiumStatus) {
          console.log("DashboardCharts: User is premium, fetching stats by sport...");
          statsPromise = supabase.rpc('get_user_advanced_stats', {
            p_user_id: session.user.id,
            p_group_by: 'sport'
          });
        } else {
            console.log("DashboardCharts: User is free, skipping stats by sport.");
        }

        // Await PL data and conditional stats data
        const [plResult, statsResult] = await Promise.all([plPromise, statsPromise]);

        // Handle PL data
        if (plResult.error) throw plResult.error;
        setPlData(plResult.data || []);
        console.log("P/L over time data:", plResult.data);

        // Handle Stats by Sport data (only if premium)
        if (premiumStatus) {
            if (statsResult.error) throw statsResult.error;
            // Format data for BarChart (ensure positive P/L for bar display if needed, or use different colors)
            const formattedStats = (statsResult.data || []).map(stat => ({
                name: stat.grouping_key,
                'P/L': parseFloat(stat.total_profit_loss.toFixed(2)) // Ensure numeric
            }));
            setStatsBySport(formattedStats);
            console.log("Stats by sport data:", formattedStats);
        }


      } catch (err) {
        console.error("Errore caricamento dati grafici:", err);
        setError(`Errore caricamento dati grafici: ${err.message}`);
        setPlData([]);
        setStatsBySport([]);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();

  }, [session?.user?.id, refreshToggle]);

  if (loading) {
    return <div className={`${styles.chartWidget} ${styles.infoMessage}`}>Caricamento grafici...</div>;
  }

  if (error) {
    return <div className={`${styles.chartWidget} ${styles.errorMessage}`}>Errore grafici: {error}</div>;
  }

  // Non mostrare nulla se non ci sono dati per il grafico P/L? O un messaggio?
  // if (plData.length === 0 && (!isPremium || statsBySport.length === 0)) {
  //   return <div style={chartWidgetStyle}>Nessun dato sufficiente per i grafici.</div>;
  // }

  return (
    <div className={styles.chartContainer}>
      {/* Grafico Andamento P/L */}
      {plData.length > 0 && (
          <div className={styles.chartWidget}>
            <h4>Andamento Profitto/Perdita</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={plData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bet_date" tickFormatter={formatDateTick} />
                <YAxis />
                <Tooltip formatter={(value) => `${value.toFixed(2)} €`} />
                <Legend />
                <Line type="monotone" dataKey="cumulative_profit_loss" name="P/L Cumulativo" stroke="#8884d8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
      )}

       {/* Grafico P/L per Sport (solo Premium) */}
      {isPremium && statsBySport.length > 0 && (
          <div className={styles.chartWidget}>
              <h4>Profitto/Perdita per Sport (Premium)</h4>
              <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                      data={statsBySport}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${value.toFixed(2)} €`} />
                      <Legend />
                      {/* Usiamo una funzione per colorare le barre */}
                      <Bar dataKey="P/L" name="P/L per Sport">
                          {statsBySport.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry['P/L'] >= 0 ? '#28a745' : '#dc3545'} />
                          ))}
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </div>
      )}
       {isPremium && statsBySport.length === 0 && !loading && (
           <div className={`${styles.chartWidget} ${styles.infoMessage}`}>
               Nessun dato P/L per sport disponibile (serve almeno una scommessa chiusa).
           </div>
       )}

    </div>
  );
}

// Rimuovi le definizioni degli stili inline
// const chartContainerStyle = { ... };
// const chartWidgetStyle = { ... }; 