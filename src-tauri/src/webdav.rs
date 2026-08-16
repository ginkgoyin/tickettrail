use crate::models::{
    WebDavCapabilityPayload, WebDavConfigPayload, WebDavConfigSavePayload,
    WebDavConnectionTestPayload,
};
use chrono::Utc;
use reqwest::{
    blocking::{Client, RequestBuilder, Response},
    header::{HeaderName, HeaderValue, CONTENT_TYPE},
    redirect::Policy,
    Method, StatusCode, Url,
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::OnceLock,
    time::Duration,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const WEBDAV_CONFIG_FILE: &str = "webdav.json";
const DEFAULT_REMOTE_FOLDER: &str = "TicketTrail";
const MANAGED_BACKUPS_FOLDER: &str = "backups";
const WEBDAV_SECRET_SERVICE: &str = "com.ginkgoyin.tickettrail.webdav";
const WEBDAV_SECRET_ACCOUNT: &str = "default";
const AUTO_BACKUP_OFF: &str = "off";
const REQUEST_TIMEOUT_SECONDS: u64 = 20;
const CONNECT_TIMEOUT_SECONDS: u64 = 10;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredWebDavConfig {
    server_url: String,
    username: String,
    remote_folder: String,
    #[serde(default = "default_auto_backup_mode")]
    auto_backup_mode: String,
    last_tested_at: Option<String>,
    last_connection_succeeded: Option<bool>,
    capabilities: Option<WebDavCapabilityPayload>,
}

#[derive(Clone, Debug)]
struct EffectiveWebDavConfig {
    stored: StoredWebDavConfig,
    password: Option<String>,
}

trait SecretStore {
    fn get_webdav_password(&self) -> Result<Option<String>, String>;
    fn set_webdav_password(&self, password: &str) -> Result<(), String>;
    fn delete_webdav_password(&self) -> Result<(), String>;
}

struct WindowsCredentialSecretStore;

impl WindowsCredentialSecretStore {
    fn entry(&self) -> Result<keyring_core::Entry, String> {
        ensure_windows_credential_store()?;
        keyring_core::Entry::new(WEBDAV_SECRET_SERVICE, WEBDAV_SECRET_ACCOUNT)
            .map_err(|_| "Windows Credential Manager is unavailable.".to_string())
    }
}

impl SecretStore for WindowsCredentialSecretStore {
    fn get_webdav_password(&self) -> Result<Option<String>, String> {
        match self.entry()?.get_password() {
            Ok(password) if !password.is_empty() => Ok(Some(password)),
            Ok(_) => Ok(None),
            Err(keyring_core::Error::NoEntry) => Ok(None),
            Err(_) => Err("Failed to read the saved WebDAV password securely.".to_string()),
        }
    }

    fn set_webdav_password(&self, password: &str) -> Result<(), String> {
        self.entry()?
            .set_password(password)
            .map_err(|_| "Failed to save the WebDAV password securely.".to_string())
    }

    fn delete_webdav_password(&self) -> Result<(), String> {
        match self.entry()?.delete_credential() {
            Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
            Err(_) => Err("Failed to clear the saved WebDAV password.".to_string()),
        }
    }
}

#[cfg(target_os = "windows")]
fn ensure_windows_credential_store() -> Result<(), String> {
    static INITIALIZED: OnceLock<Result<(), String>> = OnceLock::new();
    INITIALIZED
        .get_or_init(|| {
            let store = windows_native_keyring_store::Store::new()
                .map_err(|_| "Windows Credential Manager is unavailable.".to_string())?;
            keyring_core::set_default_store(store);
            Ok(())
        })
        .clone()
}

#[cfg(not(target_os = "windows"))]
fn ensure_windows_credential_store() -> Result<(), String> {
    Err("Secure WebDAV password storage is currently supported on Windows only.".to_string())
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum WebDavErrorCode {
    InvalidConfiguration,
    AuthenticationFailed,
    PermissionDenied,
    NetworkUnavailable,
    Timeout,
    DirectoryCreationFailed,
    ListingFailed,
    WriteTestFailed,
    CleanupFailed,
    UnsafeRedirect,
    CapabilityFailed,
}

impl WebDavErrorCode {
    fn as_str(&self) -> &'static str {
        match self {
            Self::InvalidConfiguration => "invalid_configuration",
            Self::AuthenticationFailed => "authentication_failed",
            Self::PermissionDenied => "permission_denied",
            Self::NetworkUnavailable => "network_unavailable",
            Self::Timeout => "timeout",
            Self::DirectoryCreationFailed => "directory_creation_failed",
            Self::ListingFailed => "listing_failed",
            Self::WriteTestFailed => "write_test_failed",
            Self::CleanupFailed => "cleanup_failed",
            Self::UnsafeRedirect => "unsafe_redirect",
            Self::CapabilityFailed => "capability_failed",
        }
    }
}

#[derive(Clone, Debug)]
struct WebDavError {
    code: WebDavErrorCode,
    message: String,
}

impl WebDavError {
    fn new(code: WebDavErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

struct WebDavClient {
    client: Client,
    username: String,
    password: String,
}

impl WebDavClient {
    fn new(username: String, password: String) -> Result<Self, WebDavError> {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECONDS))
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECONDS))
            .redirect(Policy::none())
            .build()
            .map_err(|_| {
                WebDavError::new(
                    WebDavErrorCode::InvalidConfiguration,
                    "The WebDAV client could not be initialized.",
                )
            })?;

        Ok(Self {
            client,
            username,
            password,
        })
    }

    fn request(&self, method: Method, url: Url) -> RequestBuilder {
        self.client
            .request(method, url)
            .basic_auth(&self.username, Some(&self.password))
    }

    fn send(
        &self,
        request: RequestBuilder,
        operation_code: WebDavErrorCode,
        operation_message: &'static str,
    ) -> Result<Response, WebDavError> {
        let response = request.send().map_err(|error| {
            if error.is_timeout() {
                WebDavError::new(WebDavErrorCode::Timeout, "The WebDAV request timed out.")
            } else {
                WebDavError::new(
                    WebDavErrorCode::NetworkUnavailable,
                    "The WebDAV server could not be reached.",
                )
            }
        })?;

        if response.status().is_redirection() {
            return Err(WebDavError::new(
                WebDavErrorCode::UnsafeRedirect,
                "The WebDAV server redirected the request. TicketTrail will not forward credentials to a redirected origin.",
            ));
        }
        if response.status() == StatusCode::UNAUTHORIZED {
            return Err(WebDavError::new(
                WebDavErrorCode::AuthenticationFailed,
                "WebDAV authentication failed. Check the username and application password.",
            ));
        }
        if response.status() == StatusCode::FORBIDDEN {
            return Err(WebDavError::new(
                WebDavErrorCode::PermissionDenied,
                "The WebDAV account does not have permission for this operation.",
            ));
        }
        if !response.status().is_success() {
            return Err(WebDavError::new(operation_code, operation_message));
        }

        Ok(response)
    }

    fn propfind(&self, url: Url) -> Result<(), WebDavError> {
        let method = Method::from_bytes(b"PROPFIND").expect("PROPFIND is a valid method");
        let response = self.send(
            self.request(method, url)
                .header("Depth", "0")
                .header(CONTENT_TYPE, "application/xml; charset=utf-8")
                .body(
                    "<?xml version=\"1.0\" encoding=\"utf-8\"?><propfind xmlns=\"DAV:\"><prop><resourcetype/></prop></propfind>",
                ),
            WebDavErrorCode::ListingFailed,
            "TicketTrail could not list the configured WebDAV collection.",
        )?;
        if response.status() != StatusCode::MULTI_STATUS && !response.status().is_success() {
            return Err(WebDavError::new(
                WebDavErrorCode::ListingFailed,
                "The configured server did not provide WebDAV collection access.",
            ));
        }
        Ok(())
    }

    fn ensure_collection(&self, url: Url) -> Result<(), WebDavError> {
        if self.propfind(url.clone()).is_ok() {
            return Ok(());
        }

        let method = Method::from_bytes(b"MKCOL").expect("MKCOL is a valid method");
        let response = self
            .request(method, url)
            .send()
            .map_err(|error| map_network_error(error, WebDavErrorCode::DirectoryCreationFailed))?;

        if response.status().is_redirection() {
            return Err(WebDavError::new(
                WebDavErrorCode::UnsafeRedirect,
                "The WebDAV server redirected directory creation.",
            ));
        }
        if response.status() == StatusCode::UNAUTHORIZED {
            return Err(WebDavError::new(
                WebDavErrorCode::AuthenticationFailed,
                "WebDAV authentication failed. Check the username and application password.",
            ));
        }
        if response.status() == StatusCode::FORBIDDEN {
            return Err(WebDavError::new(
                WebDavErrorCode::PermissionDenied,
                "The WebDAV account cannot create the TicketTrail directory.",
            ));
        }
        if response.status().is_success() || response.status() == StatusCode::METHOD_NOT_ALLOWED {
            self.propfind(response.url().clone()).map_err(|_| {
                WebDavError::new(
                    WebDavErrorCode::DirectoryCreationFailed,
                    "The TicketTrail WebDAV directory could not be verified after creation.",
                )
            })?;
            return Ok(());
        }

        Err(WebDavError::new(
            WebDavErrorCode::DirectoryCreationFailed,
            "TicketTrail could not create its managed WebDAV directory.",
        ))
    }

    fn put_probe(&self, url: Url) -> Result<(), WebDavError> {
        self.send(
            self.request(Method::PUT, url)
                .header(CONTENT_TYPE, "application/octet-stream")
                .body("TicketTrail WebDAV connection probe"),
            WebDavErrorCode::WriteTestFailed,
            "TicketTrail could not write a probe object in the managed WebDAV directory.",
        )?;
        Ok(())
    }

    fn verify_probe(&self, url: Url) -> Result<(), WebDavError> {
        let head_response = self
            .request(Method::HEAD, url.clone())
            .send()
            .map_err(|error| map_network_error(error, WebDavErrorCode::WriteTestFailed))?;
        if head_response.status().is_redirection() {
            return Err(WebDavError::new(
                WebDavErrorCode::UnsafeRedirect,
                "The WebDAV server redirected probe verification.",
            ));
        }
        if head_response.status().is_success() {
            return Ok(());
        }
        if head_response.status() == StatusCode::METHOD_NOT_ALLOWED {
            self.send(
                self.request(Method::GET, url),
                WebDavErrorCode::WriteTestFailed,
                "TicketTrail could not verify the WebDAV probe object.",
            )?;
            return Ok(());
        }
        Err(status_error(
            head_response.status(),
            WebDavErrorCode::WriteTestFailed,
            "TicketTrail could not verify the WebDAV probe object.",
        ))
    }

    fn probe_move(&self, source: Url, destination: Url) -> Result<bool, WebDavError> {
        let method = Method::from_bytes(b"MOVE").expect("MOVE is a valid method");
        let destination_header = HeaderValue::from_str(destination.as_str()).map_err(|_| {
            WebDavError::new(
                WebDavErrorCode::CapabilityFailed,
                "TicketTrail could not prepare the WebDAV MOVE probe.",
            )
        })?;
        let response = self
            .request(method, source)
            .header(HeaderName::from_static("destination"), destination_header)
            .header("Overwrite", "F")
            .send()
            .map_err(|error| map_network_error(error, WebDavErrorCode::CapabilityFailed))?;

        if response.status().is_redirection() {
            return Err(WebDavError::new(
                WebDavErrorCode::UnsafeRedirect,
                "The WebDAV server redirected the MOVE capability probe.",
            ));
        }
        if response.status().is_success() {
            return Ok(true);
        }
        if matches!(
            response.status(),
            StatusCode::METHOD_NOT_ALLOWED | StatusCode::NOT_IMPLEMENTED | StatusCode::CONFLICT
        ) {
            return Ok(false);
        }
        if response.status() == StatusCode::UNAUTHORIZED {
            return Err(WebDavError::new(
                WebDavErrorCode::AuthenticationFailed,
                "WebDAV authentication failed during the MOVE capability probe.",
            ));
        }
        if response.status() == StatusCode::FORBIDDEN {
            return Ok(false);
        }
        Ok(false)
    }

    fn delete_exact(&self, url: Url) -> Result<(), WebDavError> {
        let response = self
            .request(Method::DELETE, url)
            .send()
            .map_err(|error| map_network_error(error, WebDavErrorCode::CleanupFailed))?;
        if response.status().is_success() || response.status() == StatusCode::NOT_FOUND {
            return Ok(());
        }
        Err(status_error(
            response.status(),
            WebDavErrorCode::CleanupFailed,
            "TicketTrail could not remove its WebDAV connection-test probe.",
        ))
    }
}

