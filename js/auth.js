/* Sesión de usuario — Supabase Auth real */

async function ladIsLoggedIn() {
  if (!ladSupabase) return false;
  const { data } = await ladSupabase.auth.getSession();
  return !!data.session;
}

async function ladGetSession() {
  if (!ladSupabase) return null;
  const { data } = await ladSupabase.auth.getSession();
  if (!data.session) return null;

  const { data: profile } = await ladSupabase
    .from('profiles')
    .select('*')
    .eq('id', data.session.user.id)
    .single();

  if (profile) await ladFillNameFromProvider(profile, data.session.user);
  return { ...data.session.user, ...profile };
}

/* Quien entra con Google no pasa por el formulario de registro: completamos nombre y apellido
   con los de su cuenta de Google, solo si están vacíos (nunca pisamos lo que la persona cargó). */
async function ladFillNameFromProvider(profile, user) {
  if (profile.nombre && profile.apellido) return;
  const meta = user.user_metadata || {};
  const full = String(meta.full_name || meta.name || '').trim();
  const nombre = String(meta.given_name || '').trim() || full.split(/\s+/)[0] || '';
  const apellido = String(meta.family_name || '').trim() || (full.includes(' ') ? full.slice(full.indexOf(' ') + 1).trim() : '');
  const changes = {};
  if (!profile.nombre && nombre) changes.nombre = nombre;
  if (!profile.apellido && apellido) changes.apellido = apellido;
  if (!Object.keys(changes).length) return;
  const { error } = await ladSupabase.from('profiles').update(changes).eq('id', user.id);
  if (!error) Object.assign(profile, changes);
}

async function ladLogout() {
  if (!ladSupabase) return;
  await ladSupabase.auth.signOut();
}

function ladAuthErrorMessage(error) {
  if (!error) return '';
  if (error.message === 'Invalid login credentials') return 'Email o contraseña incorrectos.';
  if (error.message === 'Email not confirmed') return 'Todavía no confirmaste tu email. Revisá tu casilla de correo.';
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('already registered')) return 'Ya existe una cuenta con ese email. Iniciá sesión o recuperá tu contraseña.';
  if (msg.includes('different from the old password')) return 'La contraseña nueva tiene que ser distinta de la anterior.';
  if (msg.includes('password should be') || msg.includes('weak password')) return 'La contraseña es muy débil. Usá al menos 8 caracteres, mezclando letras y números.';
  if (msg.includes('rate limit') || msg.includes('security purposes')) return 'Hiciste varios intentos seguidos. Esperá unos minutos y probá de nuevo.';
  if (msg.includes('invalid email') || msg.includes('unable to validate email')) return 'Ese email no es válido.';
  if (msg.includes('session') && msg.includes('missing')) return 'El link ya no sirve. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".';
  return error.message;
}

/* Stepper compartido del checkout (Login → Información → Pago → Confirmación) */
function ladCheckoutStepperHTML(activeStep) {
  const steps = ['Iniciar sesión', 'Información', 'Pago', 'Confirmación'];
  return `
  <div class="checkout-stepper">
    ${steps.map((label, i) => {
      const n = i + 1;
      const state = n < activeStep ? 'done' : (n === activeStep ? 'active' : '');
      return `
        <div class="stepper-item ${state}">
          <span class="stepper-dot">${n < activeStep ? '✓' : n}</span>
          <span class="stepper-label">${n}. ${label}</span>
        </div>
        ${n < steps.length ? '<span class="stepper-sep">›</span>' : ''}
      `;
    }).join('')}
  </div>`;
}
