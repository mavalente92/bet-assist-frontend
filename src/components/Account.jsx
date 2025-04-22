import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Riceve la sessione come prop da App.jsx
export default function Account({ session }) {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState(null)
  const [fullName, setFullName] = useState(null)
  const [initialBankroll, setInitialBankroll] = useState(null)
  const [currentBankroll, setCurrentBankroll] = useState(null) // Lo mostriamo solo per info
  const [currency, setCurrency] = useState('EUR') // Default

  useEffect(() => {
    let ignore = false
    async function getProfile() {
      setLoading(true)
      // Assicurati che session e session.user esistano prima di procedere
      if (!session?.user) {
          console.error("Session or user not found in Account component.");
          setLoading(false);
          return; // Esce se non c'è utente nella sessione
      }
      const { user } = session;

      try {
        // Seleziona i dati dalla tabella 'profiles' usando l'ID utente
        const { data, error, status } = await supabase
          .from('profiles')
          .select(`username, full_name, initial_bankroll, current_bankroll, currency`)
          .eq('id', user.id) // Filtra per l'ID dell'utente loggato
          .single() // Ci aspettiamo un solo risultato

        if (!ignore) {
          if (error && status !== 406) { // 406 significa che non ha trovato righe, che è normale la prima volta
            console.warn(error)
            throw error
          }

          if (data) {
            setUsername(data.username)
            setFullName(data.full_name)
            setInitialBankroll(data.initial_bankroll)
            setCurrentBankroll(data.current_bankroll)
            setCurrency(data.currency || 'EUR') // Usa EUR se non impostato
          } else {
            // Se non ci sono dati (es. primo login dopo la registrazione),
            // potremmo voler inizializzare i campi qui o lasciare che l'utente li imposti.
            console.log("No profile data found for user:", user.id);
            // Potremmo impostare valori di default per i campi modificabili
            setInitialBankroll(0); // Ad esempio, inizia con 0 se non c'è un profilo
            setCurrency('EUR');
          }
        }
      } catch (error) {
        // Potrebbe essere utile mostrare un messaggio all'utente qui
        alert(`Errore nel caricamento del profilo: ${error.message}`)
      } finally {
         // Assicurati che lo spinner di caricamento scompaia solo se non siamo stati ignorati
         if (!ignore) {
            setLoading(false)
         }
      }
    }

    getProfile()

    // Funzione di cleanup per evitare aggiornamenti su componente smontato
    return () => {
      ignore = true
    }
  }, [session]) // Riesegue l'effetto se la sessione cambia

  async function updateProfile(event) {
    event.preventDefault()
    setLoading(true)
    const { user } = session

    const updates = {
      id: user.id, // Chiave primaria
      username,
      full_name: fullName,
      initial_bankroll: initialBankroll,
      currency,
      updated_at: new Date(), // Aggiorna il timestamp
    }

    try {
      // Usa upsert: inserisce se non esiste, aggiorna se esiste
      const { error } = await supabase.from('profiles').upsert(updates)

      if (error) {
        throw error
      }
       // Se l'upsert va a buon fine E il bankroll corrente è 0 (o non impostato),
       // aggiorniamo anche quello al valore iniziale. Questo succede tipicamente
       // la prima volta che l'utente imposta il bankroll.
       // In seguito, il bankroll corrente verrà aggiornato dalla logica delle scommesse.
       if (initialBankroll != null && (!currentBankroll || currentBankroll === 0)) {
           const { error: bankrollError } = await supabase
               .from('profiles')
               .update({ current_bankroll: initialBankroll })
               .eq('id', user.id);
           if (bankrollError) {
               console.warn("Could not set initial current_bankroll:", bankrollError);
               // Non blocchiamo per questo, ma logghiamo l'errore
           } else {
               // Aggiorna lo stato locale per riflettere la modifica
               setCurrentBankroll(initialBankroll);
           }
       }

      alert('Profilo aggiornato con successo!')
    } catch (error) {
      alert(`Errore nell'aggiornamento del profilo: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-widget">
      <h2>Profilo Utente</h2>
      {loading ? (
        <p>Caricamento dati profilo...</p>
      ) : (
        <form onSubmit={updateProfile}>
          <div>
            <label>Email</label>
            <input type="text" value={session.user.email} disabled />
          </div>
          <div>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username || ''}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="fullName">Nome Completo</label>
            <input
              id="fullName"
              type="text"
              value={fullName || ''}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="initialBankroll">Bankroll Iniziale ({currency})</label>
            <input
              id="initialBankroll"
              type="number"
              step="0.01" // Permette decimali
              value={initialBankroll || 0} // Mostra 0 se null
              onChange={(e) => setInitialBankroll(parseFloat(e.target.value) || 0)}
            />
          </div>
           {/* Mostra il bankroll corrente solo a scopo informativo */}
           {currentBankroll != null && (
                <div>
                    <label>Bankroll Attuale ({currency})</label>
                    <input type="text" value={currentBankroll} disabled />
                </div>
            )}
          <div>
            <label htmlFor="currency">Valuta</label>
            <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
            >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                {/* Aggiungi altre valute se necessario */}
            </select>
          </div>

          <div>
            <button className="button primary block" type="submit" disabled={loading}>
              {loading ? 'Salvataggio...' : 'Aggiorna Profilo'}
            </button>
          </div>
        </form>
      )}
      {/* Bottone Logout spostato qui o lasciato in App.jsx, a seconda del design */}
      {/* <button
        type="button"
        className="button block"
        onClick={() => supabase.auth.signOut()}
      >
        Logout
      </button> */}
    </div>
  )
}
