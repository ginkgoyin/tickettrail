use crate::db;
use crate::models::{
    WebDavBackupNowPayload, WebDavCapabilityPayload, WebDavConfigPayload, WebDavConfigSavePayload,
    WebDavConnectionTestPayload, WebDavRemoteBackupPayload,
};
use chrono::{DateTime, NaiveDateTime, Utc};
use reqwest::{
    blocking::{Client, RequestBuilder, Response},
    header::{HeaderName, HeaderValue, CONTENT_LENGTH, CONTENT_TYPE},
    redirect::Policy,
    Method, StatusCode, Url,
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
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
const MAX_PROPFIND_RESPONSE_BYTES: u64 = 1_048_576;
const MAX_SIDECAR_RESPONSE_BYTES: u64 = 32_768;
const MAX_SIDECAR_CANDIDATES: usize = 100;
const MAX_RETAINED_REMOTE_BACKUPS: usize = 30;
static CLOUD_BACKUP_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct RemoteBackupSidecar {
    remote_metadata_version: u32,
    backup_id: String,
    archive_object_name: String,
    archive_size_bytes: u64,
    archive_format_version: u32,
    created_at: String,
    label: String,
    purpose: String,
    app_version: Option<String>,
    device_id: Option<String>,
    device_name: Option<String>,
    platform: Option<String>,
    ticket_count: usize,
    journey_count: usize,
    attachment_count: usize,
    attachments_included: bool,
}

#[derive(Clone, Debug)]
struct CompleteRemoteBackup {
    payload: WebDavRemoteBackupPayload,
    archive_name: String,
    sidecar_name: String,
}

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

    fn put_file(
        &self,
        url: Url,
        path: &Path,
        content_type: &'static str,
    ) -> Result<(), WebDavError> {
        let bytes = fs::read(path).map_err(|_| {
            WebDavError::new(
                WebDavErrorCode::WriteTestFailed,
                "TicketTrail could not read the temporary archive.",
            )
        })?;
        self.send(
            self.request(Method::PUT, url)
                .header(CONTENT_TYPE, content_type)
                .body(bytes),
            WebDavErrorCode::WriteTestFailed,
            "TicketTrail could not upload the backup archive.",
        )?;
        Ok(())
    }

    fn put_bytes(
        &self,
        url: Url,
        bytes: Vec<u8>,
        content_type: &'static str,
    ) -> Result<(), WebDavError> {
        self.send(
            self.request(Method::PUT, url)
                .header(CONTENT_TYPE, content_type)
                .body(bytes),
            WebDavErrorCode::WriteTestFailed,
            "TicketTrail could not publish backup metadata.",
        )?;
        Ok(())
    }

    fn verify_object_size(&self, url: Url, expected_size: u64) -> Result<(), WebDavError> {
        let response = self
            .request(Method::HEAD, url.clone())
            .send()
            .map_err(|error| map_network_error(error, WebDavErrorCode::WriteTestFailed))?;
        if response.status().is_redirection() {
            return Err(WebDavError::new(
                WebDavErrorCode::UnsafeRedirect,
                "The WebDAV server redirected archive verification.",
            ));
        }
        if response.status().is_success() {
            if let Some(length) = response
                .headers()
                .get(CONTENT_LENGTH)
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.parse::<u64>().ok())
            {
                if length == expected_size {
                    return Ok(());
                }
            }
        } else if response.status() != StatusCode::METHOD_NOT_ALLOWED {
            return Err(status_error(
                response.status(),
                WebDavErrorCode::WriteTestFailed,
                "TicketTrail could not verify the uploaded backup archive.",
            ));
        }

        // Some generic WebDAV servers return a placeholder or no Content-Length
        // for HEAD. Query the WebDAV property before treating that as a failure.
        match self.propfind_object_size(url)? {
            Some(length) if length == expected_size => Ok(()),
            Some(_) => Err(WebDavError::new(
                WebDavErrorCode::WriteTestFailed,
                "The uploaded backup archive size could not be verified.",
            )),
            None => Ok(()), // successful PUT plus a verified object, but no reliable size capability
        }
    }

    fn propfind_object_size(&self, url: Url) -> Result<Option<u64>, WebDavError> {
        let method = Method::from_bytes(b"PROPFIND").expect("PROPFIND is a valid method");
        let response = self
            .request(method, url)
            .header("Depth", "0")
            .header(CONTENT_TYPE, "application/xml; charset=utf-8")
            .body("<?xml version=\"1.0\" encoding=\"utf-8\"?><propfind xmlns=\"DAV:\"><prop><getcontentlength/></prop></propfind>")
            .send()
            .map_err(|error| map_network_error(error, WebDavErrorCode::WriteTestFailed))?;
        if response.status().is_redirection() {
            return Err(WebDavError::new(
                WebDavErrorCode::UnsafeRedirect,
                "The WebDAV server redirected archive verification.",
            ));
        }
        if response.status() == StatusCode::METHOD_NOT_ALLOWED
            || response.status() == StatusCode::NOT_IMPLEMENTED
        {
            return Ok(None);
        }
        if !response.status().is_success() {
            return Err(status_error(
                response.status(),
                WebDavErrorCode::WriteTestFailed,
                "TicketTrail could not verify the uploaded backup archive.",
            ));
        }
        let bytes = read_limited(
            response,
            MAX_SIDECAR_RESPONSE_BYTES,
            "The WebDAV archive verification response was too large.",
        )?;
        let xml = String::from_utf8(bytes).map_err(|_| {
            WebDavError::new(
                WebDavErrorCode::WriteTestFailed,
                "The WebDAV archive verification response was invalid.",
            )
        })?;
        Ok(extract_propfind_content_length(&xml))
    }

    fn move_exact(&self, source: Url, destination: Url) -> Result<(), WebDavError> {
        let method = Method::from_bytes(b"MOVE").expect("MOVE is a valid method");
        let destination = HeaderValue::from_str(destination.as_str()).map_err(|_| {
            WebDavError::new(
                WebDavErrorCode::WriteTestFailed,
                "TicketTrail could not prepare WebDAV publication.",
            )
        })?;
        self.send(
            self.request(method, source)
                .header(HeaderName::from_static("destination"), destination)
                .header("Overwrite", "F"),
            WebDavErrorCode::WriteTestFailed,
            "TicketTrail could not publish the uploaded backup.",
        )?;
        Ok(())
    }

    fn propfind_depth_one(&self, url: Url) -> Result<Vec<String>, WebDavError> {
        let method = Method::from_bytes(b"PROPFIND").expect("PROPFIND is a valid method");
        let response = self.send(
            self.request(method, url).header("Depth", "1").header(CONTENT_TYPE, "application/xml; charset=utf-8").body("<?xml version=\"1.0\" encoding=\"utf-8\"?><propfind xmlns=\"DAV:\"><prop><resourcetype/></prop></propfind>"),
            WebDavErrorCode::ListingFailed,
            "TicketTrail could not list its managed WebDAV backups.",
        )?;
        let bytes = read_limited(
            response,
            MAX_PROPFIND_RESPONSE_BYTES,
            "The WebDAV backup listing was too large.",
        )?;
        let xml = String::from_utf8(bytes).map_err(|_| {
            WebDavError::new(
                WebDavErrorCode::ListingFailed,
                "The WebDAV backup listing was invalid.",
            )
        })?;
        Ok(extract_propfind_names(&xml))
    }

    fn get_limited(&self, url: Url, limit: u64) -> Result<Vec<u8>, WebDavError> {
        let response = self.send(
            self.request(Method::GET, url),
            WebDavErrorCode::ListingFailed,
            "TicketTrail could not read backup metadata.",
        )?;
        read_limited(response, limit, "The WebDAV backup metadata was too large.")
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

pub fn backup_now(app: &AppHandle) -> Result<WebDavBackupNowPayload, String> {
    let lock = CLOUD_BACKUP_LOCK.get_or_init(|| Mutex::new(()));
    let _guard = lock
        .try_lock()
        .map_err(|_| "A WebDAV backup is already in progress.".to_string())?;
    let (client, managed, move_supported) = open_backup_transport(app)?;
    let temporary = db::create_temporary_archive(app, "manual")?;
    let operation_id = Uuid::new_v4().simple().to_string();
    let timestamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let object_id = Uuid::new_v4().simple().to_string();
    let archive_name = format!("tickettrail-v1-{timestamp}-{object_id}.zip");
    let sidecar_name = archive_name.trim_end_matches(".zip").to_string() + ".meta.json";
    let archive_part_name = format!("tickettrail-uploading-{operation_id}.zip.part");
    let sidecar_part_name = format!("tickettrail-uploading-{operation_id}.meta.json.part");
    let archive_size_bytes = fs::metadata(&temporary.archive_path)
        .map_err(|err| err.to_string())?
        .len();
    let sidecar = RemoteBackupSidecar {
        remote_metadata_version: 1,
        backup_id: format!("backup-{object_id}"),
        archive_object_name: archive_name.clone(),
        archive_size_bytes,
        archive_format_version: 1,
        created_at: temporary.record.created_at.clone(),
        label: temporary.record.label.clone(),
        purpose: "manual".to_string(),
        app_version: temporary.record.app_version.clone(),
        device_id: None,
        device_name: temporary.record.device_name.clone(),
        platform: temporary.record.platform.clone(),
        ticket_count: temporary.record.ticket_count,
        journey_count: temporary.record.journey_count.unwrap_or(0),
        attachment_count: temporary.record.attachment_count,
        attachments_included: temporary.record.attachments_included.unwrap_or(false),
    };
    let sidecar_bytes = serde_json::to_vec_pretty(&sidecar)
        .map_err(|_| "TicketTrail could not prepare backup metadata.".to_string())?;
    let archive_final = remote_object_url(&managed, &archive_name)?;
    let sidecar_final = remote_object_url(&managed, &sidecar_name)?;
    let archive_part = remote_object_url(&managed, &archive_part_name)?;
    let sidecar_part = remote_object_url(&managed, &sidecar_part_name)?;

    let published = (|| -> Result<(), WebDavError> {
        if move_supported {
            client.put_file(
                archive_part.clone(),
                &temporary.archive_path,
                "application/zip",
            )?;
            client.verify_object_size(archive_part.clone(), archive_size_bytes)?;
            client.put_bytes(
                sidecar_part.clone(),
                sidecar_bytes.clone(),
                "application/json",
            )?;
            client.move_exact(archive_part.clone(), archive_final.clone())?;
            client.move_exact(sidecar_part.clone(), sidecar_final.clone())?;
        } else {
            client.put_file(
                archive_final.clone(),
                &temporary.archive_path,
                "application/zip",
            )?;
            client.verify_object_size(archive_final.clone(), archive_size_bytes)?;
            client.put_bytes(
                sidecar_final.clone(),
                sidecar_bytes.clone(),
                "application/json",
            )?;
        }
        Ok(())
    })();
    let mut cleanup_warning = None;
    temporary.cleanup();
    if published.is_err() {
        // The sidecar-last rule keeps an interrupted upload undiscoverable. These
        // exact-object deletes are only best-effort cleanup; they never scan.
        let mut failed = Vec::new();
        if move_supported && client.delete_exact(archive_part).is_err() {
            failed.push("archive upload temporary object");
        }
        if move_supported && client.delete_exact(sidecar_part).is_err() {
            failed.push("metadata upload temporary object");
        }
        let _ = client.delete_exact(archive_final.clone());
        let _ = client.delete_exact(sidecar_final.clone());
        if !failed.is_empty() {
            cleanup_warning = Some(format!(
                "Remote cleanup pending for {}.",
                failed.join(" and ")
            ));
        }
    }
    published.map_err(|error| error.message)?;

    let fresh = list_complete_backups(&client, &managed).map_err(|error| error.message)?;
    let created = fresh
        .iter()
        .find(|backup| backup.payload.id == sidecar.backup_id)
        .ok_or_else(|| {
            "The WebDAV backup was published but could not be confirmed in remote history."
                .to_string()
        })?
        .payload
        .clone();
    if let Err(error) = enforce_retention(&client, &managed, &sidecar.backup_id) {
        cleanup_warning = Some(match cleanup_warning {
            Some(existing) => format!(
                "{existing} Backup uploaded; remote cleanup pending: {}",
                error.message
            ),
            None => format!("Backup uploaded; remote cleanup pending: {}", error.message),
        });
    }
    Ok(WebDavBackupNowPayload {
        backup: created,
        cleanup_warning,
    })
}

pub fn list_remote_backups(app: &AppHandle) -> Result<Vec<WebDavRemoteBackupPayload>, String> {
    // History is read-only. It must never occupy the single-flight lock used by
    // archive creation/publication, or a slow provider response can block Backup now.
    let (client, managed, _) = open_backup_transport(app)?;
    list_complete_backups(&client, &managed)
        .map(|backups| backups.into_iter().map(|backup| backup.payload).collect())
        .map_err(|error| error.message)
}

fn open_backup_transport(app: &AppHandle) -> Result<(WebDavClient, Url, bool), String> {
    let effective = effective_config(&config_path(app)?, &WindowsCredentialSecretStore)?;
    let password = effective.password.ok_or_else(|| {
        "Save a WebDAV application password before creating a cloud backup.".to_string()
    })?;
    if effective.stored.username.trim().is_empty() || effective.stored.server_url.trim().is_empty()
    {
        return Err(
            "Save a complete WebDAV configuration before creating a cloud backup.".to_string(),
        );
    }
    let base = normalize_server_url(&effective.stored.server_url)?;
    let remote_folder = normalize_remote_folder(&effective.stored.remote_folder)?;
    let directories = managed_directory_urls(&base, &remote_folder)?;
    let client =
        WebDavClient::new(effective.stored.username, password).map_err(|error| error.message)?;
    for directory in &directories {
        client
            .ensure_collection(directory.clone())
            .map_err(|error| error.message)?;
    }
    let managed = directories
        .last()
        .cloned()
        .ok_or_else(|| "The managed WebDAV directory could not be resolved.".to_string())?;
    let move_supported = effective
        .stored
        .capabilities
        .map(|value| value.move_supported)
        .unwrap_or(false);
    Ok((client, managed, move_supported))
}

fn remote_object_url(managed: &Url, object_name: &str) -> Result<Url, String> {
    if !is_managed_object_name(object_name) {
        return Err("TicketTrail generated an invalid WebDAV object name.".to_string());
    }
    append_segments(managed, &[object_name], false)
}

fn is_managed_object_name(name: &str) -> bool {
    parse_final_archive_name(name).is_some()
        || parse_final_sidecar_name(name).is_some()
        || (name.starts_with("tickettrail-uploading-")
            && name.ends_with(".part")
            && name.is_ascii())
}

fn parse_final_archive_name(name: &str) -> Option<String> {
    parse_final_name(name, ".zip")
}
fn parse_final_sidecar_name(name: &str) -> Option<String> {
    parse_final_name(name, ".meta.json")
}
fn parse_final_name(name: &str, suffix: &str) -> Option<String> {
    let prefix = "tickettrail-v1-";
    let stem = name.strip_suffix(suffix)?;
    let body = stem.strip_prefix(prefix)?;
    if !name.is_ascii() || body.len() != 16 + 1 + 32 {
        return None;
    }
    let (timestamp, uuid) = body.split_once('-')?;
    if uuid.len() != 32
        || !uuid
            .chars()
            .all(|value| value.is_ascii_hexdigit() && !value.is_ascii_uppercase())
    {
        return None;
    }
    NaiveDateTime::parse_from_str(timestamp, "%Y%m%dT%H%M%SZ").ok()?;
    Some(stem.to_string())
}

fn expected_archive_name(sidecar_name: &str) -> Option<String> {
    let stem = parse_final_sidecar_name(sidecar_name)?;
    Some(format!("{stem}.zip"))
}

fn read_limited(
    response: Response,
    limit: u64,
    message: &'static str,
) -> Result<Vec<u8>, WebDavError> {
    if response
        .content_length()
        .is_some_and(|length| length > limit)
    {
        return Err(WebDavError::new(WebDavErrorCode::ListingFailed, message));
    }
    let mut bytes = Vec::new();
    response
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| {
            WebDavError::new(
                WebDavErrorCode::ListingFailed,
                "TicketTrail could not read the WebDAV response.",
            )
        })?;
    if bytes.len() as u64 > limit {
        return Err(WebDavError::new(WebDavErrorCode::ListingFailed, message));
    }
    Ok(bytes)
}

