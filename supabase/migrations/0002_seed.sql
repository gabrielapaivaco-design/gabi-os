-- Seed de desenvolvimento: um workspace, os tres cerebros vazios e os 9 pilares.
insert into workspaces (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Gabriela');

insert into brains (workspace_id, kind, content) values
  ('00000000-0000-0000-0000-000000000001','brand','{}'),
  ('00000000-0000-0000-0000-000000000001','business','{}'),
  ('00000000-0000-0000-0000-000000000001','learned','{}');

insert into pillars (workspace_id, name, color, sort) values
  ('00000000-0000-0000-0000-000000000001','Empresa','coral',0),
  ('00000000-0000-0000-0000-000000000001','Marketing','blue',1),
  ('00000000-0000-0000-0000-000000000001','Lifestyle','pink',2),
  ('00000000-0000-0000-0000-000000000001','Looks','rose',3),
  ('00000000-0000-0000-0000-000000000001','Arquitetura','amber',4),
  ('00000000-0000-0000-0000-000000000001','Direito','purple',5),
  ('00000000-0000-0000-0000-000000000001','Rotina','teal',6),
  ('00000000-0000-0000-0000-000000000001','Viagens','green',7),
  ('00000000-0000-0000-0000-000000000001','Imagem','gray',8);
