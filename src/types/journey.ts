export type JourneyDateMode = "auto" | "manual";

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