fn extract_propfind_names(xml: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut remainder = xml;
    while let Some(start) = remainder.find("<") {
        let tail = &remainder[start..];
        let Some(href_marker) = tail.find("href>") else {
            break;
        };
        // Continue from the current remainder, not from the original document.
        // Otherwise a multi-response PROPFIND repeats the first href forever.
        let after = &tail[href_marker + 5..];
        let Some(end) = after.find("</") else {
            break;
        };
        let href = after[..end].trim();
        if let Some(name) = href.trim_end_matches('/').rsplit('/').next() {
            if !name.is_empty() && !name.contains('%') {
                values.push(name.to_string());
            }
        }
        remainder = &after[end + 2..];
    }
    values.sort();
    values.dedup();
    values
}

fn extract_propfind_content_length(xml: &str) -> Option<u64> {
    let marker = "getcontentlength>";
    let start = xml.find(marker)? + marker.len();
    let remainder = &xml[start..];
    let end = remainder.find("</")?;
    remainder[..end].trim().parse::<u64>().ok()
}

fn validate_sidecar(sidecar_name: &str, bytes: &[u8]) -> Option<CompleteRemoteBackup> {
    let sidecar: RemoteBackupSidecar = serde_json::from_slice(bytes).ok()?;
    if sidecar.remote_metadata_version != 1
        || sidecar.archive_format_version != 1
        || !is_valid_backup_id(&sidecar.backup_id)
        || !matches!(
            sidecar.purpose.as_str(),
            "manual" | "automatic" | "preRestoreSafety"
        )
    {
        return None;
    }
    if sidecar.label.trim().is_empty()
        || sidecar.label.len() > 512
        || sidecar.archive_size_bytes == 0
    {
        return None;
    }
    let archive_name = expected_archive_name(sidecar_name)?;
    if sidecar.archive_object_name != archive_name {
        return None;
    }
    DateTime::parse_from_rfc3339(&sidecar.created_at).ok()?;
    Some(CompleteRemoteBackup {
        archive_name: archive_name.clone(),
        sidecar_name: sidecar_name.to_string(),
        payload: WebDavRemoteBackupPayload {
            id: sidecar.backup_id,
            label: sidecar.label,
            created_at: sidecar.created_at,
            purpose: sidecar.purpose,
            app_version: sidecar.app_version,
            device_name: sidecar.device_name,
            platform: sidecar.platform,
            ticket_count: sidecar.ticket_count,
            journey_count: sidecar.journey_count,
            attachment_count: sidecar.attachment_count,
            attachments_included: sidecar.attachments_included,
            archive_format_version: sidecar.archive_format_version,
            archive_size_bytes: sidecar.archive_size_bytes,
        },
    })
}

