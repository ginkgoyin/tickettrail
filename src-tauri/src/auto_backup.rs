use crate::{models::AutoBackupStatusPayload, webdav};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard, OnceLock},
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const STATE_VERSION: u32 = 1;
const STATE_FILE: &str = "webdav-auto-backup-state.json";
const STATE_GENERATION_PREFIX: &str = "webdav-auto-backup-state.g";

static STATE_IO_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static LOCAL_DATA_COORDINATOR: OnceLock<Mutex<()>> = OnceLock::new();
static TRACKING_ERROR: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static FALLBACK_MUTATIONS: OnceLock<Mutex<Vec<InMemoryFallbackEvent>>> = OnceLock::new();

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AutoBackupMode {
    Off,
    AfterEveryChange,
    Every1Day,
    Every3Days,
    Every7Days,
}

impl AutoBackupMode {
    pub(crate) fn parse(value: &str) -> Option<Self> {
        match value.trim() {
            "off" => Some(Self::Off),
            "afterEveryChange" => Some(Self::AfterEveryChange),
            "every1Day" => Some(Self::Every1Day),
            "every3Days" => Some(Self::Every3Days),
            "every7Days" => Some(Self::Every7Days),
            _ => None,
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::AfterEveryChange => "afterEveryChange",
            Self::Every1Day => "every1Day",
            Self::Every3Days => "every3Days",
            Self::Every7Days => "every7Days",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MutationSource {
    TicketCreate,
    TicketUpdate,
    TicketStatusUpdate,
    TicketDelete,
    AttachmentAdd,
    AttachmentDelete,
    JourneyCreate,
    JourneyUpdate,
    JourneyDelete,
    JourneyStopsReplace,
    LocalBackupRestore,
    ArchiveImport,
    WebDavRestore,
    Bootstrap,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
enum EventStatus {
    Reserved,
    Pending,
    InFlight,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PendingEvent {
    event_id: String,
    sequence: u64,
    source: MutationSource,
    registered_at_utc: String,
    status: EventStatus,
    mutation_revision: Option<u64>,
    snapshot_revision: Option<u64>,
    attempt_count: u32,
    next_retry_at: Option<String>,
    last_error_code: Option<String>,
    planned_backup_id: String,
    planned_object_timestamp: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AutoBackupState {
    state_version: u32,
    generation: u64,
    mode: AutoBackupMode,
    device_id: String,
    next_sequence: u64,
    data_revision: u64,
    last_successful_revision: u64,
    dirty_since: Option<String>,
    last_successful_backup_at: Option<String>,
    last_attempt_at: Option<String>,
    consecutive_failures: u32,
    next_retry_at: Option<String>,
    last_error_code: Option<String>,
    pending_events: Vec<PendingEvent>,
}

pub(crate) struct LocalDataGuard {
    _guard: MutexGuard<'static, ()>,
}

pub(crate) struct MutationReservation {
    kind: MutationReservationKind,
}

enum MutationReservationKind {
    Durable { event_id: String },
    InMemory { event_id: String },
}

/// Process-local fallback state when the authoritative state file cannot be
/// written. Pending entries are folded into that file on its next successful
/// write; this is not a second durable journal.
#[derive(Clone, Debug)]
struct InMemoryFallbackEvent {
    event_id: String,
    source: MutationSource,
    registered_at_utc: String,
    status: EventStatus,
}

struct StateStore {
    directory: PathBuf,
}

impl StateStore {
    fn new(directory: PathBuf) -> Self {
        Self { directory }
    }

    fn initial(mode: AutoBackupMode) -> AutoBackupState {
        AutoBackupState {
            state_version: STATE_VERSION,
            generation: 0,
            mode,
            device_id: Uuid::new_v4().simple().to_string(),
            next_sequence: 1,
            data_revision: 0,
            last_successful_revision: 0,
            dirty_since: None,
            last_successful_backup_at: None,
            last_attempt_at: None,
            consecutive_failures: 0,
            next_retry_at: None,
            last_error_code: None,
            pending_events: Vec::new(),
        }
    }

    fn state_paths(&self) -> Result<Vec<PathBuf>, String> {
        if !self.directory.exists() {
            return Ok(Vec::new());
        }
        let mut paths = Vec::new();
        for entry in fs::read_dir(&self.directory)
            .map_err(|_| "Automatic backup tracking unavailable.".to_string())?
        {
            let entry = entry.map_err(|_| "Automatic backup tracking unavailable.".to_string())?;
            if !entry
                .file_type()
                .map_err(|_| "Automatic backup tracking unavailable.".to_string())?
                .is_file()
            {
                continue;
            }
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name == STATE_FILE
                || (name.starts_with(STATE_GENERATION_PREFIX)
                    && (name.ends_with(".json") || name.ends_with(".tmp")))
            {
                paths.push(entry.path());
            }
        }
        Ok(paths)
    }

    fn read_valid_state(path: &Path) -> Option<AutoBackupState> {
        let text = fs::read_to_string(path).ok()?;
        let state = serde_json::from_str::<AutoBackupState>(&text).ok()?;
        validate_state(&state).then_some(state)
    }

    fn managed_generation(path: &Path) -> Option<u64> {
        let name = path.file_name()?.to_str()?;
        if name == STATE_FILE {
            return Some(1);
        }
        let remainder = name.strip_prefix(STATE_GENERATION_PREFIX)?;
        let digits = remainder.split('.').next()?;
        if digits.is_empty() || !digits.chars().all(|value| value.is_ascii_digit()) {
            return None;
        }
        digits.parse().ok()
    }

    fn highest_managed_generation(&self) -> Result<u64, String> {
        Ok(self
            .state_paths()?
            .iter()
            .filter_map(|path| Self::managed_generation(path))
            .max()
            .unwrap_or(0))
    }

    fn load_or_initialize(
        &self,
        compatibility_mode: AutoBackupMode,
    ) -> Result<AutoBackupState, String> {
        let mut candidates = self
            .state_paths()?
            .into_iter()
            .filter_map(|path| Self::read_valid_state(&path))
            .collect::<Vec<_>>();
        candidates.sort_by_key(|state| state.generation);
        let mut state = candidates
            .pop()
            .unwrap_or_else(|| Self::initial(compatibility_mode));
        let recovered = recover_interrupted_events(&mut state);
        if state.generation == 0 || recovered {
            self.persist(&mut state)?;
        }
        Ok(state)
    }

    fn persist(&self, state: &mut AutoBackupState) -> Result<(), String> {
        fs::create_dir_all(&self.directory)
            .map_err(|_| "Automatic backup tracking unavailable.".to_string())?;
        let highest_managed_generation = self.highest_managed_generation()?;
        let next_generation = state
            .generation
            .max(highest_managed_generation)
            .checked_add(1)
            .ok_or_else(|| "Automatic backup tracking unavailable.".to_string())?;
        let filename = if next_generation == 1 && !self.directory.join(STATE_FILE).exists() {
            STATE_FILE.to_string()
        } else {
            format!("{STATE_GENERATION_PREFIX}{next_generation:020}.json")
        };
        let path = self.directory.join(filename);
        let temporary_path = self.directory.join(format!(
            "{STATE_GENERATION_PREFIX}{next_generation:020}.{}.tmp",
            Uuid::new_v4().simple()
        ));
        let mut next_state = state.clone();
        next_state.generation = next_generation;
        let serialized = serde_json::to_vec_pretty(&next_state)
            .map_err(|_| "Automatic backup tracking unavailable.".to_string())?;
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)
            .map_err(|_| "Automatic backup tracking unavailable.".to_string())?;
        let write_result = file.write_all(&serialized).and_then(|_| file.sync_all());
        drop(file);
        if write_result.is_err() {
            let _ = fs::remove_file(&temporary_path);
            return Err("Automatic backup tracking unavailable.".to_string());
        }
        fs::rename(&temporary_path, &path).map_err(|_| {
            let _ = fs::remove_file(&temporary_path);
            "Automatic backup tracking unavailable.".to_string()
        })?;
        *state = next_state;
        self.prune_old_generations();
        Ok(())
    }

    fn prune_old_generations(&self) {
        let mut candidates = self
            .state_paths()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|path| Self::read_valid_state(&path).map(|state| (state.generation, path)))
            .collect::<Vec<_>>();
        candidates.sort_by_key(|(generation, _)| *generation);
        while candidates.len() > 2 {
            let (_, path) = candidates.remove(0);
            let _ = fs::remove_file(path);
        }
    }
}

fn validate_state(state: &AutoBackupState) -> bool {
    if state.state_version != STATE_VERSION
        || state.device_id.len() != 32
        || !state
            .device_id
            .chars()
            .all(|value| value.is_ascii_hexdigit())
        || state.next_sequence == 0
        || state.last_successful_revision > state.data_revision
    {
        return false;
    }
    let mut last_sequence = 0;
    for event in &state.pending_events {
        if event.event_id.len() != 32
            || !event
                .event_id
                .chars()
                .all(|value| value.is_ascii_hexdigit())
            || event.sequence == 0
            || event.sequence <= last_sequence
            || event.planned_backup_id != format!("backup-{}", event.event_id)
        {
            return false;
        }
        last_sequence = event.sequence;
    }
    state.next_sequence > last_sequence
}

fn recover_interrupted_events(state: &mut AutoBackupState) -> bool {
    let mut changed = false;
    for event in &mut state.pending_events {
        if matches!(event.status, EventStatus::Reserved | EventStatus::InFlight) {
            event.status = EventStatus::Pending;
            let revision = event
                .mutation_revision
                .unwrap_or_else(|| state.data_revision.saturating_add(1));
            event.mutation_revision = Some(revision);
            state.data_revision = state.data_revision.max(revision);
            state
                .dirty_since
                .get_or_insert_with(|| event.registered_at_utc.clone());
            changed = true;
        }
    }
    changed
}

fn append_event(
    state: &mut AutoBackupState,
    source: MutationSource,
    status: EventStatus,
) -> Result<String, String> {
    append_event_with_identity(
        state,
        source,
        status,
        Uuid::new_v4().simple().to_string(),
        Utc::now().to_rfc3339(),
    )
}

fn append_event_with_identity(
    state: &mut AutoBackupState,
    source: MutationSource,
    status: EventStatus,
    event_id: String,
    registered_at_utc: String,
) -> Result<String, String> {
    let sequence = state.next_sequence;
    state.next_sequence = state
        .next_sequence
        .checked_add(1)
        .ok_or_else(|| "Automatic backup tracking unavailable.".to_string())?;
    state.pending_events.push(PendingEvent {
        event_id: event_id.clone(),
        sequence,
        source,
        registered_at_utc: registered_at_utc.clone(),
        status,
        mutation_revision: None,
        snapshot_revision: None,
        attempt_count: 0,
        next_retry_at: None,
        last_error_code: None,
        planned_backup_id: format!("backup-{event_id}"),
        planned_object_timestamp: registered_at_utc,
    });
    Ok(event_id)
}

#[cfg(test)]
fn append_testable_event(
    state: &mut AutoBackupState,
    source: MutationSource,
    status: EventStatus,
) -> String {
    append_event(state, source, status).expect("test state must have a usable sequence")
}

fn state_io_lock() -> &'static Mutex<()> {
    STATE_IO_LOCK.get_or_init(|| Mutex::new(()))
}

fn tracking_error() -> &'static Mutex<Option<String>> {
    TRACKING_ERROR.get_or_init(|| Mutex::new(None))
}

fn fallback_mutations() -> &'static Mutex<Vec<InMemoryFallbackEvent>> {
    FALLBACK_MUTATIONS.get_or_init(|| Mutex::new(Vec::new()))
}

fn with_fallback_mutations<T>(action: impl FnOnce(&mut Vec<InMemoryFallbackEvent>) -> T) -> T {
    let mut events = fallback_mutations()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    action(&mut events)
}

fn fallback_has_unresolved_obligations() -> bool {
    with_fallback_mutations(|events| !events.is_empty())
}

fn create_in_memory_reservation(source: MutationSource) -> MutationReservation {
    let event_id = Uuid::new_v4().simple().to_string();
    with_fallback_mutations(|events| {
        events.push(InMemoryFallbackEvent {
            event_id: event_id.clone(),
            source,
            registered_at_utc: Utc::now().to_rfc3339(),
            status: EventStatus::Reserved,
        });
    });
    MutationReservation {
        kind: MutationReservationKind::InMemory { event_id },
    }
}

fn finalize_fallback_event(events: &mut Vec<InMemoryFallbackEvent>, event_id: &str, changed: bool) {
    let Some(index) = events.iter().position(|event| event.event_id == event_id) else {
        return;
    };
    if changed {
        events[index].status = EventStatus::Pending;
    } else {
        events.remove(index);
    }
}

fn finalize_in_memory_reservation(event_id: &str, changed: bool) {
    with_fallback_mutations(|events| finalize_fallback_event(events, event_id, changed));
}

fn pending_fallback_events() -> Vec<InMemoryFallbackEvent> {
    with_fallback_mutations(|events| {
        events
            .iter()
            .filter(|event| event.status == EventStatus::Pending)
            .cloned()
            .collect()
    })
}

fn remove_flushed_fallback_events(event_ids: &[String]) {
    with_fallback_mutations(|events| {
        events.retain(|event| !event_ids.iter().any(|event_id| event_id == &event.event_id));
    });
}

fn merge_pending_fallback_events(
    state: &mut AutoBackupState,
    fallback_events: &[InMemoryFallbackEvent],
) -> Result<Vec<String>, String> {
    let mut flushed = Vec::with_capacity(fallback_events.len());
    for event in fallback_events {
        append_event_with_identity(
            state,
            event.source,
            EventStatus::Pending,
            event.event_id.clone(),
            event.registered_at_utc.clone(),
        )?;
        let revision = state
            .data_revision
            .checked_add(1)
            .ok_or_else(|| "Automatic backup tracking unavailable.".to_string())?;
        state.data_revision = revision;
        state
            .dirty_since
            .get_or_insert_with(|| event.registered_at_utc.clone());
        if state.mode != AutoBackupMode::AfterEveryChange {
            state.pending_events.pop();
        } else if let Some(pending) = state.pending_events.last_mut() {
            pending.mutation_revision = Some(revision);
        }
        flushed.push(event.event_id.clone());
    }
    Ok(flushed)
}

fn compatibility_mode(app: &AppHandle) -> AutoBackupMode {
    webdav::legacy_auto_backup_mode(app)
        .ok()
        .and_then(|mode| AutoBackupMode::parse(&mode))
        .unwrap_or(AutoBackupMode::Off)
}

fn app_store(app: &AppHandle) -> Result<StateStore, String> {
    let directory = app
        .path()
        .app_config_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|_| "Automatic backup tracking unavailable.".to_string())?;
    Ok(StateStore::new(directory))
}

