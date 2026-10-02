-- Et projektmedlem uden login (fx fra Viby-eksemplet) kan kobles til en person
-- i projektlederens kartotek. Har personen en bekræftet konto, får vedkommende
-- adgang til projektet med det samme — ellers når kontoen bekræftes.

grant update (person_id) on public.projekt_medlemmer to authenticated;

create or replace function private.medlem_foer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_bruger uuid := (select auth.uid());
  v_opretter uuid;
begin
  select oprettet_af into v_opretter from public.projekter where id = new.projekt_id;

  if tg_op = 'UPDATE' and old.person_id is not null and new.person_id is distinct from old.person_id then
    raise exception 'Medlemmet er allerede koblet til en person';
  end if;

  -- Personen skal tilhøre den der tilføjer/kobler; bruger_id afledes af personen
  if new.person_id is not null and (tg_op = 'INSERT' or old.person_id is null) then
    select bruger_id into new.bruger_id from public.personer
    where id = new.person_id and (v_bruger is null or ejer_id = v_bruger);
    if not found then
      raise exception 'Ukendt person';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.rolle = 'projektleder' and v_bruger is not null and v_bruger is distinct from v_opretter then
      raise exception 'Kun opretteren kan udpege projektledere';
    end if;
  else
    if new.rolle is distinct from old.rolle and v_bruger is not null then
      if v_bruger is distinct from v_opretter then
        raise exception 'Kun opretteren kan ændre projektlederrollen';
      end if;
      if old.bruger_id = v_opretter then
        raise exception 'Opretteren er altid projektleder';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.medlem_foer() from public, anon, authenticated;
