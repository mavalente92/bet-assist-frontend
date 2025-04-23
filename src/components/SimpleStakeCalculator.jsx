import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SimpleStakeCalculator({ session, refreshToggle }) {
  const [currentBankroll, setCurrentBankroll] = useState(null);
  const [currency, setCurrency] = useState('EUR');
  const [percentage, setPercentage] = useState(1); // Default 1%
  const [calculatedStake, setCalculatedStake] = useState(0);
  const [loadingBankroll, setLoadingBankroll] = useState(true);
  const [errorBankroll, setErrorBankroll] = useState('');

  // Funzione per recuperare bankroll e valuta
  const fetchBankrollData = async () => {
    setLoadingBankroll(true);
    setErrorBankroll('');
    // Add check for user ID
    if (!session?.user?.id) {
        console.log("SimpleStakeCalculator: No user ID, skipping fetch.");
        setCurrentBankroll(0); // Default to 0 if no user
        setCurrency('EUR');
        setLoadingBankroll(false);
        return;
    }
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select('current_bankroll, currency')
        .eq('id', session.user.id)
        .single();

      if (error && status !== 406) { // Ignora errore "not found"
        throw error;
      }

      if (data) {
        setCurrentBankroll(data.current_bankroll || 0); // Usa 0 se null
        setCurrency(data.currency || 'EUR');
      } else {
        setCurrentBankroll(0); // Default a 0 se non c'è profilo
        setCurrency('EUR');
      }
    } catch (error) {
      console.error("Errore recupero bankroll:", error.message);
      setErrorBankroll(`Errore recupero bankroll: ${error.message}`);
      setCurrentBankroll(0); // Imposta a 0 in caso di errore per evitare NaN
    } finally {
      setLoadingBankroll(false);
    }
  };

  // useEffect per caricare i dati al mount e se la sessione/user cambia
  useEffect(() => {
    // Moved the check inside fetchBankrollData
    fetchBankrollData();
  }, [session?.user?.id, refreshToggle]); // Change dependency

  // useEffect per ricalcolare lo stake quando il bankroll o la percentuale cambiano
  useEffect(() => {
    if (currentBankroll !== null && !isNaN(percentage)) {
      const stakeValue = (currentBankroll * percentage) / 100;
      // Arrotonda a 2 decimali
      setCalculatedStake(parseFloat(stakeValue.toFixed(2)));
    } else {
      setCalculatedStake(0); // Default a 0 se i dati non sono validi
    }
  }, [currentBankroll, percentage]);

  // Gestore per l'input percentuale
  const handlePercentageChange = (e) => {
    const value = e.target.value;
    // Permetti valori vuoti o numeri (anche decimali)
    if (value === '' || !isNaN(value)) {
        setPercentage(value === '' ? '' : parseFloat(value)); // Salva come numero o stringa vuota
    }
  };


  // ----- JSX del Calcolatore -----
  return (
    <div className="calculator-widget" style={widgetStyleCalc}>
      <h4 style={{ color: '#333' }}>Calcolatore Puntata (% Fissa)</h4>
      {loadingBankroll && <p style={{ color: '#555' }}>Caricamento bankroll...</p>}
      {errorBankroll && <p style={{ color: 'red' }}>{errorBankroll}</p>}

      {!loadingBankroll && !errorBankroll && currentBankroll !== null && (
        <div style={calcContainerStyle}>
          <div style={infoStyle}>
            <span>Bankroll Attuale:</span>
            <strong style={valueInfoStyle}>{currentBankroll.toFixed(2)} {currency}</strong>
          </div>
          <div style={inputGroupStyle}>
            <label htmlFor="stakePercentage" style={{ marginRight: '10px', color: '#333' }}>Percentuale (%):</label>
            <input
              id="stakePercentage"
              type="number"
              min="0" // Percentuale non può essere negativa
              max="100" // Percentuale ragionevolmente non > 100
              step="0.1" // Permetti decimali
              value={percentage}
              onChange={handlePercentageChange}
              style={{ width: '80px', padding: '5px' }} // Stile inline per l'input
            />
          </div>
          <div style={resultStyle}>
            <span>Puntata Suggerita:</span>
            <strong style={valueResultStyle}>{calculatedStake} {currency}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

// Stili base (possono essere spostati in App.css)
const widgetStyleCalc = {
  marginTop: '20px',
  padding: '15px',
  border: '1px solid #eee',
  borderRadius: '5px',
  backgroundColor: '#fff', // Sfondo bianco per distinguerlo
};

const calcContainerStyle = {
  display: 'flex',
  flexWrap: 'wrap', // Va a capo su schermi piccoli
  alignItems: 'center',
  gap: '15px', // Spazio tra gli elementi
};

// Stile modificato per info bankroll (testo + valore)
const infoStyle = {
    marginRight: 'auto', // Spinge gli altri elementi a destra se c'è spazio
    color: '#333', // Colore per il testo "Bankroll Attuale:"
};

// Stile specifico per il valore del bankroll
const valueInfoStyle = {
    marginLeft: '5px', // Aggiungi un po' di spazio
    fontWeight: 'bold', // Già presente, ma lo confermiamo
    color: '#333', // Colore esplicito per il valore
};

const inputGroupStyle = {
    display: 'flex',
    alignItems: 'center',
};

// Stile modificato per il risultato (testo + valore)
const resultStyle = {
  marginLeft: 'auto', // Spinge a destra se c'è spazio
  color: '#333', // Colore per il testo "Puntata Suggerita:"
};

// Stile specifico per il valore della puntata suggerita
const valueResultStyle = {
    marginLeft: '5px', // Aggiungi un po' di spazio
    fontWeight: 'bold',
    fontSize: '1.1em',
    color: '#007bff', // Colore blu per evidenziare il risultato? O lascia '#333'
}; 