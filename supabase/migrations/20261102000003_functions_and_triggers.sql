-- ==============================================================================
-- MOTION TENNIS — MIGRAÇÃO 003: FUNÇÕES, GATILHOS E APIS (SUPABASE CLI MIRROR)
-- ==============================================================================
-- ATENÇÃO: FONTE CANÔNICA EM: cloud/migrations/003_functions_and_triggers.sql
-- Este arquivo é um espelho para compatibilidade nativa com o Supabase CLI.
-- NÃO execute este arquivo se já tiver executado cloud/migrations/003_functions_and_triggers.sql.
-- ==============================================================================

-- 1. FUNÇÃO DE GATILHO: Atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_player_profiles_updated_at ON public.player_profiles;
CREATE TRIGGER trg_player_profiles_updated_at
    BEFORE UPDATE ON public.player_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_player_attributes_updated_at ON public.player_attributes;
CREATE TRIGGER trg_player_attributes_updated_at
    BEFORE UPDATE ON public.player_attributes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_equipments_updated_at ON public.equipments;
CREATE TRIGGER trg_equipments_updated_at
    BEFORE UPDATE ON public.equipments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_equipment_secrets_updated_at ON public.equipment_secrets;
CREATE TRIGGER trg_equipment_secrets_updated_at
    BEFORE UPDATE ON public.equipment_secrets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_academy_lessons_updated_at ON public.academy_lessons;
