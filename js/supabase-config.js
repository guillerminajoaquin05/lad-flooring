/* Configuración de Supabase — todavía NO conectado.
   Cuando tengas la URL y la anon key (Settings → API en tu proyecto de Supabase),
   reemplazá los dos valores de abajo. Mientras sigan con el placeholder,
   el resto del sitio sigue funcionando con los datos mock (products.js, services.js, etc). */

const SUPABASE_URL = 'https://pdogvswdhqioarkpppua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkb2d2c3dkaHFpb2Fya3BwcHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MDA5MTksImV4cCI6MjEwNDM3NjkxOX0.i9OrAlzli63NdQiiO78NF0HToo7Slf41tAmqv0stnPs';

const ladSupabase = (SUPABASE_URL.startsWith('TODO') || SUPABASE_ANON_KEY.startsWith('TODO'))
  ? null
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (!ladSupabase) {
  console.warn('[Lad Flooring] Supabase todavía no está conectado — completá SUPABASE_URL y SUPABASE_ANON_KEY en js/supabase-config.js');
}