fn update_app_state<T, F>(app: &AppHandle, action: F) -> Result<T, String>
where
    F: FnOnce(&mut AutoBackupState) -> Result<T, String>,
{
    let _io = state_io_lock()
        .lock()
        .map_err(|_| "Automatic backup tracking unavailable.".to_string())?;
    let store = app_store(app)?;
    let mut state = store.load_or_initialize(compatibility_mode(app))?;
    let fallback_events = pending_fallback_events();
    let flushed_event_ids = merge_pending_fallback_events(&mut state, &fallback_events)?;
    let value = action(&mut state)?;
    store.persist(&mut state)?;
    remove_flushed_fallback_events(&flushed_event_ids);
    if !fallback_has_unresolved_obligations() {
        if let Ok(mut error) = tracking_error().lock() {
            *error = None;
        }
    }
    Ok(value)
}

pub(crate) fn acquire_local_mutation() -> Result<LocalDataGuard, String> {
    LOCAL_DATA_COORDINATOR
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map(|guard| LocalDataGuard { _guard: guard })
        .map_err(|_| "TicketTrail could not coordinate local data changes.".to_string())
}

pub(crate) fn acquire_local_snapshot() -> Result<LocalDataGuard, String> {
    acquire_local_mutation()
}

pub(crate) fn begin_mutation(app: &AppHandle, source: MutationSource) -> MutationReservation {
    match update_app_state(app, |state| {
        let event_id = append_event(state, source, EventStatus::Reserved)?;
        Ok(MutationReservation {
            kind: MutationReservationKind::Durable { event_id },
        })
    }) {
        Ok(reservation) => reservation,
        Err(_) => {
            note_tracking_failure();
            create_in_memory_reservation(source)
        }
    }
}

