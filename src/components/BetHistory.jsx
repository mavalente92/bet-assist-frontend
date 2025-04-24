import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import styles from './BetHistory.module.css'; // Importa CSS Module

// Riceve la sessione come prop
export default function BetHistory({ session, refreshToggle }) {
  const [bets, setBets] = useState([]);
  const [loadingBets, setLoadingBets] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [bookmakers, setBookmakers] = useState([]);

  // --- NUOVI STATI PER FILTRI E ORDINAMENTO ---
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    sport: '',
    status: '',
    bookmakerId: ''
  });
  const [sort, setSort] = useState({
    field: 'bet_datetime',
    direction: 'desc'
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [appliedSort, setAppliedSort] = useState(sort);

  // Effetto per caricare i bookmaker (una sola volta al mount)
  useEffect(() => {
    async function fetchBookmakers() {
      try {
        const { data, error } = await supabase
          .from('bookmakers')
          .select('id, name')
          .order('name', { ascending: true });
        if (error) throw error;
        setBookmakers(data || []);
      } catch (error) {
        console.error('Errore nel caricamento dei bookmaker per filtro:', error.message);
      }
    }
    fetchBookmakers();
  }, []);

  // Funzione per recuperare le scommesse CON FILTRI E ORDINAMENTO
  const fetchBets = useCallback(async () => {
    if (!session?.user?.id) {
      console.log("BetHistory: No user ID, skipping fetch.");
      setLoadingBets(false);
      setBets([]);
      return;
    }

    setLoadingBets(true);
    setErrorMessage('');
    try {
      let query = supabase
        .from('bets')
        .select(`
          id, created_at, bet_datetime, sport, league, event, bet_type,
          selections, odds, stake, status, profit_loss, notes,
          bookmakers ( name )
        `)
        .eq('user_id', session.user.id);

      if (appliedFilters.startDate) {
        query = query.gte('bet_datetime', appliedFilters.startDate);
      }
      if (appliedFilters.endDate) {
        query = query.lte('bet_datetime', `${appliedFilters.endDate}T23:59:59`);
      }
      if (appliedFilters.sport) {
        query = query.ilike('sport', `%${appliedFilters.sport}%`);
      }
      if (appliedFilters.status) {
        query = query.eq('status', appliedFilters.status);
      }
      if (appliedFilters.bookmakerId) {
        query = query.eq('bookmaker_id', appliedFilters.bookmakerId);
      }

      query = query.order(appliedSort.field, { ascending: appliedSort.direction === 'asc' });

      const { data, error } = await query;

      if (error) throw error;
      setBets(data || []);

    } catch (error) {
      console.error('Errore nel recupero delle scommesse filtrate/ordinate:', error.message);
      setErrorMessage(`Errore recupero scommesse: ${error.message}`);
    } finally {
      setLoadingBets(false);
    }
  }, [session?.user?.id, appliedFilters, appliedSort]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets, refreshToggle]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSortChange = (e) => {
    const { name, value } = e.target;
    setSort(prev => ({ ...prev, [name]: value }));
  };

  const applyFiltersAndSort = () => {
    setAppliedFilters(filters);
    setAppliedSort(sort);
  };

  const resetFiltersAndSort = () => {
    const defaultFilters = { startDate: '', endDate: '', sport: '', status: '', bookmakerId: '' };
    const defaultSort = { field: 'bet_datetime', direction: 'desc' };
    setFilters(defaultFilters);
    setSort(defaultSort);
    setAppliedFilters(defaultFilters);
    setAppliedSort(defaultSort);
  };

  // Funzione per formattare la data/ora in modo leggibile
  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        // Opzioni per formato italiano più comune
        const options = {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false // Formato 24h
        };
        return date.toLocaleString('it-IT', options);
    } catch (e) {
        console.error("Error formatting date:", e);
        return isoString; // Ritorna stringa originale in caso di errore
    }
  };

  // Funzione per estrarre e formattare le selezioni (semplice per ora)
  const formatSelections = (selectionsArray) => {
    if (!Array.isArray(selectionsArray) || selectionsArray.length === 0) {
      return '-';
    }
    // Per ora, mostra solo il primo esito (utile per le singole)
    // In futuro, potremmo ciclare e mostrarli tutti per le multiple
    const firstSelection = selectionsArray[0];
    return firstSelection.outcome || '-';
  };

  // Funzione per ottenere la classe CSS per la cella P/L
  const getPlCellStyle = (profit_loss) => {
      if (profit_loss === null || profit_loss === undefined || isNaN(profit_loss)) {
          return styles.tableCell; // Stile base se non è un numero valido
      }
      if (profit_loss > 0) {
          return styles.cellPositive;
      }
      if (profit_loss < 0) {
          return styles.cellNegative;
      }
      return styles.tableCell; // Stile base se P/L è 0
  };

  // ----- JSX per visualizzare la lista -----
  return (
    <div className={styles.historyWidget}>
      <h3>Storico Scommesse</h3>

      {/* --- SEZIONE FILTRI E ORDINAMENTO --- */}
      <div className={styles.filterArea}>
        <h4>Filtri e Ordinamento</h4>
        <div className={styles.filterGrid}>
          <div className={styles.filterGroup}>
            <label htmlFor="startDate">Da Data:</label>
            <input id="startDate" type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className={styles.filterInput}/>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="endDate">A Data:</label>
            <input id="endDate" type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className={styles.filterInput}/>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="sport">Sport:</label>
            <input id="sport" type="text" name="sport" placeholder="Es. Calcio" value={filters.sport} onChange={handleFilterChange} className={styles.filterInput}/>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="status">Stato:</label>
            <select id="status" name="status" value={filters.status} onChange={handleFilterChange} className={styles.filterSelect}>
              <option value="">Tutti</option>
              <option value="Aperta">Aperta</option>
              <option value="Vinta">Vinta</option>
              <option value="Persa">Persa</option>
              <option value="Void">Void</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="bookmakerId">Bookmaker:</label>
            <select id="bookmakerId" name="bookmakerId" value={filters.bookmakerId} onChange={handleFilterChange} className={styles.filterSelect}>
              <option value="">Tutti</option>
              {bookmakers.map(bookie => (
                <option key={bookie.id} value={bookie.id}>{bookie.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="sortField">Ordina per:</label>
            <select id="sortField" name="field" value={sort.field} onChange={handleSortChange} className={styles.filterSelect}>
              <option value="bet_datetime">Data Scommessa</option>
              <option value="stake">Puntata</option>
              <option value="odds">Quota</option>
              <option value="profit_loss">P/L</option>
              <option value="sport">Sport</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="sortDirection">Direzione:</label>
            <select id="sortDirection" name="direction" value={sort.direction} onChange={handleSortChange} className={styles.filterSelect}>
              <option value="desc">Discendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>
        </div>
        <div className={styles.filterActions}>
          <button onClick={applyFiltersAndSort} className={styles.applyButton}>Applica</button>
          <button onClick={resetFiltersAndSort} className={styles.resetButton}>Resetta</button>
        </div>
      </div>
      {/* --- FINE SEZIONE FILTRI --- */}

      {loadingBets && <p>Caricamento storico scommesse...</p>}
      {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

      {!loadingBets && !errorMessage && (
        <>
          {bets.length === 0 ? (
            <p className={styles.noBetsMessage}>Nessuna scommessa trovata con i filtri applicati.</p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th className={styles.tableHeader}>Data</th>
                    <th className={styles.tableHeader}>Sport</th>
                    <th className={styles.tableHeader}>Evento</th>
                    <th className={styles.tableHeader}>Esito</th>
                    <th className={styles.tableHeader}>Quota</th>
                    <th className={styles.tableHeader}>Puntata</th>
                    <th className={styles.tableHeader}>Bookmaker</th>
                    <th className={styles.tableHeader}>Stato</th>
                    <th className={styles.tableHeader}>P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((bet) => (
                    <tr key={bet.id} className={styles.tableRow}>
                      <td className={styles.tableCell}>{formatDateTime(bet.bet_datetime)}</td>
                      <td className={styles.tableCell}>{bet.sport || '-'}</td>
                      <td className={styles.tableCell}>{bet.event || '-'}</td>
                      <td className={styles.tableCell}>{formatSelections(bet.selections)}</td>
                      <td className={styles.tableCell}>{bet.odds ? bet.odds.toFixed(2) : '-'}</td>
                      <td className={styles.tableCell}>{bet.stake ? bet.stake.toFixed(2) : '-'}</td>
                      <td className={styles.tableCell}>{bet.bookmakers?.name || '-'}</td>
                      <td className={styles.tableCell}>
                        <span style={{ color: bet.status === 'Vinta' ? 'green' : bet.status === 'Persa' ? 'red' : 'inherit' }}>
                          {bet.status}
                        </span>
                      </td>
                      <td className={getPlCellStyle(bet.profit_loss)}>
                        {bet.profit_loss !== null && bet.profit_loss !== undefined ? bet.profit_loss.toFixed(2) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Rimuovi le definizioni degli stili inline
// const filterAreaStyle = { ... }
// const filterGridStyle = { ... }
// ... e così via 