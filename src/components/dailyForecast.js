/**
 * Componente Daily Forecast - Previsão Diária a 7 Dias com Consenso e IPMA
 */

import { getWeatherInfo, getWeatherSvg } from '../utils/weatherIcons.js';
import { formatDayOfWeek, formatDateShort, formatTemp } from '../utils/formatters.js';

export function renderDailyForecast(container, { dailyConsensus }) {
  if (!dailyConsensus || dailyConsensus.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Encontrar mínima global e máxima global dos 7 dias para desenhar a barra proporcional
  let overallMin = Infinity;
  let overallMax = -Infinity;

  dailyConsensus.forEach(d => {
    if (d.tempMin < overallMin) overallMin = d.tempMin;
    if (d.tempMax > overallMax) overallMax = d.tempMax;
  });

  const rangeSpan = Math.max(1, overallMax - overallMin);

  const rowsHtml = dailyConsensus.map((day, idx) => {
    const weather = getWeatherInfo(day.weatherCode);
    const dayName = formatDayOfWeek(day.date);
    const dateFormatted = formatDateShort(day.date);
    const min = formatTemp(day.tempMin);
    const max = formatTemp(day.tempMax);
    const prob = day.precipitationProbability;

    // Calcular posições em percentagem da barra
    const leftPercent = Math.max(0, Math.min(90, ((day.tempMin - overallMin) / rangeSpan) * 100));
    const widthPercent = Math.max(10, Math.min(100 - leftPercent, ((day.tempMax - day.tempMin) / rangeSpan) * 100));

    return `
      <div class="daily-row ${idx === 0 ? 'daily-row-today' : ''}">
        <div class="daily-col-day">
          <span class="day-name">${dayName}</span>
          <span class="day-date">${dateFormatted}</span>
        </div>

        <div class="daily-col-icon">
          ${getWeatherSvg(weather.icon, 28)}
          <span class="daily-weather-text">${weather.label}</span>
        </div>

        <div class="daily-col-rain">
          ${prob >= 15 ? `
            <div class="rain-pill" title="Probabilidade de chuva: ${prob}% | Total previsto: ${day.precipitationSum} mm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>
              </svg>
              <span>${prob}%</span>
            </div>
          ` : '<span class="rain-pill empty">—</span>'}
        </div>

        <div class="daily-col-temps">
          <span class="temp-min-text">${min}°</span>
          <div class="temp-bar-track">
            <div class="temp-bar-fill" style="left: ${leftPercent}%; width: ${widthPercent}%;"></div>
          </div>
          <span class="temp-max-text">${max}°</span>
        </div>

        ${day.hasIpmaBlend ? `
          <div class="daily-col-ipma" title="Fundido com a previsão oficial do IPMA">
            <span class="badge-ipma-pill">IPMA</span>
          </div>
        ` : '<div class="daily-col-ipma"></div>'}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <section class="section-container daily-section">
      <div class="section-header-row">
        <div>
          <h3 class="section-title">Previsão para 7 Dias</h3>
          <p class="section-subtitle">Consenso dos modelos numéricos calibrado com dados diários</p>
        </div>
      </div>
      <div class="daily-list">
        ${rowsHtml}
      </div>
    </section>
  `;
}
