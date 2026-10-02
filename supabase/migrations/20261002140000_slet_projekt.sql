-- Opretteren kan slette sit projekt. Alt der hører til projektet slettes med
-- (cascade). Filerne i fillageret slettes af appen før projektet.

-- RESTRICT tjekkes med det samme og kan blokere sletningen, alt efter hvilken
-- rækkefølge cascade sletter i. NO ACTION tjekkes først til sidst i sætningen,
-- så et materiale med registreringer stadig ikke kan fjernes alene.
alter table public.materiale_registreringer
  drop constraint materiale_registreringer_projekt_id_projekt_materiale_id_fkey,
  add constraint materiale_registreringer_projekt_id_projekt_materiale_id_fkey
    foreign key (projekt_id, projekt_materiale_id)
    references public.projekt_materialer (projekt_id, id) on delete no action;

grant delete on public.projekter to authenticated;
create policy "opretter sletter projekt" on public.projekter for delete to authenticated
  using (oprettet_af = (select auth.uid()));