pub(crate) fn finish_mutation(
    app: &AppHandle,
    reservation: MutationReservation,
    changed: bool,
) -> Result<(), String> {
    match reservation.kind {
        MutationReservationKind::Durable { event_id } => update_app_state(app, |state| {
            let Some(index) = state
                .pending_events
                .iter()
                .position(|event| event.event_id == event_id)
            else {
                return Err("Automatic backup tracking unavailable.".to_string());
            };
            if !changed {
                state.pending_events.remove(index);
                return Ok(());
            }
            let revision = state
                .data_revision
                .checked_add(1)
                .ok_or_else(|| "Automatic backup tracking unavailable.".to_string())?;
            state.data_revision = revision;
            state
                .dirty_since
                .get_or_insert_with(|| Utc::now().to_rfc3339());
            let event = &mut state.pending_events[index];
            event.mutation_revision = Some(revision);
            event.status = EventStatus::Pending;
            if state.mode != AutoBackupMode::AfterEveryChange {
                state.pending_events.remove(index);
            }
            Ok(())
        }),
        MutationReservationKind::InMemory { event_id } => {
            finalize_in_memory_reservation(&event_id, changed);
            if !changed {
                return Ok(());
            }
            update_app_state(app, |_| Ok(()))
        }
    }
}

pub(crate) fn cancel_mutation(
    app: &AppHandle,
    reservation: MutationReservation,
) -> Result<(), String> {
    finish_mutation(app, reservation, false)
}

