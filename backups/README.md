# PACOTE DE BACKUP INTEGRAL PRÉ-PUBLICAÇÃO
**Clínica Odontológica Dra. Rosângela Santos Pereira**  
**Data do Ponto de Restauração:** 02/11/2026  
**Projeto Supabase de Produção:** `skonxcdojbkbfnfemayz` (sistema-clinica)  
**Branch de Desenvolvimento:** `fix/contrato-assinatura-fluxo-definitivo`  
**Git Tag de Segurança:** `backup-pre-publicacao-contratos-20261102`

---

## 1. BACKUP DO CÓDIGO-FONTE E HISTÓRICO COMPLETO (GIT BUNDLE)

O estado exato de todo o repositório (todas as branches, tags, commits, migrations e scripts) foi empacotado em um arquivo bundle independente:

* **Arquivo:** `backups/codigo/backup_git_bundle_sistema_clinica.bundle` (2.48 MB)
* **Como Restaurar o Código a partir do Bundle:**
  ```bash
  # Para clonar uma nova cópia exata a partir do bundle:
  git clone backups/codigo/backup_git_bundle_sistema_clinica.bundle sistema-clinica-restaurado
  ```

---

## 2. BACKUP DO BANCO DE DADOS (SUPABASE CLI v3.0.0)

Para realizar o dump direto do banco de dados de produção antes de aplicar as migrations:

### Opção A: Execução Automática (Windows)
* Executar com 1 clique o script:  
  `backups\executar_backup_banco.bat`  
  ou via PowerShell:  
  `powershell -ExecutionPolicy Bypass -File backups\executar_backup_banco.ps1`

### Opção B: Comandos Manuais no Terminal
```bash
# 1. Login na CLI (caso ainda não esteja logado):
npx supabase login

# 2. Dump do Schema Completo (tabelas, triggers, RLS, functions):
npx supabase db dump --remote=skonxcdojbkbfnfemayz --schema=public -f backups/db/backup_schema_public.sql

# 3. Dump dos Dados Operacionais (schema public):
npx supabase db dump --remote=skonxcdojbkbfnfemayz --schema=public --data-only --use-copy -f backups/db/backup_data_public.sql

# 4. Dump dos Usuários e Autenticação (schema auth):
npx supabase db dump --remote=skonxcdojbkbfnfemayz --schema=auth --data-only -f backups/db/backup_data_auth.sql

# 5. Dump das Roles e Permissões do Banco:
npx supabase db dump --remote=skonxcdojbkbfnfemayz --role-only -f backups/db/backup_roles.sql
```

---

## 3. BACKUP DOS ARQUIVOS DO STORAGE (PDFs E CONTRATOS)

Para realizar a cópia de segurança dos contratos arquivados no bucket privado `documentos-pacientes`:

```bash
# Executa o script que faz download com cálculo de hash SHA-256:
npx tsx scripts/backup-recuperavel-sistema.ts
```
Os arquivos serão baixados para `backups/storage/contratos/` e catalogados no manifesto.

---

## 4. SCRIPTS DE ROLLBACK RÁPIDO (REVERSÃO SEGURA)

Caso ocorra qualquer divergência durante a publicação, os scripts de reversão já estão preparados na pasta `backups/rollback/`:

* `backups/rollback/rollback_blindagem_seguranca_v3.sql`: reverte as alterações mantendo ativa a proteção compatível de imutabilidade para contratos já formalizados.
* `backups/rollback/rollback_agendamento_reprocessamento_pdf.sql`: remove o agendamento `pg_cron` e funções associadas sem apagar tarefas, contratos ou PDFs.