CREATE TRIGGER trg_academy_lessons_updated_at
    BEFORE UPDATE ON public.academy_lessons
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 2. FUNÇÃO: is_equipment_online(UUID)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_equipment_online(p_equipment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_active BOOLEAN;
    v_revoked TIMESTAMPTZ;
    v_last_hb TIMESTAMPTZ;
BEGIN
    SELECT is_active, revoked_at, last_heartbeat_at
    INTO v_active, v_revoked, v_last_hb
    FROM public.equipments
    WHERE id = p_equipment_id;

    IF NOT FOUND OR v_active IS NOT TRUE OR v_revoked IS NOT NULL OR v_last_hb IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN (v_last_hb >= NOW() - INTERVAL '150 seconds');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ==============================================================================
-- 3. AUTENTICAÇÃO E INGESTÃO DE TELEMETRIA POR EQUIPAMENTO
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_equipment_heartbeat_v1(
    p_equipment_id UUID,
    p_api_key TEXT,
    p_heartbeat JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_active BOOLEAN;
    v_revoked TIMESTAMPTZ;
    v_stored_hash TEXT;
    v_failed INTEGER;
    v_locked_until TIMESTAMPTZ;
    v_computed_hash TEXT;
BEGIN
    SELECT e.is_active, e.revoked_at, s.api_key_hash, s.failed_attempts, s.locked_until
    INTO v_active, v_revoked, v_stored_hash, v_failed, v_locked_until
    FROM public.equipments e
    JOIN public.equipment_secrets s ON s.equipment_id = e.id
    WHERE e.id = p_equipment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'EQUIPMENT_NOT_FOUND');
    END IF;

    IF v_active IS NOT TRUE OR v_revoked IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'EQUIPMENT_REVOKED');
    END IF;

    IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'EQUIPMENT_TEMPORARILY_LOCKED');
    END IF;

    v_computed_hash := encode(digest(p_api_key, 'sha256'), 'hex');
    IF v_computed_hash <> v_stored_hash THEN
        UPDATE public.equipment_secrets
        SET 
            failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
            updated_at = NOW()
        WHERE equipment_id = p_equipment_id;

        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
    END IF;

    IF v_failed > 0 THEN
        UPDATE public.equipment_secrets SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
        WHERE equipment_id = p_equipment_id;
    END IF;

    INSERT INTO public.equipment_heartbeats (
        equipment_id,
        reported_at,
        client_ip,
        ping_ms,
        pending_outbox_count,
        db_integrity_ok
    ) VALUES (
        p_equipment_id,
        NOW(),
        p_heartbeat->>'client_ip',
        COALESCE((p_heartbeat->>'ping_ms')::INTEGER, 0),
        COALESCE((p_heartbeat->>'pending_outbox_count')::INTEGER, 0),
        COALESCE((p_heartbeat->>'db_integrity_ok')::BOOLEAN, TRUE)
    );

    UPDATE public.equipments
    SET 
        last_heartbeat_at = NOW(),
        app_version = COALESCE(p_heartbeat->>'app_version', app_version),
        updated_at = NOW()
    WHERE id = p_equipment_id;

    RETURN jsonb_build_object('success', true, 'timestamp', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ==============================================================================
-- 4. AUTENTICAÇÃO E SINCRONIZAÇÃO IDEMPOTENTE DE PARTIDAS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.sync_equipment_session_v1(
    p_equipment_id UUID,
    p_api_key TEXT,
    p_event JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_active BOOLEAN;
    v_revoked TIMESTAMPTZ;
    v_stored_hash TEXT;
    v_failed INTEGER;
    v_locked_until TIMESTAMPTZ;
    v_computed_hash TEXT;
    
    v_event_id TEXT;
    v_local_session_id TEXT;
    v_user_id UUID;
    v_session_uuid UUID;
    v_payload JSONB;
    v_shots JSONB;
    v_shot JSONB;
    v_event_time TIMESTAMPTZ;
BEGIN
    SELECT e.is_active, e.revoked_at, s.api_key_hash, s.failed_attempts, s.locked_until
    INTO v_active, v_revoked, v_stored_hash, v_failed, v_locked_until
    FROM public.equipments e
    JOIN public.equipment_secrets s ON s.equipment_id = e.id
    WHERE e.id = p_equipment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'EQUIPMENT_NOT_FOUND');
    END IF;

    IF v_active IS NOT TRUE OR v_revoked IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'EQUIPMENT_REVOKED');
    END IF;

    IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'EQUIPMENT_TEMPORARILY_LOCKED');
    END IF;

    v_computed_hash := encode(digest(p_api_key, 'sha256'), 'hex');
    IF v_computed_hash <> v_stored_hash THEN
        UPDATE public.equipment_secrets
        SET 
            failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
            updated_at = NOW()
        WHERE equipment_id = p_equipment_id;

        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
    END IF;

    IF v_failed > 0 THEN
        UPDATE public.equipment_secrets SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
        WHERE equipment_id = p_equipment_id;
    END IF;

    v_event_id := p_event->>'event_id';
    v_event_time := (p_event->>'timestamp')::TIMESTAMPTZ;
    v_payload := p_event->'payload';

    IF v_event_id IS NULL OR v_payload IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_EVENT_STRUCTURE');
    END IF;

    v_local_session_id := v_payload->>'local_session_id';
    v_user_id := (v_payload->>'user_id')::UUID;

    IF EXISTS (SELECT 1 FROM public.sync_checkpoints WHERE equipment_id = p_equipment_id AND event_id = v_event_id) THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'DUPLICATE_EVENT_IGNORED',
            'idempotent', true,
            'event_id', v_event_id
        );
    END IF;

    SELECT id INTO v_session_uuid 
    FROM public.synced_sessions 
    WHERE equipment_id = p_equipment_id AND local_session_id = v_local_session_id;

    IF FOUND THEN
        INSERT INTO public.sync_checkpoints (equipment_id, batch_id, event_id, entity_type, status, details_json)
        VALUES (p_equipment_id, COALESCE(p_event->>'batch_id', 'single'), v_event_id, 'SESSION', 'DUPLICATE_IGNORED', jsonb_build_object('existing_session_id', v_session_uuid));

        RETURN jsonb_build_object(
            'success', true,
            'status', 'SESSION_ALREADY_EXISTS',
            'idempotent', true,
            'session_id', v_session_uuid
        );
    END IF;

    v_session_uuid := gen_random_uuid();
    INSERT INTO public.synced_sessions (
        id,
        user_id,
        equipment_id,
        local_session_id,
        mode,
        shots_count,
        hits_count,
        accuracy,
        total_score,
        duration_seconds,
        reactivations,
        is_simulation,
        wall_preset,
        wall_dimensions_json,
        sector_distribution_json,
        xp_granted,
        started_at,
        ended_at,
        synced_at
    ) VALUES (
        v_session_uuid,
        v_user_id,
        p_equipment_id,
        v_local_session_id,
        v_payload->>'mode',
        COALESCE((v_payload->>'shots_count')::INTEGER, 0),
        COALESCE((v_payload->>'hits_count')::INTEGER, 0),
        COALESCE((v_payload->>'accuracy')::NUMERIC, 0.00),
        COALESCE((v_payload->>'total_score')::INTEGER, 0),
        COALESCE((v_payload->>'duration_seconds')::INTEGER, 0),
        COALESCE((v_payload->>'reactivations')::INTEGER, 0),
        COALESCE((v_payload->>'is_simulation')::BOOLEAN, FALSE),
        COALESCE(v_payload->>'wall_preset', '3x2'),
        v_payload->'wall_dimensions_json',
        v_payload->'sector_distribution_json',
        COALESCE((v_payload->>'xp_granted')::INTEGER, 0),
        (v_payload->>'started_at')::TIMESTAMPTZ,
        (v_payload->>'ended_at')::TIMESTAMPTZ,
        NOW()
    );

    v_shots := v_payload->'shots';
    IF v_shots IS NOT NULL AND jsonb_array_length(v_shots) > 0 THEN
        FOR v_shot IN SELECT * FROM jsonb_array_elements(v_shots) LOOP
            INSERT INTO public.synced_shots (
                session_id,
                user_id,
                x,
                y,
                sector_id,
                score,
                force_kmh,
                is_hit,
                is_bullseye,
                shot_time_offset_ms
            ) VALUES (
                v_session_uuid,
                v_user_id,
                (v_shot->>'x')::NUMERIC,
                (v_shot->>'y')::NUMERIC,
                (v_shot->>'sector_id')::INTEGER,
                COALESCE((v_shot->>'score')::INTEGER, 0),
                COALESCE((v_shot->>'force_kmh')::NUMERIC, 80.00),
                COALESCE((v_shot->>'is_hit')::BOOLEAN, TRUE),
                COALESCE((v_shot->>'is_bullseye')::BOOLEAN, FALSE),
                (v_shot->>'shot_time_offset_ms')::INTEGER
            );
        END LOOP;
    END IF;

    INSERT INTO public.sync_checkpoints (
        equipment_id,
        batch_id,
        event_id,
        entity_type,
        status,
        details_json
    ) VALUES (
        p_equipment_id,
        COALESCE(p_event->>'batch_id', 'single'),
        v_event_id,
        'SESSION',
        'SUCCESS',
        jsonb_build_object('session_id', v_session_uuid, 'shots_count', COALESCE((v_payload->>'shots_count')::INTEGER, 0))
    );

    UPDATE public.equipments
    SET 
        last_sync_at = NOW(),
        last_heartbeat_at = NOW(),
        updated_at = NOW()
    WHERE id = p_equipment_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'SUCCESS',
        'idempotent', false,
        'session_id', v_session_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ==============================================================================