fn default_auto_backup_mode() -> String {
    AUTO_BACKUP_OFF.to_string()
}

fn default_stored_config() -> StoredWebDavConfig {
    StoredWebDavConfig {
        server_url: String::new(),
        username: String::new(),
        remote_folder: DEFAULT_REMOTE_FOLDER.to_string(),
        auto_backup_mode: default_auto_backup_mode(),
        last_tested_at: None,
        last_connection_succeeded: None,
        capabilities: None,
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_config_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|_| "Failed to resolve the local WebDAV configuration folder.".to_string())?;
    Ok(base_dir.join(WEBDAV_CONFIG_FILE))
}

fn load_stored_config(path: &Path) -> Result<StoredWebDavConfig, String> {
    if !path.exists() {
        return Ok(default_stored_config());
    }
    let text = fs::read_to_string(path)
        .map_err(|_| "Failed to read the local WebDAV configuration.".to_string())?;
    let mut config: StoredWebDavConfig = serde_json::from_str(&text)
        .map_err(|_| "Failed to parse the local WebDAV configuration.".to_string())?;
    if config.remote_folder.trim().is_empty() {
        config.remote_folder = DEFAULT_REMOTE_FOLDER.to_string();
    }
    Ok(config)
}

fn write_stored_config(path: &Path, config: &StoredWebDavConfig) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "The local WebDAV configuration path is invalid.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|_| "Failed to prepare the local WebDAV configuration folder.".to_string())?;

    let serialized = serde_json::to_vec_pretty(config)
        .map_err(|_| "Failed to serialize the local WebDAV configuration.".to_string())?;
    let temporary_path = parent.join(format!("{}.{}.tmp", WEBDAV_CONFIG_FILE, Uuid::new_v4()));
    let mut temporary_file = fs::File::create(&temporary_path)
        .map_err(|_| "Failed to prepare the local WebDAV configuration file.".to_string())?;
    temporary_file
        .write_all(&serialized)
        .and_then(|_| temporary_file.sync_all())
        .map_err(|_| "Failed to write the local WebDAV configuration.".to_string())?;

    if path.exists() {
        fs::remove_file(path)
            .map_err(|_| "Failed to replace the local WebDAV configuration.".to_string())?;
    }
    fs::rename(&temporary_path, path)
        .map_err(|_| "Failed to finalize the local WebDAV configuration.".to_string())
}

