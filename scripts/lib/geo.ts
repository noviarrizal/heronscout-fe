// Service-area businesses hide their address on Google Maps, so Apify returns no country.
// Their pin still has coordinates; rough bounding boxes are enough for the countries we email.
const boxes: { code: string; lat: [number, number]; lng: [number, number] }[] = [
  { code: "US", lat: [24.4, 49.4], lng: [-124.8, -66.9] },
  { code: "GB", lat: [49.8, 60.9], lng: [-8.7, 1.8] },
  { code: "AU", lat: [-43.7, -10.6], lng: [113.1, 153.7] },
];

export function countryFromLocation(location?: { lat?: number; lng?: number } | null) {
  if (location?.lat == null || location?.lng == null) return null;
  const { lat, lng } = location;
  return boxes.find((b) => lat >= b.lat[0] && lat <= b.lat[1] && lng >= b.lng[0] && lng <= b.lng[1])?.code ?? null;
}
