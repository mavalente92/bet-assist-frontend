import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Riceve la sessione come prop da App.jsx
export default function Account({ session, onProfileUpdate }) {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState(null)
  const [fullName, setFullName] = useState(null)
  const [initialBankroll, setInitialBankroll] = useState(null)
  const [currentBankroll, setCurrentBankroll] = useState(null) // Lo mostriamo solo per info
  const [currency, setCurrency] = useState('EUR') // Default
  const [subscriptionStatus, setSubscriptionStatus] = useState('free'); // <-- NUOVO STATO
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false); // <-- NUOVO STATO per caricamento bottone

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
          .select(`username, full_name, initial_bankroll, current_bankroll, currency, subscription_status`)
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
            setSubscriptionStatus(data.subscription_status || 'free'); // <-- Imposta stato abbonamento
          } else {
            // Se non ci sono dati (es. primo login dopo la registrazione),
            // potremmo voler inizializzare i campi qui o lasciare che l'utente li imposti.
            console.log("No profile data found for user:", user.id);
            // Potremmo impostare valori di default per i campi modificabili
            setInitialBankroll(0); // Ad esempio, inizia con 0 se non c'è un profilo
            setCurrency('EUR');
            setSubscriptionStatus('free'); // Default a free se non c'è profilo
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
      // ---> CHIAMA CALLBACK <---
      if (onProfileUpdate) onProfileUpdate();
    } catch (error) {
      alert(`Errore nell'aggiornamento del profilo: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // <-- NUOVA FUNZIONE per cambiare stato abbonamento -->
  const toggleSubscription = async () => {
    setIsUpdatingSubscription(true);
    const newStatus = subscriptionStatus === 'free' ? 'premium' : 'free';
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ subscription_status: newStatus, updated_at: new Date() })
            .eq('id', session.user.id);

        if (error) throw error;

        setSubscriptionStatus(newStatus);
        alert(`Stato abbonamento cambiato in: ${newStatus}`);
        // ---> CHIAMA CALLBACK <---
        if (onProfileUpdate) onProfileUpdate();
    } catch(error) {
        console.error("Errore aggiornamento abbonamento:", error);
        alert(`Errore aggiornamento abbonamento: ${error.message}`)
    } finally {
        setIsUpdatingSubscription(false);
    }
  };

  return (
    <div className="form-widget">
      <h2 style={{color: '#333'}}>Profilo Utente</h2>
      {loading ? (
        <p style={{color: '#555'}}>Caricamento dati profilo...</p>
      ) : (
        <form onSubmit={updateProfile}>
          <div>
            <label style={{color: '#333'}}>Email</label>
            <input type="text" value={session.user.email} disabled />
          </div>
          <div>
            <label htmlFor="username" style={{color: '#333'}}>Username</label>
            <input
              id="username"
              type="text"
              value={username || ''}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="fullName" style={{color: '#333'}}>Nome Completo</label>
            <input
              id="fullName"
              type="text"
              value={fullName || ''}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="initialBankroll" style={{color: '#333'}}>Bankroll Iniziale ({currency})</label>
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
                    <label style={{color: '#333'}}>Bankroll Attuale ({currency})</label>
                    <input type="text" value={currentBankroll.toFixed(2)} disabled />
                </div>
            )}
          <div>
            <label htmlFor="currency" style={{color: '#333'}}>Valuta</label>
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

       {/* <-- NUOVA SEZIONE: Stato Abbonamento (Solo per Test) --> */}
       {!loading && ( // Mostra solo se il profilo è caricato
            <div style={{ marginTop: '20px', padding: '10px', border: '1px dashed blue', borderRadius: '5px' }}>
                <h4 style={{color: '#333', marginTop: '0'}}>Stato Abbonamento (Test)</h4>
                <p style={{color: '#555'}}>Stato attuale: <strong style={{color: subscriptionStatus === 'premium' ? 'gold' : '#555'}}>{subscriptionStatus}</strong></p>
                <button onClick={toggleSubscription} disabled={isUpdatingSubscription}>
                    {isUpdatingSubscription ? 'Aggiornamento...' : (subscriptionStatus === 'free' ? 'Passa a Premium (Test)' : 'Torna a Free (Test)')}
                </button>
                <p style={{fontSize: '0.8em', color: '#777', marginTop: '10px'}}>Questo bottone serve solo per testare la visualizzazione delle funzionalità premium.</p>
            </div>
       )}
    </div>
  )
}
