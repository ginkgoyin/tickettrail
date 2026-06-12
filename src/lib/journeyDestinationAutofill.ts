export interface JourneyDestinationAutofillState {
  destination: string;
  previousAutoFilledDestination: string;
  manuallyEdited: boolean;
}

export interface JourneyDestinationAutofillResult {
  destination: string;
  previousAutoFilledDestination: string;
}

export function resolveJourneyDestinationAutofill(
  state: JourneyDestinationAutofillState,
  currentSuggestion: string,
): JourneyDestinationAutofillResult {
  const destination = state.destination.trim();
  const previousAutoFilledDestination = state.previousAutoFilledDestination.trim();
  const suggestion = currentSuggestion.trim();

  if (!suggestion) {
    if (!state.manuallyEdited && destination && destination === previousAutoFilledDestination) {
      return {
        destination: "",
        previousAutoFilledDestination: "",
      };
    }

    return {
      destination: state.destination,
      previousAutoFilledDestination: previousAutoFilledDestination,
    };
  }

  if (!destination) {
    return {
      destination: suggestion,
      previousAutoFilledDestination: suggestion,
    };
  }

  if (!state.manuallyEdited && destination === previousAutoFilledDestination) {
    return {
      destination: suggestion,
      previousAutoFilledDestination: suggestion,
    };
  }

  return {
    destination: state.destination,
    previousAutoFilledDestination: previousAutoFilledDestination,
  };
}
