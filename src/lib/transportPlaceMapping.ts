import mappingData from "../data/transport-place.generated.json";
import type { TransportEndpointType, TransportPlaceMappingData } from "../types/transportPlace";

const TRANSPORT_PLACE_MAPPING = mappingData as TransportPlaceMappingData;

function normalizeCode(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

export function getTransportPlaceMapping(endpointType: TransportEndpointType, endpointCode?: string | null) {
  const code = normalizeCode(endpointCode);
  if (!code) {
    return null;
  }

  const endpointMapping =
    endpointType === "airport"
      ? TRANSPORT_PLACE_MAPPING.airports[code] ?? null
      : TRANSPORT_PLACE_MAPPING.railStations[code] ?? null;
  if (!endpointMapping) {
    return null;
  }

  const place = TRANSPORT_PLACE_MAPPING.places[endpointMapping.defaultJourneyPlaceKey];
  if (!place) {
    return null;
  }

  return {
    ...endpointMapping,
    defaultJourneyPlaceNameEn: place.nameEn,
    defaultJourneyPlaceNameZh: place.nameZh,
  };
}

export function listTransportPlaceMappings() {
  return TRANSPORT_PLACE_MAPPING;
}