fn normalize_server_url(raw: &str) -> Result<Url, String> {
    let trimmed = raw.trim();
    if trimmed.to_ascii_lowercase().contains("%2e") {
        return Err("The WebDAV base URL contains an unsafe encoded path.".to_string());
    }
    let mut url =
        Url::parse(trimmed).map_err(|_| "Enter a valid WebDAV server URL.".to_string())?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Do not include a username or password in the WebDAV URL.".to_string());
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err("The WebDAV base URL cannot contain a query or fragment.".to_string());
    }
    if url.host_str().is_none() || url.cannot_be_a_base() {
        return Err("Enter an absolute WebDAV server URL.".to_string());
    }

    match url.scheme() {
        "https" => {}
        "http" if is_localhost(&url) => {}
        "http" => return Err("WebDAV requires HTTPS except for localhost development.".to_string()),
        _ => return Err("WebDAV server URLs must use HTTPS.".to_string()),
    }

    let path = url.path().trim_end_matches('/');
    let normalized_path = if path.is_empty() {
        "/".to_string()
    } else {
        format!("{path}/")
    };
    url.set_path(&normalized_path);
    Ok(url)
}

fn is_localhost(url: &Url) -> bool {
    matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"))
}

fn normalize_remote_folder(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(DEFAULT_REMOTE_FOLDER.to_string());
    }
    if trimmed.starts_with('/')
        || trimmed.starts_with('\\')
        || trimmed.contains("://")
        || trimmed.contains(['?', '#', '\\', '%'])
        || trimmed.chars().any(char::is_control)
    {
        return Err("Enter a safe relative WebDAV folder.".to_string());
    }

    let mut normalized_segments = Vec::new();
    for segment in trimmed.split('/') {
        let segment = segment.trim();
        if segment.is_empty() || matches!(segment, "." | "..") {
            return Err("The WebDAV folder cannot contain empty, . or .. segments.".to_string());
        }
        if segment.contains(':') {
            return Err("The WebDAV folder contains an unsafe path segment.".to_string());
        }
        normalized_segments.push(segment);
    }
    Ok(normalized_segments.join("/"))
}

