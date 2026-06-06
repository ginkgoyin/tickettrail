export type TicketType = "flight" | "train";
export type TicketStatus = "draft" | "saved" | "used" | "archived";

export interface TicketLocation {
  name: string;
  code?: string;
  timezone: string;
}

export interface TicketSegmentDraft {
  carrierName: string;
  code: string;
  departure: TicketLocation;
  arrival: TicketLocation;
  departureTerminal?: string;
  arrivalTerminal?: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  classInfo: string;
  seatInfo: string;
  notes: string;
}

export interface TicketDraft {
  ticketType: TicketType;
  carrierName: string;
  code: string;
  departure: TicketLocation;
  arrival: TicketLocation;
  departureTerminal?: string;
  arrivalTerminal?: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  classInfo: string;
  seatInfo: string;
  notes: string;
  segments?: TicketSegmentDraft[];
}

export interface TicketRecord extends TicketDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  routeLabel: string;
  status: TicketStatus;
  segmentCount: number;
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  filePath?: string;
  previewUrl?: string;
}

export interface TicketAttachmentUpload {
  fileName: string;
  mimeType: string;
  bytes: number[];
}

export interface AirlineDirectoryEntry {
  id: string;
  iataCode: string;
  icaoCode?: string;
  nameEn: string;
  nameZh?: string;
  aliases: string[];
  countryCode?: string;
  logoKey?: string;
}

export interface LocationDirectoryEntry {
  id: string;
  locationType: string;
  code?: string;
  nameZh?: string;
  nameEn?: string;
  aliases: string[];
  pinyin?: string;
  shortPinyin?: string;
  stationIndex?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  countryCode?: string;
}

export interface MapPointPayload {
  label: string;
  code?: string;
  timezone: string;
  latitude: number;
  longitude: number;
}

export interface MapViewportPayload {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export interface MapRoutePayload {
  lineLabel: string;
  directionHint: string;
  distanceHintKm: number;
  origin: MapPointPayload;
  destination: MapPointPayload;
  viewport: MapViewportPayload;
}

export interface MapSegmentPayload {
  segmentIndex: number;
  ticketId?: string;
  transportType: TicketType;
  carrierName: string;
  code: string;
  lineLabel: string;
  directionHint: string;
  distanceHintKm: number;
  origin: MapPointPayload;
  destination: MapPointPayload;
}

export interface StubPreviewPayload {
  title: string;
  subtitle: string;
  transportBadge: string;
  primaryCode: string;
  departureLabel: string;
  departureTerminal?: string;
  departureTimeLocal: string;
  arrivalLabel: string;
  arrivalTerminal?: string;
  arrivalTimeLocal: string;
  carrierName: string;
  seatLabel: string;
  notes: string;
  routeLabel: string;
  accent: string;
}

export interface TicketDetailPayload {
  ticket: TicketRecord;
  map: MapRoutePayload;
  segments: MapSegmentPayload[];
  stub: StubPreviewPayload;
  attachments: TicketAttachment[];
}

export interface BackupRecord {
  id: string;
  label: string;
  createdAt: string;
  ticketCount: number;
  attachmentCount: number;
  databaseSizeBytes: number;
}

export interface BackupReadiness {
  databaseExists: boolean;
  databasePath: string;
  attachmentRootPath: string;
  ticketCount: number;
  attachmentCount: number;
}
