/**
 * Where the cities the records' city registrations come from sit, as
 * [longitude, latitude], so the Registrations map can pin a registration on
 * its city rather than the middle of its state. One row per register the
 * ingest reads (`cityRegistrations[].city` / `.state`); a city missing here
 * falls back to its state's centre.
 */
const CITY_LNG_LAT: Record<string, [number, number]> = {
  'San Francisco|CA': [-122.4194, 37.7749],
  'Los Angeles|CA': [-118.2437, 34.0522],
  'Seattle|WA': [-122.3321, 47.6062],
  'Washington|DC': [-77.0369, 38.9072]
}

export const cityLngLat = (city: string, state: string): [number, number] | undefined =>
  CITY_LNG_LAT[`${city}|${state}`]
