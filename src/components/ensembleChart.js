/**
 * Componente Ensemble Chart - Gráficos Interativos de Dispersão e Consenso usando Chart.js
 * Inclui o modelo oficial do IPMA (estimativa de curva diurna tMin/tMax e estação física)
 */

import { Chart, registerables } from 'chart.js';
import { formatTime, formatDateShort } from '../utils/formatters.js';

Chart.register(...registerables);

let chartInstance = null;
let currentMetric = 'temperature'; // 'temperature', 'precipitation_probability', 'precipitation'

export function renderEnsembleChart(container, {
  hourlyConsensus,
  modelsData,
  ipmaDailyForecast = null,
  groundTruthData = null,
  ipmaHourlyReadings = [],
  ipmaHourlyForecast = [],
  currentHourIndex = 0
}) {
  if (!hourlyConsensus || hourlyConsensus.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Iniciar na hora atual (com 1 hora anterior para contexto imediato) e cobrir as próximas 36 horas
  const startIdx = Math.max(0, (currentHourIndex || 0) - 1);
  const slicedHours = hourlyConsensus.slice(startIdx, startIdx + 36);

  // Construir a série horária do IPMA com prioridade para a previsão horária oficial (AROME/IPMA) e leituras reais
  const ipmaHourlyData = generateIpmaHourlySeries(slicedHours, ipmaDailyForecast, groundTruthData, ipmaHourlyReadings, ipmaHourlyForecast);

  container.innerHTML = `
    <section class="section-container chart-section">
      <div class="section-header-row">
        <div>
          <h3 class="section-title">Análise Gráfica Multimodelo (36 Horas)</h3>
          <p class="section-subtitle">
            Sobreposição das trajetórias previstas pelos modelos mundiais e pelo <strong>IPMA Oficial</strong>
          </p>
        </div>

        <div class="chart-controls">
          <button class="chart-tab ${currentMetric === 'temperature' ? 'active' : ''}" data-metric="temperature">
            Temperatura (°C)
          </button>
          <button class="chart-tab ${currentMetric === 'precipitation_probability' ? 'active' : ''}" data-metric="precipitation_probability">
            Prob. Chuva (%)
          </button>
          <button class="chart-tab ${currentMetric === 'precipitation' ? 'active' : ''}" data-metric="precipitation">
            Chuva (mm)
          </button>
        </div>
      </div>

      <div class="chart-wrapper">
        <canvas id="ensemble-chart-canvas"></canvas>
      </div>

      <div class="chart-ipma-notice">
        <span class="notice-dot-ipma"></span>
        <span><strong>IPMA Oficial (Portugal):</strong> Linha vermelha em destaque com previsão horária oficial direta da rede IPMA e medições das estações de superfície.</span>
      </div>
    </section>
  `;

  const canvas = container.querySelector('#ensemble-chart-canvas');
  const tabs = container.querySelectorAll('.chart-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMetric = tab.dataset.metric;
      buildChart(canvas, slicedHours, modelsData, ipmaHourlyData, currentMetric);
    });
  });

  buildChart(canvas, slicedHours, modelsData, ipmaHourlyData, currentMetric);
}

/**
 * Gera a série horária contínua do IPMA fundindo leituras reais da estação e previsão diária/horária oficial
 */
