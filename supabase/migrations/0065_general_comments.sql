-- Run this manually in the Supabase SQL editor.
--
-- Lets a comment not be tied to any specific intersection ("¿Querés
-- reportar otra cosa?" in the picker popup) — pool_index null means a
-- general comment/suggestion instead of one about a particular corner. The
-- FK stays, just no longer required.

alter table comments alter column pool_index drop not null;
