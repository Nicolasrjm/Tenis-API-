# MOTION TENNIS — FUNDAÇÃO CLOUD COM SUPABASE & POSTGRESQL (FASE 7B.1 REVISADA)

Este repositório contém a fundação técnica da infraestrutura em nuvem do **Motion Tennis**, corrigida e auditada conforme os requisitos de segurança e governança da **Fase 7B.1**.

---

## 1. Princípios de Segurança e Governança

1. **Autonomia Local e Resiliência Física (Offline-First):**
   - O notebook da quadra opera **100% de forma autônoma** via SQLite local (`smart_tennis.db`).
   - Os sensores KY-037, a ponte Python, o cálculo de localização, a pontuação, o cronômetro e os 3 modos de jogo **não dependem de conexão com a internet** para iniciar, pontuar ou concluir treinos.
   - Nenhuma falha na nuvem bloqueia o loop de jogo em tempo real.

2. **Eliminação do `service_role` nos Notebooks de Quadra:**
   - **NENHUM notebook físico recebe a chave mestra `service_role`.**
   - Cada equipamento possui credencial individual revogável (`EQUIPMENT_ID` e `EQUIPMENT_API_KEY`).
   - A sincronização de partidas e telemetria passa por RPCs seguras com `SECURITY DEFINER` (`sync_equipment_session_v1` e `record_equipment_heartbeat_v1`) que validam o hash da chave, protegem contra ataques de força bruta (bloqueio temporário após 5 erros) e checam status de revogação.
   - Em caso de roubo ou comprometimento físico de um notebook, o administrador revoga apenas aquela quadra específica com um comando SQL sem afetar o resto da rede.

3. **Academy com Rascunhos Protegidos (Zero Vídeos Fictícios):**
   - O catálogo da Academy possui seus 18 slots estruturados como rascunho (`is_published = FALSE`, `status = 'VÍDEO EM BREVE'`).
   - A restrição relacional `chk_published_requires_video` impede que qualquer aula seja marcada como publicada sem um vídeo válido do YouTube.
   - O seed é idempotente e preserva o status e vídeos aprovados por administradores.

4. **Blindagem de XP e Idempotência Rigorosa:**
   - A restrição `UNIQUE (equipment_id, local_session_id)` e a tabela `sync_checkpoints` garantem que partidas reenviadas por oscilação de rede sejam reconhecidas e nunca multipliquem pontuações ou XP.
   - O gatilho `protect_player_profile_fields` bloqueia tentativas de atletas autenticados de alterar XP, nível ou métricas esportivas diretamente pelo aplicativo.

5. **Status de Equipamento Temporal:**
   - O status online/offline é calculado dinamicamente pela função `is_equipment_online(UUID)` avaliando se o último ping em `equipment_heartbeats` ocorreu dentro de 150 segundos.

---

## 2. Estrutura do Diretório e Fonte Canônica de Migrações

```
cloud/
├── contracts/
│   ├── equipment_heartbeat.json        # Contrato de telemetria periódica (60s)
│   ├── match_finished_event.json       # Contrato de partida finalizada (Outbox)
│   └── pairing_claim_request.json      # Contrato de pareamento via QR Code
├── env.example                         # Template seguro para notebooks e ambiente local
├── examples/
│   ├── seed_academy_catalog.sql        # Carga idempotente dos 18 slots da Academy (Rascunhos)
│   └── supabase_client_sample.js       # Exemplo de cliente Node.js com RPC de equipamento
├── migrations/                         # FONTE CANÔNICA DE MIGRAÇÕES
│   ├── 001_initial_schema.sql          # DDL das 12 tabelas, constraints e integridade
│   ├── 002_row_level_security.sql      # Habilitação de RLS e gatilho de proteção de campos
│   └── 003_functions_and_triggers.sql  # RPCs seguras de equipamento, 150s e reconciliação
├── policies/
│   └── RLS_SECURITY_MATRIX.md          # Matriz formal de permissões revisada
├── README.md                           # Guia oficial de implantação e operação
└── tests/
    └── test_cloud_foundation.js        # Suíte de validação automatizada e auditoria
```