-- 5. VIEW: v_player_career_summary
-- ==============================================================================
CREATE OR REPLACE VIEW public.v_player_career_summary AS
SELECT
    s.user_id,
    COUNT(s.id)::INTEGER AS total_matches,
    COALESCE(SUM(s.shots_count), 0)::INTEGER AS career_shots,
    COALESCE(SUM(s.hits_count), 0)::INTEGER AS career_hits,
    CASE 
        WHEN COALESCE(SUM(s.shots_count), 0) > 0 
        THEN ROUND((COALESCE(SUM(s.hits_count), 0)::NUMERIC / SUM(s.shots_count)::NUMERIC) * 100, 2)
        ELSE 0.00
    END AS career_precision,
    COALESCE(MAX(s.total_score), 0)::INTEGER AS best_score,
    COALESCE(ROUND(AVG(s.total_score)), 0)::INTEGER AS avg_score,
    COALESCE(SUM(s.duration_seconds), 0)::INTEGER AS total_duration_seconds,
    COALESCE(SUM(s.xp_granted), 0)::INTEGER AS total_xp_from_matches,
    MAX(s.ended_at) AS last_played_at
FROM public.synced_sessions s
GROUP BY s.user_id;

-- ==============================================================================
-- 6. PROCEDIMENTO DE AUDITORIA E RECONCILIAÇÃO MANUAL DE XP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.reconcile_player_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_shots INTEGER := 0;
    v_hits INTEGER := 0;
    v_prec NUMERIC(5, 2) := 0.00;
    v_best INTEGER := 0;
    v_avg INTEGER := 0;
    v_xp_matches INTEGER := 0;
    v_xp_achievements INTEGER := 0;
    v_gross_xp INTEGER := 0;
    
    v_level INTEGER := 1;
    v_xp_next INTEGER := 250;
    v_remaining_xp INTEGER := 0;
    v_title TEXT := 'Iniciante';
BEGIN
    SELECT 
        COALESCE(SUM(shots_count), 0),
        COALESCE(SUM(hits_count), 0),
        COALESCE(MAX(total_score), 0),
        COALESCE(ROUND(AVG(total_score)), 0),
        COALESCE(SUM(xp_granted), 0)
    INTO v_shots, v_hits, v_best, v_avg, v_xp_matches
    FROM public.synced_sessions
    WHERE user_id = p_user_id;

    IF v_shots > 0 THEN
        v_prec := ROUND((v_hits::NUMERIC / v_shots::NUMERIC) * 100, 2);
    ELSE
        v_prec := 0.00;
    END IF;

    SELECT COALESCE(SUM(xp_reward), 0)
    INTO v_xp_achievements
    FROM public.player_achievements
    WHERE user_id = p_user_id;

    v_gross_xp := v_xp_matches + v_xp_achievements;
    v_remaining_xp := v_gross_xp;

    v_level := 1;
    v_xp_next := 250;
    WHILE v_remaining_xp >= v_xp_next LOOP
        v_remaining_xp := v_remaining_xp - v_xp_next;
        v_level := v_level + 1;
        v_xp_next := v_level * 250;
    END LOOP;

    IF v_level <= 2 THEN
        v_title := 'Iniciante';
    ELSIF v_level <= 5 THEN
        v_title := 'Praticante';
    ELSIF v_level <= 8 THEN
        v_title := 'Intermediário';
    ELSIF v_level <= 11 THEN
        v_title := 'Avançado';
    ELSIF v_level <= 14 THEN
        v_title := 'Competidor';
    ELSE
        v_title := 'Especialista';
    END IF;

    UPDATE public.player_profiles
    SET 
        total_shots = v_shots,
        total_hits = v_hits,
        precision = v_prec,
        best_score = v_best,
        avg_score = v_avg,
        xp = v_remaining_xp,
        level = v_level,
        xp_next = v_xp_next,
        title = v_title,
        last_synced_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
