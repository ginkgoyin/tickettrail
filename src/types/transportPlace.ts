export type TransportEndpointType = "airport" | "rail_station";
export type TransportPlaceMappingConfidence = "high" | "medium" | "low";

export interface TransportPlaceMappingEntry {
  defaultJourneyPlaceKey: string;
  mappingSource: string;
  mappingConfidence: TransportPlaceMappingConfidence;
}

export interface TransportPlaceCatalogEntry {
  nameEn: string;
  nameZh?: string;
}

export interface TransportPlaceMappingData {
  airports: Record<string, TransportPlaceMappingEntry>;
  railStations: Record<string, TransportPlaceMappingEntry>;
  places: Record<string, TransportPlaceCatalogEntry>;
}
