export type JourneyDateMode = "auto" | "manual";
export type JourneyStopSource = "auto" | "manual";

export interface JourneyCompanion {
  id: string;
  journeyId: string;
  name: string;
  createdAt: string;
}

export interface JourneyTicketLink {
  id: string;
  journeyId: string;
  ticketId: string;
  createdAt: string;
}

export interface JourneyStop {
  id: string;
  journeyId: string;
  placeName: string;
  placeKey?: string;
  countryCode?: string;
  arrivalDateTime?: string;
  departureDateTime?: string;
  lodging?: string;
  notes?: string;
  source: JourneyStopSource;
  arrivalTicketId?: string;
  departureTicketId?: string;
  sortOrder: number;
  userEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyStopInput {
  id?: string;
  placeName: string;
  placeKey?: string;
  countryCode?: string;
  arrivalDateTime?: string;
  departureDateTime?: string;
  lodging?: string;
  notes?: string;
  source: JourneyStopSource;
  arrivalTicketId?: string;
  departureTicketId?: string;
  sortOrder: number;
  userEdited: boolean;
}

export interface Journey {
  id: string;
  title: string;
  destination?: string;
  dateMode: JourneyDateMode;
  startDate?: string;
  endDate?: string;
  notes?: string;
  rating?: number;
  mood?: string;
  costAmount?: number;
  costCurrency?: string;
  costExchangeRateToCny?: number;
  lodging?: string;
  companions: JourneyCompanion[];
  ticketIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JourneyMutationInput {
  title: string;
  destination?: string;
  dateMode: JourneyDateMode;
  startDate?: string;
  endDate?: string;
  notes?: string;
  rating?: number;
  mood?: string;
  costAmount?: number;
  costCurrency?: string;
  costExchangeRateToCny?: number;
  lodging?: string;
  companionNames: string[];
  ticketIds: string[];
}

export type CreateJourneyInput = JourneyMutationInput;

export type UpdateJourneyInput = JourneyMutationInput;
