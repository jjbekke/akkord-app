-- AKBOG: tabeller, adgangsregler (RLS), hjælpefunktioner og fillager.
-- Beløb gemmes i øre og timer/antal i hundrededele — altid heltal, som i appen.
--
-- Adgangsmodel:
--   * Personkartotek og materialepriser er personlige (ejer_id).
--   * Et projekt ses af dets medlemmer. Projektledere ser og redigerer alt.
--   * Almindelige medlemmer ser kun deres egen medlemsrække, egne timer og egne noter.
--     Deres løn beregnes på serveren (edge function "mit-regnskab").
--   * Kun opretteren kan give/fjerne projektlederrollen.
--   * Et afsluttet projekt er skrivebeskyttet, indtil en projektleder genåbner det.

-- Nye tabeller/funktioner i public eksponeres kun med de grants, der gives eksplicit.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

create schema if not exists private;
grant usage on schema private to authenticated;

---------------------------------------------------------------------------
-- Tabeller
---------------------------------------------------------------------------

create table public.profiler (
  id uuid primary key references auth.users (id) on delete cascade,
  navn text not null check (char_length(navn) between 1 and 100),
  email text not null,
  oprettet timestamptz not null default now()
);

create table public.personer (
  id uuid primary key default gen_random_uuid(),
  ejer_id uuid not null default auth.uid() references public.profiler (id) on delete cascade,
  navn text not null check (char_length(navn) between 1 and 100),
  email text,
  timesats integer not null default 0 check (timesats >= 0),
  -- Sættes automatisk, når en bekræftet bruger har samme e-mail
  bruger_id uuid references public.profiler (id) on delete set null,
  oprettet timestamptz not null default now()
);
create unique index personer_ejer_email_key on public.personer (ejer_id, email) where email is not null;
create index personer_email_idx on public.personer (email);
create index personer_bruger_id_idx on public.personer (bruger_id);

create table public.materialer (
  id uuid primary key default gen_random_uuid(),
  ejer_id uuid not null default auth.uid() references public.profiler (id) on delete cascade,
  navn text not null check (char_length(navn) between 1 and 100),
  stykpris integer not null check (stykpris >= 0),
  skjult boolean not null default false,
  oprettet timestamptz not null default now()
);
create index materialer_ejer_id_idx on public.materialer (ejer_id);

create table public.projekter (
  id uuid primary key default gen_random_uuid(),
  navn text not null check (char_length(navn) between 1 and 100),
  oprettet_af uuid default auth.uid() references public.profiler (id) on delete set null,
  oprettet timestamptz not null default now(),
  afsluttet timestamptz
);
create index projekter_oprettet_af_idx on public.projekter (oprettet_af);

create table public.projekt_medlemmer (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references public.projekter (id) on delete cascade,
  person_id uuid references public.personer (id) on delete set null,
  -- Afledt af personen (trigger) — giver login-adgang til projektet
  bruger_id uuid references public.profiler (id) on delete set null,
  navn text not null check (char_length(navn) between 1 and 100),
  rolle text not null default 'medlem' check (rolle in ('projektleder', 'medlem')),
  timesats integer not null default 0 check (timesats >= 0),
  -- null = andel af overskuddet efter akkordtimer; ellers fast beløb pr. akkordtime (lærling)
  overskud_pr_time integer check (overskud_pr_time >= 0),
  oprettet timestamptz not null default now(),
  unique (projekt_id, id),
  unique (projekt_id, person_id)
);
create unique index projekt_medlemmer_bruger_key on public.projekt_medlemmer (projekt_id, bruger_id) where bruger_id is not null;
create index projekt_medlemmer_bruger_id_idx on public.projekt_medlemmer (bruger_id);
create index projekt_medlemmer_person_id_idx on public.projekt_medlemmer (person_id);

create table public.projekt_materialer (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references public.projekter (id) on delete cascade,
  materiale_id uuid references public.materialer (id) on delete set null,
  -- Navn og pris kopieres ind, når materialet vælges til projektet
  navn text not null check (char_length(navn) between 1 and 100),
  stykpris integer not null check (stykpris >= 0),
  unique (projekt_id, id),
  unique (projekt_id, materiale_id)
);
create index projekt_materialer_materiale_id_idx on public.projekt_materialer (materiale_id);

