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
import SimpleStakeCalculator from './components/SimpleStakeCalculator'
import AdvancedAnalytics from './components/AdvancedAnalytics'
import StakingPlanner from './components/StakingPlanner'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showBetForm, setShowBetForm] = useState(false)
  const [refreshBetsToggle, setRefreshBetsToggle] = useState(false)
  const [refreshStatsToggle, setRefreshStatsToggle] = useState(false)
  const [refreshPlansToggle, setRefreshPlansToggle] = useState(false)

  // --- useEffect per Sessione INIZIALE e Loading ---
  useEffect(() => {
    setLoading(true) // Inizia caricamento
    console.log("Checking initial session...")
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log("Initial session check complete.", initialSession?.user?.id || 'No session')
      setSession(initialSession) // Imposta sessione iniziale (potrebbe essere null)
    }).catch((error) => {
      console.error("Error getting initial session:", error)
      setSession(null) // Imposta null anche in caso di errore
    }).finally(() => {
      setLoading(false) // Fine caricamento iniziale, SEMPRE
    })

    // Questo effetto viene eseguito solo al mount del componente App
  }, []) // Array dipendenze VUOTO

  // --- useEffect per ASCOLTARE i cambiamenti di stato ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Logga l'evento ma aggiorna lo stato session DI DIRETTAMENTE
      // Non serve più la logica complessa con prevSession ora che l'iniziale è gestito sopra
      console.log(`>>> Auth state changed! Event: ${_event}`, session?.user?.id || null)
      setSession(session) // Aggiorna semplicemente allo stato ricevuto
                           // Questo gestirà SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED etc.
                           // Il refresh su focus con SIGNED_IN non dovrebbe causare loop
                           // perché questo useEffect non dipende da 'loading'.
    })

    // Cleanup subscription on unmount
    return () => {
      console.log("Unsubscribing from onAuthStateChange")
      subscription.unsubscribe()
    }

    // Anche questo effetto viene eseguito solo al mount per impostare l'ascoltatore
  }, []) // Array dipendenze VUOTO

  // Funzione da passare a BetForm per sapere quando chiuderlo (opzionale)
  const handleBetSubmitSuccess = () => {
      console.log("Bet submitted successfully!")
      setShowBetForm(false)
      setRefreshBetsToggle(prev => !prev)
      setRefreshStatsToggle(prev => !prev)
      setRefreshPlansToggle(prev => !prev)
  }

  // NUOVA FUNZIONE per triggerare refresh dopo update profilo/status
  const handlePossibleProfileUpdate = () => {
      console.log("Profile or status possibly updated, triggering refresh...")
      // Usiamo il toggle delle statistiche/piani come segnale generico di refresh profilo
      setRefreshStatsToggle(prev => !prev)
      setRefreshPlansToggle(prev => !prev)
      // Potremmo anche aggiornare quello delle scommesse se necessario
      // setRefreshBetsToggle(prev => !prev)
  }

  // Se stiamo ancora caricando la sessione INIZIALE, mostra un messaggio
  if (loading) {
    return <div>Caricamento sessione iniziale...</div>
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
            <DashboardStats key={`stats-${session.user.id}`} session={session} refreshToggle={refreshStatsToggle} />

            {/* Calcolatore Stake Semplice */}
            <SimpleStakeCalculator key={`calculator-${session.user.id}`} session={session} refreshToggle={refreshStatsToggle} />
            <hr style={{margin: '20px 0'}}/>

            {/* Analisi Avanzate (Premium) */}
            <AdvancedAnalytics key={`adv-stats-${session.user.id}`} session={session} refreshToggle={refreshStatsToggle} />
            <hr style={{margin: '20px 0'}}/>

            {/* Gestione Piani Staking (Premium) */}
            <StakingPlanner key={`planner-${session.user.id}`} session={session} onPlansChange={handlePossibleProfileUpdate} refreshToggle={refreshPlansToggle} />
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
                        key={'bet-form-' + session.user.id}
                        session={session}
                        onSubmitSuccess={handleBetSubmitSuccess}
                    />
                    {/* Bottone per chiudere il form */}
                    <button onClick={() => setShowBetForm(false)} style={{marginTop: '10px'}}>
                        Annulla / Chiudi Form
                    </button>
                    <hr style={{margin: '20px 0'}}/> {/* Separatore */}
                </div>
            )}

            {/* Storico Scommesse */}
            <BetHistory key={`history-${session.user.id}`} session={session} refreshToggle={refreshBetsToggle} />
            <hr style={{margin: '20px 0'}}/> {/* Separatore */}

            {/* Mostra sempre il componente Account sotto */}
            <Account
                key={`account-${session.user.id}`}
                session={session}
                onProfileUpdate={handlePossibleProfileUpdate}
                refreshToggle={refreshStatsToggle}
            />
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
