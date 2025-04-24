import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import styles from './BetForm.module.css'; // Importa CSS Module

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
  const [stake, setStake] = useState(''); // Manteniamo lo stato per la puntata inserita dall'utente
  const [bookmakerId, setBookmakerId] = useState(''); // ID del bookmaker selezionato
  const [status, setStatus] = useState('Aperta'); // Default
  const [notes, setNotes] = useState(''); // Opzionale

  // <-- NUOVI STATI per Staking -->
  const [activePlan, setActivePlan] = useState(null); // Conterrà i dettagli del piano attivo
  const [suggestedStake, setSuggestedStake] = useState(null); // Puntata calcolata dal piano
  const [currentBankroll, setCurrentBankroll] = useState(null); // Necessario per calcolare lo stake
  const [loadingPlan, setLoadingPlan] = useState(true); // Loading separato per il piano

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

  // <-- NUOVO useEffect per caricare piano attivo e bankroll -->
  useEffect(() => {
    const loadActivePlanAndBankroll = async () => {
        if (!session) {
            setLoadingPlan(false);
            return;
        }
        setLoadingPlan(true);
        setActivePlan(null); // Resetta prima di caricare
        setSuggestedStake(null);
        setCurrentBankroll(null);

        try {
            // Carica in parallelo profilo (per bankroll) e piano attivo
            const [profileRes, planRes] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('current_bankroll, currency') // Prendi anche currency
                    .eq('id', session.user.id)
                    .single(),
                supabase
                    .from('staking_plans')
                    .select('*')
                    .match({ user_id: session.user.id, is_active: true }) // Cerca piano attivo
                    .maybeSingle() // Può non esserci un piano attivo (restituisce null invece di errore)
            ]);

            // Gestione errore profilo
            if (profileRes.error && profileRes.status !== 406) {
                console.error("Errore caricamento profilo in BetForm:", profileRes.error);
                // Gestisci l'errore se necessario, ma potremmo procedere senza bankroll
            } else {
                setCurrentBankroll(profileRes.data?.current_bankroll || 0);
                // Potremmo usare profileRes.data?.currency se necessario mostrarlo
            }

            // Gestione errore piano
             if (planRes.error) {
                 console.error("Errore caricamento piano attivo:", planRes.error);
                 // Non bloccare, l'utente può inserire stake manualmente
             } else {
                 setActivePlan(planRes.data); // Salva il piano attivo (o null se non trovato)
             }

        } catch (err) {
             console.error("Errore generale caricamento dati staking:", err);
        } finally {
            setLoadingPlan(false);
        }
    };

    loadActivePlanAndBankroll();

  }, [session]); // Si aggiorna solo se cambia la sessione (il refresh è gestito dalla key in App.jsx)

  // <-- NUOVO useEffect per calcolare lo stake suggerito -->
   useEffect(() => {
       if (activePlan && currentBankroll !== null) {
           let calculated = 0;
           const bankroll = currentBankroll; // Già numero
           const config = activePlan.config;

           if (activePlan.plan_type === 'fixed_percentage' && config?.percentage > 0) {
               calculated = (bankroll * config.percentage) / 100;
           } else if (activePlan.plan_type === 'fixed_unit' && config?.unit_value > 0) {
               calculated = config.unit_value;
           }

           // Arrotonda a 2 decimali
           setSuggestedStake(parseFloat(calculated.toFixed(2)));
       } else {
           setSuggestedStake(null); // Nessun suggerimento se manca piano o bankroll
       }
   }, [activePlan, currentBankroll]);

  // Gestione invio form (modificata per includere dati staking)
  const handleSaveBet = async (submitEvent) => {
    console.log('handleSaveBet - Inizio - Valore stato eventName:', eventName);
    submitEvent.preventDefault();
    setLoading(true); // Loading generale del form
    setMessage('');

    const parsedOdds = parseFloat(odds);
    const parsedStake = parseFloat(stake); // Puntata inserita dall'utente
    const currentBookmakerId = bookmakerId;

    // Validazioni (ora includiamo lo stake inserito dall'utente)
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
        setMessage('Errore: La puntata inserita deve essere un numero positivo.');
        setLoading(false);
        return;
    }


    // Crea l'oggetto dati base
    const originalBetData = {
      user_id: session.user.id,
      bet_datetime: String(betDatetime),
      sport: String(sport),
      league: league ? String(league) : null,
      event: String(eventName),
      bet_type: String(betType),
      selections: [{ outcome: String(selectionOutcome), odds: Number(parsedOdds) }],
      odds: Number(parsedOdds),
      stake: Number(parsedStake), // Usa la puntata inserita dall'utente
      bookmaker_id: parseInt(currentBookmakerId, 10),
      status: String(status),
      notes: notes ? String(notes) : null,
      // <-- AGGIUNGI campi staking -->
      staking_plan_id: activePlan ? activePlan.id : null, // ID del piano attivo (o null)
      suggested_stake: suggestedStake // Puntata suggerita (o null)
    };

    // --- Clonazione ---
    let betDataToSend;
    try {
        betDataToSend = JSON.parse(JSON.stringify(originalBetData));
        console.log('Dati pronti per l\'invio (con staking):', betDataToSend);
    } catch (stringifyError) {
        console.error('Errore durante la clonazione dei dati per l\'invio:', stringifyError);
        // Aggiungi log dell'oggetto originale per debuggare cosa causa l'errore
        console.error('Oggetto originale che causa l\'errore:', originalBetData);
        setMessage(`Errore interno nella preparazione dei dati: ${stringifyError.message}`);
        setLoading(false);
        return;
    }
    // --- Fine clonazione ---

    try {
      // Inserimento
      const { error } = await supabase.from('bets').insert(betDataToSend);
      if (error) throw new Error(error.message || 'Errore database sconosciuto');

      setMessage('Scommessa salvata con successo!');
      // Reset (manteniamo data e bookmaker?)
      setSport('');
      setLeague('');
      setEventName('');
      setSelectionOutcome('');
      setOdds('');
      setStake(''); // Resetta puntata inserita
      setNotes('');
      // Non resettiamo suggestedStake o activePlan qui, verranno ricaricati se il form si riapre

      if (onSubmitSuccess) {
        onSubmitSuccess(); // Chiude form e triggera refresh
      }

    } catch (error) {
       // ... (gestione errore insert come prima) ...
       setMessage(`Errore: ${error.message || 'Si è verificato un problema nel salvataggio.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Funzione helper per usare lo stake suggerito
  const handleUseSuggestedStake = () => {
      if (suggestedStake !== null) {
          setStake(suggestedStake.toString()); // Imposta lo stake nel campo input
      }
  }

  // ----- JSX del Form (Refattorizzato con CSS Modules) -----
  return (
    <div className={styles.formWidget}>
      <h3>Aggiungi Nuova Scommessa ({betType})</h3>
      {message && (
        <p className={message.startsWith('Errore') ? styles.messageError : styles.messageSuccess}>
            {message}
        </p>
      )}
      <form onSubmit={handleSaveBet}>
        {/* Usiamo formGrid per layout responsive */}
        <div className={styles.formGrid}>
          {/* --- Gruppo Data/Ora e Sport --- */}
          <div className={styles.formGroup}> {/* Occupa una colonna della griglia */} 
            <label htmlFor="betDatetime">Data e Ora</label>
            <input
              id="betDatetime"
              type="datetime-local"
              value={betDatetime}
              onChange={(e) => setBetDatetime(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}> {/* Occupa un'altra colonna */} 
            <label htmlFor="sport">Sport *</label>
            <input
              id="sport"
              type="text"
              placeholder="Es. Calcio, Tennis..."
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* --- Gruppo Lega ed Evento --- */} 
          <div className={styles.formGroup}> 
            <label htmlFor="league">Lega/Torneo</label>
            <input
              id="league"
              type="text"
              placeholder="(Opzionale) Es. Serie A, ATP Finals"
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="eventName">Evento *</label>
            <input
              id="eventName"
              type="text"
              placeholder="Es. Inter - Milan, Djokovic - Sinner"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* --- Gruppo Selezione e Quota --- */} 
          <div className={styles.formGroup}>
            <label htmlFor="selectionOutcome">Selezione/Esito *</label>
            <input
              id="selectionOutcome"
              type="text"
              placeholder="Es. 1, Over 2.5, Testa a Testa 1"
              value={selectionOutcome}
              onChange={(e) => setSelectionOutcome(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="odds">Quota *</label>
            <input
              id="odds"
              type="number"
              step="0.01" // Permette decimali
              min="1.01" // Quota minima valida
              placeholder="Es. 1.85"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* --- Gruppo Bookmaker e Stato --- */}
          <div className={styles.formGroup}>
            <label htmlFor="bookmakerId">Bookmaker *</label>
            <select
              id="bookmakerId"
              value={bookmakerId}
              onChange={(e) => setBookmakerId(e.target.value)}
              required
              disabled={loading}
            >
              <option value="" disabled>-- Seleziona Bookmaker --</option>
              {bookmakers.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="status">Stato Scommessa</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={loading}
            >
              <option value="Aperta">Aperta</option>
              <option value="Vinta">Vinta</option>
              <option value="Persa">Persa</option>
              <option value="Void">Void</option>
              {/* Aggiungere altri stati se necessario */}
            </select>
          </div>
        </div> {/* Fine formGrid */} 

        {/* --- Sezione Puntata (Stake) --- */}
        {/* Mostra suggerimento solo se disponibile e non in loading piano */} 
        {!loadingPlan && suggestedStake !== null && (
            <div className={styles.stakeSuggestion}>
                Piano Attivo: {activePlan?.plan_name || 'N/D'} - Puntata Suggerita: <strong>{suggestedStake.toFixed(2)}</strong>
                <button type="button" onClick={handleUseSuggestedStake} disabled={loading}>
                    Usa Suggerimento
                </button>
            </div>
        )}
        {loadingPlan && <p>Caricamento info staking...</p>}

        {/* Campo Puntata - ora separato dalla griglia principale */} 
        <div className={styles.formGroup}>
          <label htmlFor="stake">Puntata *</label>
          <input
            id="stake"
            type="number"
            step="0.01"
            min="0.01" // Puntata minima
            placeholder="Inserisci la puntata..."
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        {/* --- Note (TextArea) - occupa tutta la larghezza sotto la griglia --- */}
        <div className={styles.formGroup}>
          <label htmlFor="notes">Note</label>
          <textarea
            id="notes"
            placeholder="(Opzionale) Aggiungi dettagli o analisi..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Bottone Salva */}
        <button type="submit" className={styles.submitButton} disabled={loading}>
          {loading ? 'Salvataggio...' : 'Salva Scommessa'}
        </button>
      </form>
    </div>
  );
}
