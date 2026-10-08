-- Flere satser pr. person: akkordsats, sygesats og vejrligsats.
-- Tom (null) = samme som timesatsen, så de følger med, når timesatsen ændres.
-- Personens satser er standard og kopieres ind, når personen kommer på et projekt;
-- i projektet kan de rettes for sig.

alter table public.personer
  add column akkordsats integer check (akkordsats >= 0),
  add column sygsats integer check (sygsats >= 0),
  add column vejrligsats integer check (vejrligsats >= 0);

alter table public.projekt_medlemmer
  add column akkordsats integer check (akkordsats >= 0),
  add column sygsats integer check (sygsats >= 0),
  add column vejrligsats integer check (vejrligsats >= 0);

grant insert (akkordsats, sygsats, vejrligsats), update (akkordsats, sygsats, vejrligsats)
  on public.personer to authenticated;
grant insert (akkordsats, sygsats, vejrligsats), update (akkordsats, sygsats, vejrligsats)
  on public.projekt_medlemmer to authenticated;

/** Opretteren bliver automatisk projektleder — med satserne fra sin egen person. */
create or replace function private.projekt_oprettet() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_person public.personer;
begin
  if new.oprettet_af is null then
    return null;
  end if;
  select * into v_person from public.personer
  where ejer_id = new.oprettet_af and bruger_id = new.oprettet_af
  limit 1;

  insert into public.projekt_medlemmer
    (projekt_id, person_id, bruger_id, navn, rolle, timesats, akkordsats, sygsats, vejrligsats)
  select new.id, v_person.id, p.id, coalesce(v_person.navn, p.navn), 'projektleder',
    coalesce(v_person.timesats, 0), v_person.akkordsats, v_person.sygsats, v_person.vejrligsats
  from public.profiler p where p.id = new.oprettet_af;
  return null;
end;
$$;
revoke execute on function private.projekt_oprettet() from public, anon, authenticated;

create or replace function public.opret_projekt(p_navn text, p_medlemmer jsonb, p_materialer uuid[])
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.projekter (navn) values (trim(p_navn)) returning id into v_id;

  insert into public.projekt_medlemmer
    (projekt_id, person_id, navn, timesats, akkordsats, sygsats, vejrligsats, overskud_pr_time)
  select v_id, p.id, p.navn, p.timesats, p.akkordsats, p.sygsats, p.vejrligsats,
    nullif(x ->> 'overskud_pr_time', '')::integer
  from jsonb_array_elements(coalesce(p_medlemmer, '[]'::jsonb)) x
  join public.personer p on p.id = (x ->> 'person_id')::uuid
  where p.bruger_id is distinct from (select auth.uid());

  insert into public.projekt_materialer (projekt_id, materiale_id, navn, stykpris)
  select v_id, m.id, m.navn, m.stykpris
  from public.materialer m where m.id = any(coalesce(p_materialer, '{}'));

  return v_id;
end;
$$;
revoke execute on function public.opret_projekt(text, jsonb, uuid[]) from public, anon;
grant execute on function public.opret_projekt(text, jsonb, uuid[]) to authenticated;

create or replace function public.kobl_medlem_email(p_medlem uuid, p_email text) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
  v_medlem public.projekt_medlemmer;
  v_person uuid;
  v_antal int;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Skriv en gyldig e-mail';
  end if;

  select * into v_medlem from public.projekt_medlemmer where id = p_medlem;
  if not found then
    raise exception 'Ukendt medlem';
  end if;
  if v_medlem.person_id is not null then
    raise exception 'Medlemmet er allerede koblet til en person';
  end if;

  select id into v_person from public.personer
  where ejer_id = (select auth.uid()) and email = v_email;
  if v_person is null then
    insert into public.personer (navn, email, timesats, akkordsats, sygsats, vejrligsats)
    values (v_medlem.navn, v_email, v_medlem.timesats, v_medlem.akkordsats, v_medlem.sygsats, v_medlem.vejrligsats)
    returning id into v_person;
  end if;

  begin
    update public.projekt_medlemmer set person_id = v_person where id = p_medlem;
    get diagnostics v_antal = row_count;
  exception when unique_violation then
    raise exception 'Personen med den e-mail er allerede med i projektet';
  end;
  if v_antal = 0 then
    raise exception 'Kun projektledere kan koble medlemmer';
  end if;
end;
$$;
revoke execute on function public.kobl_medlem_email(uuid, text) from public, anon;
grant execute on function public.kobl_medlem_email(uuid, text) to authenticated;