create table public.timer (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references public.projekter (id) on delete cascade,
  medlem_id uuid not null,
  dato date not null,
  type text not null check (type in ('akkord', 'timeloen', 'syg', 'vejrlig')),
  timer integer not null check (timer > 0),
  beskrivelse text check (char_length(beskrivelse) <= 500),
  oprettet_af uuid default auth.uid() references public.profiler (id) on delete set null,
  oprettet timestamptz not null default now(),
  foreign key (projekt_id, medlem_id) references public.projekt_medlemmer (projekt_id, id) on delete cascade
);
create index timer_projekt_dato_idx on public.timer (projekt_id, dato);
create index timer_projekt_medlem_idx on public.timer (projekt_id, medlem_id);
create index timer_oprettet_af_idx on public.timer (oprettet_af);

create table public.materiale_registreringer (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references public.projekter (id) on delete cascade,
  projekt_materiale_id uuid not null,
  dato date not null,
  antal integer not null check (antal <> 0),
  oprettet_af uuid default auth.uid() references public.profiler (id) on delete set null,
  oprettet timestamptz not null default now(),
  foreign key (projekt_id, projekt_materiale_id) references public.projekt_materialer (projekt_id, id) on delete restrict
);
create index materiale_reg_projekt_dato_idx on public.materiale_registreringer (projekt_id, dato);
create index materiale_reg_projekt_materiale_idx on public.materiale_registreringer (projekt_id, projekt_materiale_id);
create index materiale_reg_oprettet_af_idx on public.materiale_registreringer (oprettet_af);

create table public.noter (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references public.projekter (id) on delete cascade,
  dato date not null,
  tekst text not null check (char_length(tekst) between 1 and 2000),
  oprettet_af uuid default auth.uid() references public.profiler (id) on delete set null,
  oprettet timestamptz not null default now()
);
create index noter_projekt_dato_idx on public.noter (projekt_id, dato);
create index noter_oprettet_af_idx on public.noter (oprettet_af);

create table public.justeringer (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references public.projekter (id) on delete cascade,
  medlem_id uuid not null,
  beloeb integer not null check (beloeb <> 0),
  begrundelse text not null check (char_length(begrundelse) between 1 and 200),
  oprettet_af uuid default auth.uid() references public.profiler (id) on delete set null,
  oprettet timestamptz not null default now(),
  foreign key (projekt_id, medlem_id) references public.projekt_medlemmer (projekt_id, id) on delete cascade
);
create index justeringer_projekt_medlem_idx on public.justeringer (projekt_id, medlem_id);
create index justeringer_oprettet_af_idx on public.justeringer (oprettet_af);

create table public.projekt_filer (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references public.projekter (id) on delete cascade,
  type text not null check (type in ('kvittering', 'timeloen')),
  filnavn text not null,
  sti text not null unique,
  oprettet_af uuid default auth.uid() references public.profiler (id) on delete set null,
  oprettet timestamptz not null default now()
);
create index projekt_filer_projekt_id_idx on public.projekt_filer (projekt_id);
create index projekt_filer_oprettet_af_idx on public.projekt_filer (oprettet_af);

create table public.favoritter (
  bruger_id uuid not null default auth.uid() references public.profiler (id) on delete cascade,
  projekt_id uuid not null references public.projekter (id) on delete cascade,
  primary key (bruger_id, projekt_id)
);
create index favoritter_projekt_id_idx on public.favoritter (projekt_id);

