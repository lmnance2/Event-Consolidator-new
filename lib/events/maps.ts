export function googleMapsUrl(venue: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}

export function appleMapsUrl(venue: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(venue)}`;
}
