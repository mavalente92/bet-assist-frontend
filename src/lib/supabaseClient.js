import { createClient } from '@supabase/supabase-js'

// Recupera le variabili d'ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica che le variabili siano state caricate correttamente
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing. Make sure to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file");
}

// Crea e esporta il client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
