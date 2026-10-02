/**
 * Componente Model Comparison - Matriz Comparativa Lado a Lado dos Modelos Meteorológicos
 */

import { getWeatherInfo, getWeatherSvg } from '../utils/weatherIcons.js';
import { formatTemp, formatWind } from '../utils/formatters.js';

export function renderModelComparison(container, { currentHour, weights, ipmaDailyToday, groundTruthData, ipmaHourlyToday }) {
  if (!currentHour || !currentHour.models) {
    container.innerHTML = '';
    return;
  }

  const models = Object.entries(currentHour.models);
  const consensusTemp = currentHour.temperature;

  // Se houver dados do IPMA hoje, adicionar card do IPMA
  let ipmaCardHtml = '';
  if (ipmaDailyToday || groundTruthData?.realTemp !== undefined || ipmaHourlyToday) {
    // Priorizar sempre a previsão oficial horária do IPMA para a localidade selecionada
    const ipmaTemp = (ipmaHourlyToday?.temperature !== undefined)
      ? ipmaHourlyToday.temperature
      : (groundTruthData?.realTemp !== undefined && (groundTruthData.station?.distanceKm || 0) <= 5
          ? groundTruthData.realTemp
          : (ipmaDailyToday ? Math.round(((parseFloat(ipmaDailyToday.tMin) + parseFloat(ipmaDailyToday.tMax)) / 2) * 10) / 10 : 21));
    const ipmaProb = (ipmaHourlyToday?.precipitationProbability !== null && ipmaHourlyToday?.precipitationProbability !== undefined)
      ? Math.round(ipmaHourlyToday.precipitationProbability)
      : (ipmaDailyToday && !isNaN(parseFloat(ipmaDailyToday.precipitaProb)) && parseFloat(ipmaDailyToday.precipitaProb) >= 0 ? Math.round(parseFloat(ipmaDailyToday.precipitaProb)) : 0);
    const diff = Math.round((ipmaTemp - consensusTemp) * 10) / 10;
    const diffText = diff > 0 ? `+${diff}°C vs consenso` : (diff < 0 ? `${diff}°C vs consenso` : 'Igual ao consenso');

    const stationLabel = groundTruthData?.station?.distanceKm <= 5 ? 'Sensor de Solo' : 'Estação Próxima';
    const stationValue = groundTruthData?.station?.name 
      ? `${groundTruthData.station.name.slice(0, 10)} (${formatTemp(groundTruthData.realTemp)}°)` 
      : 'Oficial IPMA';

    ipmaCardHtml = `
      <div class="model-card model-card-ipma" style="--model-accent: #ef4444; border-color: rgba(239, 68, 68, 0.4);">
        <div class="model-card-header">
          <div class="model-indicator" style="background-color: #ef4444; box-shadow: 0 0 8px #ef4444;"></div>
          <div class="model-title-block">
            <h4 class="model-name" style="color: #f87171;">IPMA Oficial</h4>
            <span class="model-weight-label">Portugal (AROME / Concelho)</span>
          </div>
          <span class="model-tag" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5;">${diffText}</span>
        </div>

        <div class="model-card-body">
          <div class="model-temp-row">
            <div class="model-temp-val" style="color: #fca5a5;">${formatTemp(ipmaTemp)}°C</div>
            <div class="model-weather-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/>
              </svg>
            </div>
          </div>
          <p class="model-weather-desc">Extremos: ${ipmaDailyToday?.tMin || '--'}° ~ ${ipmaDailyToday?.tMax || '--'}°C</p>

          <div class="model-metrics-list">
            <div class="model-metric-item" title="Probabilidade oficial do IPMA calculada para o bloco tri-horário correspondente (nas últimas 3 horas)">
              <span class="metric-name">Prob. Chuva</span>
              <span class="metric-val ${ipmaProb >= 40 ? 'val-rain' : ''}">${ipmaProb}%</span>
            </div>
            <div class="model-metric-item">
              <span class="metric-name">${stationLabel}</span>
              <span class="metric-val" title="${groundTruthData?.station?.name || ''} a ~${groundTruthData?.station?.distanceKm || 0} km">${stationValue}</span>
            </div>
            <div class="model-metric-item">
              <span class="metric-name">Vento Real</span>
              <span class="metric-val">${formatWind(groundTruthData?.realWind)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Encontrar extremos
  let highestTempModel = null;
  let lowestTempModel = null;
  let highestTemp = -Infinity;
  let lowestTemp = Infinity;

  models.forEach(([key, m]) => {
    if (m.temperature > highestTemp) {
      highestTemp = m.temperature;
      highestTempModel = key;
    }
    if (m.temperature < lowestTemp) {
      lowestTemp = m.temperature;
      lowestTempModel = key;
    }
  });

  const cardsHtml = models.map(([key, m]) => {
    const weather = getWeatherInfo(m.weatherCode);
    const weightPercent = Math.round((weights[key] || 0.2) * 100);
    const diff = Math.round((m.temperature - consensusTemp) * 10) / 10;
    const diffText = diff > 0 ? `+${diff}°C vs consenso` : (diff < 0 ? `${diff}°C vs consenso` : 'Igual ao consenso');

    let badgePill = '';
    if (key === highestTempModel && highestTemp - lowestTemp >= 1.0) {
      badgePill = `<span class="model-tag tag-hot">Modelo Mais Quente</span>`;
    } else if (key === lowestTempModel && highestTemp - lowestTemp >= 1.0) {
      badgePill = `<span class="model-tag tag-cold">Modelo Mais Frio</span>`;
    } else {
      badgePill = `<span class="model-tag tag-neutral">${diffText}</span>`;
    }

    return `
      <div class="model-card" style="--model-accent: ${m.color}">
        <div class="model-card-header">
          <div class="model-indicator" style="background-color: ${m.color}"></div>
          <div class="model-title-block">
            <h4 class="model-name">${m.name}</h4>
            <span class="model-weight-label">Peso: <strong>${weightPercent}%</strong></span>
          </div>
          ${badgePill}
        </div>

        <div class="model-card-body">
          <div class="model-temp-row">
            <div class="model-temp-val">${formatTemp(m.temperature)}°C</div>
            <div class="model-weather-icon">${getWeatherSvg(weather.icon, 36)}</div>
          </div>
          <p class="model-weather-desc">${weather.label}</p>

          <div class="model-metrics-list">
            <div class="model-metric-item">
              <span class="metric-name">Prob. Chuva</span>
              <span class="metric-val ${m.precipitationProbability >= 40 ? 'val-rain' : ''}">${m.precipitationProbability}%</span>
            </div>
            <div class="model-metric-item">
              <span class="metric-name">Chuva Prevista</span>
              <span class="metric-val">${m.precipitation} mm</span>
            </div>
            <div class="model-metric-item">
              <span class="metric-name">Vento</span>
              <span class="metric-val">${formatWind(m.windSpeed)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <section class="section-container model-comparison-section">
      <div class="section-header-row">
        <div>
          <h3 class="section-title">Dissecção dos Modelos Meteorológicos</h3>
          <p class="section-subtitle">Comparativo direto das simulações computacionais para a hora atual</p>
        </div>
        <div class="legend-badge">
          <span>${models.length + (ipmaCardHtml ? 1 : 0)} Modelos em Execução Paralela</span>
        </div>
      </div>

      <div class="models-grid">
        ${ipmaCardHtml}
        ${cardsHtml}
      </div>

      ${ipmaDailyToday ? `
        <div class="ipma-extra-banner">
          <div class="ipma-badge-flag">PT</div>
          <div class="ipma-banner-content">
            <strong>Previsão Oficial do IPMA para Hoje:</strong>
            Mínima de ${ipmaDailyToday.tMin}°C, Máxima de ${ipmaDailyToday.tMax}°C, Probabilidade de precipitação: ${Math.round(parseFloat(ipmaDailyToday.precipitaProb))}%
          </div>
        </div>
      ` : ''}
    </section>
  `;
}