fn append_segments(base: &Url, segments: &[&str], trailing_slash: bool) -> Result<Url, String> {
    let mut url = base.clone();
    {
        let mut path = url
            .path_segments_mut()
            .map_err(|_| "The WebDAV base URL cannot be used as a directory.".to_string())?;
        path.pop_if_empty();
        for segment in segments {
            path.push(segment);
        }
        if trailing_slash {
            path.push("");
        }
    }
    Ok(url)
}

fn managed_directory_urls(base: &Url, remote_folder: &str) -> Result<Vec<Url>, String> {
    let folder_segments = remote_folder.split('/').collect::<Vec<_>>();
    let mut urls = Vec::new();
    for index in 1..=folder_segments.len() {
        urls.push(append_segments(base, &folder_segments[..index], true)?);
    }
    let mut backup_segments = folder_segments;
    backup_segments.push(MANAGED_BACKUPS_FOLDER);
    urls.push(append_segments(base, &backup_segments, true)?);
    Ok(urls)
}

fn public_config<S: SecretStore>(
    stored: StoredWebDavConfig,
    secrets: &S,
) -> Result<WebDavConfigPayload, String> {
    let has_password = secrets.get_webdav_password()?.is_some();
    Ok(WebDavConfigPayload {
        configured: !stored.server_url.is_empty() && !stored.username.is_empty() && has_password,
        server_url: stored.server_url,
        username: stored.username,
        remote_folder: stored.remote_folder,
        has_password,
        auto_backup_mode: stored.auto_backup_mode,
        last_tested_at: stored.last_tested_at,
        last_connection_succeeded: stored.last_connection_succeeded,
        capabilities: stored.capabilities,
    })
}

