import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Riceve la sessione per sapere a quale utente associare la scommessa
// Riceve una prop 'onSubmitSuccess' per notificare App.jsx quando una scommessa è aggiunta
export default function BetForm({ session, onSubmitSuccess }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [bookmakers, setBookmakers] = useState([]); // Lista bookmaker dal DB

  // Stati per i campi del form (inizializzati per una scommessa singola)
  const [betDatetime, setBetDatetime] = useState(new Date().toISOString().slice(0, 16)); // Data e ora attuale
  const [sport, setSport] = useState('');
  const [league, setLeague] = useState(''); // Opzionale inizialmente
  const [eventName, setEventName] = useState('');
  const [betType, setBetType] = useState('Singola'); // Iniziamo con Singola
  const [selectionOutcome, setSelectionOutcome] = useState(''); // Esito per la singola
  const [odds, setOdds] = useState(''); // Quota decimale
  const [stake, setStake] = useState(''); // Puntata
  const [bookmakerId, setBookmakerId] = useState(''); // ID del bookmaker selezionato
  const [status, setStatus] = useState('Aperta'); // Default
  const [notes, setNotes] = useState(''); // Opzionale

  // Effetto per caricare i bookmaker al montaggio del componente
  useEffect(() => {
    async function fetchBookmakers() {
      try {
        const { data, error } = await supabase
          .from('bookmakers')
          .select('id, name')
          .order('name', { ascending: true });

        if (error) throw error;
        setBookmakers(data || []);
        // Imposta il primo bookmaker come default se la lista non è vuota
        // if (data && data.length > 0) {
        //   setBookmakerId(data[0].id);
        // }
      } catch (error) {
        console.error('Errore nel caricamento dei bookmaker:', error.message);
        setMessage('Errore nel caricamento dei bookmaker.');
      }
    }
    fetchBookmakers();
  }, []); // Esegui solo al mount

  // Gestione invio form
  const handleSaveBet = async (submitEvent) => {
    console.log('handleSaveBet - Inizio - Valore stato eventName:', eventName);
    submitEvent.preventDefault();
    setLoading(true);
    setMessage('');

    const parsedOdds = parseFloat(odds);
    const parsedStake = parseFloat(stake);
    const currentBookmakerId = bookmakerId;

    if (!sport || !eventName || !selectionOutcome || !odds || !stake || !currentBookmakerId) {
      setMessage('Errore: Compila tutti i campi obbligatori (Sport, Evento, Esito, Quota, Puntata, Bookmaker).');
      setLoading(false);
      return;
    }
    if (isNaN(parsedOdds) || parsedOdds <= 1) {
        setMessage('Errore: La quota deve essere un numero maggiore di 1.');
        setLoading(false);
        return;
    }
    if (isNaN(parsedStake) || parsedStake <= 0) {
        setMessage('Errore: La puntata deve essere un numero positivo.');
        setLoading(false);
        return;
    }

    // Crea l'oggetto dati base con conversioni esplicite per sicurezza
    const originalBetData = {
      user_id: session.user.id, // UUID di Supabase è già un tipo sicuro
      bet_datetime: String(betDatetime), // Assicura sia stringa (da datetime-local)
      sport: String(sport),             // Assicura sia stringa
      league: league ? String(league) : null, // Assicura sia stringa o null
      event: String(eventName),             // Assicura sia stringa
      bet_type: String(betType),         // Assicura sia stringa
      // Assicurati che i tipi dentro 'selections' siano corretti
      selections: [{
          outcome: String(selectionOutcome), // Assicura sia stringa
          odds: Number(parsedOdds)          // Assicura sia numero
      }],
      odds: Number(parsedOdds),          // Assicura sia numero
      stake: Number(parsedStake),         // Assicura sia numero
      bookmaker_id: parseInt(currentBookmakerId, 10), // Già parsato
      status: String(status),           // Assicura sia stringa
      notes: notes ? String(notes) : null, // Assicura sia stringa o null
    };

    // --- **Crea una copia profonda "pulita" per sicurezza** ---
    let betDataToSend;
    try {
        betDataToSend = JSON.parse(JSON.stringify(originalBetData));
        console.log('Dati pronti per l\'invio (clonati):', betDataToSend);
    } catch (stringifyError) {
        console.error('Errore durante la clonazione dei dati per l\'invio:', stringifyError);
        // Aggiungi log dell'oggetto originale per debuggare cosa causa l'errore
        console.error('Oggetto originale che causa l\'errore:', originalBetData);
        setMessage(`Errore interno nella preparazione dei dati: ${stringifyError.message}`);
        setLoading(false);
        return;
    }
    // --- Fine creazione copia pulita ---

    try {
      // Usa l'oggetto clonato e pulito per l'inserimento
      const { error } = await supabase.from('bets').insert(betDataToSend);

      if (error) {
         console.error('Errore Supabase durante insert:', error);
         // Prova a estrarre messaggio più utile dall'errore Supabase
         let errorMessage = 'Errore database sconosciuto';
         if (error.message) { errorMessage = error.message; }
         else if (error.details) { errorMessage = error.details; }
         else if (error.hint) { errorMessage = error.hint; }
         // A volte l'errore circolare potrebbe essere mascherato da un errore DB generico qui
         if (errorMessage.toLowerCase().includes('circular structure')) {
             errorMessage = "Errore di struttura circolare rilevato durante l'invio a Supabase.";
         }
         throw new Error(errorMessage);
      }

      setMessage('Scommessa salvata con successo!');
      // Reset parziale del form
      setSport('');
      setLeague('');
      setEventName('');
      setSelectionOutcome('');
      setOdds('');
      setStake('');
      setNotes('');

      if (onSubmitSuccess) {
        onSubmitSuccess();
      }

    } catch (error) {
      // Cattura errori sia dalla clonazione sia dall'insert
      console.error('Errore nel processo di salvataggio della scommessa:', error);
      setMessage(`Errore: ${error.message || 'Si è verificato un problema nel salvataggio.'}`);
    } finally {
      setLoading(false);
    }
  };

  // ----- JSX del Form -----
  return (
    <div className="form-widget">
      <h3>Aggiungi Nuova Scommessa ({betType})</h3>
      {message && <p style={{ color: message.startsWith('Errore') ? 'red' : 'green' }}>{message}</p>}
      <form onSubmit={handleSaveBet}>
        {/* Data e Ora */}
        <div>
          <label htmlFor="betDatetime">Data e Ora</label>
          <input
            id="betDatetime"
            type="datetime-local" // Input specifico per data/ora
            value={betDatetime}
            onChange={(e) => setBetDatetime(e.target.value)}
            required
          />
        </div>

        {/* Sport */}
        <div>
          <label htmlFor="sport">Sport *</label>
          <input
            id="sport"
            type="text"
            placeholder="Es. Calcio, Tennis..."
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            required
          />
        </div>

        {/* Lega (Opzionale) */}
        <div>
          <label htmlFor="league">Lega/Torneo</label>
          <input
            id="league"
            type="text"
            placeholder="Es. Serie A, Wimbledon..."
            value={league}
            onChange={(e) => setLeague(e.target.value)}
          />
        </div>

        {/* Evento */}
        <div>
          <label htmlFor="event">Evento *</label>
          <input
            id="event"
            type="text"
            placeholder="Es. Milan - Inter, Finale ATP..."
            value={eventName}
            onChange={(e) => {
                const value = e.target.value;
                console.log('Evento onChange - e.target.value:', value);
                setEventName(value);
            }}
            required
          />
        </div>

        {/* Esito (per Singola) */}
        <div>
          <label htmlFor="selectionOutcome">Esito Pronosticato *</label>
          <input
            id="selectionOutcome"
            type="text"
            placeholder="Es. 1, Over 2.5, Testa a Testa 1..."
            value={selectionOutcome}
            onChange={(e) => setSelectionOutcome(e.target.value)}
            required
          />
        </div>

        {/* Quota */}
        <div>
          <label htmlFor="odds">Quota *</label>
          <input
            id="odds"
            type="number"
            step="0.01" // Permette decimali
            placeholder="Es. 1.85"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            required
            min="1" // Le quote sono solitamente > 1
          />
        </div>

        {/* Puntata */}
        <div>
          <label htmlFor="stake">Puntata (€) *</label>
          <input
            id="stake"
            type="number"
            step="0.01"
            placeholder="Es. 10.00"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            required
            min="0.01" // La puntata deve essere positiva
          />
        </div>

        {/* Bookmaker */}
        <div>
          <label htmlFor="bookmakerId">Bookmaker *</label>
          <select
            id="bookmakerId"
            value={bookmakerId}
            onChange={(e) => setBookmakerId(e.target.value)}
            required
          >
            <option value="" disabled>Seleziona un bookmaker</option>
            {bookmakers.map((bookie) => (
              <option key={bookie.id} value={bookie.id}>
                {bookie.name}
              </option>
            ))}
          </select>
          {/* Qui potremmo aggiungere logica per l'input "Altro" */}
        </div>

        {/* Stato */}
        <div>
          <label htmlFor="status">Stato</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="Aperta">Aperta</option>
            <option value="Vinta">Vinta</option>
            <option value="Persa">Persa</option>
            <option value="Rimborsata/Void">Rimborsata/Void</option>
            <option value="Cash Out">Cash Out</option>
             {/* Dovremo aggiungere input per importo cashout se selezionato */}
          </select>
        </div>

        {/* Note */}
        <div>
          <label htmlFor="notes">Note</label>
          <textarea
            id="notes"
            placeholder="Note aggiuntive..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Bottone Salva */}
        <div>
          <button className="button primary block" type="submit" disabled={loading}>
            {loading ? 'Salvataggio...' : 'Salva Scommessa'}
          </button>
        </div>
      </form>
    </div>
  );
}
