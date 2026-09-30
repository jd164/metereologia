/**
 * Confidence Engine - Avaliação da Incerteza e Índice de Concordância dos Modelos
 */

/**
 * Calcula o score de confiança (0-100%) para uma determinada hora
 */
export function calculateHourConfidence(hourConsensus) {
  if (!hourConsensus || !hourConsensus.models) {
    return { score: 75, label: 'Consenso Moderado', details: 'Dados limitados' };
  }

  const models = Object.values(hourConsensus.models);
  if (models.length < 2) {
    return { score: 80, label: 'Consenso Padrão', details: 'Modelo único disponível' };
  }

  // 1. Penalização por Dispersão de Temperatura (Spread)
  // Spread <= 1.0°C -> 0 penalização. Spread >= 5°C -> -35 pontos.
  const tempSpread = hourConsensus.tempSpread;
  let tempPenalty = 0;
  if (tempSpread > 1.2) {
    tempPenalty = Math.min(35, (tempSpread - 1.2) * 9);
  }

  // 2. Penalização por Dispersão de Precipitação
  // Se uns modelos derem probabilidade > 50% e outros < 20%, há choque de previsões
  const probs = models.map(m => m.precipitationProbability);
  const minProb = Math.min(...probs);
  const maxProb = Math.max(...probs);
  const probSpread = maxProb - minProb;

  let precipPenalty = 0;
  if (probSpread > 20) {
    precipPenalty = Math.min(35, (probSpread - 20) * 0.5);
  }

  // 3. Penalização por Dispersão de Vento
  const winds = models.map(m => m.windSpeed);
  const windSpread = Math.max(...winds) - Math.min(...winds);
  let windPenalty = 0;
  if (windSpread > 15) {
    windPenalty = Math.min(20, (windSpread - 15) * 1.0);
  }

  const rawScore = 100 - (tempPenalty + precipPenalty + windPenalty);
  const score = Math.max(20, Math.min(99, Math.round(rawScore)));

  let label = '';
  let badgeClass = '';
  let summary = '';

  if (score >= 85) {
    label = 'Consenso Muito Alto';
    badgeClass = 'confidence-very-high';
    summary = `Excelente fiabilidade. Todos os ${models.length} modelos convergem para ~${hourConsensus.temperature}ºC com variação de apenas ±${(tempSpread / 2).toFixed(1)}ºC.`;
  } else if (score >= 70) {
    label = 'Consenso Alto';
    badgeClass = 'confidence-high';
    summary = `Boa convergência entre os modelos. Pequena discrepância térmica de ${tempSpread}ºC entre o mais frio e o mais quente.`;
  } else if (score >= 50) {
    label = 'Incerteza Moderada';
    badgeClass = 'confidence-medium';
    summary = `Divergência moderada entre os modelos (${tempSpread}ºC de intervalo térmico ou divergência de ${probSpread}% na chuva).`;
  } else {
    label = 'Alta Incerteza';
    badgeClass = 'confidence-low';
    summary = `Divergência crítica entre modelos globais. Cenário atmosférico instável com choque na posição de frentes ou massas de ar.`;
  }

  return {
    score,
    label,
    badgeClass,
    summary,
    tempSpread,
    probSpread,
    windSpread
  };
}

/**
 * Calcula o score de confiança global para o dia atual ou semana
 */
export function calculateOverallConfidence(hourlyConsensus) {
  if (!hourlyConsensus || hourlyConsensus.length === 0) return 75;
  // Considerar as próximas 24 horas
  const next24 = hourlyConsensus.slice(0, 24);
  const scores = next24.map(h => calculateHourConfidence(h).score);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