> **IMPORTANTE — FONTE CANÔNICA ÚNICA:**
> A pasta `cloud/migrations/` é a **fonte oficial canônica** para execução de migrações.
> A pasta `supabase/migrations/` contém cópias espelhadas geradas exclusivamente para ferramentas que exigem convenção timestamp do Supabase CLI.
> **ATENÇÃO:** Nunca execute os dois diretórios no mesmo banco de dados para evitar conflitos! Escolha apenas um fluxo (SQL Editor web ou Supabase CLI).

---

## 3. Passo a Passo: Implantação no Supabase (Gratuito)

### Passo 1: Criar o Projeto no Supabase
1. Acesse [https://supabase.com](https://supabase.com) com a conta pessoal do responsável.
2. Clique em **"New project"**.
3. Selecione:
   - **Name:** `Motion Tennis Cloud`
   - **Database Password:** Escolha uma senha forte e armazene com segurança.
   - **Region:** `South America (São Paulo) - sa-east-1` (menor latência com as quadras).
   - **Plan:** `Free tier`.
4. Aguarde a finalização da criação.

### Passo 2: Executar as Migrações SQL
No menu lateral do painel Supabase:
1. Acesse o **SQL Editor**.
2. Clique em **New query**.
3. Cole e execute sequencialmente os arquivos de `cloud/migrations/`:
   - **1º:** Conteúdo de `001_initial_schema.sql` -> Clique em **Run**.
   - **2º:** Conteúdo de `002_row_level_security.sql` -> Clique em **Run**.
   - **3º:** Conteúdo de `003_functions_and_triggers.sql` -> Clique em **Run**.
   - **4º (Opcional - Catálogo Base):** Conteúdo de `cloud/examples/seed_academy_catalog.sql` -> Clique em **Run**.
4. No menu lateral, acesse **Table Editor** e verifique as 12 tabelas criadas com os escudos de **RLS Enabled**.

### Passo 3: Cadastrar o Primeiro Equipamento da Quadra
No **SQL Editor**, cadastre o notebook e gere o hash de sua credencial individual:
```sql
-- 1. Insere a quadra física
INSERT INTO public.equipments (id, hardware_code, name, location, wall_preset)
VALUES ('a0000000-0000-0000-0000-000000000001', 'COURT_NOTEBOOK_01', 'Quadra Principal', 'FECAP', '3x2');

-- 2. Insere a credencial (exemplo com hash SHA-256 de 'minha_chave_secreta_quadra_1')
INSERT INTO public.equipment_secrets (equipment_id, key_prefix, api_key_hash)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'mt_eq_',
    encode(digest('minha_chave_secreta_quadra_1', 'sha256'), 'hex')
);
```

### Passo 4: Configurar o Notebook da Quadra
No notebook físico da quadra, configure o `.env.local`:
```bash
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EQUIPMENT_ID=a0000000-0000-0000-0000-000000000001
EQUIPMENT_API_KEY=minha_chave_secreta_quadra_1
EQUIPMENT_HARDWARE_CODE=COURT_NOTEBOOK_01
```

---

## 4. O que foi Validado vs O que Permanece Pendente

- **VALIDADO COM SUCESSO (Testes Automatizados Locais):**
  - Conformidade estática completa de todo o schema PostgreSQL e convenções de nomes.
  - Verificação de políticas de RLS e ausência de SELECT público em credenciais.
  - Preservação da integridade do banco SQLite local `smart_tennis.db` (todas as tabelas intactas).
  - Garantia de que a Academy não possui vídeos fictícios e preserva rascunhos.
  - Zero exposição de chaves `service_role` nos modelos e no cliente de equipamento.
  - Conformidade dos contratos JSON e integridade de espelhamento entre migrações.

- **PENDÊNCIAS PARA A PRIMEIRA IMPLANTAÇÃO CONTROLADA (Ambiente Remoto):**
  - Criação do projeto remoto pelo responsável no painel Supabase.
  - Execução das migrações no banco PostgreSQL remoto ativo.
  - Teste de integração ponta a ponta simulando envio de partida via RPC a partir do notebook da quadra conectado à internet.
  - Cadastro de usuários reais no Supabase Auth.
