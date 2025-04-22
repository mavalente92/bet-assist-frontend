import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Riceve session e onPlansChange
export default function StakingPlanner({ session, onPlansChange }) {
  console.log("StakingPlanner received props - session exists:", !!session);

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUserPremium, setIsUserPremium] = useState(false); // Stato locale

  // Stati per il form di aggiunta nuovo piano
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlanType, setNewPlanType] = useState('fixed_percentage');
  const [newPlanValue, setNewPlanValue] = useState(''); // Per % o valore unità
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [addFormMessage, setAddFormMessage] = useState('');

  // Rinominiamo fetchPlans per chiarezza
  const loadPlans = async () => {
    // Non impostare loading qui, è gestito dall'useEffect principale
    // setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('staking_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      console.error("Errore caricamento piani staking:", err);
      setError(`Errore caricamento piani: ${err.message}`);
       setPlans([]); // Resetta piani in caso di errore
    }
    // Non impostare setLoading(false) qui, è gestito dall'useEffect principale
    // finally { setLoading(false); }
  };

  useEffect(() => {
    const checkStatusAndLoadPlans = async () => {
        if (!session) {
            setLoading(false);
            setIsUserPremium(false);
            return;
        }

        setLoading(true);
        setError('');
        setPlans([]); // Pulisci dati vecchi

        let currentStatus = 'free';
        try {
            // 1. Recupera lo stato dell'utente
            console.log("StakingPlanner: Checking user status...");
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('subscription_status')
                .eq('id', session.user.id)
                .single();

             if (profileError && profileError.code !== 'PGRST116') { throw profileError; }
             currentStatus = profileData?.subscription_status || 'free';
             setIsUserPremium(currentStatus === 'premium');
             console.log("StakingPlanner: User status is", currentStatus);

            // 2. Se è premium, carica i piani
            if (currentStatus === 'premium') {
                console.log("StakingPlanner: User is premium, loading plans...");
                await loadPlans(); // Aspetta che il caricamento dei piani finisca
            } else {
                 console.log("StakingPlanner: User is not premium, skipping plans load.");
                 setShowAddForm(false); // Nascondi form se non premium
            }

        } catch (err) {
             console.error("StakingPlanner: Error checking status or loading plans:", err);
             setError(`Errore generale: ${err.message}`);
             setIsUserPremium(false);
        } finally {
             setLoading(false); // Fine caricamento (status e/o piani)
        }
    };

    checkStatusAndLoadPlans();

  }, [session]); // Dipende solo da session

  // Funzione per gestire il salvataggio di un nuovo piano
  const handleAddPlan = async (e) => {
    e.preventDefault();
    setIsSavingPlan(true);
    setAddFormMessage('');

    let config = {};
    const numericValue = parseFloat(newPlanValue);

    // Validazione input
    if (isNaN(numericValue) || numericValue <= 0) {
        setAddFormMessage('Errore: Inserisci un valore numerico positivo valido.');
        setIsSavingPlan(false);
        return;
    }

    if (newPlanType === 'fixed_percentage') {
        if (numericValue > 100) { // Controllo aggiuntivo per percentuale
            setAddFormMessage('Errore: La percentuale non può superare 100.');
            setIsSavingPlan(false);
            return;
        }
        config = { percentage: numericValue };
    } else if (newPlanType === 'fixed_unit') {
        config = { unit_value: numericValue };
    } else {
        setAddFormMessage('Errore: Tipo di piano non valido.');
        setIsSavingPlan(false);
        return;
    }

    try {
      const { error } = await supabase.from('staking_plans').insert({
        user_id: session.user.id,
        plan_type: newPlanType,
        config: config,
        is_active: false // I nuovi piani non sono attivi di default
      });

      if (error) throw error;

      setAddFormMessage('Piano salvato con successo!');
      setNewPlanValue(''); // Resetta input
      setShowAddForm(false); // Chiudi form
      await loadPlans(); // Ricarica la lista
      // ---> CHIAMA CALLBACK <---
      if (onPlansChange) onPlansChange();

    } catch (err) {
      console.error("Errore salvataggio piano:", err);
      setAddFormMessage(`Errore salvataggio: ${err.message}`);
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Funzione per attivare un piano (disattivando gli altri)
  const setActivePlan = async (planIdToActivate) => {
    setLoading(true); // Riutilizziamo il loading principale per l'attivazione
    setError('');
    try {
        // 1. Disattiva tutti gli altri piani dell'utente (transazione sarebbe meglio, ma facciamolo in due passi)
        const { error: deactivateError } = await supabase
            .from('staking_plans')
            .update({ is_active: false, updated_at: new Date() })
            .match({ user_id: session.user.id, is_active: true }); // Disattiva solo quelli attualmente attivi

        if (deactivateError) throw deactivateError;

        // 2. Attiva il piano selezionato
        const { error: activateError } = await supabase
            .from('staking_plans')
            .update({ is_active: true, updated_at: new Date() })
            .eq('id', planIdToActivate);

        if (activateError) throw activateError;

        // Ricarica la lista per riflettere i cambiamenti
        await loadPlans();
        // ---> CHIAMA CALLBACK <---
        if (onPlansChange) onPlansChange();

    } catch (err) {
        console.error("Errore attivazione piano:", err);
        setError(`Errore attivazione: ${err.message}`);
        setLoading(false); // Assicurati che loading si fermi in caso di errore
    }
    // setLoading(false) viene chiamato da loadPlans() nel finally implicito
  };

  // Funzione per eliminare un piano
    const deletePlan = async (planIdToDelete) => {
        if (!window.confirm("Sei sicuro di voler eliminare questo piano?")) {
            return;
        }
        setLoading(true);
        setError('');
        try {
            const { error } = await supabase
                .from('staking_plans')
                .delete()
                .eq('id', planIdToDelete);

            if (error) throw error;

            // Ricarica la lista
            await loadPlans();
            // ---> CHIAMA CALLBACK <---
            if (onPlansChange) onPlansChange();

        } catch (err) {
            console.error("Errore eliminazione piano:", err);
            setError(`Errore eliminazione: ${err.message}`);
            setLoading(false);
        }
    };


  // ---- Rendering ----

  // Usa lo stato locale isUserPremium per il rendering condizionale
  if (!isUserPremium && !loading) {
     return (
       <div style={{...widgetStyleStaking, backgroundColor: '#fff8e1', borderColor: '#ffe57f'}}>
         <h3 style={{color: '#ef6c00'}}>Piani di Staking (Premium)</h3>
         <p style={{color: '#555'}}>Questa sezione è riservata agli utenti Premium.</p>
       </div>
     );
  }

  // Contenuto per utenti premium
  return (
    <div className="staking-widget" style={widgetStyleStaking}>
      <h3 style={{ color: '#333' }}>Gestione Piani di Staking (Premium)</h3>

      {loading && <p style={{color: '#555'}}>Caricamento piani...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Lista dei piani esistenti */}
      {!loading && !error && plans.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {plans.map((plan) => (
            <li key={plan.id} style={planItemStyle}>
              <div style={planDetailsStyle}>
                <strong>{plan.plan_type === 'fixed_percentage' ? 'Percentuale Fissa' : 'Unità Fissa'}</strong>:
                {plan.plan_type === 'fixed_percentage' && ` ${plan.config.percentage}%`}
                {plan.plan_type === 'fixed_unit' && ` ${plan.config.unit_value} €/unità`}
                {plan.is_active && <span style={activeBadgeStyle}> ATTIVO</span>}
              </div>
              <div style={planActionsStyle}>
                {!plan.is_active && (
                  <button onClick={() => setActivePlan(plan.id)} style={actionButtonStyle}>
                    Attiva
                  </button>
                )}
                 <button onClick={() => deletePlan(plan.id)} style={{...actionButtonStyle, backgroundColor: '#dc3545', marginLeft: '5px'}}>
                     Elimina
                 </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && plans.length === 0 && (
        <p style={{color: '#777', fontStyle: 'italic'}}>Nessun piano di staking definito.</p>
      )}

      <hr style={{margin: '20px 0'}} />

      {/* Bottone/Form per aggiungere nuovo piano */}
      {!showAddForm ? (
        <button onClick={() => setShowAddForm(true)}>+ Aggiungi Nuovo Piano</button>
      ) : (
        <div>
          <h4 style={{color: '#333', marginTop: '0'}}>Nuovo Piano</h4>
          {addFormMessage && <p style={{ color: addFormMessage.startsWith('Errore') ? 'red' : 'green' }}>{addFormMessage}</p>}
          <form onSubmit={handleAddPlan}>
            <div style={formGroupStyle}>
              <label htmlFor="planType" style={{color: '#333'}}>Tipo:</label>
              <select id="planType" value={newPlanType} onChange={(e) => setNewPlanType(e.target.value)} style={{marginLeft: '10px'}}>
                <option value="fixed_percentage">Percentuale Fissa (%)</option>
                <option value="fixed_unit">Unità Fissa (€)</option>
                {/* Aggiungere altri tipi qui in futuro */}
              </select>
            </div>
            <div style={formGroupStyle}>
              <label htmlFor="planValue" style={{color: '#333'}}>
                  {newPlanType === 'fixed_percentage' ? 'Percentuale:' : 'Valore Unità:'}
              </label>
              <input
                id="planValue"
                type="number"
                step="any"
                min="0.01"
                placeholder={newPlanType === 'fixed_percentage' ? 'Es. 2' : 'Es. 10'}
                value={newPlanValue}
                onChange={(e) => setNewPlanValue(e.target.value)}
                required
                style={{marginLeft: '10px'}}
              />
            </div>
            <div style={{marginTop: '15px'}}>
              <button type="submit" disabled={isSavingPlan} style={{marginRight: '10px'}}>
                {isSavingPlan ? 'Salvataggio...' : 'Salva Piano'}
              </button>
              <button type="button" onClick={() => { setShowAddForm(false); setAddFormMessage(''); }}>
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Stili (meglio spostarli in file CSS)
const widgetStyleStaking = {
    marginBottom: '30px',
    padding: '15px',
    border: '1px solid #eee',
    borderRadius: '5px',
    backgroundColor: '#f0f8ff',
};
const planItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #eee',
};
const planDetailsStyle = {
    color: '#333',
};
const planActionsStyle = {
    display: 'flex',
    alignItems: 'center',
};
const actionButtonStyle = {
    padding: '4px 8px',
    fontSize: '0.9em',
    cursor: 'pointer',
    backgroundColor: '#28a745', // Verde per attiva
    color: 'white',
    border: 'none',
    borderRadius: '3px',
};
const activeBadgeStyle = {
    marginLeft: '10px',
    padding: '2px 6px',
    fontSize: '0.8em',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#007bff', // Blu per attivo
    borderRadius: '3px',
};
const formGroupStyle = {
    marginBottom: '10px',
};