---------------------------------------------------------------------------
-- Hjælpefunktioner til RLS (private skema — kan ikke kaldes via API'et)
---------------------------------------------------------------------------

create function private.er_medlem(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projekt_medlemmer
    where projekt_id = p and bruger_id = (select auth.uid())
  );
$$;

create function private.er_projektleder(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projekt_medlemmer
    where projekt_id = p and bruger_id = (select auth.uid()) and rolle = 'projektleder'
  );
$$;

create function private.er_opretter(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projekter where id = p and oprettet_af = (select auth.uid())
  );
$$;

create function private.er_aaben(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projekter where id = p and afsluttet is null);
$$;

/** Er medlemsrækken m i projekt p den indloggede brugers egen? */
create function private.mit_medlem(p uuid, m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projekt_medlemmer
    where id = m and projekt_id = p and bruger_id = (select auth.uid())
  );
$$;

revoke execute on function
  private.er_medlem(uuid), private.er_projektleder(uuid), private.er_opretter(uuid),
  private.er_aaben(uuid), private.mit_medlem(uuid, uuid)
from public, anon;
grant execute on function
  private.er_medlem(uuid), private.er_projektleder(uuid), private.er_opretter(uuid),
  private.er_aaben(uuid), private.mit_medlem(uuid, uuid)
to authenticated;

---------------------------------------------------------------------------
-- Triggere
---------------------------------------------------------------------------

/** Bekræftet bruger med denne e-mail (null hvis ingen). */
create function private.bekraeftet_bruger(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users
  where lower(email) = p_email and email_confirmed_at is not null
  limit 1;
$$;
revoke execute on function private.bekraeftet_bruger(text) from public, anon, authenticated;

/** Kobler en (netop bekræftet) bruger til personer og projekter med samme e-mail. */
create function private.kobl_bruger(p_bruger uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_navn text;
begin
  select email, navn into v_email, v_navn from public.profiler where id = p_bruger;
  if v_email is null then
    return;
  end if;

  -- Brugeren selv i eget kartotek, så man kan sætte sin egen timesats
  insert into public.personer (ejer_id, navn, email)
  values (p_bruger, v_navn, v_email)
  on conflict (ejer_id, email) where email is not null do nothing;

  update public.personer set bruger_id = p_bruger
  where email = v_email and bruger_id is null;
  -- projekt_medlemmer opdateres af triggeren på personer
end;
$$;
revoke execute on function private.kobl_bruger(uuid) from public, anon, authenticated;

create function private.ny_bruger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiler (id, navn, email)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'navn'), ''), split_part(new.email, '@', 1)), 100),
    lower(new.email)
  )
  on conflict (id) do nothing;
  if new.email_confirmed_at is not null then
    begin
      perform private.kobl_bruger(new.id);
    exception when others then
      raise warning 'kobl_bruger fejlede for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

create function private.bruger_bekraeftet() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Bekræftelsen må aldrig fejle, selv hvis koblingen gør
  begin
    perform private.kobl_bruger(new.id);
  exception when others then
    raise warning 'kobl_bruger fejlede for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create trigger akbog_ny_bruger
  after insert on auth.users
  for each row execute function private.ny_bruger();

create trigger akbog_bruger_bekraeftet
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.bruger_bekraeftet();

/** Normaliserer e-mail og finder den tilhørende bruger. */
create function private.personer_foer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := nullif(lower(trim(new.email)), '');
  if tg_op = 'UPDATE' and old.bruger_id = old.ejer_id and new.email is distinct from old.email then
    raise exception 'Din egen e-mail kan ikke ændres her';
  end if;
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    new.bruger_id := case when new.email is null then null else private.bekraeftet_bruger(new.email) end;
  end if;
  return new;
end;
$$;

create trigger personer_foer
  before insert or update on public.personer
  for each row execute function private.personer_foer();

/** Når en person kobles til en bruger, får brugeren adgang til de projekter personen er med i. */
create function private.personer_efter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.projekt_medlemmer m set bruger_id = new.bruger_id
  where m.person_id = new.id
    -- Er brugeren allerede med i projektet (via en anden person), springes det over
    and (new.bruger_id is null or not exists (
      select 1 from public.projekt_medlemmer andre
      where andre.projekt_id = m.projekt_id and andre.bruger_id = new.bruger_id
    ));
  return null;
end;
$$;

create trigger personer_efter
  after update of bruger_id on public.personer
  for each row
  when (old.bruger_id is distinct from new.bruger_id)
  execute function private.personer_efter();

/** Opretteren bliver automatisk projektleder. */
create function private.projekt_oprettet() returns trigger
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

  insert into public.projekt_medlemmer (projekt_id, person_id, bruger_id, navn, rolle, timesats)
  select new.id, v_person.id, p.id, coalesce(v_person.navn, p.navn), 'projektleder', coalesce(v_person.timesats, 0)
  from public.profiler p where p.id = new.oprettet_af;
  return null;
end;
$$;

