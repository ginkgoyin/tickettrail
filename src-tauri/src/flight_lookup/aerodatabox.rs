use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use chrono::{DateTime, NaiveDateTime};
use reqwest::blocking::{Client, Response};
use reqwest::header::{ACCEPT, CONTENT_TYPE, HeaderMap, HeaderValue};
use reqwest::{StatusCode, Url};
use serde::Deserialize;

use crate::models::{
    FlightLookupCandidatePayload, FlightLookupErrorPayload, FlightLookupLocationPayload,
};

use super::{
    error_payload, AERODATABOX_GATEWAY_API_MARKET, AERODATABOX_GATEWAY_RAPID_API,
    PROVIDER_AERODATABOX,
};

const AERODATABOX_PROVIDER_LABEL: &str = "AeroDataBox";
const AERODATABOX_SOURCE_NOTE: &str = "AeroDataBox schedule/status result";
const API_MARKET_BASE_URL: &str = "https://prod.api.market/api/v1/aedbx/aerodatabox";
const RAPID_API_BASE_URL: &str = "https://aerodatabox.p.rapidapi.com";
const RAPID_API_HOST: &str = "aerodatabox.p.rapidapi.com";
const LOOKUP_CACHE_TTL_SECONDS: u64 = 300;

static LOOKUP_CACHE: OnceLock<Mutex<HashMap<String, CachedLookupEntry>>> = OnceLock::new();

#[derive(Clone, Debug)]
struct AerodataboxGatewayConfig {
    base_url: &'static str,
    auth_header_name: &'static str,
    rapid_api_host: Option<&'static str>,
}