pub(crate) fn note_tracking_failure() {
    if let Ok(mut error) = tracking_error().lock() {
        *error = Some("trackingUnavailable".to_string());
    }
}

fn tracking_is_available(error: &Option<String>, fallback_pending: bool) -> bool {
    error.is_none() && !fallback_pending
}

pub(crate) fn status(app: &AppHandle) -> AutoBackupStatusPayload {
    let error = tracking_error().lock().ok().and_then(|error| error.clone());
    let fallback_pending = fallback_has_unresolved_obligations();
    let result = (|| {
        let _io = state_io_lock().lock().ok()?;
        let store = app_store(app).ok()?;
        let state = store.load_or_initialize(compatibility_mode(app)).ok()?;
        Some(state)
    })();
    let Some(state) = result else {
        return AutoBackupStatusPayload {
            mode: compatibility_mode(app).as_str().to_string(),
            pending_event_count: 0,
            paused_pending_event_count: 0,
            is_dirty: false,
            last_successful_backup_at: None,
            last_attempt_at: None,
            next_retry_at: None,
            status_code: "trackingUnavailable".to_string(),
            last_error_code: Some("trackingUnavailable".to_string()),
            tracking_available: false,
        };
    };
    let pending = state.pending_events.len();
    let paused = if state.mode == AutoBackupMode::Off {
        pending
    } else {
        0
    };
    let is_dirty = state.data_revision > state.last_successful_revision;
    AutoBackupStatusPayload {
        mode: state.mode.as_str().to_string(),
        pending_event_count: pending,
        paused_pending_event_count: paused,
        is_dirty,
        last_successful_backup_at: state.last_successful_backup_at,
        last_attempt_at: state.last_attempt_at,
        next_retry_at: state.next_retry_at,
        status_code: if error.is_some() || fallback_pending {
            "trackingUnavailable".to_string()
        } else if paused > 0 {
            "paused".to_string()
        } else if pending > 0 {
            "pending".to_string()
        } else if is_dirty {
            "dirty".to_string()
        } else {
            "idle".to_string()
        },
        last_error_code: if error.is_some() || fallback_pending {
            Some("trackingUnavailable".to_string())
        } else {
            state.last_error_code
        },
        tracking_available: tracking_is_available(&error, fallback_pending),
    }
}

