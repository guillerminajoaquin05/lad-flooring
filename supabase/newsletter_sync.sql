-- Sincroniza "Quiero recibir novedades" de las cuentas (profiles.newsletter) con la lista de
-- suscriptores del newsletter (newsletter_subscribers), que es a la que se le mandan los emails.
-- Antes, marcar la casilla al registrarse o en "Mi cuenta" no suscribía a nadie.
-- Correr una sola vez en el SQL Editor de Supabase.

-- 1) Cuenta → lista de suscriptores
create or replace function public.lad_sync_profile_newsletter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_meta jsonb;
  v_wants boolean;
begin
  select email, raw_user_meta_data into v_email, v_meta from auth.users where id = new.id;
  if v_email is null then return new; end if;

  v_wants := coalesce(new.newsletter, false);

  -- Cuenta nueva: la casilla del registro viaja en los datos del usuario
  if tg_op = 'INSERT' and not v_wants and coalesce((v_meta ->> 'newsletter')::boolean, false) then
    update public.profiles set newsletter = true where id = new.id;  -- vuelve a entrar acá y suscribe
    return new;
  end if;

  if v_wants then
    insert into public.newsletter_subscribers (email)
    select lower(v_email)
    where not exists (select 1 from public.newsletter_subscribers where lower(email) = lower(v_email));
  elsif tg_op = 'UPDATE' and coalesce(old.newsletter, false) then
    delete from public.newsletter_subscribers where lower(email) = lower(v_email);
  end if;
  return new;
end;
$$;

drop trigger if exists lad_sync_profile_newsletter on public.profiles;
create trigger lad_sync_profile_newsletter
  after insert or update of newsletter on public.profiles
  for each row execute function public.lad_sync_profile_newsletter();

-- 2) Baja desde el link del email → se desmarca en la cuenta
create or replace function public.lad_sync_unsubscribe_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p set newsletter = false
  from auth.users u
  where u.id = p.id and lower(u.email) = lower(old.email) and p.newsletter;
  return old;
end;
$$;

drop trigger if exists lad_sync_unsubscribe_to_profile on public.newsletter_subscribers;
create trigger lad_sync_unsubscribe_to_profile
  after delete on public.newsletter_subscribers
  for each row execute function public.lad_sync_unsubscribe_to_profile();

-- 3) Cuentas que YA existían con la casilla marcada: primero miralas con esta consulta
--    (se muestra al final). Si están bien, sacá los "--" del insert de abajo y correlo aparte.
--    Ojo: si alguna de esas personas se había dado de baja desde el email, volvería a quedar suscripta.
select u.email, p.created_at
from public.profiles p join auth.users u on u.id = p.id
where p.newsletter
  and not exists (select 1 from public.newsletter_subscribers s where lower(s.email) = lower(u.email));

-- insert into public.newsletter_subscribers (email)
-- select distinct lower(u.email)
-- from public.profiles p join auth.users u on u.id = p.id
-- where p.newsletter
--   and not exists (select 1 from public.newsletter_subscribers s where lower(s.email) = lower(u.email));
