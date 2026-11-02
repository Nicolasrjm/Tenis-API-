-- ==============================================================================
-- MOTION TENNIS — MIGRAÇÃO 002: ROW LEVEL SECURITY (RLS) & POLÍTICAS DE ACESSO
-- ==============================================================================
-- Descrição: Habilitação de RLS em todas as tabelas do schema public.
-- Aplica o princípio do menor privilégio (Least Privilege):
-- - Atletas autenticados (auth.uid()) só enxergam seus próprios dados.
-- - Proteção de colunas: atletas só podem atualizar display_name e avatar em perfis.
-- - Partidas (synced_sessions) e disparos (synced_shots) são IMUTÁVEIS para o app mobile.
-- - Chaves de hardware (equipment_secrets) e checkpoints são estritamente isolados.
-- - Academy pública (academy_lessons) é acessível anonimamente APENAS quando publicada.
-- Fonte Oficial: cloud/migrations/002_row_level_security.sql
-- ==============================================================================

-- 1. HABILITAÇÃO OBRIGATÓRIA DE RLS EM TODAS AS 12 TABELAS
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synced_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synced_shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_checkpoints ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. TABELA: player_profiles
-- ==============================================================================
-- Atleta pode ler o seu próprio perfil
CREATE POLICY "Athletes can view own profile"
    ON public.player_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Atleta pode atualizar perfil com restrição estrita
CREATE POLICY "Athletes can update own visual profile"
    ON public.player_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role tem controle total
CREATE POLICY "Service role full access on player_profiles"
    ON public.player_profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- GATILHO DE PROTEÇÃO: Impede que atletas alterem XP, nível ou métricas
CREATE OR REPLACE FUNCTION public.protect_player_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o autor da mutação for um atleta logado (não service_role/admin)
    IF (current_user = 'authenticated' OR auth.role() = 'authenticated') THEN
        IF (NEW.xp IS DISTINCT FROM OLD.xp OR
            NEW.level IS DISTINCT FROM OLD.level OR
            NEW.title IS DISTINCT FROM OLD.title OR
            NEW.precision IS DISTINCT FROM OLD.precision OR
            NEW.total_shots IS DISTINCT FROM OLD.total_shots OR
            NEW.total_hits IS DISTINCT FROM OLD.total_hits OR
            NEW.best_score IS DISTINCT FROM OLD.best_score OR
            NEW.avg_score IS DISTINCT FROM OLD.avg_score OR
            NEW.streak_days IS DISTINCT FROM OLD.streak_days OR
            NEW.user_id IS DISTINCT FROM OLD.user_id OR
            NEW.last_synced_at IS DISTINCT FROM OLD.last_synced_at) THEN
            RAISE EXCEPTION 'Acesso negado: atletas podem atualizar apenas display_name e avatar.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_player_profile_fields ON public.player_profiles;
CREATE TRIGGER trg_protect_player_profile_fields
    BEFORE UPDATE ON public.player_profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_player_profile_fields();

-- ==============================================================================
-- 3. TABELA: player_attributes
-- ==============================================================================
-- Atleta consulta os próprios atributos técnicos esportivos
CREATE POLICY "Athletes can view own attributes"
    ON public.player_attributes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.player_profiles p
            WHERE p.id = player_attributes.player_id
              AND p.user_id = auth.uid()
        )
    );

-- Escrita de atributos reservada a rotinas seguras/service_role
CREATE POLICY "Service role full access on player_attributes"
    ON public.player_attributes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 4. TABELA: equipments
-- ==============================================================================
-- Usuários (anônimos e logados) podem ler equipamentos ativos (para pareamento e quadras)
CREATE POLICY "Anyone can view active equipments"
    ON public.equipments
    FOR SELECT
    TO anon, authenticated
    USING (is_active = TRUE AND revoked_at IS NULL);

-- Gerenciamento de equipamentos reservado a service_role/admin
CREATE POLICY "Service role full access on equipments"
    ON public.equipments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 5. TABELA: equipment_secrets
