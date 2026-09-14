/* FAQs — leídas desde Supabase (antes eran HTML hardcodeado en faq.html) */

function ladMapFaq(row) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sort_order,
    hidden: row.hidden
  };
}

async function ladGetFaqs({ includeHidden = false } = {}) {
  if (!ladSupabase) { console.warn('[Lad Flooring] Supabase no conectado — ladGetFaqs() devuelve []'); return []; }
  let query = ladSupabase.from('faqs').select('*').order('sort_order').order('id');
  if (!includeHidden) query = query.eq('hidden', false);
  const { data, error } = await query;
  if (error) { console.error('[Lad Flooring] Error cargando FAQs:', error.message); return []; }
  return data.map(ladMapFaq);
}
