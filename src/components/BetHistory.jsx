import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Riceve la sessione come prop
export default function BetHistory({ session }) {
  const [bets, setBets] = useState([]);
  const [loadingBets, setLoadingBets] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Funzione per recuperare le scommesse
  const fetchBets = async () => {
    setLoadingBets(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase
        .from('bets')
        .select(`
          id,
          created_at,
          bet_datetime,
          sport,
          league,
          event,
          bet_type,
          selections,
          odds,
          stake,
          status,
          profit_loss,
          notes,
          bookmakers ( name ) // Seleziona il nome dalla tabella bookmakers collegata
        `)
        .eq('user_id', session.user.id) // Filtra per l'utente loggato
        .order('bet_datetime', { ascending: false }); // Ordina per data scommessa, dalla più recente

      if (error) {
        throw error;
      }

      setBets(data || []); // Imposta i dati recuperati o un array vuoto
    } catch (error) {
      console.error('Errore nel recupero delle scommesse:', error.message);
      setErrorMessage(`Errore nel recupero delle scommesse: ${error.message}`);
    } finally {
      setLoadingBets(false);
    }
  };

  // useEffect per chiamare fetchBets al montaggio e quando la sessione cambia
  useEffect(() => {
    if (session) {
      fetchBets();
    }
  }, [session]); // Dipende dalla sessione

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
      {loadingBets && <p>Caricamento storico scommesse...</p>}
      {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}

      {!loadingBets && !errorMessage && (
        <>
          {bets.length === 0 ? (
            <p>Nessuna scommessa trovata.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}> {/* Rende la tabella scrollabile orizzontalmente su schermi piccoli */}
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
                    {/* Aggiungere altre colonne se necessario (es. Note, Modifica) */}
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
                      {/* Accede al nome del bookmaker tramite la relazione */}
                      <td style={tableCellStyle}>{bet.bookmakers?.name || '-'}</td>
                      <td style={tableCellStyle}>
                        {/* Potremmo aggiungere colore in base allo stato */}
                        <span style={{ color: bet.status === 'Vinta' ? 'green' : bet.status === 'Persa' ? 'red' : 'inherit' }}>
                          {bet.status}
                        </span>
                      </td>
                      <td style={{ ...tableCellStyle, color: bet.profit_loss > 0 ? 'green' : bet.profit_loss < 0 ? 'red' : 'inherit', fontWeight: bet.profit_loss !== null ? 'bold' : 'normal' }}>
                        {/* Mostra P/L solo se non è null */}
                        {bet.profit_loss !== null ? bet.profit_loss.toFixed(2) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Qui potremmo aggiungere la paginazione in futuro */}
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
  verticalAlign: 'top', // Allinea in alto se il contenuto va a capo
};