fn is_valid_backup_id(value: &str) -> bool {
    value.len() == 39
        && value.starts_with("backup-")
        && value[7..]
            .chars()
            .all(|char| char.is_ascii_hexdigit() && !char.is_ascii_uppercase())
}

fn list_complete_backups(
    client: &WebDavClient,
    managed: &Url,
) -> Result<Vec<CompleteRemoteBackup>, WebDavError> {
    let names = client.propfind_depth_one(managed.clone())?;
    let known_names = names
        .iter()
        .cloned()
        .collect::<std::collections::HashSet<_>>();
    let candidates = names
        .into_iter()
        .filter(|name| parse_final_sidecar_name(name).is_some())
        .collect::<Vec<_>>();
    if candidates.len() > MAX_SIDECAR_CANDIDATES {
        return Err(WebDavError::new(
            WebDavErrorCode::ListingFailed,
            "The managed WebDAV backup directory contains too many metadata objects.",
        ));
    }
    let mut backups = Vec::new();
    for sidecar_name in candidates {
        let Some(archive_name) = expected_archive_name(&sidecar_name) else {
            continue;
        };
        if !known_names.contains(&archive_name) {
            continue;
        }
        let url = remote_object_url(managed, &sidecar_name)
            .map_err(|message| WebDavError::new(WebDavErrorCode::ListingFailed, message))?;
        let bytes = match client.get_limited(url, MAX_SIDECAR_RESPONSE_BYTES) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };
        if let Some(backup) = validate_sidecar(&sidecar_name, &bytes) {
            backups.push(backup);
        }
    }
    backups.sort_by(|left, right| {
        right
            .payload
            .created_at
            .cmp(&left.payload.created_at)
            .then_with(|| right.payload.id.cmp(&left.payload.id))
    });
    Ok(backups)
}

