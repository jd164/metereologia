/**
 * Componente Hero Consensus - Apresentação da Previsão Consolidada de Consenso
 */

import { getWeatherInfo, getWeatherSvg } from '../utils/weatherIcons.js';
import { formatTime, formatTemp, formatWind } from '../utils/formatters.js';

export function renderHeroConsensus(container, { location, currentHour, confidence, isNight = false, onToggleViewMode, activeViewMode }) {
  if (!currentHour) {
    container.innerHTML = `<div class="hero-loading">A carregar dados dos modelos...</div>`;
    return;
  }

  const weather = getWeatherInfo(currentHour.weatherCode);
  const temp = formatTemp(currentHour.temperature);
  const minTemp = formatTemp(currentHour.tempMin);
  const maxTemp = formatTemp(currentHour.tempMax);
  const spread = currentHour.tempSpread.toFixed(1);
  const precipProb = currentHour.precipitationProbability;
  const precipAmount = currentHour.precipitation;
  const wind = formatWind(currentHour.windSpeed);

  const confScore = confidence.score;
  const confLabel = confidence.label;
  const confBadgeClass = confidence.badgeClass;
  const confSummary = confidence.summary;

  // Cor do círculo de confiança
  let circleColor = '#10b981'; // verde
  if (confScore < 50) circleColor = '#ef4444'; // vermelho
  else if (confScore < 70) circleColor = '#f59e0b'; // laranja
  else if (confScore < 85) circleColor = '#3b82f6'; // azul

  const circumference = 2 * Math.PI * 34; // raio 34
  const strokeDashoffset = circumference - (confScore / 100) * circumference;

  container.innerHTML = `
    <section class="hero-consensus-card">
      <div class="hero-header-row">
        <div class="hero-location-block">
          <div class="location-name-line">
            <h2 class="location-name">${location.name}</h2>
            ${location.globalIdLocal ? '<span class="badge-ipma-official" title="Integrado com previsão oficial do IPMA e estações de superfície">IPMA Integrado</span>' : ''}
          </div>
          <p class="location-subtitle">${location.country} • Atualização das ${formatTime(currentHour.time)}</p>
        </div>

        <div class="view-mode-selector">
          <button class="mode-pill ${activeViewMode === 'consensus' ? 'active' : ''}" data-mode="consensus">
            Consenso Recomendado
          </button>
          <button class="mode-pill ${activeViewMode === 'models' ? 'active' : ''}" data-mode="models">
            Dissecção dos Modelos
          </button>
        </div>
      </div>

      <div class="hero-main-grid">
        <!-- Temperatura e Condição -->
        <div class="hero-temp-block">
          <div class="hero-weather-icon-wrapper">
            ${getWeatherSvg(weather.icon, 72, isNight)}
          </div>
          <div class="temp-text-group">
            <div class="hero-temp-display">
              <span class="temp-number">${temp}</span>
              <span class="temp-unit">°C</span>
            </div>
            <p class="hero-weather-desc">${weather.label}</p>
          </div>
        </div>

        <!-- Métrica de Certeza / Consenso Multimodelo -->
        <div class="hero-confidence-block">
          <div class="confidence-circle-wrap">
            <svg class="confidence-circle-svg" width="90" height="90" viewBox="0 0 80 80">
              <circle class="circle-bg" cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.08)" stroke-width="7" fill="none" />
              <circle 
                class="circle-fill" 
                cx="40" 
                cy="40" 
                r="34" 
                stroke="${circleColor}" 
                stroke-width="7" 
                fill="none" 
                stroke-linecap="round"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${strokeDashoffset}"
                style="transition: stroke-dashoffset 0.8s ease;"
              />
            </svg>
            <div class="confidence-circle-inner">
              <span class="confidence-percent">${confScore}%</span>
            </div>
          </div>

          <div class="confidence-info">
            <div class="confidence-title-row">
              <span class="confidence-title">Índice de Certeza</span>
              <span class="confidence-badge ${confBadgeClass}">${confLabel}</span>
            </div>
            <p class="confidence-summary-text">${confSummary}</p>
          </div>
        </div>
      </div>

      <!-- Barra de 4 Métricas Chave do Consenso -->
      <div class="hero-stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
              <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
            </svg>
          </div>
          <div class="stat-data">
            <span class="stat-label">Intervalo Térmico</span>
            <span class="stat-value">${minTemp}° ~ ${maxTemp}°C</span>
            <span class="stat-hint">Dispersão entre modelos: ±${(spread / 2).toFixed(1)}°C</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>
            </svg>
          </div>
          <div class="stat-data">
            <span class="stat-label">Probabilidade de Chuva</span>
            <span class="stat-value">${precipProb}%</span>
            <span class="stat-hint">${precipAmount > 0 ? `Previsto: ${precipAmount} mm` : 'Sem precipitação prevista'}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2">
              <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
            </svg>
          </div>
          <div class="stat-data">
            <span class="stat-label">Vento Consolidado</span>
            <span class="stat-value">${wind}</span>
            <span class="stat-hint">Consenso ponderado</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div class="stat-data">
            <span class="stat-label">Mediana dos Modelos</span>
            <span class="stat-value">${currentHour.tempMedian.toFixed(1)}°C</span>
            <span class="stat-hint">Robusto a previsões anómalas</span>
          </div>
        </div>
      </div>

      ${activeViewMode === 'models' && currentHour.models ? `
        <div class="hero-models-strip">
          <div class="strip-header">
            <span class="strip-title">Dissecção Direta dos Modelos (Hora Atual):</span>
            <span class="strip-sub">Abaixo encontra a matriz comparativa completa e detalhada</span>
          </div>
          <div class="strip-pills-row">
            ${Object.values(currentHour.models).map(m => `
              <div class="strip-pill-item" style="--pill-color: ${m.color}">
                <span class="strip-pill-dot" style="background-color: ${m.color}"></span>
                <span class="strip-pill-name">${m.name}</span>
                <strong class="strip-pill-temp">${formatTemp(m.temperature)}°C</strong>
                <span class="strip-pill-rain">${m.precipitationProbability}% chuva</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </section>
  `;

  // Listener para alternar modo de visualização
  container.querySelectorAll('.mode-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      onToggleViewMode(mode);
    });
  });
}
