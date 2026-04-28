export type TicketType = "flight" | "train";

export interface TicketLocation {
  name: string;
  code?: string;
  timezone: string;
}

export interface TicketDraft {
  ticketType: TicketType;
  carrierName: string;
  code: string;
  departure: TicketLocation;
  arrival: TicketLocation;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  classInfo: string;
  seatInfo: string;
  notes: string;
}

export interface TicketRecord extends TicketDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  routeLabel: string;
  status: "draft" | "saved";
}