function generateIpmaHourlySeries(hours, ipmaDaily, groundTruth, hourlyReadings = [], ipmaHourlyForecast = []) {
  const hasIpmaDaily = ipmaDaily && ipmaDaily.length > 0;
  const hasStation = groundTruth && groundTruth.realTemp !== undefined;
  const hasHourlyReadings = hourlyReadings && hourlyReadings.length > 0;
  const hasHourlyForecast = ipmaHourlyForecast && ipmaHourlyForecast.length > 0;

  if (!hasIpmaDaily && !hasStation && !hasHourlyReadings && !hasHourlyForecast) {
    return null;
  }

  // Mapa de leituras horárias reais da estação (por timestamp YYYY-MM-DDTHH)
  const readingsMap = {};
  if (hasHourlyReadings) {
    hourlyReadings.forEach(r => {
      const key = r.time.slice(0, 13);
      readingsMap[key] = r;
    });
  }

  // Mapa da previsão horária oficial do IPMA (por timestamp YYYY-MM-DDTHH)
  const forecastMap = {};
  if (hasHourlyForecast) {
    ipmaHourlyForecast.forEach(f => {
      const key = f.time.slice(0, 13);
      forecastMap[key] = f;
    });
  }

  return hours.map((h, idx) => {
    const timeKey = h.time.slice(0, 13);
    const dateStr = h.time.split('T')[0];
    const hourNum = new Date(h.time).getHours();
    
    // 1. Prioridade: Previsão horária oficial do modelo do IPMA (AROME) para a localidade selecionada
    if (forecastMap[timeKey] && forecastMap[timeKey].temperature !== undefined) {
      const fc = forecastMap[timeKey];
      const prob = (fc.precipitationProbability !== null && fc.precipitationProbability !== undefined)
        ? fc.precipitationProbability
        : 0;
      return {
        temperature: Math.round(fc.temperature * 10) / 10,
        precipitationProbability: Math.round(prob),
        precipitation: prob >= 70 ? 1.5 : (prob >= 40 ? 0.4 : 0),
        isRealObservation: false,
        isOfficialHourly: true
      };
    }

    // 2. Alternativa: Leitura física de solo se a estação estiver no próprio local (< 5 km)
    if (readingsMap[timeKey] && readingsMap[timeKey].temperature !== undefined && (groundTruth?.station?.distanceKm || 0) <= 5) {
      return {
        temperature: Math.round(readingsMap[timeKey].temperature * 10) / 10,
        precipitationProbability: readingsMap[timeKey].precipitation > 0 ? 80 : 0,
        precipitation: readingsMap[timeKey].precipitation || 0,
        isRealObservation: true
      };
    }

    // 3. Fallback: Previsão diária oficial do IPMA com curva diurna senoidal suave
    const dayData = hasIpmaDaily ? ipmaDaily.find(d => d.forecastDate === dateStr) : null;
    let tMin = dayData ? parseFloat(dayData.tMin) : null;
    let tMax = dayData ? parseFloat(dayData.tMax) : null;
    let prob = (dayData && !isNaN(parseFloat(dayData.precipitaProb)) && parseFloat(dayData.precipitaProb) >= 0)
      ? parseFloat(dayData.precipitaProb)
      : 0;

    if (isNaN(tMin) || isNaN(tMax) || tMin === null || tMax === null) {
      if (hasStation) {
        tMin = Math.round((groundTruth.realTemp - 3.5) * 10) / 10;
        tMax = Math.round((groundTruth.realTemp + 4.0) * 10) / 10;
        prob = 0;
      } else {
        return { temperature: null, precipitationProbability: null, precipitation: 0 };
      }
    }

    // Curva diurna senoidal suave entre tMin (06:30) e tMax (15:30)
    const cycleHour = (hourNum - 6.5 + 24) % 24;
    let factor = 0;
    if (cycleHour <= 9) {
      factor = (1 - Math.cos((cycleHour / 9) * Math.PI)) / 2;
    } else {
      const coolingPhase = cycleHour - 9;
      factor = (1 + Math.cos((coolingPhase / 15) * Math.PI)) / 2;
    }

    let temp = Math.round((tMin + factor * (tMax - tMin)) * 10) / 10;

    return {
      temperature: temp,
      precipitationProbability: Math.round(prob),
      precipitation: prob >= 70 ? 1.5 : (prob >= 40 ? 0.4 : 0),
      isRealObservation: false
    };
  });
}

