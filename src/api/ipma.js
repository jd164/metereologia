/**
 * API Client para o IPMA (Instituto Português do Mar e da Atmosfera)
 * Fornece dados oficiais de previsão diária, tipos de tempo e estações de superfície em tempo real.
 */

const BASE_URL = 'https://api.ipma.pt/open-data';

// Cache em memória para evitar chamadas redundantes
let districtsCache = null;
let weatherTypesCache = null;
let surfaceStationsCache = null;
let surfaceStationsCacheTime = 0;

/**
 * Obtém a lista de distritos e concelhos com coordenadas e globalIdLocal (cobertura total de 400+ locais)
 */
export async function getIpmaLocations() {
  if (districtsCache) return districtsCache;
  try {
    const res = await fetch('https://api.ipma.pt/public-data/forecast/locations.json');
    if (res.ok) {
      const json = await res.json();
      districtsCache = json.map(item => ({
        globalIdLocal: item.globalIdLocal,
        name: item.local || item.name,
        latitude: parseFloat(item.latitude),
        longitude: parseFloat(item.longitude),
        idDistrict: item.idDistrito,
        idConcelho: item.idConcelho,
        isIpma: true,
        country: 'Portugal'
      }));
      return districtsCache;
    }
  } catch (e) {
    console.warn('Erro ao carregar locais completos do IPMA, a tentar fallback:', e);
  }

  try {
    const res = await fetch(`${BASE_URL}/distrits-islands.json`);
    if (!res.ok) throw new Error(`IPMA districts error: ${res.status}`);
    const json = await res.json();
    districtsCache = json.data.map(item => ({
      globalIdLocal: item.globalIdLocal,
      name: item.local,
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      idDistrict: item.idDistrito,
      isIpma: true,
      country: 'Portugal'
    }));
    return districtsCache;
  } catch (err) {
    console.warn('Erro ao carregar locais do IPMA:', err);
    return [];
  }
}

/**
 * Obtém o dicionário de tipos de tempo do IPMA (id -> descrição PT e ícone)
 */
export async function getIpmaWeatherTypes() {
  if (weatherTypesCache) return weatherTypesCache;
  try {
    const res = await fetch(`${BASE_URL}/weather-type-classe.json`);
    if (!res.ok) throw new Error(`IPMA weather types error: ${res.status}`);
    const json = await res.json();
    weatherTypesCache = {};
    json.data.forEach(item => {
      weatherTypesCache[item.idWeatherType] = {
        descPT: item.descWeatherTypePT,
        descEN: item.descWeatherTypeEN
      };
    });
    return weatherTypesCache;
  } catch (err) {
    console.warn('Erro ao carregar tipos de tempo do IPMA:', err);
    return {};
  }
}

/**
 * Obtém a previsão diária oficial do IPMA a 10 dias para um globalIdLocal
 * Suporta os mais de 400 concelhos via endpoint agregado e capitais via fallback
 */
