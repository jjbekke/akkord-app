-- Kobl et projektmedlem til en person ud fra en e-mail (Indstillinger → Ret → Kobl).
-- Findes e-mailen i projektlederens kartotek, bruges den person; ellers oprettes
-- personen med medlemmets navn og timesats. Har e-mailen en bekræftet konto, får
-- vedkommende adgang med det samme — ellers når kontoen oprettes og bekræftes.
-- Kører med kalderens rettigheder, så RLS og triggerne gælder som normalt.

create function public.kobl_medlem_email(p_medlem uuid, p_email text) returns void
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
    insert into public.personer (navn, email, timesats)
    values (v_medlem.navn, v_email, v_medlem.timesats)
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
