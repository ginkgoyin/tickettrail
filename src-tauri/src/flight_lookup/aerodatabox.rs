use crate::models::{FlightLookupCandidatePayload, FlightLookupErrorPayload};

use super::{error_payload, PROVIDER_AERODATABOX};

pub fn lookup_candidates(
    _flight_number: &str,
    _lookup_date: &str,
    api_key: Option<&str>,
) -> Result<Vec<FlightLookupCandidatePayload>, FlightLookupErrorPayload> {
    if api_key.map(str::trim).filter(|value| !value.is_empty()).is_none() {
        return Err(error_payload(
            "missing_api_key",
            "AeroDataBox is selected, but no local API key is configured yet.",
            Some(PROVIDER_AERODATABOX),
            false,
            Some("Real AeroDataBox integration is not connected in this phase."),
        ));
    }

    Err(error_payload(
        "provider_not_implemented",
        "AeroDataBox is selected, but the live provider adapter is still a skeleton in this phase.",
        Some(PROVIDER_AERODATABOX),
        false,
        Some("No real network request has been implemented yet."),
    ))
}