export async function getIpmaDailyForecast(globalIdLocal) {
  if (!globalIdLocal) return null;
  // 1. Tentar primeiro o endpoint agregado público que cobre todos os 423 concelhos
  try {
    const aggRes = await fetch(`https://api.ipma.pt/public-data/forecast/aggregate/${globalIdLocal}.json`);
    if (aggRes.ok) {
      const json = await aggRes.json();
      const dailyItems = json
        .filter(item => item.idPeriodo === 24)
        .map(item => ({
          forecastDate: item.dataPrev.split('T')[0],
          tMin: item.tMin,
          tMax: item.tMax,
          precipitaProb: (item.probabilidadePrecipita !== undefined && parseFloat(item.probabilidadePrecipita) >= 0)
            ? item.probabilidadePrecipita
            : '0.0',
          idWeatherType: item.idTipoTempo,
          iUv: item.iUv,
          predWindDir: item.ddVento
        }));
      if (dailyItems.length > 0) {
        return dailyItems;
      }
    }
  } catch (err) {
    console.warn(`Tentativa de previsão agregada diária falhou para ${globalIdLocal}:`, err);
  }

  // 2. Fallback para o endpoint de capitais de distrito
  try {
    const res = await fetch(`${BASE_URL}/forecast/meteorology/cities/daily/${globalIdLocal}.json`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.warn(`Erro ao carregar previsão do IPMA para ${globalIdLocal}:`, err);
    return null;
  }
}

/**
 * Obtém a previsão horária oficial do IPMA (modelo AROME / NWP com resolução horária) para um globalIdLocal
 * Fornece a previsão hora a hora oficial exata usada no site oficial www.ipma.pt
 */
export async function getIpmaHourlyForecast(globalIdLocal) {
  if (!globalIdLocal) return [];
  try {
    const res = await fetch(`https://api.ipma.pt/public-data/forecast/aggregate/${globalIdLocal}.json`);
    if (!res.ok) return [];
    const json = await res.json();

    const hourlyItems = json.filter(item => item.idPeriodo === 1 && item.tMed !== undefined);
    if (hourlyItems.length === 0) return [];

    // No IPMA (modelo numérico AROME), a probabilidade de precipitação é calculada para
    // intervalos tri-horários (a cada 3 horas: 00h, 03h, 06h, 09h, 12h, 15h, 18h, 21h).
    // As horas intermédias chegam da API com probabilidadePrecipita = "-99.0" (código de ausência de cálculo horário isolado).
    // No site e na aplicação do IPMA, esse valor tri-horário abrange as 3 horas do bloco (ex.: às 15h, cobre 14h, 15h e 16h).
    const validProbs = [];
    for (const item of hourlyItems) {
      const rawProb = parseFloat(item.probabilidadePrecipita);
      if (!isNaN(rawProb) && rawProb >= 0) {
        const timeMs = new Date(item.dataPrev.endsWith('Z') ? item.dataPrev : item.dataPrev + 'Z').getTime();
        validProbs.push({
          timeMs,
          prob: Math.round(rawProb)
        });
      }
    }

    return hourlyItems.map(item => {
      const itemTimeMs = new Date(item.dataPrev.endsWith('Z') ? item.dataPrev : item.dataPrev + 'Z').getTime();
      const rawProb = parseFloat(item.probabilidadePrecipita);
      let prob = 0;

      if (!isNaN(rawProb) && rawProb >= 0) {
        prob = Math.round(rawProb);
      } else if (validProbs.length > 0) {
        // Encontrar o bloco tri-horário mais próximo (janela centrada de ±90 min: H-1, H, H+1)
        let closest = null;
        let minDiff = Infinity;
        for (const vp of validProbs) {
          const diff = Math.abs(itemTimeMs - vp.timeMs);
          if (diff < minDiff) {
            minDiff = diff;
            closest = vp;
          }
        }
        if (closest && minDiff <= 95 * 60 * 1000) {
          prob = closest.prob;
        } else if (closest && minDiff <= 3 * 3600 * 1000) {
          prob = closest.prob;
        }
      }

      return {
        time: item.dataPrev,
        temperature: parseFloat(item.tMed),
        humidity: item.hR ? parseFloat(item.hR) : null,
        windSpeed: item.ffVento ? parseFloat(item.ffVento) : null,
        windDirection: item.ddVento,
        weatherCode: item.idTipoTempo,
        precipitationProbability: prob
      };
    });
  } catch (err) {
    console.warn(`Erro ao carregar previsão horária agregada do IPMA para ${globalIdLocal}:`, err);
    return [];
  }
}

/**
 * Obtém as observações em tempo real das 500+ estações de superfície do IPMA
 */
export async function getIpmaSurfaceObservations() {
  const now = Date.now();
  // Cache por 10 minutos
  if (surfaceStationsCache && now - surfaceStationsCacheTime < 10 * 60 * 1000) {
    return surfaceStationsCache;
  }

  try {
    const res = await fetch(`${BASE_URL}/observation/meteorology/stations/obs-surface.geojson`);
    if (!res.ok) throw new Error(`IPMA surface error: ${res.status}`);
    const json = await res.json();
    
    // Deduplicar estações pelo idEstacao, mantendo sempre o registo mais recente (última hora reportada)
    const stationMap = new Map();
    for (const f of json.features) {
      const p = f.properties;
      if (!p || p.temperatura === null || p.temperatura === -99) continue;

      const existing = stationMap.get(p.idEstacao);
      if (!existing || new Date(p.time) > new Date(existing.time)) {
        stationMap.set(p.idEstacao, {
          id: p.idEstacao,
          name: p.localEstacao,
          latitude: f.geometry.coordinates[1],
          longitude: f.geometry.coordinates[0],
          temperature: p.temperatura,
          humidity: p.humidade,
          windSpeed: p.intensidadeVentoKM,
          windDirection: p.descDirVento,
          pressure: p.pressao,
          precipitation: p.precAcumulada,
          time: p.time
        });
      }
    }

    surfaceStationsCache = Array.from(stationMap.values());
    surfaceStationsCacheTime = now;
    return surfaceStationsCache;
  } catch (err) {
    console.warn('Erro ao carregar observações do IPMA:', err);
    return [];
  }
}

/**
 * Fórmula de Haversine para calcular distância em km entre dois pontos geográficos
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Encontra a estação de superfície do IPMA mais próxima das coordenadas indicadas
 */
export async function findNearestIpmaStation(lat, lon) {
  const stations = await getIpmaSurfaceObservations();
  if (!stations || stations.length === 0) return null;

  let nearest = null;
  let minDistance = Infinity;

  for (const station of stations) {
    const dist = calculateDistanceKm(lat, lon, station.latitude, station.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = { ...station, distanceKm: Math.round(dist * 10) / 10 };
    }
  }

  // Enriquecer com a observação horária mais recente disponível em observations.json
  if (nearest?.id) {
    try {
      const hourly = await getIpmaHourlyStationReadings(nearest.id);
      if (hourly && hourly.length > 0) {
        const latest = hourly[hourly.length - 1];
        if (latest && latest.temperature !== null && latest.temperature !== -99) {
          if (!nearest.time || new Date(latest.time) >= new Date(nearest.time)) {
            nearest.temperature = latest.temperature;
            if (latest.humidity !== undefined && latest.humidity !== null) {
              nearest.humidity = latest.humidity;
            }
            if (latest.windSpeed !== undefined && latest.windSpeed !== -99) {
              nearest.windSpeed = latest.windSpeed;
            }
            nearest.time = latest.time;
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao verificar última leitura horária da estação:', e);
    }
  }

  return nearest;
}

/**
 * Obtém o histórico horário (hora a hora) das últimas 24 horas da estação do IPMA
 */
export async function getIpmaHourlyStationReadings(stationId) {
  if (!stationId) return [];
  try {
    const res = await fetch(`${BASE_URL}/observation/meteorology/stations/observations.json`);
    if (!res.ok) return [];
    const json = await res.json();
    const timestamps = Object.keys(json).sort();
    
    return timestamps.map(ts => {
      const reading = json[ts]?.[stationId];
      if (!reading || reading.temperatura === null || reading.temperatura === -99) return null;
      return {
        time: ts,
        temperature: reading.temperatura,
        humidity: reading.humidade,
        windSpeed: reading.intensidadeVentoKM,
        precipitation: reading.precAcumulada || 0,
        radiation: reading.radiacao
      };
    }).filter(Boolean);
  } catch (err) {
    console.warn(`Erro ao carregar leituras horárias da estação ${stationId}:`, err);
    return [];
  }
}

/**
 * Encontra o local oficial do IPMA mais próximo para obter sempre globalIdLocal em Portugal
 */
export async function getNearestIpmaLocation(lat, lon) {
  const locations = await getIpmaLocations();
  if (!locations || locations.length === 0) return null;

  let nearest = null;
  let minDist = Infinity;

  for (const loc of locations) {
    const d = calculateDistanceKm(lat, lon, loc.latitude, loc.longitude);
    if (d < minDist) {
      minDist = d;
      nearest = loc;
    }
  }

  // Se estiver a menos de 70 km de um concelho do IPMA, associar
  return minDist < 70 ? nearest : null;
}

