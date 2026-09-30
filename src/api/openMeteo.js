/**
 * API Client para Open-Meteo Multi-Model & Geocoding
 * Permite extrair dados paralelos de ECMWF, GFS, ICON, Météo-France e GEM.
 */

const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export const SUPPORTED_MODELS = [
  { id: 'ecmwf_ifs025', name: 'ECMWF (IFS)', origin: 'União Europeia', defaultWeight: 0.35, color: '#3b82f6' },
  { id: 'icon_seamless', name: 'ICON', origin: 'Alemanha (DWD)', defaultWeight: 0.25, color: '#10b981' },
  { id: 'meteofrance_seamless', name: 'Météo-France', origin: 'França (AROME/ARPEGE)', defaultWeight: 0.20, color: '#8b5cf6' },
  { id: 'gfs_seamless', name: 'GFS', origin: 'EUA (NOAA)', defaultWeight: 0.15, color: '#f59e0b' },
  { id: 'gem_seamless', name: 'GEM', origin: 'Canadá (CMC)', defaultWeight: 0.05, color: '#ec4899' }
];

/**
 * Pesquisa de localidades por nome (global e Portugal)
 */
export async function searchLocations(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `${GEOCODING_BASE_URL}?name=${encodeURIComponent(query.trim())}&count=10&language=pt&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding error: ${res.status}`);
    const data = await res.json();
    if (!data.results) return [];

    return data.results.map(r => ({
      id: r.id,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      country: r.country,
      countryCode: r.country_code,
      admin1: r.admin1 || '',
      elevation: r.elevation,
      timezone: r.timezone
    }));
  } catch (err) {
    console.warn('Erro ao pesquisar localidades:', err);
    return [];
  }
}

/**
 * Obtém previsões horárias e diárias de todos os modelos selecionados
 */
export async function getMultiModelForecast(lat, lon, timezone = 'auto') {
  const modelIds = SUPPORTED_MODELS.map(m => m.id).join(',');
  
  // Variáveis horárias para multi-modelos
  const hourlyVars = [
    'temperature_2m',
    'relative_humidity_2m',
    'precipitation_probability',
    'precipitation',
    'weather_code',
    'wind_speed_10m',
    'wind_direction_10m',
    'surface_pressure'
  ].join(',');

  // Variáveis diárias gerais
  const dailyVars = [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_probability_max',
    'wind_speed_10m_max'
  ].join(',');

  const currentVars = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m';

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    models: modelIds,
    current: currentVars,
    hourly: hourlyVars,
    daily: dailyVars,
    timezone: timezone,
    forecast_days: '7'
  });

  try {
    const res = await fetch(`${FORECAST_BASE_URL}?${params.toString()}`);
    if (!res.ok) {
      // Fallback: se falhar com todos os modelos, tentar sem especificar múltiplos modelos (usa best_match)
      console.warn('Erro na requisição multi-modelo completa, tentando fallback simples...');
      return await getBestMatchForecast(lat, lon, timezone);
    }
    const data = await res.json();
    return processMultiModelData(data);
  } catch (err) {
    console.error('Erro ao obter previsão multi-modelo:', err);
    throw err;
  }
}

/**
 * Fallback caso algum modelo específico esteja em manutenção
 */
async function getBestMatchForecast(lat, lon, timezone) {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    timezone: timezone,
    forecast_days: '7'
  });
  const res = await fetch(`${FORECAST_BASE_URL}?${params.toString()}`);
  const data = await res.json();
  return processFallbackData(data);
}

/**
 * Normaliza os dados retornados pela Open-Meteo organizando por modelo
 */
function processMultiModelData(raw) {
  const hourly = raw.hourly;
  const times = hourly.time || [];
  const hoursCount = times.length;

  // Organizar cada modelo com a sua série temporal de dados
  const modelsData = {};

  for (const model of SUPPORTED_MODELS) {
    const tempKey = `temperature_2m_${model.id}`;
    const precipProbKey = `precipitation_probability_${model.id}`;
    const precipKey = `precipitation_${model.id}`;
    const windKey = `wind_speed_10m_${model.id}`;
    const codeKey = `weather_code_${model.id}`;

    // Nem todos os modelos fornecem 100% dos parâmetros com o sufixo idêntico, validar arrays
    const temps = hourly[tempKey] || hourly.temperature_2m || [];
    const precipProbs = hourly[precipProbKey] || hourly.precipitation_probability || [];
    const precips = hourly[precipKey] || hourly.precipitation || [];
    const winds = hourly[windKey] || hourly.wind_speed_10m || [];
    const codes = hourly[codeKey] || hourly.weather_code || [];

    modelsData[model.id] = {
      modelInfo: model,
      hourly: times.map((t, idx) => ({
        time: t,
        temperature: temps[idx] !== undefined ? temps[idx] : null,
        precipitationProbability: precipProbs[idx] !== undefined ? precipProbs[idx] : 0,
        precipitation: precips[idx] !== undefined ? precips[idx] : 0,
        windSpeed: winds[idx] !== undefined ? winds[idx] : 0,
        weatherCode: codes[idx] !== undefined ? codes[idx] : 0
      }))
    };
  }

  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    elevation: raw.elevation,
    timezone: raw.timezone,
    current: raw.current,
    daily: raw.daily,
    times: times,
    modelsData: modelsData,
    rawHourly: hourly
  };
}

function processFallbackData(raw) {
  const hourly = raw.hourly;
  const times = hourly.time || [];
  const modelsData = {};

  for (const model of SUPPORTED_MODELS) {
    modelsData[model.id] = {
      modelInfo: model,
      hourly: times.map((t, idx) => ({
        time: t,
        temperature: hourly.temperature_2m?.[idx] ?? null,
        precipitationProbability: hourly.precipitation_probability?.[idx] ?? 0,
        precipitation: hourly.precipitation?.[idx] ?? 0,
        windSpeed: hourly.wind_speed_10m?.[idx] ?? 0,
        weatherCode: hourly.weather_code?.[idx] ?? 0
      }))
    };
  }

  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    elevation: raw.elevation,
    timezone: raw.timezone,
    current: raw.current,
    daily: raw.daily,
    times: times,
    modelsData: modelsData,
    rawHourly: hourly
  };
}
