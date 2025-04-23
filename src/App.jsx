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
import DashboardCharts from './components/DashboardCharts'
import SimpleStakeCalculator from './components/SimpleStakeCalculator'
import AdvancedAnalytics from './components/AdvancedAnalytics'
import StakingPlanner from './components/StakingPlanner'
import Navigation from './components/Navigation'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showBetForm, setShowBetForm] = useState(false)
  const [refreshBetsToggle, setRefreshBetsToggle] = useState(false)
  const [refreshStatsToggle, setRefreshStatsToggle] = useState(false)
  const [refreshPlansToggle, setRefreshPlansToggle] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')

  // --- useEffect per Sessione INIZIALE e Loading ---
  useEffect(() => {
    setLoading(true)
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
    }).catch((error) => {
      console.error("Error getting initial session:", error)
      setSession(null)
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  // --- useEffect per ASCOLTARE i cambiamenti di stato ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log(`>>> Auth state changed! Event: ${_event}`, session?.user?.id || null)
      setSession(session)
      // Se l'utente fa logout, torna alla dashboard (o potremmo nascondere tutto)
      if (_event === 'SIGNED_OUT') {
          setActiveTab('dashboard'); // O gestisci diversamente
          setShowBetForm(false); // Chiudi form scommesse al logout
      }
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Funzione da passare a BetForm per sapere quando chiuderlo
  const handleBetSubmitSuccess = () => {
      console.log("Bet submitted successfully!")
      setShowBetForm(false)
      setRefreshBetsToggle(prev => !prev)
      setRefreshStatsToggle(prev => !prev)
      setRefreshPlansToggle(prev => !prev)
      // Potremmo voler passare alla tab Scommesse dopo l'invio?
      // setActiveTab('bets');
  }

  // Funzione per triggerare refresh dopo update profilo/status
  const handlePossibleProfileUpdate = () => {
      console.log("Profile or status possibly updated, triggering refresh...")
      setRefreshStatsToggle(prev => !prev) // Stats/Charts/Calculator/Account si aggiornano
      setRefreshPlansToggle(prev => !prev) // Planner si aggiorna
      // Non serve refreshare BetHistory qui
  }

  // Funzione per triggerare refresh piani (usata da StakingPlanner)
  const handlePlansChange = () => {
      setRefreshPlansToggle(prev => !prev);
      // Altre azioni se necessario?
  }

  if (loading) {
    return <div>Caricamento sessione iniziale...</div>
  }

  return (
    <div className="container" style={{ padding: '50px 0 100px 0' }}>
      {!session ? (
        <Auth />
      ) : (
        <div>
          {/* --- BARRA DI NAVIGAZIONE (USA NUOVO COMPONENTE) --- */}
          <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

          {/* --- AREA CONTENUTO TAB --- */}
          <div>

            {/* Contenuto Tab Dashboard */}
            {activeTab === 'dashboard' && (
              <>
                <DashboardStats key={`stats-${session.user.id}`} session={session} refreshToggle={refreshStatsToggle} />
                <DashboardCharts key={`charts-${session.user.id}`} session={session} refreshToggle={refreshStatsToggle} />
              </>
            )}

            {/* Contenuto Tab Scommesse */}
            {activeTab === 'bets' && (
              <>
                {!showBetForm && (
                    <button onClick={() => setShowBetForm(true)} style={{marginBottom: '20px'}}>
                        + Aggiungi Scommessa
                    </button>
                )}
                {showBetForm && (
                    <div>
                        <BetForm
                            key={'bet-form-' + session.user.id} // Chiave qui può rimanere per reset form
                            session={session}
                            onSubmitSuccess={handleBetSubmitSuccess}
                        />
                        <button onClick={() => setShowBetForm(false)} style={{marginTop: '10px'}}>
                            Annulla / Chiudi Form
                        </button>
                        <hr style={{margin: '20px 0'}}/>
                    </div>
                )}
                <BetHistory key={`history-${session.user.id}`} session={session} refreshToggle={refreshBetsToggle} />
              </>
            )}

            {/* Contenuto Tab Strumenti */}
            {activeTab === 'tools' && (
              <>
                <SimpleStakeCalculator key={`calculator-${session.user.id}`} session={session} refreshToggle={refreshStatsToggle} />
                <hr style={{margin: '20px 0'}}/>
                {/* Questi componenti gestiscono internamente la visibilità premium */}
                <AdvancedAnalytics key={`adv-stats-${session.user.id}`} session={session} refreshToggle={refreshStatsToggle} />
                <hr style={{margin: '20px 0'}}/>
                <StakingPlanner key={`planner-${session.user.id}`} session={session} onPlansChange={handlePlansChange} refreshToggle={refreshPlansToggle} />
              </>
            )}

            {/* Contenuto Tab Profilo */}
            {activeTab === 'profile' && (
              <Account
                  key={`account-${session.user.id}`} // Chiave statica qui va bene
                  session={session}
                  onProfileUpdate={handlePossibleProfileUpdate}
                  refreshToggle={refreshStatsToggle} // Si aggiorna se cambiano P/L o Bankroll
              />
            )}

          </div>
          {/* --- FINE AREA CONTENUTO TAB --- */}

          {/* Bottone Logout (sempre visibile in fondo) */}
          <button
              onClick={() => supabase.auth.signOut()}
              style={{ marginTop: '30px' }} // Più spazio
          >
              Logout
          </button>
        </div>
      )}
    </div>
  )
}

export default App
