/**
 * Componente Hourly Forecast - Carrossel Horário das Próximas 24-36 Horas
 */

import { getWeatherInfo, getWeatherSvg } from '../utils/weatherIcons.js';
import { formatTime, formatTemp } from '../utils/formatters.js';

export function renderHourlyForecast(container, { hourlyConsensus, currentHourIndex = 0 }) {
  if (!hourlyConsensus || hourlyConsensus.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Iniciar o carrossel na hora atual (e não na madrugada/01h)
  const startIdx = Math.max(0, currentHourIndex);
  const hours = hourlyConsensus.slice(startIdx, startIdx + 24);

  const itemsHtml = hours.map((h, idx) => {
    const weather = getWeatherInfo(h.weatherCode);
    const timeStr = idx === 0 ? 'Agora' : formatTime(h.time);
    const temp = formatTemp(h.temperature);
    const prob = h.precipitationProbability;
    const spread = h.tempSpread;

    return `
      <div class="hourly-item ${idx === 0 ? 'item-now' : ''}">
        <span class="hourly-time">${timeStr}</span>
        <div class="hourly-icon">
          ${getWeatherSvg(weather.icon, 30)}
        </div>
        <span class="hourly-temp">${temp}°</span>
        <div class="hourly-rain-wrap" title="Probabilidade de precipitação: ${prob}%">
          <div class="hourly-rain-bar" style="height: ${Math.max(4, (prob / 100) * 28)}px; opacity: ${prob > 10 ? 1 : 0.3}"></div>
          <span class="hourly-rain-text">${prob}%</span>
        </div>
        <span class="hourly-spread-tag" title="Dispersão entre modelos: ±${(spread / 2).toFixed(1)}°C">±${(spread / 2).toFixed(1)}°</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <section class="section-container hourly-section">
      <div class="section-header-row">
        <div>
          <h3 class="section-title">Previsão Horária Consolidada</h3>
          <p class="section-subtitle">Próximas 24 horas com probabilidade de precipitação e desvio térmico</p>
        </div>
      </div>
      <div class="hourly-scroll-container">
        ${itemsHtml}
      </div>
    </section>
  `;
}