fn effective_config<S: SecretStore>(
    path: &Path,
    secrets: &S,
) -> Result<EffectiveWebDavConfig, String> {
    Ok(EffectiveWebDavConfig {
        stored: load_stored_config(path)?,
        password: secrets.get_webdav_password()?,
    })
}

pub fn get_public_config(app: &AppHandle) -> Result<WebDavConfigPayload, String> {
    public_config(
        load_stored_config(&config_path(app)?)?,
        &WindowsCredentialSecretStore,
    )
}

fn save_config_with_store<S: SecretStore>(
    path: &Path,
    input: WebDavConfigSavePayload,
    secrets: &S,
) -> Result<WebDavConfigPayload, String> {
    let server_url = normalize_server_url(&input.server_url)?.to_string();
    let username = input.username.trim().to_string();
    if username.is_empty() {
        return Err("Enter the WebDAV username.".to_string());
    }
    let remote_folder = normalize_remote_folder(&input.remote_folder)?;
    let existing = load_stored_config(path)?;
    let clear_password = input.clear_password.unwrap_or(false);
    let replacement_password = input
        .password
        .as_deref()
        .filter(|value| !value.trim().is_empty());

    if clear_password {
        secrets.delete_webdav_password()?;
    } else if let Some(password) = replacement_password {
        secrets.set_webdav_password(password)?;
    }

    let stored = StoredWebDavConfig {
        server_url,
        username,
        remote_folder,
        auto_backup_mode: existing.auto_backup_mode,
        last_tested_at: None,
        last_connection_succeeded: None,
        capabilities: None,
    };
    write_stored_config(path, &stored)?;
    public_config(stored, secrets)
}

