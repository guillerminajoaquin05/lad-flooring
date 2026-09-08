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

  return { ...data.session.user, ...profile };
}

async function ladLogout() {
  if (!ladSupabase) return;
  await ladSupabase.auth.signOut();
}

function ladAuthErrorMessage(error) {
  if (!error) return '';
  if (error.message === 'Invalid login credentials') return 'Email o contraseña incorrectos.';
  if (error.message === 'Email not confirmed') return 'Todavía no confirmaste tu email. Revisá tu casilla de correo.';
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