fn enforce_retention(
    client: &WebDavClient,
    managed: &Url,
    protected_id: &str,
) -> Result<(), WebDavError> {
    let mut backups = list_complete_backups(client, managed)?;
    if backups.len() <= MAX_RETAINED_REMOTE_BACKUPS {
        return Ok(());
    }
    let remove_ids = select_retention_ids(&backups, protected_id, MAX_RETAINED_REMOTE_BACKUPS)
        .ok_or_else(|| {
            WebDavError::new(
                WebDavErrorCode::CleanupFailed,
                "Remote cleanup is pending because all older backups are protected.",
            )
        })?;
    for backup_id in remove_ids {
        let position = backups
            .iter()
            .position(|backup| backup.payload.id == backup_id)
            .expect("selected retention backup must be present");
        let backup = backups.remove(position);
        let sidecar = remote_object_url(managed, &backup.sidecar_name)
            .map_err(|message| WebDavError::new(WebDavErrorCode::CleanupFailed, message))?;
        client.delete_exact(sidecar)?;
        let archive = remote_object_url(managed, &backup.archive_name)
            .map_err(|message| WebDavError::new(WebDavErrorCode::CleanupFailed, message))?;
        client.delete_exact(archive)?;
    }
    let verified = list_complete_backups(client, managed)?;
    if verified.len() > MAX_RETAINED_REMOTE_BACKUPS {
        return Err(WebDavError::new(
            WebDavErrorCode::CleanupFailed,
            "Remote cleanup is pending because the backup cap could not be confirmed.",
        ));
    }
    Ok(())
}

