-- ==============================================================================
-- MOTION TENNIS — MIGRAÇÃO 001: SCHEMA INICIAL POSTGRESQL (SUPABASE)
-- ==============================================================================
-- Descrição: Estrutura relacional cloud para suporte offline-first, perfil do
-- atleta, histórico consolidado, equipamentos, telemetria e catálogo da Academy.
-- Convenções: UUID nativo (gen_random_uuid), TIMESTAMPTZ (UTC), chaves estrangeiras,
-- restrições CHECK rigorosas, índices otimizados e suporte a idempotência.
-- Fonte Oficial: cloud/migrations/001_initial_schema.sql
-- ==============================================================================

-- 1. Habilita extensões necessárias (pgcrypto nativa para UUID e hash criptográfico)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELA: player_profiles
-- ==============================================================================
-- Finalidade: Perfil consolidado do atleta consultável pelo app Android mesmo
-- com o notebook da quadra desligado.
CREATE TABLE IF NOT EXISTS public.player_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar TEXT DEFAULT '🎾',
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    title TEXT NOT NULL DEFAULT 'Iniciante',
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    xp_next INTEGER NOT NULL DEFAULT 250 CHECK (xp_next > 0),
    precision NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (precision >= 0.00 AND precision <= 100.00),
    total_shots INTEGER NOT NULL DEFAULT 0 CHECK (total_shots >= 0),
    total_hits INTEGER NOT NULL DEFAULT 0 CHECK (total_hits >= 0 AND total_hits <= total_shots),
    best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
    avg_score INTEGER NOT NULL DEFAULT 0 CHECK (avg_score >= 0),
    streak_days INTEGER NOT NULL DEFAULT 1 CHECK (streak_days >= 0),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_profiles_user_id ON public.player_profiles (user_id);

-- ==============================================================================
-- 3. TABELA: player_attributes
-- ==============================================================================
-- Finalidade: Espelha os 6 atributos esportivos do atleta para evolução técnica.
CREATE TABLE IF NOT EXISTS public.player_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
    key TEXT NOT NULL CHECK (key IN ('precision', 'consistency', 'speed', 'control', 'reflex', 'strategy')),
    name TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= max_level),
    max_level INTEGER NOT NULL DEFAULT 10 CHECK (max_level >= 1),
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    xp_next INTEGER NOT NULL DEFAULT 1000 CHECK (xp_next > 0),
    objective TEXT,
    strong_points TEXT,
    improvement_points TEXT,
    coach_tip TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_player_attribute UNIQUE (player_id, key)
);

CREATE INDEX IF NOT EXISTS idx_player_attributes_player_id ON public.player_attributes (player_id);