pub fn save_config(
    app: &AppHandle,
    input: WebDavConfigSavePayload,
) -> Result<WebDavConfigPayload, String> {
    save_config_with_store(&config_path(app)?, input, &WindowsCredentialSecretStore)
}

pub fn test_connection(app: &AppHandle) -> Result<WebDavConnectionTestPayload, String> {
    let path = config_path(app)?;
    let secrets = WindowsCredentialSecretStore;
    let effective = effective_config(&path, &secrets)?;
    let tested_at = Utc::now().to_rfc3339();
    let managed_directory = format!("{}/backups/", effective.stored.remote_folder);

    let result = run_connection_test(&effective);
    let (payload, succeeded, capabilities) = match result {
        Ok((capabilities, cleanup_warning)) => (
            WebDavConnectionTestPayload {
                success: true,
                tested_at: tested_at.clone(),
                managed_directory,
                capabilities: Some(capabilities.clone()),
                error_code: None,
                message: if capabilities.move_supported {
                    "Connected. TicketTrail can create, list, write, verify, move, and delete probe objects in the managed WebDAV directory.".to_string()
                } else {
                    "Connected. MOVE is unavailable, so a compatibility publish mode will be required for future backups.".to_string()
                },
                cleanup_warning,
            },
            true,
            Some(capabilities),
        ),
        Err(error) => (
            WebDavConnectionTestPayload {
                success: false,
                tested_at: tested_at.clone(),
                managed_directory,
                capabilities: None,
                error_code: Some(error.code.as_str().to_string()),
                message: error.message,
                cleanup_warning: None,
            },
            false,
            None,
        ),
    };

    let mut stored = effective.stored;
    stored.last_tested_at = Some(tested_at);
    stored.last_connection_succeeded = Some(succeeded);
    stored.capabilities = capabilities;
    write_stored_config(&path, &stored)?;
    Ok(payload)
}

