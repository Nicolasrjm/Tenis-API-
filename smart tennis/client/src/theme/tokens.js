/**
 * MOTION TENNIS — SPORT PREMIUM + SPORT PLAY DESIGN TOKENS
 * Centralized design tokens for colors, typography, spacing, shadows and states.
 * Etapa 2: Dual Theme (Sport Premium Dark [Default] & Sport Premium Light [Cinza-Azulado])
 */

export const sportsColors = {
  // Brand Main Colors
  navy: '#142B3D',
  navyDeep: '#0D1C28',
  navyLight: '#1C3A52',
  navyHeading: '#142B3D',
  
  // ==========================================
  // TEMA ESCURO — Sport Premium Dark (Padrão)
  // ==========================================
  dark: {
    bg: '#101820',            // Fundo principal
    bgSec: '#18242E',         // Fundo secundário
    card: '#22313D',          // Cards
    header: '#0D1B2A',        // Header
    border: '#344653',        // Bordas
    text: '#F1F5F9',          // Texto principal
    textSec: '#A8BAC8',       // Texto secundário
    lime: '#B8F044',          // Destaque esportivo
    blue: '#60A5FA',          // Azul complementar
    input: '#18242E',         // Inputs
    borderInput: '#344653',   // Borda do input
  },

  // ==========================================
  // TEMA CLARO — Sport Premium Light (Cinza-Azulado)
  // ==========================================
  light: {
    bg: '#DCE3E8',            // Fundo principal
    bgSec: '#C9D4DC',         // Seções alternadas
    card: '#F4F6F8',          // Cards e formulários
    input: '#E8EDF1',         // Inputs
    header: '#142B3D',        // Header
    border: '#B8C6D0',        // Bordas
    text: '#142B3D',          // Texto principal
    textSec: '#475569',       // Texto secundário
    lime: '#B8F044',          // Destaque esportivo
    blue: '#2563EB',          // Azul complementar
    borderInput: '#B8C6D0',   // Borda do input
  },

  // Compatibility aliases (Light Cinza-Azulado defaults)
  bgLight: '#DCE3E8',
  surfaceAlt: '#C9D4DC',
  surfaceCard: '#F4F6F8',
  surfaceInput: '#E8EDF1',
  borderLight: '#B8C6D0',
  borderInput: '#B8C6D0',
  textDark: '#142B3D',
  textMuted: '#475569',

  // Accents
  lime: '#B8F044',
  limeHover: '#A4DE2D',
  blue: '#2563EB',
  blueHover: '#1D4ED8',
  orange: '#FF7548',
  orangeHover: '#F05F30',
  
  // Arena Ativa (Sempre Escura / Preto de Projeção)
  arenaBg: '#050D07',
  arenaOverlay: '#000000',
  
  // Semantic status
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#2563EB',
};

export const sportsFonts = {
  body: 'Inter, system-ui, -apple-system, sans-serif',
  sport: '"Barlow Condensed", sans-serif',
  mono: '"JetBrains Mono", monospace',
};

export const sportsShadows = {
  card: '0 4px 20px -2px rgba(16, 24, 32, 0.12), 0 2px 6px -1px rgba(16, 24, 32, 0.08)',
  cardHover: '0 12px 28px -4px rgba(16, 24, 32, 0.20), 0 4px 10px -2px rgba(16, 24, 32, 0.12)',
  lime: '0 4px 14px 0 rgba(184, 240, 68, 0.4)',
  blue: '0 4px 14px 0 rgba(37, 99, 235, 0.3)',
  orange: '0 4px 14px 0 rgba(255, 117, 72, 0.3)',
};

export default {
  colors: sportsColors,
  fonts: sportsFonts,
  shadows: sportsShadows,
};
