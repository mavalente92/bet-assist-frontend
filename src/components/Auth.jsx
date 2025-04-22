import { useState } from 'react'
import { supabase } from '../lib/supabaseClient' // Importa il client Supabase

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true) // Stato per alternare tra Login e Signup
  const [message, setMessage] = useState('')   // Stato per mostrare messaggi all'utente

  const handleAuth = async (event) => {
    event.preventDefault() // Previene il ricaricamento della pagina
    setLoading(true)
    setMessage('') // Resetta messaggi precedenti

    const credentials = { email, password }

    try {
      let error;
      if (isLogin) {
        // LOGIN
        const { error: loginError } = await supabase.auth.signInWithPassword(credentials)
        error = loginError;
        if (!error) {
            setMessage('Login effettuato con successo! Verrai reindirizzato.');
            // Non serve reindirizzare manualmente, onAuthStateChange in App.jsx farà il lavoro
        }
      } else {
        // SIGNUP (REGISTRAZIONE)
        // Potremmo voler chiedere un username qui, ma per ora usiamo solo email/password
        // const { error: signUpError } = await supabase.auth.signUp({
        //   email: email,
        //   password: password,
        //   options: { // Opzionale: passa dati extra da usare nel trigger handle_new_user
        //     data: {
        //       username: 'default_username' // O prendilo da un input
        //     }
        //   }
        // })
        const { error: signUpError } = await supabase.auth.signUp(credentials)
        error = signUpError;
        if (!error) {
          setMessage('Registrazione avvenuta! Controlla la tua email per il link di conferma.')
        } else {
            // Controlla se l'errore è dovuto a un utente già esistente
            if (error.message.includes("User already registered")) {
                setMessage("Utente già registrato con questa email. Prova a fare il login.");
            }
        }
      }

      if (error) throw error // Se c'è stato un errore, lancialo per il blocco catch

    } catch (error) {
      console.error('Errore durante autenticazione:', error.message)
      // Mostra un messaggio di errore più specifico se possibile
      setMessage(`Errore: ${error.message || 'Si è verificato un problema.'}`)
    } finally {
      setLoading(false) // In ogni caso, smetti di caricare
    }
  }

  return (
    <div className="row flex-center flex">
      <div className="col-6 form-widget">
        <h1 className="header">{isLogin ? 'Accedi' : 'Registrati'}</h1>
        <p className="description">
          {isLogin ? 'Accedi con la tua email e password' : 'Crea un nuovo account'}
        </p>
        {message && <p style={{color: message.startsWith('Errore') ? 'red' : 'green'}}>{message}</p>}
        <form onSubmit={handleAuth}>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="inputField"
              type="email"
              placeholder="latua@email.com"
              value={email}
              required={true}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="inputField"
              type="password"
              placeholder="La tua password"
              value={password}
              required={true}
              minLength={6} // Supabase richiede almeno 6 caratteri per la password
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <button className={'button block'} disabled={loading}>
              {loading ? <span>Caricamento...</span> : (isLogin ? 'Login' : 'Registrati')}
            </button>
          </div>
        </form>
        <button
          onClick={() => {
              setIsLogin(!isLogin);
              setMessage(''); // Resetta messaggio quando si cambia modalità
              setEmail('');   // Resetta anche i campi per pulizia
              setPassword('');
          }}
          className="button-link" // Stile da definire in App.css se vuoi
          style={{background: 'none', border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer', marginTop: '10px'}}
        >
          {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </button>
      </div>
    </div>
  )
}