fn run_connection_test(
    config: &EffectiveWebDavConfig,
) -> Result<(WebDavCapabilityPayload, Option<String>), WebDavError> {
    let password = config.password.clone().ok_or_else(|| {
        WebDavError::new(
            WebDavErrorCode::InvalidConfiguration,
            "Save a WebDAV application password before testing the connection.",
        )
    })?;
    let base = normalize_server_url(&config.stored.server_url)
        .map_err(|message| WebDavError::new(WebDavErrorCode::InvalidConfiguration, message))?;
    let remote_folder = normalize_remote_folder(&config.stored.remote_folder)
        .map_err(|message| WebDavError::new(WebDavErrorCode::InvalidConfiguration, message))?;
    if config.stored.username.trim().is_empty() {
        return Err(WebDavError::new(
            WebDavErrorCode::InvalidConfiguration,
            "Enter the WebDAV username before testing the connection.",
        ));
    }

    let client = WebDavClient::new(config.stored.username.clone(), password)?;
    client.propfind(base.clone())?;
    let directories = managed_directory_urls(&base, &remote_folder)
        .map_err(|message| WebDavError::new(WebDavErrorCode::InvalidConfiguration, message))?;
    for directory in &directories {
        client.ensure_collection(directory.clone())?;
    }
    let managed = directories.last().cloned().ok_or_else(|| {
        WebDavError::new(
            WebDavErrorCode::InvalidConfiguration,
            "The managed WebDAV directory could not be resolved.",
        )
    })?;
    client.propfind(managed.clone())?;

    let operation_id = Uuid::new_v4().simple().to_string();
    let source = append_segments(
        &managed,
        &[&format!("tickettrail-connection-test-{operation_id}.tmp")],
        false,
    )
    .map_err(|message| WebDavError::new(WebDavErrorCode::InvalidConfiguration, message))?;
    let moved = append_segments(
        &managed,
        &[&format!(
            "tickettrail-connection-test-{operation_id}-moved.tmp"
        )],
        false,
    )
    .map_err(|message| WebDavError::new(WebDavErrorCode::InvalidConfiguration, message))?;

    client.put_probe(source.clone())?;
    let test_result = (|| {
        client.verify_probe(source.clone())?;
        client.probe_move(source.clone(), moved.clone())
    })();

    let mut cleanup_failures = Vec::new();
    if client.delete_exact(source).is_err() {
        cleanup_failures.push("original probe");
    }
    if client.delete_exact(moved).is_err() {
        cleanup_failures.push("MOVE probe");
    }

    if !cleanup_failures.is_empty() {
        let primary_failure = test_result
            .as_ref()
            .err()
            .map(|error| format!("{} ", error.message))
            .unwrap_or_default();
        return Err(WebDavError::new(
            WebDavErrorCode::CleanupFailed,
            format!(
                "{}TicketTrail could not clean up the {}. Remove only the tickettrail-connection-test object if it remains.",
                primary_failure,
                cleanup_failures.join(" and ")
            ),
        ));
    }
    let move_supported = test_result?;

    Ok((
        WebDavCapabilityPayload {
            webdav_accessible: true,
            managed_directory_writable: true,
            move_supported,
        },
        None,
    ))
}

fn map_network_error(error: reqwest::Error, fallback: WebDavErrorCode) -> WebDavError {
    if error.is_timeout() {
        WebDavError::new(WebDavErrorCode::Timeout, "The WebDAV request timed out.")
    } else if error.is_connect() {
        WebDavError::new(
            WebDavErrorCode::NetworkUnavailable,
            "The WebDAV server could not be reached.",
        )
    } else {
        WebDavError::new(fallback, "The WebDAV operation failed.")
    }
}

