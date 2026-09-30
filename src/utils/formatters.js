/**
 * Formatadores de datas, horas, temperaturas e valores meteorológicos em Português
 */

export function formatTime(isoString) {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export function formatDayOfWeek(isoString, short = false) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const today = new Date();
  
  if (date.toDateString() === today.toDateString()) {
    return 'Hoje';
  }
  
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Amanhã';
  }

  return date.toLocaleDateString('pt-PT', {
    weekday: short ? 'short' : 'long'
  }).replace(/^\w/, c => c.toUpperCase());
}

export function formatDateShort(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

export function formatTemp(temp) {
  if (temp === null || temp === undefined || isNaN(temp)) return '--';
  return Math.round(temp);
}

export function formatWind(speedKmH, dir = '') {
  if (speedKmH === null || speedKmH === undefined) return '-- km/h';
  const s = Math.round(speedKmH);
  return dir ? `${s} km/h ${dir}` : `${s} km/h`;
}
