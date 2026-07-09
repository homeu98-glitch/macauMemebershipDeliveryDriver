import macauDistrictGeoJson from "./data/macau-districts.geojson.json";
import { createServiceRoleSupabaseClient } from "./supabase";

type Position = [number, number];
type PolygonCoordinates = Position[][];
type MultiPolygonCoordinates = Position[][][];

type DistrictFeature = {
  properties?: {
    nameCht?: string;
    namePor?: string;
  };
  geometry?: {
    type?: "Polygon" | "MultiPolygon";
    coordinates?: PolygonCoordinates | MultiPolygonCoordinates;
  };
};

const districtFeatures = ((macauDistrictGeoJson as unknown as { features?: DistrictFeature[] }).features ?? []).filter(
  (feature) => feature.properties?.nameCht && feature.geometry?.coordinates
);

function pointInRing(longitude: number, latitude: number, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(longitude: number, latitude: number, polygon: PolygonCoordinates) {
  if (!polygon.length) return false;
  if (!pointInRing(longitude, latitude, polygon[0])) return false;
  for (let index = 1; index < polygon.length; index += 1) {
    if (pointInRing(longitude, latitude, polygon[index])) return false;
  }
  return true;
}

export function findMacauDistrict(latitude?: number | null, longitude?: number | null) {
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  for (const feature of districtFeatures) {
    const geometry = feature.geometry;
    if (!geometry?.coordinates) continue;

    if (geometry.type === "Polygon") {
      if (pointInPolygon(longitude, latitude, geometry.coordinates as PolygonCoordinates)) {
        return feature.properties?.nameCht ?? null;
      }
      continue;
    }

    if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates as MultiPolygonCoordinates) {
        if (pointInPolygon(longitude, latitude, polygon)) {
          return feature.properties?.nameCht ?? null;
        }
      }
    }
  }

  return null;
}

export function listMacauDistrictNames() {
  return districtFeatures
    .map((feature) => feature.properties?.nameCht?.trim())
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

export async function backfillStoredDistricts() {
  const supabase = createServiceRoleSupabaseClient();

  const [{ data: shops, error: shopsError }, { data: customers, error: customersError }] = await Promise.all([
    supabase.from("shops").select("id,latitude,longitude,district").not("latitude", "is", null).not("longitude", "is", null),
    supabase.from("customers").select("id,latitude,longitude,district").not("latitude", "is", null).not("longitude", "is", null)
  ]);

  if (shopsError) throw shopsError;
  if (customersError) throw customersError;

  let updatedShops = 0;
  let updatedCustomers = 0;

  for (const row of shops ?? []) {
    const district = findMacauDistrict(Number(row.latitude), Number(row.longitude));
    if ((row.district ?? null) === district) continue;
    const { error } = await supabase.from("shops").update({ district }).eq("id", row.id);
    if (error) throw error;
    updatedShops += 1;
  }

  for (const row of customers ?? []) {
    const district = findMacauDistrict(Number(row.latitude), Number(row.longitude));
    if ((row.district ?? null) === district) continue;
    const { error } = await supabase.from("customers").update({ district }).eq("id", row.id);
    if (error) throw error;
    updatedCustomers += 1;
  }

  return {
    districtCount: districtFeatures.length,
    updatedShops,
    updatedCustomers
  };
}
