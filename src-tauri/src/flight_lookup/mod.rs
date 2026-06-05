pub mod aerodatabox;
pub mod mock;

use crate::models::{
    FlightLookupCandidatePayload, FlightLookupErrorPayload, FlightLookupRequestPayload,
};

pub const PROVIDER_MOCK: &str = "mock";
pub const PROVIDER_AERODATABOX: &str = "aerodatabox";
pub const AERODATABOX_GATEWAY_API_MARKET: &str = "apiMarket";
pub const AERODATABOX_GATEWAY_RAPID_API: &str = "rapidApi";

#[derive(Clone, Debug)]
pub struct FlightLookupProviderConfig {
    pub provider: String,
    pub gateway: String,
    pub api_key: Option<String>,
}

pub fn lookup_candidates(
    request: &FlightLookupRequestPayload,
    config: Option<&FlightLookupProviderConfig>,
) -> Result<Vec<FlightLookupCandidatePayload>, FlightLookupErrorPayload> {
    let normalized_flight_number = normalize_flight_number(&request.flight_number);
    let lookup_date = request.date.trim();

    if normalized_flight_number.is_empty() || !is_iso_date(lookup_date) {
        return Ok(vec![]);
    }

    match resolve_provider(config).as_str() {
        PROVIDER_MOCK => mock::lookup_candidates(&normalized_flight_number, lookup_date),
        PROVIDER_AERODATABOX => aerodatabox::lookup_candidates(
            &normalized_flight_number,
            lookup_date,
            &config
                .map(|value| value.gateway.clone())
                .unwrap_or_else(|| AERODATABOX_GATEWAY_API_MARKET.to_string()),
            config.and_then(|value| value.api_key.as_deref()),
        ),
        unsupported => Err(error_payload(
            "unsupported_provider",
            "This flight lookup provider is not supported by the current backend boundary.",
            Some(unsupported),
            false,
            None,
        )),
    }
}

pub fn error_payload(
    code: &str,
    message: &str,
    provider: Option<&str>,
    retryable: bool,
    details: Option<&str>,
) -> FlightLookupErrorPayload {
    FlightLookupErrorPayload {
        code: code.into(),
        message: message.into(),
        provider: provider.map(str::to_string),
        retryable,
        details: details.map(str::to_string),
    }
}

pub fn normalize_flight_number(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        .trim()
        .to_uppercase()
}

pub fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit())
}

fn resolve_provider(config: Option<&FlightLookupProviderConfig>) -> String {
    let configured_provider = config
        .map(|value| value.provider.trim().to_lowercase())
        .filter(|value| !value.is_empty());
    if let Some(provider) = configured_provider.as_deref() {
        return provider.to_string();
    }

    PROVIDER_MOCK.to_string()
}

#[cfg(test)]
mod tests {
    use super::{
        is_iso_date, lookup_candidates, normalize_flight_number, FlightLookupProviderConfig,
        AERODATABOX_GATEWAY_API_MARKET, PROVIDER_AERODATABOX, PROVIDER_MOCK,
    };
    use crate::models::FlightLookupRequestPayload;

    fn build_request(provider: &str) -> FlightLookupRequestPayload {
        FlightLookupRequestPayload {
            flight_number: "MF802".into(),
            date: "2026-06-05".into(),
            provider: provider.into(),
            locale: None,
            departure_airport_hint: None,
            arrival_airport_hint: None,
            country_hint: None,
        }
    }

    #[test]
    fn normalize_flight_number_strips_spacing_and_symbols() {
        assert_eq!(normalize_flight_number(" mf-802 "), "MF802");
    }

    #[test]
    fn iso_date_validation_accepts_expected_shape() {
        assert!(is_iso_date("2026-06-05"));
        assert!(!is_iso_date("2026/06/05"));
        assert!(!is_iso_date("20260605"));
    }

    #[test]
    fn lookup_defaults_to_mock_when_no_config_exists() {
        let results = lookup_candidates(&build_request(PROVIDER_AERODATABOX), None)
            .expect("mock lookup should succeed");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].provider, PROVIDER_AERODATABOX);
        assert_eq!(results[0].code, "MF802");
    }

    #[test]
    fn lookup_uses_saved_mock_provider_when_configured() {
        let results = lookup_candidates(
            &build_request(PROVIDER_AERODATABOX),
            Some(&FlightLookupProviderConfig {
                provider: PROVIDER_MOCK.into(),
                gateway: AERODATABOX_GATEWAY_API_MARKET.into(),
                api_key: None,
            }),
        )
        .expect("saved mock provider should still return local candidates");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].provider_label, "AeroDataBox mock via Tauri");
    }

    #[test]
    fn lookup_returns_missing_key_for_aerodatabox_config_without_secret() {
        let error = lookup_candidates(
            &build_request(PROVIDER_AERODATABOX),
            Some(&FlightLookupProviderConfig {
                provider: PROVIDER_AERODATABOX.into(),
                gateway: AERODATABOX_GATEWAY_API_MARKET.into(),
                api_key: None,
            }),
        )
        .expect_err("aerodatabox should reject missing API keys");

        assert_eq!(error.code, "missing_api_key");
        assert_eq!(error.provider.as_deref(), Some(PROVIDER_AERODATABOX));
    }

    #[test]
    fn lookup_returns_empty_for_unknown_flights() {
        let results = lookup_candidates(
            &FlightLookupRequestPayload {
                flight_number: "ZZ999".into(),
                ..build_request(PROVIDER_MOCK)
            },
            None,
        )
        .expect("unknown mock flight should be empty");

        assert!(results.is_empty());
    }
}