-- ==============================================================================
-- 4. TABELA: equipments
-- ==============================================================================
-- Finalidade: Cadastro institucional dos equipamentos físicos (notebooks da quadra).
CREATE TABLE IF NOT EXISTS public.equipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardware_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location TEXT DEFAULT 'Quadra Principal',
    wall_preset TEXT NOT NULL DEFAULT '3x2' CHECK (wall_preset IN ('3x2', '3x3', '4x3', 'custom')),
    wall_width_m NUMERIC(4, 2) NOT NULL DEFAULT 3.00 CHECK (wall_width_m > 0),
    wall_height_m NUMERIC(4, 2) NOT NULL DEFAULT 2.00 CHECK (wall_height_m > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    app_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipments_code ON public.equipments (hardware_code);

-- ==============================================================================
-- 5. TABELA: equipment_secrets
-- ==============================================================================
-- Finalidade: Armazenamento estritamente isolado do hash da credencial individual do notebook.
-- NUNCA exposta para clientes web ou mobile. Acesso reservado a funções de backend confiáveis.
CREATE TABLE IF NOT EXISTS public.equipment_secrets (
    equipment_id UUID PRIMARY KEY REFERENCES public.equipments(id) ON DELETE CASCADE,
    key_prefix TEXT NOT NULL DEFAULT 'mt_eq_',
    api_key_hash TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    locked_until TIMESTAMPTZ,
    rotated_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. TABELA: equipment_heartbeats
-- ==============================================================================
-- Finalidade: Série temporal de telemetria a cada 60s para cálculo de status online/offline.
CREATE TABLE IF NOT EXISTS public.equipment_heartbeats (
    id BIGSERIAL PRIMARY KEY,
    equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_ip TEXT,
    ping_ms INTEGER CHECK (ping_ms >= 0),
    pending_outbox_count INTEGER DEFAULT 0 CHECK (pending_outbox_count >= 0),
    db_integrity_ok BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_eq_date ON public.equipment_heartbeats (equipment_id, reported_at DESC);

-- ==============================================================================
-- 7. TABELA: equipment_pairings
-- ==============================================================================
-- Finalidade: Gerencia o vínculo seguro entre smartphone do atleta e um notebook específico.
CREATE TABLE IF NOT EXISTS public.equipment_pairings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
    pairing_role TEXT NOT NULL DEFAULT 'athlete' CHECK (pairing_role IN ('athlete', 'operator')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    pairing_code_hash TEXT,
    expires_at TIMESTAMPTZ,
    paired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_user_equipment UNIQUE (user_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_pairings_user ON public.equipment_pairings (user_id);
CREATE INDEX IF NOT EXISTS idx_pairings_equipment ON public.equipment_pairings (equipment_id);

-- ==============================================================================
-- 8. TABELA: synced_sessions
-- ==============================================================================
-- Finalidade: Partidas finalizadas imutáveis sincronizadas pelo notebook.
-- IDEMPOTÊNCIA: UNIQUE(equipment_id, local_session_id) impede partidas duplicadas.
-- POLÍTICA DE RETENÇÃO: ON DELETE RESTRICT no equipment_id impede que a exclusão
-- de um equipamento destrua o histórico físico de partidas realizadas.
CREATE TABLE IF NOT EXISTS public.synced_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE RESTRICT,
    local_session_id TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('free', 'single', 'clear_all')),
    shots_count INTEGER NOT NULL DEFAULT 0 CHECK (shots_count >= 0),
    hits_count INTEGER NOT NULL DEFAULT 0 CHECK (hits_count >= 0 AND hits_count <= shots_count),
    accuracy NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (accuracy >= 0.00 AND accuracy <= 100.00),
    total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score >= 0),
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    reactivations INTEGER NOT NULL DEFAULT 0 CHECK (reactivations >= 0),
    is_simulation BOOLEAN NOT NULL DEFAULT FALSE,
    wall_preset TEXT NOT NULL DEFAULT '3x2',
    wall_dimensions_json JSONB,
    sector_distribution_json JSONB,
    xp_granted INTEGER NOT NULL DEFAULT 0 CHECK (xp_granted >= 0),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_equipment_local_session UNIQUE (equipment_id, local_session_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON public.synced_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_equipment ON public.synced_sessions (equipment_id);

-- ==============================================================================
-- 9. TABELA: synced_shots
-- ==============================================================================
-- Finalidade: Impactos para reconstrução de mapas de calor e precisão gráfica no mobile.
CREATE TABLE IF NOT EXISTS public.synced_shots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.synced_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    x NUMERIC(5, 3) NOT NULL CHECK (x >= 0.000 AND x <= 1.000),
    y NUMERIC(5, 3) NOT NULL CHECK (y >= 0.000 AND y <= 1.000),
    sector_id INTEGER CHECK (sector_id >= 0 AND sector_id <= 6),
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
    force_kmh NUMERIC(5, 2) DEFAULT 80.00 CHECK (force_kmh >= 0),
    is_hit BOOLEAN NOT NULL DEFAULT TRUE,
    is_bullseye BOOLEAN NOT NULL DEFAULT FALSE,
    shot_time_offset_ms INTEGER CHECK (shot_time_offset_ms >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shots_session ON public.synced_shots (session_id);
CREATE INDEX IF NOT EXISTS idx_shots_user ON public.synced_shots (user_id);

-- ==============================================================================
-- 10. TABELA: player_achievements
-- ==============================================================================
-- Finalidade: Conquistas gamificadas desbloqueadas pelo atleta.
CREATE TABLE IF NOT EXISTS public.player_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT DEFAULT '🏆',
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    progress INTEGER NOT NULL DEFAULT 1 CHECK (progress >= 0),
    target INTEGER NOT NULL DEFAULT 1 CHECK (target >= 1),
    xp_reward INTEGER NOT NULL DEFAULT 200 CHECK (xp_reward >= 0),
    CONSTRAINT unq_user_achievement UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user ON public.player_achievements (user_id);

-- ==============================================================================
-- 11. TABELA: academy_lessons
-- ==============================================================================
-- Finalidade: Catálogo público 100% gratuito de videoaulas da Motion Tennis Academy.
-- REGRAS DE INTEGRIDADE:
-- 1. Aulas não gravadas/rascunhos permanecem privados (is_published = FALSE).
-- 2. Vídeo do YouTube é opcional em rascunho, mas OBRIGATÓRIO quando is_published = TRUE.
-- 3. Nenhuma aula pode ser publicada com links ou IDs vazios/fictícios.
CREATE TABLE IF NOT EXISTS public.academy_lessons (
    id TEXT PRIMARY KEY,
    module_key TEXT NOT NULL CHECK (module_key IN ('precision', 'consistency', 'speed', 'control', 'reflex', 'strategy')),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    instructor TEXT DEFAULT '',
    level TEXT NOT NULL DEFAULT 'Iniciante' CHECK (level IN ('Iniciante', 'Intermediário', 'Avançado')),
    duration TEXT DEFAULT '5 min',
    youtube_video_id TEXT CHECK (youtube_video_id IS NULL OR length(youtube_video_id) = 11),
    youtube_url TEXT,
    embed_url TEXT,
    thumbnail_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'VÍDEO EM BREVE')),
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_published_requires_video CHECK (
        NOT (is_published = TRUE) OR (
            youtube_video_id IS NOT NULL AND 
            youtube_url IS NOT NULL AND 
            embed_url IS NOT NULL AND
            status = 'published'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_academy_published ON public.academy_lessons (is_published, display_order);

-- ==============================================================================
-- 12. TABELA: academy_progress
-- ==============================================================================
-- Finalidade: Registro de conclusão de videoaulas por atleta autenticado.
CREATE TABLE IF NOT EXISTS public.academy_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT TRUE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_user_lesson UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_progress_user ON public.academy_progress (user_id);

-- ==============================================================================
-- 13. TABELA: sync_checkpoints
-- ==============================================================================
-- Finalidade: Registro de controle de sincronização para garantir processamento
-- idempotente (exactly-once) de cada lote/evento enviado pelo notebook.
CREATE TABLE IF NOT EXISTS public.sync_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('SESSION', 'SHOTS', 'ACHIEVEMENT', 'ACADEMY_PROGRESS', 'HEARTBEAT')),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'DUPLICATE_IGNORED', 'FAILED')),
    details_json JSONB,
    CONSTRAINT unq_equipment_event UNIQUE (equipment_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_lookup ON public.sync_checkpoints (equipment_id, event_id);
