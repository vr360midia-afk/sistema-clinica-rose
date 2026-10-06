-- Tabelas de configurações e entidades auxiliares para o funcionamento completo do sistema

-- CONFIGURAÇÕES GERAIS
create table if not exists public.configuracoes (
  user_id uuid references auth.users on delete cascade primary key,
  nome_clinica text,
  logo_url text,
  cnpj text,
  endereco text,
  telefone text,
  whatsapp_numero text,
  email text,
  email_notificacoes boolean default true,
  whatsapp_lembretes boolean default true,
  lembrete_24h boolean default true,
  lembrete_2h boolean default true,
  backup_automatico boolean default true,
  frequencia_backup text default 'diario',
  criado_em timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now()
);
alter table public.configuracoes enable row level security;
drop policy if exists "Configuracoes RLS" on public.configuracoes;
create policy "Configuracoes RLS" on public.configuracoes for all using (public.clinica_id() = user_id);

-- DENTISTAS
create table if not exists public.dentistas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  nome text not null,
  cro text,
  especialidade text,
  telefone text,
  email text,
  ativo boolean default true,
  criado_em timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now()
);
alter table public.dentistas enable row level security;
drop policy if exists "Dentistas RLS" on public.dentistas;
create policy "Dentistas RLS" on public.dentistas for all using (public.clinica_id() = user_id);

-- PARCEIROS
create table if not exists public.parceiros (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  nome text not null,
  especialidade text,
  telefone text,
  email text,
  tipo_repasse text,
  valor_repasse numeric,
  observacoes text,
  ativo boolean default true,
  criado_em timestamp with time zone default now()
);
alter table public.parceiros enable row level security;
drop policy if exists "Parceiros RLS" on public.parceiros;
create policy "Parceiros RLS" on public.parceiros for all using (public.clinica_id() = user_id);

-- MEDICAMENTOS
create table if not exists public.medicamentos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  nome text not null,
  principio_ativo text,
  apresentacao text,
  dosagem text,
  posologia text,
  periodo text,
  quantidade text,
  observacoes text,
  ativo boolean default true,
  criado_em timestamp with time zone default now()
);
alter table public.medicamentos enable row level security;
drop policy if exists "Medicamentos RLS" on public.medicamentos;
create policy "Medicamentos RLS" on public.medicamentos for all using (public.clinica_id() = user_id);

-- CERTIFICADOS DIGITAIS
create table if not exists public.certificados_digitais (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  provedor text,
  ambiente text,
  titular_nome text,
  titular_cpf text,
  client_id text,
  client_secret text,
  ativo boolean default true,
  criado_em timestamp with time zone default now()
);
alter table public.certificados_digitais enable row level security;
drop policy if exists "Certificados RLS" on public.certificados_digitais;
create policy "Certificados RLS" on public.certificados_digitais for all using (public.clinica_id() = user_id);

-- USER ROLES E EQUIPE
create table if not exists public.user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  role text,
  criado_em timestamp with time zone default now()
);
alter table public.user_roles enable row level security;
drop policy if exists "Roles RLS" on public.user_roles;
create policy "Roles RLS" on public.user_roles for all using (public.clinica_id() = user_id);

NOTIFY pgrst, 'reload schema';
