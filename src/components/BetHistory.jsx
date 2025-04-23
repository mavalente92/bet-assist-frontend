import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

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

  // ----- JSX per visualizzare la lista -----
  return (
    <div className="history-widget" style={{ marginTop: '30px' }}>
      <h3>Storico Scommesse</h3>

      {/* --- SEZIONE FILTRI E ORDINAMENTO --- */}
      <div className="filter-sort-controls" style={filterAreaStyle}>
        <h4>Filtri e Ordinamento</h4>
        <div style={filterGridStyle}>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>Da Data:</label>
            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} style={inputStyle}/>
          </div>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>A Data:</label>
            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} style={inputStyle}/>
          </div>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>Sport:</label>
            <input type="text" name="sport" placeholder="Es. Calcio" value={filters.sport} onChange={handleFilterChange} style={inputStyle}/>
          </div>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>Stato:</label>
            <select name="status" value={filters.status} onChange={handleFilterChange} style={inputStyle}>
              <option value="">Tutti</option>
              <option value="Aperta">Aperta</option>
              <option value="Vinta">Vinta</option>
              <option value="Persa">Persa</option>
              <option value="Rimborsata/Void">Rimborsata/Void</option>
              <option value="Cash Out">Cash Out</option>
            </select>
          </div>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>Bookmaker:</label>
            <select name="bookmakerId" value={filters.bookmakerId} onChange={handleFilterChange} style={inputStyle}>
              <option value="">Tutti</option>
              {bookmakers.map(bookie => (
                <option key={bookie.id} value={bookie.id}>{bookie.name}</option>
              ))}
            </select>
          </div>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>Ordina per:</label>
            <select name="field" value={sort.field} onChange={handleSortChange} style={inputStyle}>
              <option value="bet_datetime">Data Scommessa</option>
              <option value="stake">Puntata</option>
              <option value="odds">Quota</option>
              <option value="profit_loss">P/L</option>
              <option value="sport">Sport</option>
            </select>
          </div>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>Direzione:</label>
            <select name="direction" value={sort.direction} onChange={handleSortChange} style={inputStyle}>
              <option value="desc">Discendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button onClick={applyFiltersAndSort} style={buttonStyle}>Applica</button>
          <button onClick={resetFiltersAndSort} style={{...buttonStyle, backgroundColor: '#6c757d'}}>Resetta</button>
        </div>
      </div>
      {/* --- FINE SEZIONE FILTRI --- */}

      {loadingBets && <p>Caricamento storico scommesse...</p>}
      {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}

      {!loadingBets && !errorMessage && (
        <>
          {bets.length === 0 ? (
            <p style={{ fontStyle: 'italic', marginTop: '15px' }}>Nessuna scommessa trovata con i filtri applicati.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '15px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Data</th>
                    <th style={tableHeaderStyle}>Sport</th>
                    <th style={tableHeaderStyle}>Evento</th>
                    <th style={tableHeaderStyle}>Esito</th>
                    <th style={tableHeaderStyle}>Quota</th>
                    <th style={tableHeaderStyle}>Puntata</th>
                    <th style={tableHeaderStyle}>Bookmaker</th>
                    <th style={tableHeaderStyle}>Stato</th>
                    <th style={tableHeaderStyle}>P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((bet) => (
                    <tr key={bet.id}>
                      <td style={tableCellStyle}>{formatDateTime(bet.bet_datetime)}</td>
                      <td style={tableCellStyle}>{bet.sport || '-'}</td>
                      <td style={tableCellStyle}>{bet.event || '-'}</td>
                      <td style={tableCellStyle}>{formatSelections(bet.selections)}</td>
                      <td style={tableCellStyle}>{bet.odds ? bet.odds.toFixed(2) : '-'}</td>
                      <td style={tableCellStyle}>{bet.stake ? bet.stake.toFixed(2) : '-'}</td>
                      <td style={tableCellStyle}>{bet.bookmakers?.name || '-'}</td>
                      <td style={tableCellStyle}>
                        <span style={{ color: bet.status === 'Vinta' ? 'green' : bet.status === 'Persa' ? 'red' : 'inherit' }}>
                          {bet.status}
                        </span>
                      </td>
                      <td style={{ ...tableCellStyle, color: bet.profit_loss > 0 ? 'green' : bet.profit_loss < 0 ? 'red' : 'inherit', fontWeight: bet.profit_loss !== null ? 'bold' : 'normal' }}>
                        {bet.profit_loss !== null ? bet.profit_loss.toFixed(2) : '-'}
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

// Stili base per la tabella (possono essere spostati in App.css)
const tableHeaderStyle = {
  borderBottom: '2px solid #ccc',
  padding: '8px',
  textAlign: 'left',
  backgroundColor: '#f2f2f2',
};

const tableCellStyle = {
  borderBottom: '1px solid #eee',
  padding: '8px',
  textAlign: 'left',
  verticalAlign: 'top',
};

// --- NUOVI STILI PER FILTRI ---
const filterAreaStyle = {
  backgroundColor: '#f8f9fa',
  padding: '15px',
  border: '1px solid #dee2e6',
  borderRadius: '5px',
  marginBottom: '20px',
};

const filterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '10px 15px',
};

const filterGroupStyle = {
  display: 'flex',
  flexDirection: 'column',
};

const labelStyle = {
  marginBottom: '4px',
  fontSize: '0.9em',
  fontWeight: 'bold',
  color: '#495057',
};

const inputStyle = {
  padding: '6px 8px',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  fontSize: '0.95em',
};

const buttonStyle = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: '#007bff',
  color: 'white',
  cursor: 'pointer',
  fontSize: '0.95em',
}; 