create trigger projekt_oprettet
  after insert on public.projekter
  for each row execute function private.projekt_oprettet();

/**
 * bruger_id afledes af personen; kun opretteren styrer projektlederrollen.
 * (bruger_id og person_id kan ikke sættes af klienten — se kolonne-grants.)
 */
create function private.medlem_foer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_bruger uuid := (select auth.uid());
  v_opretter uuid;
begin
  select oprettet_af into v_opretter from public.projekter where id = new.projekt_id;

  if tg_op = 'INSERT' then
    -- Personen skal tilhøre den der tilføjer (eller opretteren selv, se projekt_oprettet)
    if new.person_id is not null then
      select bruger_id into new.bruger_id from public.personer
      where id = new.person_id and (v_bruger is null or ejer_id = v_bruger);
      if not found then
        raise exception 'Ukendt person';
      end if;
    end if;
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

create trigger medlem_foer
  before insert or update on public.projekt_medlemmer
  for each row execute function private.medlem_foer();

create function private.medlem_slet() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.bruger_id is not null
     and old.bruger_id = (select oprettet_af from public.projekter where id = old.projekt_id)
     and (select auth.uid()) is not null then
    raise exception 'Opretteren kan ikke fjernes fra projektet';
  end if;
  return old;
end;
$$;

create trigger medlem_slet
  before delete on public.projekt_medlemmer
  for each row execute function private.medlem_slet();

/** Navn og pris kopieres fra eget materialekartotek. */
create function private.projekt_materiale_foer() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.materiale_id is not null then
    select navn, stykpris into new.navn, new.stykpris
    from public.materialer where id = new.materiale_id;
    if not found then
      raise exception 'Ukendt materiale';
    end if;
  end if;
  return new;
end;
$$;

create trigger projekt_materiale_foer
  before insert on public.projekt_materialer
  for each row execute function private.projekt_materiale_foer();

revoke execute on function
  private.ny_bruger(), private.bruger_bekraeftet(), private.personer_foer(), private.personer_efter(),
  private.projekt_oprettet(), private.medlem_foer(), private.medlem_slet(), private.projekt_materiale_foer()
from public, anon, authenticated;

---------------------------------------------------------------------------
-- RLS og grants
---------------------------------------------------------------------------

alter table public.profiler enable row level security;
alter table public.personer enable row level security;
alter table public.materialer enable row level security;
alter table public.projekter enable row level security;
alter table public.projekt_medlemmer enable row level security;
alter table public.projekt_materialer enable row level security;
alter table public.timer enable row level security;
alter table public.materiale_registreringer enable row level security;
alter table public.noter enable row level security;
alter table public.justeringer enable row level security;
alter table public.projekt_filer enable row level security;
alter table public.favoritter enable row level security;

-- Profiler: kun ens egen
grant select, update (navn) on public.profiler to authenticated;
create policy "egen profil" on public.profiler for select to authenticated
  using (id = (select auth.uid()));
create policy "ret egen profil" on public.profiler for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Personkartotek: kun ejeren
grant select, insert (navn, email, timesats), update (navn, email, timesats), delete on public.personer to authenticated;
create policy "se egne personer" on public.personer for select to authenticated
  using (ejer_id = (select auth.uid()));
create policy "opret egne personer" on public.personer for insert to authenticated
  with check (ejer_id = (select auth.uid()));
create policy "ret egne personer" on public.personer for update to authenticated
  using (ejer_id = (select auth.uid())) with check (ejer_id = (select auth.uid()));
create policy "slet egne personer" on public.personer for delete to authenticated
  using (ejer_id = (select auth.uid()) and bruger_id is distinct from (select auth.uid()));

-- Materialepriser: kun ejeren. Pris og navn kan ikke ændres — opret en ny pris i stedet.
grant select, insert (navn, stykpris), update (skjult), delete on public.materialer to authenticated;
create policy "se egne materialer" on public.materialer for select to authenticated
  using (ejer_id = (select auth.uid()));
create policy "opret egne materialer" on public.materialer for insert to authenticated
  with check (ejer_id = (select auth.uid()));
create policy "ret egne materialer" on public.materialer for update to authenticated
  using (ejer_id = (select auth.uid())) with check (ejer_id = (select auth.uid()));
