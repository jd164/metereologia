/**
 * Mapeamento de códigos meteorológicos WMO e IPMA para descrições em Português
 * e gerador de ícones SVG modernos com animações e cores celestes.
 */

export const WMO_CODES = {
  0: { label: 'Céu Limpo', icon: 'sun', type: 'clear' },
  1: { label: 'Predomínio de Sol', icon: 'sun-cloud', type: 'clear' },
  2: { label: 'Parcialmente Nublado', icon: 'sun-cloud', type: 'cloudy' },
  3: { label: 'Encoberto', icon: 'cloud', type: 'cloudy' },
  45: { label: 'Nevoeiro', icon: 'fog', type: 'fog' },
  48: { label: 'Nevoeiro com Geada', icon: 'fog', type: 'fog' },
  51: { label: 'Chuvisco Ligeiro', icon: 'drizzle', type: 'rain' },
  53: { label: 'Chuvisco Moderado', icon: 'drizzle', type: 'rain' },
  55: { label: 'Chuvisco Denso', icon: 'drizzle', type: 'rain' },
  61: { label: 'Chuva Fraca', icon: 'rain-light', type: 'rain' },
  63: { label: 'Chuva Moderada', icon: 'rain-med', type: 'rain' },
  65: { label: 'Chuva Forte', icon: 'rain-heavy', type: 'rain' },
  71: { label: 'Queda de Neve Fraca', icon: 'snow', type: 'snow' },
  73: { label: 'Neve Moderada', icon: 'snow', type: 'snow' },
  75: { label: 'Neve Forte', icon: 'snow', type: 'snow' },
  80: { label: 'Aguaceiros Fracos', icon: 'showers', type: 'rain' },
  81: { label: 'Aguaceiros Moderados', icon: 'showers', type: 'rain' },
  82: { label: 'Aguaceiros Violentos', icon: 'rain-heavy', type: 'rain' },
  95: { label: 'Trovoada', icon: 'thunder', type: 'thunder' },
  96: { label: 'Trovoada com Granizo Fraco', icon: 'thunder-hail', type: 'thunder' },
  99: { label: 'Trovoada com Granizo Forte', icon: 'thunder-hail', type: 'thunder' }
};

export function getWeatherInfo(code) {
  return WMO_CODES[code] || { label: 'Condições Variáveis', icon: 'sun-cloud', type: 'variable' };
}

/**
 * Retorna o SVG correspondente ao tipo de tempo
 */
export function getWeatherSvg(iconName, size = 36, isNight = false) {
  const s = size;
  switch (iconName) {
    case 'sun':
      if (isNight) {
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg svg-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
      }
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg svg-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;

    case 'sun-cloud':
      if (isNight) {
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg svg-cloud-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M17.5 19H9a5 5 0 0 1 0-10c.2 0 .4 0 .6.1A5.5 5.5 0 0 1 19.5 14a4 4 0 0 1-2 5Z"/></svg>`;
      }
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg svg-sun-cloud"><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M17.5 19H9a5 5 0 0 1 0-10c.29 0 .57.02.84.07A5.5 5.5 0 0 1 20 13.5a4.5 4.5 0 0 1-2.5 5.5Z"/></svg>`;

    case 'cloud':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg svg-cloud"><path d="M17.5 19H9a5 5 0 0 1 0-10c.2 0 .4 0 .6.1A5.5 5.5 0 0 1 19.5 14a4 4 0 0 1-2 5Z"/></svg>`;

    case 'rain-light':
    case 'drizzle':
    case 'showers':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg svg-rain"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`;

    case 'rain-med':
    case 'rain-heavy':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg svg-rain-heavy"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m14 14-2 6"/><path d="m10 14-2 6"/><path d="m18 14-2 6"/></svg>`;

    case 'thunder':
    case 'thunder-hail':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg svg-thunder"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>`;

    case 'snow':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg svg-snow"><path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="m14 20 1.25-2.5L18 18"/><path d="m14 4 1.25 2.5L18 6"/><path d="m17 21-3-6h-4l-3 6"/><path d="m17 3-3 6h-4L7 3"/><path d="M2 12h20"/><path d="m20 10-2.5 1.25L18 14"/><path d="m4 10 2.5 1.25L6 14"/><path d="m20 14-2.5-1.25L18 10"/><path d="m4 14 2.5-1.25L6 10"/></svg>`;

    case 'fog':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg svg-fog"><path d="M4 14h16"/><path d="M4 18h16"/><path d="M4 10h16"/><path d="M4 6h16"/></svg>`;

    default:
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="weather-svg"><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/></svg>`;
  }
}
