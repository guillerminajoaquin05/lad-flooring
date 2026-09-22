/* Configuración de Supabase — todavía NO conectado.
   Cuando tengas la URL y la anon key (Settings → API en tu proyecto de Supabase),
   reemplazá los dos valores de abajo. Mientras sigan con el placeholder,
   el resto del sitio sigue funcionando con los datos mock (products.js, services.js, etc). */

const SUPABASE_URL = 'https://pdogvswdhqioarkpppua.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9Wk6q774NW5EG_ZGuqgXrg_gkM1Tu7B';

const ladSupabase = (SUPABASE_URL.startsWith('TODO') || SUPABASE_ANON_KEY.startsWith('TODO'))
  ? null
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (!ladSupabase) {
  console.warn('[Lad Flooring] Supabase todavía no está conectado — completá SUPABASE_URL y SUPABASE_ANON_KEY en js/supabase-config.js');
}
