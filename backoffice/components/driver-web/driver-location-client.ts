export type DriverLocationPayload = {
  latitude: number;
  longitude: number;
  speedMps: number | null;
  heading: number | null;
  capturedAt: string;
};

export async function captureDriverLocationPayload(): Promise<DriverLocationPayload | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) return null;

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 120000
    });
  }).catch(() => null);

  if (!position) return null;

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    speedMps: position.coords.speed ?? null,
    heading: position.coords.heading ?? null,
    capturedAt: new Date().toISOString()
  };
}

export async function reportDriverLocationOnce(payload?: DriverLocationPayload | null) {
  const nextPayload = payload ?? (await captureDriverLocationPayload());
  if (!nextPayload) return false;

  const response = await fetch("/api/driver/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nextPayload)
  }).catch(() => null);

  return Boolean(response?.ok);
}
