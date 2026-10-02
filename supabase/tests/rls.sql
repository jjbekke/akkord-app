-- Test af adgangsreglerne (RLS og triggere) med simulerede brugere.
-- Kør hele filen i SQL-editoren eller via Supabase MCP (execute_sql).
-- Den slutter ALTID med en fejl, så alt rulles tilbage:
--   "ALLE RLS-TESTS OK"  = alt bestod
--   enhver anden fejl     = en test fejlede (beskeden siger hvilken)

do $$
declare
  leder uuid := gen_random_uuid();
  medlem uuid := gen_random_uuid();
  fremmed uuid := gen_random_uuid();
  v_projekt uuid;
  v_person_medlem uuid;
  v_mat uuid;
  v_pm uuid;
  v_medlem_row uuid;
  v_leder_row uuid;
  v_uden uuid;
  v_person_fremmed uuid;
  n int;
  ok boolean;
begin
  -- Brugere: leder og fremmed bekræftet ved oprettelse, medlem bekræftes senere
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
  values (leder, 'Leder@Test.dk', now(), '{"navn":"Lene Leder"}', 'authenticated', 'authenticated'),
         (medlem, 'medlem@test.dk', null, '{"navn":"Mads Medlem"}', 'authenticated', 'authenticated'),
         (fremmed, 'fremmed@test.dk', now(), '{"navn":"Frede"}', 'authenticated', 'authenticated');

  assert (select count(*) from public.profiler where id in (leder, medlem, fremmed)) = 3, 'profiler oprettes';
  assert (select email from public.profiler where id = leder) = 'leder@test.dk', 'email lowercase';
  assert (select count(*) from public.personer where ejer_id = leder and bruger_id = leder) = 1, 'egen person oprettes';
  assert (select count(*) from public.personer where ejer_id = medlem) = 0, 'ubekræftet: ingen egen person endnu';

  -- === Som leder ===
  perform set_config('request.jwt.claims', json_build_object('sub', leder, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update public.personer set timesats = 21000 where ejer_id = leder and bruger_id = leder;
  insert into public.personer (navn, email, timesats) values ('Mads', ' MEDLEM@test.dk ', 10850) returning id into v_person_medlem;
  assert (select email from public.personer where id = v_person_medlem) = 'medlem@test.dk', 'email normaliseres';
  assert (select bruger_id from public.personer where id = v_person_medlem) is null, 'ubekræftet bruger kobles ikke';
  insert into public.materialer (navn, stykpris) values ('Sålbænke', 10000) returning id into v_mat;

  v_projekt := public.opret_projekt('Test', jsonb_build_array(jsonb_build_object('person_id', v_person_medlem, 'overskud_pr_time', 5000)), array[v_mat]);
  select id into v_leder_row from public.projekt_medlemmer where projekt_id = v_projekt and bruger_id = leder;
  assert (select rolle from public.projekt_medlemmer where id = v_leder_row) = 'projektleder', 'opretter er leder';
  assert (select timesats from public.projekt_medlemmer where id = v_leder_row) = 21000, 'opretters timesats kopieres';
  select id into v_medlem_row from public.projekt_medlemmer where projekt_id = v_projekt and person_id = v_person_medlem;
  assert (select overskud_pr_time from public.projekt_medlemmer where id = v_medlem_row) = 5000, 'lærlingetillæg';
  select id into v_pm from public.projekt_materialer where projekt_id = v_projekt;
  assert (select stykpris from public.projekt_materialer where id = v_pm) = 10000, 'materialepris kopieres';

  insert into public.timer (projekt_id, medlem_id, dato, type, timer) values
    (v_projekt, v_leder_row, '2026-10-01', 'akkord', 750),
    (v_projekt, v_medlem_row, '2026-10-01', 'akkord', 700);
  insert into public.materiale_registreringer (projekt_id, projekt_materiale_id, dato, antal) values (v_projekt, v_pm, '2026-10-01', 1200);
  insert into public.noter (projekt_id, dato, tekst) values (v_projekt, '2026-10-01', 'Ledernote');
  insert into public.justeringer (projekt_id, medlem_id, beloeb, begrundelse) values (v_projekt, v_medlem_row, 10000, 'Kørsel');
  insert into public.favoritter (projekt_id) values (v_projekt);

  ok := false;
  begin update public.materialer set stykpris = 1 where id = v_mat; exception when insufficient_privilege then ok := true; end;
  assert ok, 'stykpris kan ikke ændres';
  ok := false;
  begin update public.projekt_medlemmer set bruger_id = fremmed where id = v_medlem_row; exception when insufficient_privilege then ok := true; end;
  assert ok, 'bruger_id kan ikke sættes';

  reset role;

  -- === Medlem bekræfter sin e-mail → kobles til projektet ===
  update auth.users set email_confirmed_at = now() where id = medlem;
  assert (select bruger_id from public.projekt_medlemmer where id = v_medlem_row) = medlem, 'medlem kobles ved bekræftelse';
  assert (select count(*) from public.personer where ejer_id = medlem and bruger_id = medlem) = 1, 'medlem får egen person';

  -- === Som medlem ===
  perform set_config('request.jwt.claims', json_build_object('sub', medlem, 'role', 'authenticated')::text, true);
  set local role authenticated;

  assert (select count(*) from public.projekter where id = v_projekt) = 1, 'medlem ser projektet';
  assert (select count(*) from public.projekt_medlemmer where projekt_id = v_projekt) = 1, 'medlem ser kun egen medlemsrække';
  assert (select count(*) from public.timer where projekt_id = v_projekt) = 1, 'medlem ser kun egne timer';
  assert (select count(*) from public.projekt_materialer where projekt_id = v_projekt) = 0, 'medlem ser ikke materialer';
  assert (select count(*) from public.materiale_registreringer where projekt_id = v_projekt) = 0, 'medlem ser ikke materialeregistreringer';
  assert (select count(*) from public.noter where projekt_id = v_projekt) = 0, 'medlem ser ikke andres noter';
  assert (select count(*) from public.justeringer where projekt_id = v_projekt) = 0, 'medlem ser ikke rettelser';

  insert into public.timer (projekt_id, medlem_id, dato, type, timer) values (v_projekt, v_medlem_row, '2026-10-02', 'timeloen', 200);
  insert into public.noter (projekt_id, dato, tekst) values (v_projekt, '2026-10-02', 'Min note');
  assert (select count(*) from public.noter where projekt_id = v_projekt) = 1, 'medlem ser egen note';

  ok := false;
  begin insert into public.timer (projekt_id, medlem_id, dato, type, timer) values (v_projekt, v_leder_row, '2026-10-02', 'akkord', 100);
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'medlem kan ikke registrere for andre';

  ok := false;
  begin insert into public.materiale_registreringer (projekt_id, projekt_materiale_id, dato, antal) values (v_projekt, v_pm, '2026-10-02', 100);
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'medlem kan ikke registrere materialer';

  update public.projekt_medlemmer set timesats = 99999 where id = v_medlem_row;
  get diagnostics n = row_count;
  assert n = 0, 'medlem kan ikke rette egen timesats';

  update public.projekter set afsluttet = now() where id = v_projekt;
  get diagnostics n = row_count;
  assert n = 0, 'medlem kan ikke afslutte';

  reset role;

  -- === Som fremmed ===
  perform set_config('request.jwt.claims', json_build_object('sub', fremmed, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert (select count(*) from public.projekter where id = v_projekt) = 0, 'fremmed ser ikke projektet';
  assert (select count(*) from public.timer where projekt_id = v_projekt) = 0, 'fremmed ser ingen timer';
  assert (select count(*) from public.personer where ejer_id <> fremmed) = 0, 'fremmed ser ikke andres kartotek';
  ok := false;
  begin insert into public.favoritter (projekt_id) values (v_projekt); exception when insufficient_privilege then ok := true; end;
  assert ok, 'fremmed kan ikke favoritmarkere';
  reset role;

  -- === Leder: roller og afslutning ===
  perform set_config('request.jwt.claims', json_build_object('sub', leder, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.projekt_medlemmer set rolle = 'projektleder' where id = v_medlem_row;
  assert (select rolle from public.projekt_medlemmer where id = v_medlem_row) = 'projektleder', 'opretter udpeger leder';
  ok := false;
  begin update public.projekt_medlemmer set rolle = 'medlem' where id = v_leder_row; exception when raise_exception then ok := true; end;
  assert ok, 'opretter kan ikke miste lederrollen';

  update public.projekter set afsluttet = now() where id = v_projekt;
  ok := false;
  begin insert into public.timer (projekt_id, medlem_id, dato, type, timer) values (v_projekt, v_leder_row, '2026-10-03', 'akkord', 100);
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'afsluttet projekt er skrivebeskyttet';
  insert into public.projekt_filer (projekt_id, type, filnavn, sti) values (v_projekt, 'kvittering', 'k.pdf', v_projekt || '/k.pdf');
  update public.projekter set afsluttet = null where id = v_projekt;
  insert into public.timer (projekt_id, medlem_id, dato, type, timer) values (v_projekt, v_leder_row, '2026-10-03', 'akkord', 100);

  -- Medlem uden login (som i Viby-eksemplet): kan blive projektleder og kobles til en person
  insert into public.projekt_medlemmer (projekt_id, navn, timesats) values (v_projekt, 'Uden login', 9000) returning id into v_uden;
  update public.projekt_medlemmer set rolle = 'projektleder' where id = v_uden;
  assert (select rolle from public.projekt_medlemmer where id = v_uden) = 'projektleder', 'medlem uden login kan blive leder';
  insert into public.personer (navn, email, timesats) values ('Frede', 'fremmed@test.dk', 9000) returning id into v_person_fremmed;
  update public.projekt_medlemmer set person_id = v_person_fremmed where id = v_uden;
  assert (select bruger_id from public.projekt_medlemmer where id = v_uden) = fremmed, 'kobling giver login-adgang';
  ok := false;
  begin update public.projekt_medlemmer set person_id = v_person_medlem where id = v_uden; exception when raise_exception then ok := true; end;
  assert ok, 'koblet medlem kan ikke kobles om';
  reset role;

  -- En person fra en andens kartotek kan ikke bruges
  perform set_config('request.jwt.claims', json_build_object('sub', medlem, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.projekt_medlemmer (projekt_id, navn, timesats) values (v_projekt, 'Endnu en', 9000) returning id into v_uden;
  ok := false;
  begin update public.projekt_medlemmer set person_id = v_person_fremmed where id = v_uden; exception when raise_exception then ok := true; end;
  assert ok, 'kan ikke koble til en andens person';
  delete from public.projekt_medlemmer where id = v_uden;
  reset role;

  -- Den koblede bruger ser nu projektet
  perform set_config('request.jwt.claims', json_build_object('sub', fremmed, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert (select count(*) from public.projekter where id = v_projekt) = 1, 'koblet bruger ser projektet';
  reset role;

  -- Ny projektleder (ikke opretter) ser alt, men kan ikke ændre roller
  perform set_config('request.jwt.claims', json_build_object('sub', medlem, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert (select count(*) from public.timer where projekt_id = v_projekt) = 4, 'ny leder ser alle timer';
  ok := false;
  begin update public.projekt_medlemmer set rolle = 'medlem' where id = v_medlem_row; exception when raise_exception then ok := true; end;
  assert ok, 'kun opretter ændrer roller';
  reset role;

  raise exception 'ALLE RLS-TESTS OK';
end $$;
