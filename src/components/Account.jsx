import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Riceve la sessione come prop da App.jsx
export default function Account({ session, onProfileUpdate, refreshToggle }) {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState(null);
  const [fullName, setFullName] = useState(null);
  const [initialBankroll, setInitialBankroll] = useState(null);
  const [currentBankroll, setCurrentBankroll] = useState(null); // Lo mostriamo solo per info
  const [currency, setCurrency] = useState('EUR'); // Default
  const [subscriptionStatus, setSubscriptionStatus] = useState('free');
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function getProfile() {
      setLoading(true);
      if (!session?.user?.id) {
          console.error("Account: No user ID, skipping profile fetch.");
          setUsername('');
          setFullName('');
          setInitialBankroll(0);
          setCurrentBankroll(0);
          setCurrency('EUR');
          setSubscriptionStatus('free');
          setLoading(false);
          return;
      }
      const { user } = session;

      try {
        const { data, error, status } = await supabase
          .from('profiles')
          .select(`username, full_name, initial_bankroll, current_bankroll, currency, subscription_status`)
          .eq('id', user.id)
          .single();

        if (!ignore) {
          if (error && status !== 406) {
            console.warn(error);
            throw error;
          }
          if (data) {
            setUsername(data.username);
            setFullName(data.full_name);
            setInitialBankroll(data.initial_bankroll);
            setCurrentBankroll(data.current_bankroll);
            setCurrency(data.currency || 'EUR');
            setSubscriptionStatus(data.subscription_status || 'free');
          } else {
            console.log("No profile data found for user:", user.id);
            setInitialBankroll(0);
            setCurrency('EUR');
            setSubscriptionStatus('free');
          }
        }
      } catch (error) {
        alert(`Errore nel caricamento del profilo: ${error.message}`);
        setUsername('');
        setFullName('');
        setInitialBankroll(0);
        setCurrentBankroll(0);
        setCurrency('EUR');
        setSubscriptionStatus('free');
      } finally {
         if (!ignore) {
            setLoading(false);
         }
      }
    }
    getProfile();
    return () => {
      ignore = true;
    };
  }, [session?.user?.id, refreshToggle]);

  async function updateProfile(event) {
    event.preventDefault();
    setLoading(true);
    const { user } = session;
    const updates = {
      id: user.id,
      username,
      full_name: fullName,
      initial_bankroll: initialBankroll,
      currency,
      updated_at: new Date(),
    };

    try {
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) {
        throw error;
      }
      if (initialBankroll != null && (!currentBankroll || currentBankroll === 0)) {
           const { error: bankrollError } = await supabase
               .from('profiles')
               .update({ current_bankroll: initialBankroll })
               .eq('id', user.id);
           if (bankrollError) {
               console.warn("Could not set initial current_bankroll:", bankrollError);
           } else {
               setCurrentBankroll(initialBankroll);
           }
       }
      alert('Profilo aggiornato con successo!');
      if (onProfileUpdate) onProfileUpdate();
    } catch (error) {
      alert(`Errore nell'aggiornamento del profilo: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

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
        if (onProfileUpdate) onProfileUpdate();
    } catch(error) {
        console.error("Errore aggiornamento abbonamento:", error);
        alert(`Errore aggiornamento abbonamento: ${error.message}`);
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
              step="0.01"
              value={initialBankroll || 0}
              onChange={(e) => setInitialBankroll(parseFloat(e.target.value) || 0)}
            />
          </div>
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
            </select>
          </div>

          <div>
            <button className="button primary block" type="submit" disabled={loading}>
              {loading ? 'Salvataggio...' : 'Aggiorna Profilo'}
            </button>
          </div>
        </form>
      )}

       {!loading && (
            <div style={{ marginTop: '20px', padding: '10px', border: '1px dashed blue', borderRadius: '5px' }}>
                <h4 style={{color: '#333', marginTop: '0'}}>Stato Abbonamento (Test)</h4>
                <p style={{color: '#555'}}>Stato attuale: <strong style={{color: subscriptionStatus === 'premium' ? 'gold' : '#555'}}>{subscriptionStatus}</strong></p>
                <button onClick={toggleSubscription} disabled={isUpdatingSubscription || loading}>
                    {isUpdatingSubscription ? 'Aggiornamento...' : (subscriptionStatus === 'free' ? 'Passa a Premium (Test)' : 'Torna a Free (Test)')}
                </button>
                <p style={{fontSize: '0.8em', color: '#777', marginTop: '10px'}}>Questo bottone serve solo per testare la visualizzazione delle funzionalità premium.</p>
            </div>
       )}
    </div>
  )
} 