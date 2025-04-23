import { createClient } from '@supabase/supabase-js'

// Recupera le variabili d'ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica che le variabili siano state caricate correttamente
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing. Make sure to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file");
}

// Crea e esporta il client Supabase con opzioni aggiuntive
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Disabilita il refresh automatico del token in background.
    // Questo è il candidato più probabile per prevenire re-check su focus.
    autoRefreshToken: false,
    // Assicura che la sessione venga salvata/letta dallo storage (default è true)
    persistSession: true,
    // Disabilita il rilevamento della sessione dall'URL (usato per OAuth/Magic Link, disabilitiamolo per sicurezza)
    detectSessionInUrl: false,
  },
  // Opzioni globali (potrebbero influire su fetch, ma meno probabile)
  // global: {
  //   fetch: fetch, // Usa il fetch standard
  //   headers: {}
  // }
});