fn select_retention_ids(
    backups: &[CompleteRemoteBackup],
    protected_id: &str,
    maximum: usize,
) -> Option<Vec<String>> {
    if backups.len() <= maximum {
        return Some(Vec::new());
    }
    let mut ordered = backups.iter().collect::<Vec<_>>();
    ordered.sort_by(|left, right| {
        left.payload
            .created_at
            .cmp(&right.payload.created_at)
            .then_with(|| left.payload.id.cmp(&right.payload.id))
    });
    let mut result = Vec::new();
    for backup in ordered {
        if backups.len().saturating_sub(result.len()) <= maximum {
            break;
        }
        if backup.payload.id != protected_id {
            result.push(backup.payload.id.clone());
        }
    }
    (backups.len().saturating_sub(result.len()) <= maximum).then_some(result)
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
        append_segments, default_stored_config, expected_archive_name,
        extract_propfind_content_length, extract_propfind_names, managed_directory_urls,
        normalize_remote_folder, normalize_server_url, parse_final_archive_name,
        parse_final_sidecar_name, public_config, save_config_with_store, select_retention_ids,
        validate_sidecar, CompleteRemoteBackup, RemoteBackupSidecar, SecretStore,
        StoredWebDavConfig,
    };
    use crate::models::{WebDavConfigSavePayload, WebDavRemoteBackupPayload};
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

    fn archive_name(id: &str) -> String {
        format!("tickettrail-v1-20260816T070019Z-{id}.zip")
    }

    fn remote_backup(id: &str, created_at: &str) -> CompleteRemoteBackup {
        let archive_name = archive_name(id);
        CompleteRemoteBackup {
            sidecar_name: archive_name.trim_end_matches(".zip").to_string() + ".meta.json",
            archive_name,
            payload: WebDavRemoteBackupPayload {
                id: format!("backup-{id}"),
                label: "Backup".to_string(),
                created_at: created_at.to_string(),
                purpose: "manual".to_string(),
                app_version: Some("0.1.0".to_string()),
                device_name: None,
                platform: Some("windows".to_string()),
                ticket_count: 1,
                journey_count: 1,
                attachment_count: 0,
                attachments_included: false,
                archive_format_version: 1,
                archive_size_bytes: 10,
            },
        }
    }

    #[test]
    fn strict_remote_filename_contract_rejects_temp_and_unrelated_names() {
        let id = "6adc040628f24208a0e2dd98a369625b";
        let archive = archive_name(id);
        let sidecar = archive.trim_end_matches(".zip").to_string() + ".meta.json";
        assert!(parse_final_archive_name(&archive).is_some());
        assert!(parse_final_sidecar_name(&sidecar).is_some());
        assert_eq!(
            expected_archive_name(&sidecar).as_deref(),
            Some(archive.as_str())
        );
        for invalid in [
            "tickettrail-uploading-a.zip.part",
            "tickettrail-v1-20260816T070019Z-NOT-A-UUID.zip",
            "notes.meta.json",
            "tickettrail-v1-20261316T070019Z-6adc040628f24208a0e2dd98a369625b.zip",
        ] {
            assert!(parse_final_archive_name(invalid).is_none());
            assert!(parse_final_sidecar_name(invalid).is_none());
        }
    }

    #[test]
    fn extracts_webdav_content_length_with_a_namespace_prefix() {
        assert_eq!(
            extract_propfind_content_length(
                "<d:prop><d:getcontentlength>253952</d:getcontentlength></d:prop>"
            ),
            Some(253_952)
        );
        assert_eq!(
            extract_propfind_content_length("<getcontentlength>nope</getcontentlength>"),
            None
        );
    }

    #[test]
    fn extracts_each_propfind_href_without_looping() {
        let names = extract_propfind_names(
            "<d:multistatus><d:response><d:href>/TicketTrail/backups/</d:href></d:response><d:response><d:href>/TicketTrail/backups/first.meta.json</d:href></d:response><d:response><d:href>/TicketTrail/backups/second.zip</d:href></d:response></d:multistatus>",
        );
        assert_eq!(names, vec!["backups", "first.meta.json", "second.zip"]);
    }

    #[test]
    fn sidecar_validation_requires_matching_archive_and_excludes_secrets() {
        let id = "6adc040628f24208a0e2dd98a369625b";
        let archive = archive_name(id);
        let sidecar_name = archive.trim_end_matches(".zip").to_string() + ".meta.json";
        let sidecar = RemoteBackupSidecar {
            remote_metadata_version: 1,
            backup_id: format!("backup-{id}"),
            archive_object_name: archive.clone(),
            archive_size_bytes: 42,
            archive_format_version: 1,
            created_at: "2026-08-16T07:00:19Z".to_string(),
            label: "备份".to_string(),
            purpose: "manual".to_string(),
            app_version: Some("0.1.0".to_string()),
            device_id: None,
            device_name: Some("Device".to_string()),
            platform: Some("windows".to_string()),
            ticket_count: 1,
            journey_count: 2,
            attachment_count: 0,
            attachments_included: false,
        };
        let bytes = serde_json::to_vec(&sidecar).unwrap();
        let text = String::from_utf8(bytes.clone()).unwrap();
        assert!(!text.contains("password"));
        assert!(validate_sidecar(&sidecar_name, &bytes).is_some());
        let mut untrusted: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        untrusted["password"] = serde_json::Value::String("not-accepted".to_string());
        assert!(
            validate_sidecar(&sidecar_name, &serde_json::to_vec(&untrusted).unwrap()).is_none()
        );
        let mut invalid = sidecar;
        invalid.archive_object_name = "unrelated.zip".to_string();
        assert!(validate_sidecar(&sidecar_name, &serde_json::to_vec(&invalid).unwrap()).is_none());
    }

    #[test]
    fn retention_selects_one_oldest_at_thirty_one_and_protects_new_backup() {
        let mut backups = Vec::new();
        for index in 0..31_u32 {
            let id = format!("{index:032x}");
            backups.push(remote_backup(
                &id,
                &format!("2026-08-{:02}T00:00:00Z", index + 1),
            ));
        }
        let protected = backups.last().unwrap().payload.id.clone();
        let selected = select_retention_ids(&backups, &protected, 30).unwrap();
        assert_eq!(selected, vec![backups[0].payload.id.clone()]);
        assert!(!selected.contains(&protected));
        assert!(select_retention_ids(&backups[..30], &protected, 30)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn retention_tie_breaks_by_backup_id() {
        let old = remote_backup("00000000000000000000000000000001", "2026-08-16T00:00:00Z");
        let newer_id = remote_backup("00000000000000000000000000000002", "2026-08-16T00:00:00Z");
        let selected =
            select_retention_ids(&[newer_id.clone(), old.clone()], &newer_id.payload.id, 1)
                .unwrap();
        assert_eq!(selected, vec![old.payload.id]);
    }
}
