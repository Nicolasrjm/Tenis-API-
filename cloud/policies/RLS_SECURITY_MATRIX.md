# MOTION TENNIS — MATRIZ DE SEGURANÇA E ROW LEVEL SECURITY (RLS) (REVISADA FASE 7B.1)

Este documento estabelece as regras de controle de acesso (Least Privilege) e as garantias de integridade da infraestrutura PostgreSQL no Supabase.

---

## 1. Perfis de Acesso (Roles) e Credenciais

| Role | Identificação | Descrição e Contexto de Uso |
| :--- | :--- | :--- |
| **`anon`** | `auth.role() = 'anon'` | Visitante não autenticado (app mobile antes do login ou site institucional). |
| **`authenticated_athlete`** | `auth.role() = 'authenticated'` | Atleta devidamente autenticado via Supabase Auth (possui `auth.uid()`). |
| **`equipment_notebook`** | Chave individual revogável (`EQUIPMENT_API_KEY`) via RPC segura | Notebook físico na quadra. **NÃO possui service_role.** Autentica-se por hash SHA-256 via RPC `SECURITY DEFINER`. |
| **`service_role` (Admin)** | Chave privada mestre do Supabase | **EXCLUSIVA** para scripts de migração e manutenção do administrador. **NUNCA** distribuída a hardwares de quadra. |

---

## 2. Matriz de Permissões por Tabela

| Tabela | anon | authenticated_athlete | equipment_notebook (via RPC) | service_role (Admin) | Mecanismo de Proteção |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `player_profiles` | ❌ Bloqueado | **SELECT** (próprio `user_id`),<br>**UPDATE** (apenas `display_name` e `avatar`) | ❌ Sem acesso direto | **FULL** | **Gatilho `protect_player_profile_fields`:** Lança exceção se cliente tentar alterar XP, nível ou scores. |
| `player_attributes` | ❌ Bloqueado | **SELECT** (próprio atleta) | ❌ Sem acesso direto | **FULL** | Leitura dos 6 atributos esportivos; escrita exclusiva de rotinas seguras. |
| `equipments` | **SELECT** (`is_active = TRUE`) | **SELECT** (`is_active = TRUE`) | **SELECT / UPDATE** (telemetria própria) | **FULL** | Lista pública de quadras para pareamento; dados sensíveis não expostos. |
| `equipment_secrets` | ❌ **BLOQUEIO TOTAL** | ❌ **BLOQUEIO TOTAL** | ❌ Acesso interno à RPC | **FULL** | **SEGURANÇA MÁXIMA:** Hashes de credenciais e controle de tentativas falhas inacessíveis a clientes. |
| `equipment_heartbeats`| ❌ Bloqueado | ❌ Bloqueado | **INSERT** (via RPC) | **FULL** | Série temporal de pings a cada 60s para cálculo dinâmico de status online. |
| `equipment_pairings` | ❌ Bloqueado | **FULL** (`pairing_role = 'athlete'`) | ❌ Sem acesso direto | **FULL** | Atleta pode parear smartphone à quadra. Restrição CHECK impede elevação a 'operator'. |
| `synced_sessions` | ❌ Bloqueado | **SELECT** (próprio `user_id`) | **INSERT** (via RPC com idempotência) | **FULL** | **IMUTÁVEL:** Partidas não podem ser forjadas, alteradas ou deletadas pelo app mobile. |
| `synced_shots` | ❌ Bloqueado | **SELECT** (próprio `user_id`) | **INSERT** (via RPC com a sessão) | **FULL** | Impactos detalhados e mapa de calor do atleta. |
| `player_achievements`| ❌ Bloqueado | **SELECT** (próprio `user_id`) | ❌ Sem acesso direto | **FULL** | Conquistas desbloqueadas gravadas unicamente por procedimentos seguros. |
| `academy_lessons` | **SELECT** (`published`) | **SELECT** (`published`) | ❌ Sem acesso direto | **FULL** | **100% GRATUITA:** Qualquer visitante lê aulas publicadas. Rascunhos permanecem privados. |
| `academy_progress` | ❌ Bloqueado | **FULL** (próprio `user_id`) | ❌ Sem acesso direto | **FULL** | Atleta rastreia suas próprias aulas concluídas. |
| `sync_checkpoints` | ❌ Bloqueado | ❌ Bloqueado | **INSERT, SELECT** (via RPC) | **FULL** | Controle interno de idempotência *exactly-once*. |

---

## 3. Diretrizes de Segurança e Imutabilidade

1. **Eliminação da Dependência de `service_role` no Notebook:**
   - O notebook físico na quadra utiliza a chave pública anônima padrão do Supabase mais sua credencial individual (`EQUIPMENT_ID` e `EQUIPMENT_API_KEY`).
   - As operações de gravação ocorrem via RPC segura (`sync_equipment_session_v1` e `record_equipment_heartbeat_v1`).
   - Se o hardware for roubado ou inspecionado, o invasor NÃO tem acesso à chave `service_role` mestre do projeto. A credencial daquela quadra pode ser revogada instantaneamente no painel com `UPDATE equipments SET is_active = FALSE, revoked_at = NOW() WHERE id = '...'`.

2. **Proteção contra Forjamento de XP e Níveis:**
   - O aplicativo móvel não tem permissão de UPDATE nos campos de estatística do atleta. O gatilho `protect_player_profile_fields()` impede qualquer mutação arbitrária em `xp`, `level`, `title`, `precision`, `total_shots`, `total_hits`, etc.
   - Partidas inseridas pelo notebook são transacionais e atômicas: a sessão, os tiros e o checkpoint são gravados no mesmo bloco.

3. **Academy com Rascunhos Seguros e Publicação Auditada:**
   - O seed inicial não publica nenhuma aula fictícia. Todos os 18 slots iniciam com `is_published = FALSE` e `status = 'VÍDEO EM BREVE'`.
   - A restrição `chk_published_requires_video` garante que uma aula jamais possa ser publicada sem um ID real de YouTube de 11 caracteres.

4. **Blindagem contra Ataques de Repetição (Replay):**
   - O checkpoint de sincronização valida `UNIQUE (equipment_id, event_id)` e `UNIQUE (equipment_id, local_session_id)`. Se o mesmo evento for reenviado por oscilação de rede, o PostgreSQL retorna confirmação imediata sem reprocessar dados ou re-conceder XP.
