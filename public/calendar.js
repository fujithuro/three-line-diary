import holidays from './holidays.js';
export function dateLabel(date) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const holiday = holidays[date] || '';
  return {
    date: `${year}年${month}月${day}日`,
    weekday: `(${'日月火水木金土'[weekday]}${holiday ? '・祝' : ''})`,
    className: holiday || weekday === 0 ? 'weekday-holiday' : weekday === 6 ? 'weekday-saturday' : '',
    holiday,
  };
}
