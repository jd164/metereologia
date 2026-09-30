/**
 * Ensemble Engine - Algoritmo de Consenso Multimodelo e Fusão Estatística
 * 
 * Implementa fusão ponderada (weighted blending), mediana contra outliers,
 * cálculo de desvio padrão e limites de dispersão (spread).
 */

export const DEFAULT_WEIGHTS = {
  ecmwf_ifs025: 0.35,        // Centro Europeu - geralmente a maior pontuação global
  icon_seamless: 0.25,       // DWD Alemão - altíssima resolução para a Europa
  meteofrance_seamless: 0.20,// Météo-France - especializado na Península Ibérica/França
  gfs_seamless: 0.15,        // NOAA GFS - robustez global americana
  gem_seamless: 0.05         // CMC Canadá
};

/**
 * Normaliza os pesos para somarem 1.0 (100%)
 */
export function normalizeWeights(weights) {
  const sum = Object.values(weights).reduce((acc, w) => acc + (w || 0), 0);
  if (sum === 0) return DEFAULT_WEIGHTS;
  const normalized = {};
  for (const [key, val] of Object.entries(weights)) {
    normalized[key] = (val || 0) / sum;
  }
  return normalized;
}

/**
 * Calcula a mediana de um array de números
 */
export function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calcula a média e o desvio padrão de um conjunto de valores
 */
export function calculateMeanAndStdDev(numbers) {
  if (!numbers || numbers.length === 0) return { mean: 0, stdDev: 0 };
  const mean = numbers.reduce((acc, n) => acc + n, 0) / numbers.length;
  const variance = numbers.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) / numbers.length;
  return {
    mean: Math.round(mean * 10) / 10,
    stdDev: Math.round(Math.sqrt(variance) * 100) / 100
  };
}

/**
 * Computa a previsão consolidada horária através de consenso ponderado
 * @param {Object} multiModelData - Dados organizados retornados por getMultiModelForecast
 * @param {Object} customWeights - Pesos personalizados opcionais
 */
export function computeHourlyConsensus(multiModelData, customWeights = DEFAULT_WEIGHTS) {
  if (!multiModelData || !multiModelData.times) return [];

  const weights = normalizeWeights(customWeights);
  const modelsData = multiModelData.modelsData;
  const times = multiModelData.times;
  const modelKeys = Object.keys(modelsData);

  return times.map((time, hourIdx) => {
    const hourlyValues = [];
    const precipProbValues = [];
    const precipSumValues = [];
    const windSpeedValues = [];
    const codes = [];

    let weightedTempSum = 0;
    let weightedPrecipProbSum = 0;
    let weightedPrecipSum = 0;
    let weightedWindSum = 0;
    let validWeightSum = 0;

    const perModelBreakdown = {};

    for (const key of modelKeys) {
      const modelHourly = modelsData[key]?.hourly?.[hourIdx];
      if (!modelHourly || modelHourly.temperature === null) continue;

      const w = weights[key] || 0.1;
      const t = modelHourly.temperature;
      const prob = modelHourly.precipitationProbability || 0;
      const prec = modelHourly.precipitation || 0;
      const wind = modelHourly.windSpeed || 0;

      hourlyValues.push(t);
      precipProbValues.push(prob);
      precipSumValues.push(prec);
      windSpeedValues.push(wind);
      codes.push(modelHourly.weatherCode);

      weightedTempSum += t * w;
      weightedPrecipProbSum += prob * w;
      weightedPrecipSum += prec * w;
      weightedWindSum += wind * w;
      validWeightSum += w;

      perModelBreakdown[key] = {
        name: modelsData[key].modelInfo.name,
        color: modelsData[key].modelInfo.color,
        temperature: t,
        precipitationProbability: prob,
        precipitation: prec,
        windSpeed: wind,
        weatherCode: modelHourly.weatherCode
      };
    }

    if (validWeightSum === 0) validWeightSum = 1;

    const consensusTemp = Math.round((weightedTempSum / validWeightSum) * 10) / 10;
    const consensusPrecipProb = Math.round(weightedPrecipProbSum / validWeightSum);
    const consensusPrecip = Math.round((weightedPrecipSum / validWeightSum) * 10) / 10;
    const consensusWind = Math.round((weightedWindSum / validWeightSum) * 10) / 10;

    const { stdDev: tempStdDev } = calculateMeanAndStdDev(hourlyValues);
    const tempMin = hourlyValues.length ? Math.min(...hourlyValues) : consensusTemp;
    const tempMax = hourlyValues.length ? Math.max(...hourlyValues) : consensusTemp;
    const tempMedian = calculateMedian(hourlyValues);

    // Código do tempo: se a prob de chuva for alta, priorizar código de chuva
    let consensusCode = 0;
    if (consensusPrecipProb >= 60) {
      consensusCode = consensusPrecip > 2.5 ? 63 : 61; // Chuva moderada ou fraca
    } else if (consensusPrecipProb >= 30) {
      consensusCode = 51; // Chuvisco / Aguaceiro fraco
    } else {
      // Moda dos códigos meteorológicos
      const counts = {};
      codes.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
      consensusCode = parseInt(Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 0));
    }

    return {
      time,
      temperature: consensusTemp,
      tempMin: Math.round(tempMin * 10) / 10,
      tempMax: Math.round(tempMax * 10) / 10,
      tempMedian: Math.round(tempMedian * 10) / 10,
      tempSpread: Math.round((tempMax - tempMin) * 10) / 10,
      tempStdDev,
      precipitationProbability: consensusPrecipProb,
      precipitation: consensusPrecip,
      windSpeed: consensusWind,
      weatherCode: consensusCode,
      models: perModelBreakdown
    };
  });
}

