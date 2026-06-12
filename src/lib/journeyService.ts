import { invoke } from "@tauri-apps/api/core";
import type {
  CreateJourneyInput,
  Journey,
  JourneyStop,
  JourneyStopInput,
  UpdateJourneyInput,
} from "../types/journey";

export async function listJourneys(): Promise<Journey[]> {
  return invoke<Journey[]>("list_journeys");
}

export async function getJourney(journeyId: string): Promise<Journey> {
  return invoke<Journey>("get_journey", { journeyId });
}

export async function createJourney(input: CreateJourneyInput): Promise<Journey> {
  return invoke<Journey>("create_journey", { input });
}

export async function updateJourney(
  journeyId: string,
  input: UpdateJourneyInput,
): Promise<Journey> {
  return invoke<Journey>("update_journey", { journeyId, input });
}

export async function deleteJourney(journeyId: string): Promise<void> {
  return invoke<void>("delete_journey", { journeyId });
}

export async function listJourneyStops(journeyId: string): Promise<JourneyStop[]> {
  return invoke<JourneyStop[]>("list_journey_stops", { journeyId });
}

export async function replaceJourneyStops(
  journeyId: string,
  stops: JourneyStopInput[],
): Promise<JourneyStop[]> {
  return invoke<JourneyStop[]>("replace_journey_stops", { journeyId, stops });
}
