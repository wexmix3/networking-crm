alter table crm_contacts
  add column if not exists enrichment_status text
  check (enrichment_status in ('pending', 'found', 'not_found'));