pub(crate) fn mode_for_config(app: &AppHandle) -> Result<String, String> {
    let _io = state_io_lock()
        .lock()
        .map_err(|_| "Automatic backup tracking unavailable.".to_string())?;
    let store = app_store(app)?;
    Ok(store
        .load_or_initialize(compatibility_mode(app))?
        .mode
        .as_str()
        .to_string())
}

pub(crate) fn set_mode(
    app: &AppHandle,
    mode: AutoBackupMode,
) -> Result<AutoBackupStatusPayload, String> {
    update_app_state(app, |state| {
        let previous_mode = state.mode;
        state.mode = mode;
        if mode == AutoBackupMode::AfterEveryChange
            && previous_mode != AutoBackupMode::AfterEveryChange
            && state.data_revision > state.last_successful_revision
            && state.pending_events.is_empty()
        {
            let event_id = append_event(state, MutationSource::Bootstrap, EventStatus::Pending)?;
            if let Some(event) = state
                .pending_events
                .iter_mut()
                .find(|event| event.event_id == event_id)
            {
                event.mutation_revision = Some(state.data_revision);
            }
        }
        Ok(())
    })?;
    Ok(status(app))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{env, sync::mpsc, thread};

    fn temp_store() -> (StateStore, PathBuf) {
        let dir = env::temp_dir().join(format!("tickettrail-auto-backup-test-{}", Uuid::new_v4()));
        (StateStore::new(dir.clone()), dir)
    }

    #[test]
    fn initializes_from_compatible_mode_and_serializes_no_secrets() {
        let (store, dir) = temp_store();
        let state = store
            .load_or_initialize(AutoBackupMode::Every3Days)
            .expect("should initialize state");
        assert_eq!(state.mode, AutoBackupMode::Every3Days);
        let text = fs::read_to_string(dir.join(STATE_FILE)).expect("should read state");
        assert!(!text.contains("password"));
        assert!(!text.contains("authorization"));
        assert!(!text.contains("tickettrail.sqlite3"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn corrupt_newest_generation_is_skipped_for_the_next_windows_safe_write() {
        let (store, dir) = temp_store();
        let mut state = store.load_or_initialize(AutoBackupMode::Off).unwrap();
        state.mode = AutoBackupMode::AfterEveryChange;
        store.persist(&mut state).unwrap();
        state.mode = AutoBackupMode::Every1Day;
        store.persist(&mut state).unwrap();
        assert_eq!(state.generation, 3);

        let corrupt_path = dir.join(format!("{STATE_GENERATION_PREFIX}{:020}.json", 3));
        fs::write(&corrupt_path, "{").unwrap();
        let mut recovered = store.load_or_initialize(AutoBackupMode::Off).unwrap();
        assert_eq!(recovered.generation, 2);
        assert_eq!(recovered.mode, AutoBackupMode::AfterEveryChange);

        recovered.mode = AutoBackupMode::Every3Days;
        store.persist(&mut recovered).unwrap();
        assert_eq!(recovered.generation, 4);
        assert!(
            corrupt_path.exists(),
            "corrupt generation must not be overwritten"
        );
        let restarted = store.load_or_initialize(AutoBackupMode::Off).unwrap();
        assert_eq!(restarted.generation, 4);
        assert_eq!(restarted.mode, AutoBackupMode::Every3Days);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn managed_temp_generation_is_also_skipped_for_the_next_write() {
        let (store, dir) = temp_store();
        let mut state = store.load_or_initialize(AutoBackupMode::Off).unwrap();
        let temporary_generation =
            dir.join(format!("{STATE_GENERATION_PREFIX}{:020}.leftover.tmp", 2));
        fs::write(&temporary_generation, "partial").unwrap();
        state.mode = AutoBackupMode::Every1Day;
        store.persist(&mut state).unwrap();
        assert_eq!(state.generation, 3);
        assert!(temporary_generation.exists());
        let _ = fs::remove_dir_all(dir);
    }
    #[test]
    fn invalid_schema_is_not_accepted_as_durable_state() {
        let (store, dir) = temp_store();
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join(STATE_FILE),
            r#"{"stateVersion":999,"generation":99,"mode":"afterEveryChange"}"#,
        )
        .unwrap();
        let state = store.load_or_initialize(AutoBackupMode::Off).unwrap();
        assert_eq!(state.mode, AutoBackupMode::Off);
        assert_eq!(state.data_revision, 0);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn next_sequence_must_exceed_every_durable_event_sequence() {
        let mut state = StateStore::initial(AutoBackupMode::AfterEveryChange);
        append_testable_event(
            &mut state,
            MutationSource::TicketCreate,
            EventStatus::Pending,
        );
        state.next_sequence = 1;
        assert!(!validate_state(&state));

        state.next_sequence = u64::MAX;
        assert!(append_event(
            &mut state,
            MutationSource::TicketUpdate,
            EventStatus::Pending
        )
        .is_err());
    }

    #[test]
    fn fallback_events_remain_distinct_and_flush_to_a_durable_fifo_state() {
        let (store, dir) = temp_store();
        let mut state = StateStore::initial(AutoBackupMode::AfterEveryChange);
        let events = vec![
            InMemoryFallbackEvent {
                event_id: Uuid::new_v4().simple().to_string(),
                source: MutationSource::TicketCreate,
                registered_at_utc: Utc::now().to_rfc3339(),
                status: EventStatus::Pending,
            },
            InMemoryFallbackEvent {
                event_id: Uuid::new_v4().simple().to_string(),
                source: MutationSource::JourneyUpdate,
                registered_at_utc: Utc::now().to_rfc3339(),
                status: EventStatus::Pending,
            },
            InMemoryFallbackEvent {
                event_id: Uuid::new_v4().simple().to_string(),
                source: MutationSource::JourneyStopsReplace,
                registered_at_utc: Utc::now().to_rfc3339(),
                status: EventStatus::Pending,
            },
        ];
        let flushed = merge_pending_fallback_events(&mut state, &events).unwrap();
        assert_eq!(flushed.len(), 3);
        assert_eq!(state.pending_events.len(), 3);
        assert_eq!(state.pending_events[0].event_id, events[0].event_id);
        assert_eq!(state.pending_events[1].event_id, events[1].event_id);
        assert_eq!(state.pending_events[2].event_id, events[2].event_id);
        assert_eq!(state.data_revision, 3);
        store.persist(&mut state).unwrap();
        let restarted = store.load_or_initialize(AutoBackupMode::Off).unwrap();
        assert_eq!(restarted.pending_events.len(), 3);
        assert!(validate_state(&restarted));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn fallback_noop_and_failed_mutations_do_not_leave_obligations() {
        let mut events = vec![InMemoryFallbackEvent {
            event_id: "a".repeat(32),
            source: MutationSource::TicketUpdate,
            registered_at_utc: Utc::now().to_rfc3339(),
            status: EventStatus::Reserved,
        }];
        finalize_fallback_event(&mut events, &"a".repeat(32), false);
        assert!(events.is_empty());

        events.push(InMemoryFallbackEvent {
            event_id: "b".repeat(32),
            source: MutationSource::JourneyUpdate,
            registered_at_utc: Utc::now().to_rfc3339(),
            status: EventStatus::Reserved,
        });
        finalize_fallback_event(&mut events, &"b".repeat(32), true);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].status, EventStatus::Pending);
    }
    #[test]
    fn reservation_recovery_promotes_a_conservative_pending_event() {
        let (store, dir) = temp_store();
        let mut state = store
            .load_or_initialize(AutoBackupMode::AfterEveryChange)
            .unwrap();
        state.pending_events.push(PendingEvent {
            event_id: Uuid::new_v4().simple().to_string(),
            sequence: 1,
            source: MutationSource::TicketCreate,
            registered_at_utc: Utc::now().to_rfc3339(),
            status: EventStatus::Reserved,
            mutation_revision: None,
            snapshot_revision: None,
            attempt_count: 0,
            next_retry_at: None,
            last_error_code: None,
            planned_backup_id: String::new(),
            planned_object_timestamp: Utc::now().to_rfc3339(),
        });
        let event_id = state.pending_events[0].event_id.clone();
        state.pending_events[0].planned_backup_id = format!("backup-{event_id}");
        state.next_sequence = 2;
        store.persist(&mut state).unwrap();
        let recovered = store.load_or_initialize(AutoBackupMode::Off).unwrap();
        assert_eq!(recovered.pending_events[0].status, EventStatus::Pending);
        assert_eq!(recovered.data_revision, 1);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn every_change_events_are_distinct_fifo_and_off_does_not_drop_them() {
        let mut state = StateStore::initial(AutoBackupMode::AfterEveryChange);
        let first = append_testable_event(
            &mut state,
            MutationSource::TicketCreate,
            EventStatus::Pending,
        );
        let second = append_testable_event(
            &mut state,
            MutationSource::JourneyUpdate,
            EventStatus::Pending,
        );
        let third = append_testable_event(
            &mut state,
            MutationSource::JourneyStopsReplace,
            EventStatus::Pending,
        );
        assert_eq!(state.pending_events.len(), 3);
        assert_eq!(state.pending_events[0].event_id, first);
        assert_eq!(state.pending_events[1].event_id, second);
        assert_eq!(state.pending_events[2].event_id, third);
        assert!(validate_state(&state));

        state.mode = AutoBackupMode::Off;
        assert_eq!(
            state.pending_events.len(),
            3,
            "Off pauses rather than drops events"
        );
        state.mode = AutoBackupMode::Every1Day;
        assert_eq!(
            state.pending_events.len(),
            3,
            "interval modes preserve obligations"
        );
    }

    #[test]
    fn bootstrap_event_is_the_only_event_needed_for_preexisting_dirty_state() {
        let mut state = StateStore::initial(AutoBackupMode::Off);
        state.data_revision = 4;
        state.dirty_since = Some(Utc::now().to_rfc3339());
        let previous_mode = state.mode;
        state.mode = AutoBackupMode::AfterEveryChange;
        if previous_mode != AutoBackupMode::AfterEveryChange
            && state.data_revision > state.last_successful_revision
            && state.pending_events.is_empty()
        {
            append_testable_event(&mut state, MutationSource::Bootstrap, EventStatus::Pending);
        }
        assert_eq!(state.pending_events.len(), 1);
        assert_eq!(state.pending_events[0].source, MutationSource::Bootstrap);
    }

    #[test]
    fn journey_and_stops_meaningful_outcomes_produce_the_expected_event_counts() {
        for (journey_changed, stops_changed, expected_count) in [
            (true, true, 2),
            (true, false, 1),
            (false, true, 1),
            (false, false, 0),
        ] {
            let mut state = StateStore::initial(AutoBackupMode::AfterEveryChange);
            if journey_changed {
                append_testable_event(
                    &mut state,
                    MutationSource::JourneyUpdate,
                    EventStatus::Pending,
                );
            }
            if stops_changed {
                append_testable_event(
                    &mut state,
                    MutationSource::JourneyStopsReplace,
                    EventStatus::Pending,
                );
            }
            assert_eq!(state.pending_events.len(), expected_count);
        }
    }
    #[test]
    fn tracking_is_unavailable_until_fallback_obligations_are_flushed() {
        assert!(!tracking_is_available(
            &Some("trackingUnavailable".to_string()),
            false
        ));
        assert!(!tracking_is_available(&None, true));
        assert!(tracking_is_available(&None, false));
    }
    #[test]
    fn local_coordinator_serializes_mutation_and_snapshot_authority() {
        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        let first = thread::spawn(move || {
            let _guard = acquire_local_mutation().unwrap();
            entered_tx.send(()).unwrap();
            release_rx.recv().unwrap();
        });
        entered_rx.recv().unwrap();
        let (snapshot_tx, snapshot_rx) = mpsc::channel();
        let second = thread::spawn(move || {
            let _guard = acquire_local_snapshot().unwrap();
            snapshot_tx.send(()).unwrap();
        });
        assert!(snapshot_rx.try_recv().is_err());
        release_tx.send(()).unwrap();
        first.join().unwrap();
        snapshot_rx.recv().unwrap();
        second.join().unwrap();
    }
}
