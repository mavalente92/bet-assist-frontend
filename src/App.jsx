import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { supabase } from './lib/supabaseClient'
import './App.css'
import Auth from './components/Auth'
import Account from './components/Account'
import BetForm from './components/BetForm'
import BetHistory from './components/BetHistory'
import DashboardStats from './components/DashboardStats'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showBetForm, setShowBetForm] = useState(false)
  const [refreshBetsToggle, setRefreshBetsToggle] = useState(false)
  const [refreshStatsToggle, setRefreshStatsToggle] = useState(false)

  useEffect(() => {
    // Tenta di ottenere la sessione corrente all'avvio dell'app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false) // Abbiamo finito di caricare la sessione iniziale
    }).catch((error) => {
        console.error("Error getting initial session:", error);
        setLoading(false); // Anche in caso di errore, smettiamo di caricare
    });

    // Ascolta i cambiamenti nello stato di autenticazione (login, logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed:", _event, session); // Log per debug
      setSession(session)
    })

    // Pulisce la sottoscrizione quando il componente viene smontato
    return () => subscription.unsubscribe()
  }, []) // L'array vuoto [] assicura che useEffect venga eseguito solo al mount

  // Se stiamo ancora caricando la sessione, mostra un messaggio
  if (loading) {
    return <div>Caricamento sessione...</div>
  }

  // Funzione da passare a BetForm per sapere quando chiuderlo (opzionale)
  const handleBetSubmitSuccess = () => {
      console.log("Bet submitted successfully!");
      setShowBetForm(false); // Nasconde il form
      setRefreshBetsToggle(prev => !prev); // Triggera refresh storico
      setRefreshStatsToggle(prev => !prev); // <-- Triggera refresh statistiche
  }

  return (
    <div className="container" style={{ padding: '50px 0 100px 0' }}>
      {!session ? (
        // Se non c'è sessione, mostra il componente di Autenticazione
        <Auth />
      ) : (
        // Se c'è sessione, mostra l'area riservata (es. la dashboard)
        <div>
            {/* Dashboard Statistiche (in cima) */}
            <DashboardStats key={`stats-${session.user.id}-${refreshStatsToggle}`} session={session} />
            <hr style={{margin: '20px 0'}}/>

            {/* Mostra il bottone per aggiungere scommessa SOLO se il form NON è già visibile */}
            {!showBetForm && (
                <button onClick={() => setShowBetForm(true)} style={{marginBottom: '20px'}}>
                    + Aggiungi Scommessa
                </button>
            )}

            {/* Mostra il BetForm se showBetForm è true */}
            {showBetForm && (
                <div>
                    <BetForm
                        key={'bet-form-' + session.user.id} // Key per reset se utente cambia? Forse non serve qui.
                        session={session}
                        onSubmitSuccess={handleBetSubmitSuccess} // Passa la callback
                    />
                    {/* Bottone per chiudere il form */}
                    <button onClick={() => setShowBetForm(false)} style={{marginTop: '10px'}}>
                        Annulla / Chiudi Form
                    </button>
                    <hr style={{margin: '20px 0'}}/> {/* Separatore */}
                </div>
            )}

            {/* Storico Scommesse */}
            {/* Passiamo refreshBetsToggle come parte della key per forzare il re-fetch */}
            <BetHistory key={`history-${session.user.id}-${refreshBetsToggle}`} session={session} />
            <hr style={{margin: '20px 0'}}/> {/* Separatore */}

            {/* Mostra sempre il componente Account sotto */}
            <Account key={`account-${session.user.id}-${refreshBetsToggle}`} session={session} />
        </div>
      )}
      {/* Il bottone Logout può stare qui se vuoi che sia sempre visibile
          in fondo alla pagina quando loggato, oppure spostalo dentro Account.jsx */}
      {session && (
           <button
                onClick={() => supabase.auth.signOut()}
                style={{ marginTop: '20px' }} // Aggiungi un po' di spazio
           >
                Logout
           </button>
      )}
    </div>
  )
}

export default App
