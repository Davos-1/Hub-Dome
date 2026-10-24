-- Phase 4h: Quartier eines Hauses frei wählbar («Haus bearbeiten» → Quartier). null = Quartier aus dem Modulcode.
-- RLS: Es gelten die bestehenden Policies der Tabelle houses (nur der Besitzer ändert seine Häuser).
alter table houses add column quarter_override text null
  check (quarter_override in (
    'tragwerk', 'umwelt', 'gebaeude', 'projekt', 'wirtschaft', 'grundlagen', 'sprache', 'digital', 'weitere'
  ));

-- Die Zentrale steht in der Mitte und gehört zu keinem Quartier.
alter table houses add constraint houses_zentrale_ohne_quartier
  check (kind <> 'zentrale' or quarter_override is null);