create policy "slet egne materialer" on public.materialer for delete to authenticated
  using (ejer_id = (select auth.uid()));

-- Projekter
grant select, insert (navn), update (navn, afsluttet) on public.projekter to authenticated;
create policy "se projekter" on public.projekter for select to authenticated
  using ((select private.er_medlem(id)) or oprettet_af = (select auth.uid()));
create policy "opret projekt" on public.projekter for insert to authenticated
  with check (oprettet_af = (select auth.uid()));
create policy "projektleder retter projekt" on public.projekter for update to authenticated
  using ((select private.er_projektleder(id))) with check ((select private.er_projektleder(id)));

-- Medlemmer
grant select, insert (projekt_id, person_id, navn, rolle, timesats, overskud_pr_time),
  update (navn, rolle, timesats, overskud_pr_time), delete on public.projekt_medlemmer to authenticated;
create policy "se medlemmer" on public.projekt_medlemmer for select to authenticated
  using (bruger_id = (select auth.uid()) or (select private.er_projektleder(projekt_id)));
create policy "tilføj medlemmer" on public.projekt_medlemmer for insert to authenticated
  with check ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)));
create policy "ret medlemmer" on public.projekt_medlemmer for update to authenticated
  using ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)))
  with check ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)));
create policy "fjern medlemmer" on public.projekt_medlemmer for delete to authenticated
  using ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)));

-- Projektets materialer: kun projektledere
grant select, insert (projekt_id, materiale_id, navn, stykpris), delete on public.projekt_materialer to authenticated;
create policy "se projektmaterialer" on public.projekt_materialer for select to authenticated
  using ((select private.er_projektleder(projekt_id)));
create policy "tilføj projektmaterialer" on public.projekt_materialer for insert to authenticated
  with check ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)));
create policy "fjern projektmaterialer" on public.projekt_materialer for delete to authenticated
  using ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)));

-- Timer: projektledere alt, medlemmer kun egne
grant select, insert (projekt_id, medlem_id, dato, type, timer, beskrivelse),
  update (medlem_id, dato, type, timer, beskrivelse), delete on public.timer to authenticated;
create policy "se timer" on public.timer for select to authenticated
  using ((select private.er_projektleder(projekt_id)) or (select private.mit_medlem(projekt_id, medlem_id)));
create policy "registrer timer" on public.timer for insert to authenticated
  with check (
    (select private.er_aaben(projekt_id))
    and ((select private.er_projektleder(projekt_id)) or (select private.mit_medlem(projekt_id, medlem_id)))
  );
create policy "ret timer" on public.timer for update to authenticated
  using (
    (select private.er_aaben(projekt_id))
    and ((select private.er_projektleder(projekt_id)) or (select private.mit_medlem(projekt_id, medlem_id)))
  )
  with check (
    (select private.er_aaben(projekt_id))
    and ((select private.er_projektleder(projekt_id)) or (select private.mit_medlem(projekt_id, medlem_id)))
  );
create policy "slet timer" on public.timer for delete to authenticated
  using (
    (select private.er_aaben(projekt_id))
    and ((select private.er_projektleder(projekt_id)) or (select private.mit_medlem(projekt_id, medlem_id)))
  );

-- Materialeregistreringer: kun projektledere
grant select, insert (projekt_id, projekt_materiale_id, dato, antal),
  update (projekt_materiale_id, dato, antal), delete on public.materiale_registreringer to authenticated;
create policy "se materialeregistreringer" on public.materiale_registreringer for select to authenticated
  using ((select private.er_projektleder(projekt_id)));
create policy "registrer materialer" on public.materiale_registreringer for insert to authenticated
  with check ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)));
create policy "ret materialeregistreringer" on public.materiale_registreringer for update to authenticated
  using ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)))
  with check ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)));
create policy "slet materialeregistreringer" on public.materiale_registreringer for delete to authenticated
  using ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)));

-- Noter: projektledere ser alle, medlemmer egne
grant select, insert (projekt_id, dato, tekst), update (dato, tekst), delete on public.noter to authenticated;
create policy "se noter" on public.noter for select to authenticated
  using (oprettet_af = (select auth.uid()) or (select private.er_projektleder(projekt_id)));
