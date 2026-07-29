// Формула гаверсинуса - стандартный способ посчитать расстояние между двумя
// точками на земном шаре по широте/долготе (в километрах). Используется, чтобы
// проверить, находится ли человек рядом с аэропортом (см. useAirportPresence.ts).

export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const EARTH_RADIUS_KM = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}
