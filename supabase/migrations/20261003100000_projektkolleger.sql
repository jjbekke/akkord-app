-- "Personer" viser alle, man deler projekt med — også dem en anden projektleder
-- har tilføjet. Almindelige medlemmer må ikke læse hinandens timesatser, og RLS
-- kan ikke skjule enkelte kolonner pr. række, så listen udleveres af en funktion:
--   * kun projekter hvor den indloggede selv er medlem
--   * timesats kun i projekter hvor den indloggede er projektleder
--   * person_id kun når personen ligger i den indloggedes eget kartotek (så den kan rettes)

create function public.projektkolleger()
returns table (
  medlem_id uuid,
  projekt_id uuid,
  projekt_navn text,
  projekt_afsluttet boolean,
  navn text,
  rolle text,
  noegle uuid,
  person_id uuid,
  timesats integer,
  har_login boolean,
  er_mig boolean
)
language sql stable security definer set search_path = '' as $$
  select
    m.id,
    p.id,
    p.navn,
    p.afsluttet is not null,
    m.navn,
    m.rolle,
    coalesce(m.bruger_id, m.id),
    case when pe.ejer_id = (select auth.uid()) then m.person_id end,
    case when mig.rolle = 'projektleder' then m.timesats end,
    m.bruger_id is not null,
    m.bruger_id = (select auth.uid())
  from public.projekt_medlemmer mig
  join public.projekter p on p.id = mig.projekt_id
  join public.projekt_medlemmer m on m.projekt_id = mig.projekt_id
  left join public.personer pe on pe.id = m.person_id
  where mig.bruger_id = (select auth.uid())
  order by m.navn, p.navn;
$$;
revoke execute on function public.projektkolleger() from public, anon;
grant execute on function public.projektkolleger() to authenticated;