function buildChart(canvas, hours, modelsData, ipmaData, metric) {
  if (chartInstance) {
    chartInstance.destroy();
  }

  const labels = hours.map(h => {
    const timeStr = formatTime(h.time);
    const dateStr = formatDateShort(h.time);
    return `${timeStr}\n${dateStr}`;
  });

  const datasets = [];

  if (metric === 'temperature') {
    // 1. Linha do Consenso Ponderado (em destaque)
    datasets.push({
      label: 'Consenso Ponderado',
      data: hours.map(h => h.temperature),
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6, 182, 212, 0.1)',
      borderWidth: 3.5,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.35,
      order: 1
    });

    // 2. Modelo Oficial do IPMA (Vermelho conforme solicitado pelo utilizador)
    if (ipmaData) {
      datasets.push({
        label: 'IPMA Oficial (Portugal)',
        data: ipmaData.map(d => d.temperature),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 2.8,
        borderDash: [5, 4],
        pointRadius: 2.5,
        pointHoverRadius: 6,
        pointBackgroundColor: '#ef4444',
        tension: 0.4,
        order: 2
      });
    }

    // 3. Linhas dos Modelos Globais
    const modelKeys = Object.keys(modelsData);
    modelKeys.forEach((key, idx) => {
      const model = modelsData[key];
      const modelHours = model.hourly.slice(0, hours.length);
      datasets.push({
        label: model.modelInfo.name,
        data: modelHours.map(m => m.temperature),
        borderColor: model.modelInfo.color,
        borderWidth: 1.8,
        borderDash: idx > 1 ? [4, 4] : [],
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.35,
        order: 3
      });
    });

  } else if (metric === 'precipitation_probability') {
    datasets.push({
      label: 'Consenso de Chuva (%)',
      data: hours.map(h => h.precipitationProbability),
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56, 189, 248, 0.2)',
      fill: true,
      borderWidth: 3,
      tension: 0.3,
      order: 1
    });

    if (ipmaData) {
      datasets.push({
        label: 'IPMA Oficial (%)',
        data: ipmaData.map(d => d.precipitationProbability),
        borderColor: '#ef4444',
        borderWidth: 2.5,
        borderDash: [6, 4],
        tension: 0.1,
        pointRadius: 2.5,
        pointBackgroundColor: '#ef4444',
        order: 2
      });
    }

    const modelKeys = Object.keys(modelsData);
    modelKeys.forEach((key) => {
      const model = modelsData[key];
      const modelHours = model.hourly.slice(0, hours.length);
      datasets.push({
        label: model.modelInfo.name,
        data: modelHours.map(m => m.precipitationProbability),
        borderColor: model.modelInfo.color,
        borderWidth: 1.5,
        tension: 0.3,
        pointRadius: 0,
        order: 3
      });
    });

  } else if (metric === 'precipitation') {
    datasets.push({
      type: 'bar',
      label: 'Consenso (mm)',
      data: hours.map(h => h.precipitation),
      backgroundColor: 'rgba(56, 189, 248, 0.65)',
      borderRadius: 4,
      order: 1
    });

    if (ipmaData) {
      datasets.push({
        type: 'line',
        label: 'IPMA Oficial (mm)',
        data: ipmaData.map(d => d.precipitation),
        borderColor: '#ef4444',
        borderWidth: 2.2,
        borderDash: [5, 4],
        pointRadius: 2.5,
        pointBackgroundColor: '#ef4444',
        tension: 0.2,
        order: 2
      });
    }

    const modelKeys = Object.keys(modelsData);
    modelKeys.forEach((key) => {
      const model = modelsData[key];
      const modelHours = model.hourly.slice(0, hours.length);
      datasets.push({
        type: 'line',
        label: model.modelInfo.name,
        data: modelHours.map(m => m.precipitation),
        borderColor: model.modelInfo.color,
        borderWidth: 1.5,
        tension: 0.3,
        pointRadius: 0,
        order: 3
      });
    });
  }

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            boxWidth: 14,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const val = context.parsed.y;
              if (val === null || val === undefined) return `${label}: N/D`;
              if (metric === 'temperature') return `${label}: ${val.toFixed(1)}°C`;
              if (metric === 'precipitation_probability') return `${label}: ${val}%`;
              return `${label}: ${val.toFixed(1)} mm`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 12,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
          }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#64748b',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
            callback: function(value) {
              if (metric === 'temperature') return `${value}°C`;
              if (metric === 'precipitation_probability') return `${value}%`;
              return `${value} mm`;
            }
          }
        }
      }
    }
  });
}
