use crate::models::{
    FlightLookupCandidatePayload, FlightLookupErrorPayload, FlightLookupLocationPayload,
};

use super::PROVIDER_AERODATABOX;

const MOCK_PROVIDER_LABEL: &str = "AeroDataBox mock via Tauri";
const MOCK_SOURCE_NOTE: &str =
    "Phase B provider adapter skeleton. This result is still generated locally through the Tauri boundary and should be reviewed before saving.";

#[derive(Clone)]
struct MockFlightTemplate {
    carrier_name: String,
    code: String,
    departure: FlightLookupLocationPayload,
    arrival: FlightLookupLocationPayload,
    departure_terminal: Option<String>,
    arrival_terminal: Option<String>,
    departure_time: String,
    arrival_time: String,
    aircraft: Option<String>,
    flight_status: Option<String>,
    confidence: Option<String>,
}

pub fn lookup_candidates(
    flight_number: &str,
    lookup_date: &str,
) -> Result<Vec<FlightLookupCandidatePayload>, FlightLookupErrorPayload> {
    Ok(mock_templates_for_flight(flight_number)
        .into_iter()
        .enumerate()
        .map(|(index, template)| FlightLookupCandidatePayload {
            id: format!("{}-{}-{}", flight_number, lookup_date, index),
            provider: PROVIDER_AERODATABOX.into(),
            provider_label: MOCK_PROVIDER_LABEL.into(),
            source_note: MOCK_SOURCE_NOTE.into(),
            carrier_name: template.carrier_name,
            code: template.code,
            departure: template.departure,
            arrival: template.arrival,
            departure_terminal: template.departure_terminal,
            arrival_terminal: template.arrival_terminal,
            departure_time_local: format!("{}T{}", lookup_date, template.departure_time),
            arrival_time_local: format!("{}T{}", lookup_date, template.arrival_time),
            aircraft: template.aircraft,
            flight_status: template.flight_status,
            confidence: template.confidence,
        })
        .collect())
}

fn mock_templates_for_flight(flight_number: &str) -> Vec<MockFlightTemplate> {
    match flight_number {
        "MF802" => vec![MockFlightTemplate {
            carrier_name: "XiamenAir".into(),
            code: "MF802".into(),
            departure: FlightLookupLocationPayload {
                name: "Sydney Kingsford Smith Airport".into(),
                code: "SYD".into(),
                timezone: "Australia/Sydney".into(),
            },
            arrival: FlightLookupLocationPayload {
                name: "Xiamen Gaoqi International Airport".into(),
                code: "XMN".into(),
                timezone: "Asia/Shanghai".into(),
            },
            departure_terminal: Some("T1".into()),
            arrival_terminal: Some("T3".into()),
            departure_time: "11:25".into(),
            arrival_time: "19:40".into(),
            aircraft: Some("Boeing 787-9".into()),
            flight_status: Some("scheduled".into()),
            confidence: Some("high".into()),
        }],
        "MU562" => vec![MockFlightTemplate {
            carrier_name: "China Eastern".into(),
            code: "MU562".into(),
            departure: FlightLookupLocationPayload {
                name: "Sydney Kingsford Smith Airport".into(),
                code: "SYD".into(),
                timezone: "Australia/Sydney".into(),
            },
            arrival: FlightLookupLocationPayload {
                name: "Shanghai Pudong International Airport".into(),
                code: "PVG".into(),
                timezone: "Asia/Shanghai".into(),
            },
            departure_terminal: Some("T1".into()),
            arrival_terminal: Some("T1".into()),
            departure_time: "12:10".into(),
            arrival_time: "20:35".into(),
            aircraft: Some("Airbus A330-200".into()),
            flight_status: Some("scheduled".into()),
            confidence: Some("high".into()),
        }],
        "CZ326" => vec![MockFlightTemplate {
            carrier_name: "China Southern".into(),
            code: "CZ326".into(),
            departure: FlightLookupLocationPayload {
                name: "Sydney Kingsford Smith Airport".into(),
                code: "SYD".into(),
                timezone: "Australia/Sydney".into(),
            },
            arrival: FlightLookupLocationPayload {
                name: "Guangzhou Baiyun International Airport".into(),
                code: "CAN".into(),
                timezone: "Asia/Shanghai".into(),
            },
            departure_terminal: Some("T1".into()),
            arrival_terminal: Some("T2".into()),
            departure_time: "10:45".into(),
            arrival_time: "18:20".into(),
            aircraft: Some("Boeing 787-8".into()),
            flight_status: Some("scheduled".into()),
            confidence: Some("high".into()),
        }],
        "QF127" => vec![MockFlightTemplate {
            carrier_name: "Qantas".into(),
            code: "QF127".into(),
            departure: FlightLookupLocationPayload {
                name: "Sydney Kingsford Smith Airport".into(),
                code: "SYD".into(),
                timezone: "Australia/Sydney".into(),
            },
            arrival: FlightLookupLocationPayload {
                name: "Hong Kong International Airport".into(),
                code: "HKG".into(),
                timezone: "Asia/Hong_Kong".into(),
            },
            departure_terminal: Some("T1".into()),
            arrival_terminal: Some("T1".into()),
            departure_time: "09:30".into(),
            arrival_time: "16:10".into(),
            aircraft: Some("Airbus A330-300".into()),
            flight_status: Some("scheduled".into()),
            confidence: Some("high".into()),
        }],
        _ => vec![],
    }
}