#[derive(Clone, Debug)]
struct CachedLookupEntry {
    inserted_at: Instant,
    candidates: Vec<FlightLookupCandidatePayload>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AerodataboxDateTime {
    local: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AerodataboxAirport {
    name: Option<String>,
    iata: Option<String>,
    icao: Option<String>,
    time_zone: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AerodataboxAirportMovement {
    airport: Option<AerodataboxAirport>,
    terminal: Option<String>,
    scheduled_time: Option<AerodataboxDateTime>,
    revised_time: Option<AerodataboxDateTime>,
    quality: Option<Vec<String>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AerodataboxAirline {
    name: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AerodataboxAircraft {
    model: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AerodataboxFlight {
    number: Option<String>,
    status: Option<String>,
    airline: Option<AerodataboxAirline>,
    aircraft: Option<AerodataboxAircraft>,
    departure: Option<AerodataboxAirportMovement>,
    arrival: Option<AerodataboxAirportMovement>,
}

pub fn lookup_candidates(
    flight_number: &str,
    lookup_date: &str,
    gateway: &str,
    api_key: Option<&str>,
) -> Result<Vec<FlightLookupCandidatePayload>, FlightLookupErrorPayload> {
    let api_key = api_key
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            error_payload(
                "missing_api_key",
                "AeroDataBox is selected, but no local API key is configured yet.",
                Some(PROVIDER_AERODATABOX),
                false,
                Some("Save a local AeroDataBox API key in Settings before using the live provider."),
            )
        })?;

    let cache_key = build_cache_key(gateway, flight_number, lookup_date);
    if let Some(cached_candidates) = get_cached_candidates(&cache_key) {
        return Ok(cached_candidates);
    }

    let gateway_config = gateway_config(gateway)?;
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| {
            error_payload(
                "network_error",
                "The AeroDataBox HTTP client could not be prepared.",
                Some(PROVIDER_AERODATABOX),
                true,
                None,
            )
        })?;

    let response = client
        .get(build_lookup_url(gateway_config.base_url, flight_number, lookup_date)?)
        .headers(build_headers(gateway_config, api_key)?)
        .send()
        .map_err(|_| {
            error_payload(
                "network_error",
                "AeroDataBox could not be reached from the desktop backend.",
                Some(PROVIDER_AERODATABOX),
                true,
                None,
            )
        })?;

    if response.status() == StatusCode::NO_CONTENT {
        return Err(error_payload(
            "no_results",
            "No AeroDataBox results matched this flight number and date.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        ));
    }

    if response.status() == StatusCode::TOO_MANY_REQUESTS {
        return Err(error_payload(
            "rate_limited",
            "AeroDataBox rate limits were reached for the current desktop request.",
            Some(PROVIDER_AERODATABOX),
            true,
            None,
        ));
    }

    if response.status() == StatusCode::UNAUTHORIZED {
        return Err(error_payload(
            "provider_unauthorized",
            "The saved AeroDataBox API key was rejected by the provider.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        ));
    }

    if response.status() == StatusCode::FORBIDDEN {
        return Err(error_payload(
            "provider_unauthorized",
            "The selected AeroDataBox gateway rejected this request. Check the saved API key, gateway choice, and marketplace subscription.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        ));
    }

    if response.status() == StatusCode::NOT_FOUND {
        return Err(error_payload(
            "provider_response_parse_error",
            "The current AeroDataBox gateway path could not be reached with this backend configuration.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        ));
    }

    if response.status() == StatusCode::BAD_REQUEST
    {
        let status = response.status();
        let headers = response.headers().clone();
        let body = response
            .text()
            .unwrap_or_else(|_| "<failed to read AeroDataBox response body>".to_string());

        eprintln!(
            "[AeroDataBox lookup failed] status={} flight_number={} lookup_date={} body={}",
            status,
            flight_number,
            lookup_date,
            body
        );

        eprintln!(
            "[AeroDataBox rate-limit headers] limit={:?} remaining={:?} reset={:?} rapid_free_remaining={:?}",
            headers.get("x-ratelimit-requests-limit"),
            headers.get("x-ratelimit-requests-remaining"),
            headers.get("x-ratelimit-requests-reset"),
            headers.get("x-rate-limit-rapid-free-plans-hard-limit-remaining"),
        );

        return Err(error_payload(
            "provider_response_parse_error",
            "AeroDataBox rejected this flight number and date lookup request. AeroDataBox only supports flight lookup dates within the last 365 days and up to 365 days ahead. This ticket date is outside the provider's data range. Please enter the flight details manually.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        ));
    }

    if response.status() == StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS {
        return Err(error_payload(
            "provider_response_parse_error",
            "AeroDataBox could not serve this lookup because of current marketplace, legal, or data-coverage restrictions.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        ));
    }

    if response.status() == StatusCode::INTERNAL_SERVER_ERROR
        || response.status() == StatusCode::SERVICE_UNAVAILABLE
    {
        return Err(error_payload(
            "network_error",
            "AeroDataBox is temporarily unavailable for live flight lookup.",
            Some(PROVIDER_AERODATABOX),
            true,
            None,
        ));
    }

    if !response.status().is_success() {
        return Err(error_payload(
            "provider_response_parse_error",
            "AeroDataBox returned an unexpected flight lookup response.",
            Some(PROVIDER_AERODATABOX),
            response.status().is_server_error(),
            None,
        ));
    }

    let flights = parse_response_flights(response)?;
    if flights.is_empty() {
        return Err(error_payload(
            "no_results",
            "No AeroDataBox results matched this flight number and date.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        ));
    }

    let candidates = flights
        .into_iter()
        .enumerate()
        .map(|(index, flight)| map_candidate(flight_number, lookup_date, index, flight))
        .collect::<Vec<_>>();
    store_cached_candidates(&cache_key, &candidates);
    Ok(candidates)
}

fn gateway_config(gateway: &str) -> Result<AerodataboxGatewayConfig, FlightLookupErrorPayload> {
    match gateway {
        AERODATABOX_GATEWAY_API_MARKET => Ok(AerodataboxGatewayConfig {
            base_url: API_MARKET_BASE_URL,
            auth_header_name: "x-magicapi-key",
            rapid_api_host: None,
        }),
        AERODATABOX_GATEWAY_RAPID_API => Ok(AerodataboxGatewayConfig {
            base_url: RAPID_API_BASE_URL,
            auth_header_name: "X-RapidAPI-Key",
            rapid_api_host: Some(RAPID_API_HOST),
        }),
        _ => Err(error_payload(
            "missing_provider_configuration",
            "The saved AeroDataBox gateway is not supported by the current backend configuration.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        )),
    }
}

fn build_lookup_url(
    base_url: &str,
    flight_number: &str,
    lookup_date: &str,
) -> Result<Url, FlightLookupErrorPayload> {
    let mut url = Url::parse(base_url).map_err(|_| {
        error_payload(
            "missing_provider_configuration",
            "The AeroDataBox base URL is invalid in the current backend configuration.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        )
    })?;
    {
        let mut segments = url.path_segments_mut().map_err(|_| {
            error_payload(
                "missing_provider_configuration",
                "The AeroDataBox lookup path could not be prepared.",
                Some(PROVIDER_AERODATABOX),
                false,
                None,
            )
        })?;
        segments.extend(["flights", "number", flight_number, lookup_date]);
    }
    url.query_pairs_mut()
        .append_pair("dateLocalRole", "Both")
        .append_pair("withLocation", "false")
        .append_pair("withAircraftImage", "false")
        .append_pair("withFlightPlan", "false");
    Ok(url)
}

fn build_headers(
    gateway: AerodataboxGatewayConfig,
    api_key: &str,
) -> Result<HeaderMap, FlightLookupErrorPayload> {
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        gateway.auth_header_name,
        HeaderValue::from_str(api_key).map_err(|_| {
            error_payload(
                "missing_provider_configuration",
                "The saved AeroDataBox API key could not be applied to the desktop request.",
                Some(PROVIDER_AERODATABOX),
                false,
                None,
            )
        })?,
    );

    if let Some(host) = gateway.rapid_api_host {
        headers.insert(
            "X-RapidAPI-Host",
            HeaderValue::from_static(host),
        );
    }

    Ok(headers)
}

fn parse_response_flights(
    response: Response,
) -> Result<Vec<AerodataboxFlight>, FlightLookupErrorPayload> {
    let payload = response.json::<serde_json::Value>().map_err(|_| {
        error_payload(
            "provider_response_parse_error",
            "AeroDataBox returned flight data that could not be parsed safely.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        )
    })?;

    match payload {
        serde_json::Value::Array(_) => serde_json::from_value(payload).map_err(|_| {
            error_payload(
                "provider_response_parse_error",
                "AeroDataBox returned an unexpected flight list shape.",
                Some(PROVIDER_AERODATABOX),
                false,
                None,
            )
        }),
        serde_json::Value::Object(mut object) => {
            if let Some(items) = object.remove("items") {
                serde_json::from_value(items).map_err(|_| {
                    error_payload(
                        "provider_response_parse_error",
                        "AeroDataBox returned an unexpected wrapped flight list shape.",
                        Some(PROVIDER_AERODATABOX),
                        false,
                        None,
                    )
                })
            } else {
                serde_json::from_value(serde_json::Value::Object(object))
                    .map(|flight| vec![flight])
                    .map_err(|_| {
                        error_payload(
                            "provider_response_parse_error",
                            "AeroDataBox returned an unexpected flight payload.",
                            Some(PROVIDER_AERODATABOX),
                            false,
                            None,
                        )
                    })
            }
        }
        _ => Err(error_payload(
            "provider_response_parse_error",
            "AeroDataBox returned a flight payload that the desktop adapter could not normalize.",
            Some(PROVIDER_AERODATABOX),
            false,
            None,
        )),
    }
}

fn map_candidate(
    fallback_flight_number: &str,
    lookup_date: &str,
    index: usize,
    flight: AerodataboxFlight,
) -> FlightLookupCandidatePayload {
    let departure_code = airport_code(flight.departure.as_ref().and_then(|value| value.airport.as_ref()));
    let arrival_code = airport_code(flight.arrival.as_ref().and_then(|value| value.airport.as_ref()));

    let departure_quality = flight
        .departure
        .as_ref()
        .and_then(|value| value.quality.as_ref())
        .map(|value| value.join(", "));
    let arrival_quality = flight
        .arrival
        .as_ref()
        .and_then(|value| value.quality.as_ref())
        .map(|value| value.join(", "));

    FlightLookupCandidatePayload {
        id: format!(
            "{}-{}-{}",
            normalize_code(flight.number.as_deref(), fallback_flight_number),
            lookup_date,
            index
        ),
        provider: PROVIDER_AERODATABOX.into(),
        provider_label: AERODATABOX_PROVIDER_LABEL.into(),
        source_note: AERODATABOX_SOURCE_NOTE.into(),
        carrier_name: trim_or_fallback(
            flight.airline.as_ref().and_then(|value| value.name.as_deref()),
            "Unknown airline",
        ),
        code: normalize_code(flight.number.as_deref(), fallback_flight_number),
        departure: FlightLookupLocationPayload {
            name: airport_name(
                flight
                    .departure
                    .as_ref()
                    .and_then(|value| value.airport.as_ref()),
                &departure_code,
            ),
            code: departure_code,
            timezone: trim_or_fallback(
                flight
                    .departure
                    .as_ref()
                    .and_then(|value| value.airport.as_ref())
                    .and_then(|value| value.time_zone.as_deref()),
                "",
            ),
        },
        arrival: FlightLookupLocationPayload {
            name: airport_name(
                flight.arrival.as_ref().and_then(|value| value.airport.as_ref()),
                &arrival_code,
            ),
            code: arrival_code,
            timezone: trim_or_fallback(
                flight
                    .arrival
                    .as_ref()
                    .and_then(|value| value.airport.as_ref())
                    .and_then(|value| value.time_zone.as_deref()),
                "",
            ),
        },
        departure_terminal: trimmed_optional(
            flight
                .departure
                .as_ref()
                .and_then(|value| value.terminal.as_deref()),
        ),
        arrival_terminal: trimmed_optional(
            flight
                .arrival
                .as_ref()
                .and_then(|value| value.terminal.as_deref()),
        ),
        departure_time_local: best_local_time(flight.departure.as_ref()),
        arrival_time_local: best_local_time(flight.arrival.as_ref()),
        aircraft: trimmed_optional(flight.aircraft.as_ref().and_then(|value| value.model.as_deref())),
        flight_status: trimmed_optional(flight.status.as_deref()),
        confidence: build_confidence_note(departure_quality.as_deref(), arrival_quality.as_deref()),
    }
}

fn best_local_time(movement: Option<&AerodataboxAirportMovement>) -> String {
    normalize_local_datetime(
        movement
            .and_then(|value| value.revised_time.as_ref())
            .and_then(|value| value.local.as_deref()),
    )
    .or_else(|| {
        normalize_local_datetime(
            movement
                .and_then(|value| value.scheduled_time.as_ref())
                .and_then(|value| value.local.as_deref()),
        )
    })
    .unwrap_or_default()
}

fn normalize_local_datetime(value: Option<&str>) -> Option<String> {
    let trimmed = value.map(str::trim).filter(|value| !value.is_empty())?;
    let compact = trimmed.replace(' ', "T");
    let short_candidate = compact.chars().take(16).collect::<String>();
    if is_datetime_local_value(&short_candidate) {
        return Some(short_candidate);
    }

    DateTime::parse_from_rfc3339(trimmed)
        .ok()
        .map(|value| value.format("%Y-%m-%dT%H:%M").to_string())
        .or_else(|| {
            ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M"]
                .iter()
                .find_map(|pattern| {
                    NaiveDateTime::parse_from_str(trimmed, pattern)
                        .ok()
                        .map(|value| value.format("%Y-%m-%dT%H:%M").to_string())
                })
        })
}

fn is_datetime_local_value(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 16
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes[10] == b'T'
        && bytes[13] == b':'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7 | 10 | 13) || byte.is_ascii_digit())
}

fn airport_code(airport: Option<&AerodataboxAirport>) -> String {
    trimmed_optional(airport.and_then(|value| value.iata.as_deref()))
        .or_else(|| trimmed_optional(airport.and_then(|value| value.icao.as_deref())))
        .unwrap_or_default()
}

fn airport_name(airport: Option<&AerodataboxAirport>, code: &str) -> String {
    trimmed_optional(airport.and_then(|value| value.name.as_deref()))
        .or_else(|| (!code.is_empty()).then(|| code.to_string()))
        .unwrap_or_else(|| "Unknown airport".into())
}

fn normalize_code(provider_code: Option<&str>, fallback_flight_number: &str) -> String {
    trimmed_optional(provider_code).unwrap_or_else(|| fallback_flight_number.to_string())
}

fn build_confidence_note(
    departure_quality: Option<&str>,
    arrival_quality: Option<&str>,
) -> Option<String> {
    let mut parts = vec![];
    if let Some(value) = departure_quality.filter(|value| !value.is_empty()) {
        parts.push(format!("departure quality: {}", value));
    }
    if let Some(value) = arrival_quality.filter(|value| !value.is_empty()) {
        parts.push(format!("arrival quality: {}", value));
    }

    if parts.is_empty() {
        Some("provider-sourced flight lookup candidate".into())
    } else {
        Some(parts.join("; "))
    }
}

fn trim_or_fallback(value: Option<&str>, fallback: &str) -> String {
    trimmed_optional(value).unwrap_or_else(|| fallback.to_string())
}

fn trimmed_optional(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn lookup_cache() -> &'static Mutex<HashMap<String, CachedLookupEntry>> {
    LOOKUP_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn build_cache_key(gateway: &str, flight_number: &str, lookup_date: &str) -> String {
    format!("{}|{}|{}", gateway, flight_number, lookup_date)
}

fn get_cached_candidates(cache_key: &str) -> Option<Vec<FlightLookupCandidatePayload>> {
    let mut cache = lookup_cache().lock().ok()?;
    let entry = cache.get(cache_key)?.clone();
    if entry.inserted_at.elapsed().as_secs() > LOOKUP_CACHE_TTL_SECONDS {
        cache.remove(cache_key);
        return None;
    }

    Some(entry.candidates)
}

fn store_cached_candidates(cache_key: &str, candidates: &[FlightLookupCandidatePayload]) {
    if let Ok(mut cache) = lookup_cache().lock() {
        cache.insert(
            cache_key.to_string(),
            CachedLookupEntry {
                inserted_at: Instant::now(),
                candidates: candidates.to_vec(),
            },
        );
    }
}

#[cfg(test)]
mod tests {
    use super::{
        airport_code, best_local_time, build_lookup_url, gateway_config, map_candidate,
        normalize_local_datetime, AerodataboxAirport, AerodataboxAirportMovement,
        AerodataboxDateTime, AerodataboxFlight, AERODATABOX_GATEWAY_API_MARKET,
        AERODATABOX_GATEWAY_RAPID_API,
    };

    #[test]
    fn build_lookup_url_uses_validated_path_and_query() {
        let url = build_lookup_url(
            "https://prod.api.market/api/v1/aedbx/aerodatabox",
            "MF802",
            "2026-06-05",
        )
        .expect("lookup URL should be built");

        assert_eq!(
            url.as_str(),
            "https://prod.api.market/api/v1/aedbx/aerodatabox/flights/number/MF802/2026-06-05?dateLocalRole=Both&withLocation=false&withAircraftImage=false&withFlightPlan=false"
        );
    }

    #[test]
    fn gateway_config_supports_both_documented_gateways() {
        assert!(gateway_config(AERODATABOX_GATEWAY_API_MARKET).is_ok());
        assert!(gateway_config(AERODATABOX_GATEWAY_RAPID_API).is_ok());
    }

    #[test]
    fn best_local_time_prefers_revised_then_scheduled() {
        let movement = AerodataboxAirportMovement {
            airport: None,
            terminal: None,
            scheduled_time: Some(AerodataboxDateTime {
                local: Some("2026-06-05T11:25".into()),
            }),
            revised_time: Some(AerodataboxDateTime {
                local: Some("2026-06-05T11:40".into()),
            }),
            quality: None,
        };

        assert_eq!(best_local_time(Some(&movement)), "2026-06-05T11:40");
    }

    #[test]
    fn normalize_local_datetime_trims_provider_offsets_for_datetime_local_fields() {
        assert_eq!(
            normalize_local_datetime(Some("2026-06-05T11:40:00+10:00")).as_deref(),
            Some("2026-06-05T11:40")
        );
        assert_eq!(
            normalize_local_datetime(Some("2026-06-05 11:40:00")).as_deref(),
            Some("2026-06-05T11:40")
        );
    }

    #[test]
    fn airport_code_falls_back_to_icao_when_iata_is_missing() {
        let airport = AerodataboxAirport {
            name: Some("Sydney Kingsford Smith Airport".into()),
            iata: None,
            icao: Some("YSSY".into()),
            time_zone: Some("Australia/Sydney".into()),
        };

        assert_eq!(airport_code(Some(&airport)), "YSSY");
    }

    #[test]
    fn map_candidate_uses_expected_field_fallbacks() {
        let candidate = map_candidate(
            "MF802",
            "2026-06-05",
            0,
            AerodataboxFlight {
                number: None,
                status: Some("Scheduled".into()),
                airline: Some(super::AerodataboxAirline {
                    name: Some("XiamenAir".into()),
                }),
                aircraft: Some(super::AerodataboxAircraft {
                    model: Some("Boeing 787-9".into()),
                }),
                departure: Some(AerodataboxAirportMovement {
                    airport: Some(AerodataboxAirport {
                        name: Some("Sydney Kingsford Smith Airport".into()),
                        iata: Some("SYD".into()),
                        icao: Some("YSSY".into()),
                        time_zone: Some("Australia/Sydney".into()),
                    }),
                    terminal: Some("T1".into()),
                    scheduled_time: Some(AerodataboxDateTime {
                        local: Some("2026-06-05T11:25".into()),
                    }),
                    revised_time: Some(AerodataboxDateTime {
                        local: Some("2026-06-05T11:35".into()),
                    }),
                    quality: Some(vec!["Basic".into()]),
                }),
                arrival: Some(AerodataboxAirportMovement {
                    airport: Some(AerodataboxAirport {
                        name: Some("Xiamen Gaoqi International Airport".into()),
                        iata: Some("XMN".into()),
                        icao: Some("ZSAM".into()),
                        time_zone: Some("Asia/Shanghai".into()),
                    }),
                    terminal: Some("T3".into()),
                    scheduled_time: Some(AerodataboxDateTime {
                        local: Some("2026-06-05T19:40".into()),
                    }),
                    revised_time: None,
                    quality: Some(vec!["Live".into()]),
                }),
            },
        );

        assert_eq!(candidate.code, "MF802");
        assert_eq!(candidate.departure.code, "SYD");
        assert_eq!(candidate.arrival.code, "XMN");
        assert_eq!(candidate.departure_time_local, "2026-06-05T11:35");
        assert_eq!(candidate.arrival_time_local, "2026-06-05T19:40");
        assert_eq!(candidate.departure_terminal.as_deref(), Some("T1"));
        assert_eq!(candidate.arrival_terminal.as_deref(), Some("T3"));
        assert_eq!(candidate.aircraft.as_deref(), Some("Boeing 787-9"));
        assert_eq!(candidate.flight_status.as_deref(), Some("Scheduled"));
    }
}