fn status_error(
    status: StatusCode,
    fallback: WebDavErrorCode,
    message: &'static str,
) -> WebDavError {
    match status {
        StatusCode::UNAUTHORIZED => WebDavError::new(
            WebDavErrorCode::AuthenticationFailed,
            "WebDAV authentication failed. Check the username and application password.",
        ),
        StatusCode::FORBIDDEN => WebDavError::new(
            WebDavErrorCode::PermissionDenied,
            "The WebDAV account does not have permission for this operation.",
        ),
        status if status.is_redirection() => WebDavError::new(
            WebDavErrorCode::UnsafeRedirect,
            "The WebDAV server redirected the request. TicketTrail did not forward credentials.",
        ),
        _ => WebDavError::new(fallback, message),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        append_segments, default_stored_config, managed_directory_urls, normalize_remote_folder,
        normalize_server_url, public_config, save_config_with_store, SecretStore,
        StoredWebDavConfig,
    };
    use crate::models::WebDavConfigSavePayload;
    use std::{cell::RefCell, fs};
    use uuid::Uuid;

    #[derive(Default)]
    struct FakeSecretStore {
        password: RefCell<Option<String>>,
    }

    impl SecretStore for FakeSecretStore {
        fn get_webdav_password(&self) -> Result<Option<String>, String> {
            Ok(self.password.borrow().clone())
        }

        fn set_webdav_password(&self, password: &str) -> Result<(), String> {
            *self.password.borrow_mut() = Some(password.to_string());
            Ok(())
        }

        fn delete_webdav_password(&self) -> Result<(), String> {
            *self.password.borrow_mut() = None;
            Ok(())
        }
    }

    #[test]
    fn normalizes_https_and_localhost_http_urls() {
        assert_eq!(
            normalize_server_url("https://dav.example.com/root")
                .unwrap()
                .as_str(),
            "https://dav.example.com/root/"
        );
        assert!(normalize_server_url("http://localhost:8080/dav").is_ok());
        assert!(normalize_server_url("http://127.0.0.1:8080/dav").is_ok());
    }

    #[test]
    fn rejects_unsafe_server_urls() {
        assert!(normalize_server_url("http://dav.example.com").is_err());
        assert!(normalize_server_url("not a URL").is_err());
        assert!(normalize_server_url("https://user:secret@dav.example.com").is_err());
        assert!(normalize_server_url("https://dav.example.com/root?x=1").is_err());
        assert!(normalize_server_url("https://dav.example.com/root#fragment").is_err());
        assert!(normalize_server_url("https://dav.example.com/%2e%2e/root").is_err());
    }

    #[test]
    fn validates_remote_folder_segments() {
        assert_eq!(
            normalize_remote_folder("TicketTrail").unwrap(),
            "TicketTrail"
        );
        assert_eq!(
            normalize_remote_folder("Personal/TicketTrail").unwrap(),
            "Personal/TicketTrail"
        );
        for invalid in [
            ".",
            "..",
            "TicketTrail//Backups",
            "../TicketTrail",
            "/TicketTrail",
            "TicketTrail\\Backups",
            "TicketTrail%2f..",
            "https://dav.example.com",
        ] {
            assert!(
                normalize_remote_folder(invalid).is_err(),
                "{invalid} should fail"
            );
        }
    }

    #[test]
    fn managed_directory_stays_under_the_configured_base() {
        let base = normalize_server_url("https://dav.example.com/base/").unwrap();
        let urls = managed_directory_urls(&base, "Personal/TicketTrail").unwrap();
        assert_eq!(
            urls.last().unwrap().as_str(),
            "https://dav.example.com/base/Personal/TicketTrail/backups/"
        );
        assert_eq!(
            append_segments(&base, &["TicketTrail", "backups"], true)
                .unwrap()
                .origin(),
            base.origin()
        );
    }

    #[test]
    fn public_config_never_serializes_the_password() {
        let secrets = FakeSecretStore {
            password: RefCell::new(Some("do-not-return-this".to_string())),
        };
        let public = public_config(
            StoredWebDavConfig {
                server_url: "https://dav.example.com/".to_string(),
                username: "user@example.com".to_string(),
                remote_folder: "TicketTrail".to_string(),
                ..default_stored_config()
            },
            &secrets,
        )
        .unwrap();
        let serialized = serde_json::to_string(&public).unwrap();
        let serialized_value: serde_json::Value = serde_json::from_str(&serialized).unwrap();
        assert!(public.has_password);
        assert!(!serialized.contains("do-not-return-this"));
        assert!(serialized_value.get("password").is_none());
    }

    #[test]
    fn blank_password_preserves_existing_secret_and_clear_is_explicit() {
        let directory =
            std::env::temp_dir().join(format!("tickettrail-webdav-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("webdav.json");
        let secrets = FakeSecretStore {
            password: RefCell::new(Some("existing-secret".to_string())),
        };

        let saved = save_config_with_store(
            &path,
            WebDavConfigSavePayload {
                server_url: "https://dav.example.com".to_string(),
                username: "user".to_string(),
                remote_folder: "TicketTrail".to_string(),
                password: Some("  ".to_string()),
                clear_password: Some(false),
            },
            &secrets,
        )
        .unwrap();
        assert!(saved.has_password);
        assert_eq!(
            secrets.get_webdav_password().unwrap().as_deref(),
            Some("existing-secret")
        );

        let cleared = save_config_with_store(
            &path,
            WebDavConfigSavePayload {
                server_url: "https://dav.example.com".to_string(),
                username: "user".to_string(),
                remote_folder: "TicketTrail".to_string(),
                password: None,
                clear_password: Some(true),
            },
            &secrets,
        )
        .unwrap();
        assert!(!cleared.has_password);
        fs::remove_dir_all(directory).unwrap();
    }
}
