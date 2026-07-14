export async function reportDriverLocationOnce() {
  if (typeof window === "undefined" || !("geolocation" in navigator)) return false;

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 120000
    });
  }).catch(() => null);

  if (!position) return false;

  const payload = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    speedMps: position.coords.speed ?? null,
    heading: position.coords.heading ?? null
  };

  const response = await fetch("/api/driver/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => null);

  return Boolean(response?.ok);
}