-- ==============================================================================
-- SEGURANÇA CRÍTICA: Nenhum cliente (anon ou authenticated) tem qualquer acesso.
-- Apenas service_role ou funções SECURITY DEFINER de backend confiáveis acessam esta tabela.
CREATE POLICY "Service role only access on equipment_secrets"
    ON public.equipment_secrets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 6. TABELA: equipment_heartbeats
-- ==============================================================================
-- Heartbeats são gravados exclusivamente pela rotina de sincronização confiável
CREATE POLICY "Service role full access on equipment_heartbeats"
    ON public.equipment_heartbeats
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 7. TABELA: equipment_pairings
-- ==============================================================================
-- Atleta pode visualizar seus próprios pareamentos
CREATE POLICY "Athletes can view own pairings"
    ON public.equipment_pairings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Atleta pode registrar novo pareamento (estritamente como role 'athlete')
CREATE POLICY "Athletes can insert own pairings"
    ON public.equipment_pairings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND pairing_role = 'athlete');

-- Atleta pode atualizar seu próprio pareamento (sem elevar para 'operator')
CREATE POLICY "Athletes can update own pairings"
    ON public.equipment_pairings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND pairing_role = 'athlete');

-- Atleta pode remover seu vínculo
CREATE POLICY "Athletes can delete own pairings"
    ON public.equipment_pairings
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role tem acesso irrestrito
CREATE POLICY "Service role full access on equipment_pairings"
    ON public.equipment_pairings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 8. TABELA: synced_sessions
-- ==============================================================================
-- Atleta pode consultar seu histórico de partidas
CREATE POLICY "Athletes can view own sessions"
    ON public.synced_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Inserção de partidas imutáveis reservada a service_role ou função segura sync_equipment_session_v1
-- Partidas NÃO podem ser criadas, alteradas ou excluídas diretamente pelo app do atleta
CREATE POLICY "Service role full access on synced_sessions"
    ON public.synced_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 9. TABELA: synced_shots
-- ==============================================================================
-- Atleta pode consultar seus impactos detalhados (mapa de calor)
CREATE POLICY "Athletes can view own shots"
    ON public.synced_shots
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Inserção reservada a service_role ou função segura
CREATE POLICY "Service role full access on synced_shots"
    ON public.synced_shots
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 10. TABELA: player_achievements
-- ==============================================================================
-- Atleta consulta suas conquistas desbloqueadas
CREATE POLICY "Athletes can view own achievements"
    ON public.player_achievements
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Conquistas concedidas unicamente pelo backend
CREATE POLICY "Service role full access on player_achievements"
    ON public.player_achievements
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 11. TABELA: academy_lessons
-- ==============================================================================
-- Catálogo 100% gratuito e público: Qualquer pessoa (anônima ou autenticada) pode ler aulas publicadas
-- Aulas em rascunho (draft) permanecem invisíveis ao público
CREATE POLICY "Public read published academy lessons"
    ON public.academy_lessons
    FOR SELECT
    TO anon, authenticated
    USING (is_published = TRUE AND status = 'published');

-- Gerenciamento de conteúdo reservado ao service_role/administradores
CREATE POLICY "Service role full access on academy_lessons"
    ON public.academy_lessons
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 12. TABELA: academy_progress
-- ==============================================================================
-- Atleta consulta suas próprias aulas concluídas
CREATE POLICY "Athletes can view own academy progress"
    ON public.academy_progress
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Atleta pode marcar aulas como concluídas
CREATE POLICY "Athletes can track own academy progress"
    ON public.academy_progress
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Atleta pode atualizar status de conclusão
CREATE POLICY "Athletes can update own academy progress"
    ON public.academy_progress
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role tem acesso irrestrito
CREATE POLICY "Service role full access on academy_progress"
    ON public.academy_progress
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 13. TABELA: sync_checkpoints
-- ==============================================================================
-- Controle interno de sincronização idempotente: exclusivo para service_role e funções seguras
CREATE POLICY "Service role only access on sync_checkpoints"
    ON public.sync_checkpoints
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