create policy "skriv noter" on public.noter for insert to authenticated
  with check (
    oprettet_af = (select auth.uid())
    and (select private.er_medlem(projekt_id)) and (select private.er_aaben(projekt_id))
  );
create policy "ret noter" on public.noter for update to authenticated
  using (
    (select private.er_aaben(projekt_id))
    and (oprettet_af = (select auth.uid()) or (select private.er_projektleder(projekt_id)))
  )
  with check (
    (select private.er_aaben(projekt_id))
    and (oprettet_af = (select auth.uid()) or (select private.er_projektleder(projekt_id)))
  );
create policy "slet noter" on public.noter for delete to authenticated
  using (
    (select private.er_aaben(projekt_id))
    and (oprettet_af = (select auth.uid()) or (select private.er_projektleder(projekt_id)))
  );

-- Rettelser i lønregnskabet: kun projektledere
grant select, insert (projekt_id, medlem_id, beloeb, begrundelse), delete on public.justeringer to authenticated;
create policy "se rettelser" on public.justeringer for select to authenticated
  using ((select private.er_projektleder(projekt_id)));
create policy "opret rettelser" on public.justeringer for insert to authenticated
  with check ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)));
create policy "slet rettelser" on public.justeringer for delete to authenticated
  using ((select private.er_projektleder(projekt_id)) and (select private.er_aaben(projekt_id)));

-- Kvittering og Excel-fil: kun projektledere (må laves efter projektet er afsluttet)
grant select, insert (projekt_id, type, filnavn, sti), delete on public.projekt_filer to authenticated;
create policy "se filer" on public.projekt_filer for select to authenticated
  using ((select private.er_projektleder(projekt_id)));
create policy "gem filer" on public.projekt_filer for insert to authenticated
  with check ((select private.er_projektleder(projekt_id)));
create policy "slet filer" on public.projekt_filer for delete to authenticated
  using ((select private.er_projektleder(projekt_id)));

-- Favoritter: egne
grant select, insert (projekt_id), delete on public.favoritter to authenticated;
create policy "se egne favoritter" on public.favoritter for select to authenticated
  using (bruger_id = (select auth.uid()));
create policy "tilføj favorit" on public.favoritter for insert to authenticated
  with check (bruger_id = (select auth.uid()) and (select private.er_medlem(projekt_id)));
create policy "fjern favorit" on public.favoritter for delete to authenticated
  using (bruger_id = (select auth.uid()));

---------------------------------------------------------------------------
-- Opret projekt i ét hug (kører med kalderens rettigheder)
---------------------------------------------------------------------------

/**
 * p_medlemmer: [{ "person_id": uuid, "overskud_pr_time": øre | null }]
 * Opretteren tilføjes automatisk som projektleder (trigger).
 */
create function public.opret_projekt(p_navn text, p_medlemmer jsonb, p_materialer uuid[])
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.projekter (navn) values (trim(p_navn)) returning id into v_id;

  insert into public.projekt_medlemmer (projekt_id, person_id, navn, timesats, overskud_pr_time)
  select v_id, p.id, p.navn, p.timesats, nullif(x ->> 'overskud_pr_time', '')::integer
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

---------------------------------------------------------------------------
-- Fillager til kvitteringer og Excel-filer: <projekt_id>/<filnavn>
---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('projektfiler', 'projektfiler', false)
on conflict (id) do nothing;

create function private.leder_af_sti(p_navn text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_projekt uuid;
begin
  begin
    v_projekt := (storage.foldername(p_navn))[1]::uuid;
  exception when others then
    return false;
  end;
  return private.er_projektleder(v_projekt);
end;
$$;
revoke execute on function private.leder_af_sti(text) from public, anon;
grant execute on function private.leder_af_sti(text) to authenticated;

create policy "projektledere læser projektfiler" on storage.objects for select to authenticated
  using (bucket_id = 'projektfiler' and private.leder_af_sti(name));
create policy "projektledere gemmer projektfiler" on storage.objects for insert to authenticated
  with check (bucket_id = 'projektfiler' and private.leder_af_sti(name));
create policy "projektledere sletter projektfiler" on storage.objects for delete to authenticated
  using (bucket_id = 'projektfiler' and private.leder_af_sti(name));
