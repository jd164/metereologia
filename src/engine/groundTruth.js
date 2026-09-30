/**
 * Ground Truth Engine - Validação e Ranking de Precisão com Estações Reais do IPMA
 */

/**
 * Avalia o desempenho dos modelos em relação à estação real mais próxima
 * @param {Object} nearestStation - Objeto com dados em tempo real da estação do IPMA
 * @param {Object} currentConsensusHour - Dados do consenso e de cada modelo para a hora atual
 */
export function evaluateModelAccuracy(nearestStation, currentConsensusHour) {
  if (!nearestStation || !currentConsensusHour || nearestStation.temperature === undefined) {
    return null;
  }

  const realTemp = nearestStation.temperature;
  const realWind = nearestStation.windSpeed;
  const models = currentConsensusHour.models || {};

  const evaluations = [];

  // Avaliar o próprio Consenso
  const consensusError = Math.abs(currentConsensusHour.temperature - realTemp);
  evaluations.push({
    id: 'consensus',
    name: 'Consenso Multimodelo',
    isConsensus: true,
    color: '#06b6d4',
    predictedTemp: currentConsensusHour.temperature,
    realTemp,
    errorTemp: Math.round(consensusError * 10) / 10,
    accuracyScore: calculateAccuracyScore(consensusError)
  });

  // Avaliar cada modelo individualmente
  for (const [key, data] of Object.entries(models)) {
    if (data.temperature === null || data.temperature === undefined) continue;
    const error = Math.abs(data.temperature - realTemp);
    evaluations.push({
      id: key,
      name: data.name,
      isConsensus: false,
      color: data.color,
      predictedTemp: data.temperature,
      realTemp,
      errorTemp: Math.round(error * 10) / 10,
      accuracyScore: calculateAccuracyScore(error)
    });
  }

  // Ordenar do menor erro para o maior (mais preciso primeiro)
  evaluations.sort((a, b) => a.errorTemp - b.errorTemp);

  return {
    station: nearestStation,
    realTemp,
    realWind,
    ranking: evaluations,
    winner: evaluations[0],
    isConsensusLeader: evaluations[0]?.isConsensus || evaluations[1]?.isConsensus
  };
}

/**
 * Converte um erro térmico em percentagem de precisão aproximada (0-100%)
 * Erro de 0.0°C = 100%
 * Erro de 1.0°C = 90%
 * Erro de 2.0°C = 78%
 * Erro de 4.0°C = 50%
 */
function calculateAccuracyScore(error) {
  const score = 100 * Math.exp(-0.15 * error);
  return Math.max(10, Math.min(100, Math.round(score)));
}
