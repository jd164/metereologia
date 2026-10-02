/**
 * Componente Hourly Forecast - Carrossel Horário das Próximas 24-36 Horas
 */

import { getWeatherInfo, getWeatherSvg } from '../utils/weatherIcons.js';
import { formatTime, formatTemp } from '../utils/formatters.js';

export function renderHourlyForecast(container, { hourlyConsensus, currentHourIndex = 0, selectedHourIndex = null, onSelectHour = null }) {
  if (!hourlyConsensus || hourlyConsensus.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Iniciar o carrossel na hora atual (e não na madrugada/01h)
  const startIdx = Math.max(0, currentHourIndex);
  const hours = hourlyConsensus.slice(startIdx, startIdx + 24);

  const activeIdx = selectedHourIndex !== null ? selectedHourIndex : currentHourIndex;

  const itemsHtml = hours.map((h, idx) => {
    const actualIdx = startIdx + idx;
    const isNow = actualIdx === currentHourIndex;
    const isSelected = actualIdx === activeIdx;
    const weather = getWeatherInfo(h.weatherCode);
    const timeStr = isNow ? 'Agora' : formatTime(h.time);
    const temp = formatTemp(h.temperature);
    const prob = h.precipitationProbability;
    const spread = h.tempSpread;

    return `
      <div class="hourly-item ${isNow ? 'item-now' : ''} ${isSelected ? 'item-selected' : ''}" data-hour-idx="${actualIdx}" role="button" tabindex="0" title="Ver detalhes das ${formatTime(h.time)}">
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
          <p class="section-subtitle">Próximas 24 horas • Clique numa hora para inspecionar os modelos e IPMA</p>
        </div>
      </div>
      <div class="hourly-scroll-container">
        ${itemsHtml}
      </div>
    </section>
  `;

  if (onSelectHour) {
    container.querySelectorAll('.hourly-item').forEach(el => {
      const handleClick = () => {
        const idx = parseInt(el.getAttribute('data-hour-idx'), 10);
        if (!isNaN(idx)) {
          onSelectHour(idx);
        }
      };
      el.addEventListener('click', handleClick);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      });
    });
  }
}