/**
 * Computa a previsão consolidada diária
 */
export function computeDailyConsensus(hourlyConsensus, ipmaDailyForecast = null) {
  if (!hourlyConsensus || hourlyConsensus.length === 0) return [];

  // Agrupar por data (YYYY-MM-DD)
  const daysMap = {};

  hourlyConsensus.forEach(hour => {
    const dateStr = hour.time.split('T')[0];
    if (!daysMap[dateStr]) {
      daysMap[dateStr] = [];
    }
    daysMap[dateStr].push(hour);
  });

  return Object.keys(daysMap).map(dateStr => {
    const hours = daysMap[dateStr];
    const temps = hours.map(h => h.temperature);
    const precipProbs = hours.map(h => h.precipitationProbability);
    const precips = hours.map(h => h.precipitation);
    const winds = hours.map(h => h.windSpeed);

    const tMin = Math.min(...temps);
    const tMax = Math.max(...temps);
    const precipProbMax = Math.max(...precipProbs);
    const precipSum = Math.round(precips.reduce((a, b) => a + b, 0) * 10) / 10;
    const maxWind = Math.max(...winds);

    // Média de desvio de temperatura ao longo do dia para o score de certeza
    const avgSpread = Math.round((hours.reduce((a, b) => a + b.tempSpread, 0) / hours.length) * 10) / 10;

    // Verificar se existe dado oficial do IPMA para este dia
    let ipmaDay = null;
    if (ipmaDailyForecast) {
      ipmaDay = ipmaDailyForecast.find(d => d.forecastDate === dateStr);
    }

    // Se houver IPMA, enriquecer o consenso
    let finalTMin = tMin;
    let finalTMax = tMax;
    let finalPrecipProb = precipProbMax;

    if (ipmaDay) {
      const ipmaMin = parseFloat(ipmaDay.tMin);
      const ipmaMax = parseFloat(ipmaDay.tMax);
      const ipmaProb = parseFloat(ipmaDay.precipitaProb);

      if (!isNaN(ipmaMin)) finalTMin = Math.round(((tMin * 0.7) + (ipmaMin * 0.3)) * 10) / 10;
      if (!isNaN(ipmaMax)) finalTMax = Math.round(((tMax * 0.7) + (ipmaMax * 0.3)) * 10) / 10;
      if (!isNaN(ipmaProb)) finalPrecipProb = Math.round((precipProbMax * 0.7) + (ipmaProb * 0.3));
    }

    // Representação do código de tempo do dia (das 12h ou média diurna)
    const middayHour = hours.find(h => h.time.includes('T12:')) || hours[Math.floor(hours.length / 2)];

    return {
      date: dateStr,
      tempMin: finalTMin,
      tempMax: finalTMax,
      precipitationProbability: finalPrecipProb,
      precipitationSum: precipSum,
      maxWindSpeed: maxWind,
      avgSpread,
      weatherCode: middayHour ? middayHour.weatherCode : 0,
      hasIpmaBlend: !!ipmaDay,
      ipmaData: ipmaDay
    };
  });
}
