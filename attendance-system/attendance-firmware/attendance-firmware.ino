/*
 * RFID Attendance Reader — ESP32 + RC522
 *
 * See OVERVIEW.md at the repo root for the full system design. This sketch
 * implements section 4 (ESP32 Responsibilities) against the Next.js API in
 * attendance-application (section 5).
 *
 * Required libraries (install via Arduino Library Manager):
 *   - MFRC522 (GithubCommunity)
 *   - LiquidCrystal_I2C (johnrickman / marcoschwartz fork both work)
 *   - ArduinoJson (Benoit Blanchon), v7.x
 * Built into the ESP32 board package (no separate install needed):
 *   - WiFi, ESPmDNS, HTTPClient, LittleFS, SPI, Wire
 *
 * Board: any ESP32-WROOM-32 DevKit. Wiring: see OVERVIEW.md section 7.
 */

#include <SPI.h>
#include <Wire.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>
#include <vector>

// ---------------------------------------------------------------------------
// Configuration — edit before flashing
// ---------------------------------------------------------------------------
static const char *WIFI_SSID = "attendance-system";
static const char *WIFI_PASSWORD = "attendance112";

// Hostname the PC app advertises via mDNS (attendance-application must be
// reachable at http://attendance.local — see the app's README for how to
// enable this on Windows/macOS/Linux).
static const char *SERVER_MDNS_NAME = "worshix"; // resolves "attendance.local"
static const char *SELF_MDNS_NAME = "esp32-attendance";
static const uint16_t SERVER_PORT = 3000; // Next.js dev/start default

static const char *NTP_SERVER_1 = "pool.ntp.org";
static const char *NTP_SERVER_2 = "time.nist.gov";

// LCD I2C address — most PCF8574 backpacks are 0x27 or 0x3F. Run an I2C
// scanner sketch first if the display stays blank.
static const uint8_t LCD_I2C_ADDR = 0x27;

// ---------------------------------------------------------------------------
// Pinout — matches OVERVIEW.md section 7
// ---------------------------------------------------------------------------
static const uint8_t PIN_RFID_SS = 4;
static const uint8_t PIN_RFID_RST = 16;
// RC522 SCK/MOSI/MISO use the ESP32's default VSPI pins (18/23/19) via SPI.begin().

static const uint8_t PIN_LED_WIFI = 25;
static const uint8_t PIN_LED_APP = 26;
static const uint8_t PIN_BUZZER = 27;
static const uint8_t PIN_RESET_BTN = 32; // INPUT_PULLUP, active-low

static const uint8_t PIN_I2C_SDA = 21;
static const uint8_t PIN_I2C_SCL = 22;

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
static const unsigned long WIFI_RETRY_INTERVAL_MS = 10000;
static const unsigned long MDNS_RESOLVE_INTERVAL_MS = 30000;
static const unsigned long HEALTH_CHECK_INTERVAL_MS = 5000;
static const unsigned long CARD_SYNC_INTERVAL_MS = 60000;
static const unsigned long QUEUE_DRAIN_INTERVAL_MS = 10000;
static const unsigned long TAP_DEBOUNCE_MS = 1500;
static const unsigned long RESET_BTN_DEBOUNCE_MS = 300;
static const unsigned long LCD_MESSAGE_HOLD_MS = 2000;
static const unsigned long HTTP_TIMEOUT_MS = 4000;
static const size_t SYNC_BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
MFRC522 rfid(PIN_RFID_SS, PIN_RFID_RST);
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);

std::vector<String> knownCards;    // synced copy of the PC's card UIDs
std::vector<String> pendingQueue;  // taps waiting to be forwarded, as "UID|epoch"

bool wifiWasConnected = false;
unsigned long lastWifiAttempt = 0;

IPAddress serverIp;
bool serverIpResolved = false;
unsigned long lastMdnsResolve = 0;

bool appReachable = false;
unsigned long lastHealthCheck = 0;
unsigned long lastCardSync = 0;
unsigned long lastQueueDrain = 0;

bool timeSynced = false;
time_t epochAtSync = 0;
unsigned long millisAtSync = 0;

String lastUid = "";
unsigned long lastTapMillis = 0;

unsigned long lcdMessageUntil = 0;
bool resetBtnLastState = HIGH;
unsigned long lastResetBtnChange = 0;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);

  pinMode(PIN_LED_WIFI, OUTPUT);
  pinMode(PIN_LED_APP, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_RESET_BTN, INPUT_PULLUP);
  digitalWrite(PIN_LED_WIFI, LOW);
  digitalWrite(PIN_LED_APP, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcdShow("Attendance Sys", "Booting...");

  SPI.begin();
  rfid.PCD_Init();

  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS mount failed even after format");
  }
  loadCards();
  loadQueue();

  beep(2, 120, 120); // boot confirmation

  connectWifi();

  lcdShow("Attendance Sys", "Tap your card");
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
void loop() {
  handleResetButton();
  maintainWifi();
  maintainServerConnection();
  handleCardRead();
  periodicMaintenance();
  refreshIdleLcd();
}

// ---------------------------------------------------------------------------
// WiFi + mDNS + health check
// ---------------------------------------------------------------------------
void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWifiAttempt = millis();
}

void maintainWifi() {
  bool connected = WiFi.status() == WL_CONNECTED;
  digitalWrite(PIN_LED_WIFI, connected ? HIGH : LOW);

  if (connected && !wifiWasConnected) {
    Serial.println("WiFi connected: " + WiFi.localIP().toString());
    MDNS.begin(SELF_MDNS_NAME);
    trySyncTime();
    serverIpResolved = false; // force a fresh resolve on this connection
  }

  if (!connected) {
    appReachable = false;
    digitalWrite(PIN_LED_APP, LOW);
    if (millis() - lastWifiAttempt > WIFI_RETRY_INTERVAL_MS) {
      Serial.println("WiFi retry...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      lastWifiAttempt = millis();
    }
  }

  wifiWasConnected = connected;
}

void maintainServerConnection() {
  if (WiFi.status() != WL_CONNECTED) return;

  if (!serverIpResolved && millis() - lastMdnsResolve > MDNS_RESOLVE_INTERVAL_MS) {
    resolveServerIp();
    lastMdnsResolve = millis();
  }

  if (millis() - lastHealthCheck > HEALTH_CHECK_INTERVAL_MS) {
    lastHealthCheck = millis();
    checkHealth();
  }
}

void resolveServerIp() {
  IPAddress ip = MDNS.queryHost(SERVER_MDNS_NAME, 3000);
  if (ip != INADDR_NONE) {
    serverIp = ip;
    serverIpResolved = true;
    Serial.println("Resolved " + String(SERVER_MDNS_NAME) + ".local -> " + ip.toString());
  } else {
    Serial.println("mDNS resolve for '" + String(SERVER_MDNS_NAME) + ".local' failed");
  }
}

void checkHealth() {
  if (!serverIpResolved) {
    appReachable = false;
    digitalWrite(PIN_LED_APP, LOW);
    return;
  }

  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(buildUrl("/api/health"));
  int code = http.GET();
  http.end();

  bool ok = code == 200;
  if (!ok) {
    // Negative codes are HTTPClient/transport errors (timeout, connection
    // refused, etc.) — see HTTPClient.h's HTTPC_ERROR_* constants.
    // Server may also have gotten a new DHCP lease — force re-resolve next cycle.
    Serial.println("Health check to " + buildUrl("/api/health") + " failed, code " + String(code));
    serverIpResolved = false;
  }
  appReachable = ok;
  digitalWrite(PIN_LED_APP, ok ? HIGH : LOW);
}

String buildUrl(const String &path) {
  return "http://" + serverIp.toString() + ":" + String(SERVER_PORT) + path;
}

// ---------------------------------------------------------------------------
// Time (NTP once online; interpolated locally afterward so offline taps
// still get a reasonable timestamp instead of none)
// ---------------------------------------------------------------------------
void trySyncTime() {
  configTime(0, 0, NTP_SERVER_1, NTP_SERVER_2);
  time_t now = time(nullptr);
  int retries = 0;
  while (now < 1700000000 && retries < 15) {
    delay(200);
    now = time(nullptr);
    retries++;
  }
  if (now >= 1700000000) {
    timeSynced = true;
    epochAtSync = now;
    millisAtSync = millis();
    Serial.println("Time synced via NTP");
  } else {
    Serial.println("NTP sync failed; taps will be timestamped on arrival at the server");
  }
}

// Returns 0 if time has never been synced since boot (caller omits the
// field so the server falls back to its own receive time).
unsigned long currentEpochSeconds() {
  if (!timeSynced) return 0;
  return epochAtSync + (millis() - millisAtSync) / 1000UL;
}

// TapOutcome + its forward declaration must come before handleCardRead()
// below: the Arduino IDE auto-generates function prototypes by scanning
// top-to-bottom, and it can't do that for a function whose return type
// (TapOutcome) isn't known yet, which silently drops sendOrQueueTap's
// prototype and breaks the build.
struct TapOutcome {
  bool delivered;
  String status;
  String studentName;
};

TapOutcome sendOrQueueTap(const String &uid);

// ---------------------------------------------------------------------------
// Card read
// ---------------------------------------------------------------------------
void handleCardRead() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String uid = uidToString(rfid.uid.uidByte, rfid.uid.size);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  if (uid == lastUid && millis() - lastTapMillis < TAP_DEBOUNCE_MS) {
    return; // debounce accidental double-read of the same card
  }
  lastUid = uid;
  lastTapMillis = millis();

  bool known = isKnownCard(uid);
  Serial.println("Tap: " + uid + (known ? " (known)" : " (unknown)"));

  if (!known) {
    beep(1, 600, 0);
    lcdShowTimed("Unknown card", "See front desk");
    sendOrQueueTap(uid); // still forwarded — server logs it for the dashboard toast
    return;
  }

  TapOutcome outcome = sendOrQueueTap(uid);
  if (!outcome.delivered) {
    beep(2, 120, 120);
    lcdShowTimed("Saved offline", uid);
    return;
  }

  if (outcome.status == "arrived") {
    beep(2, 120, 120);
    lcdShowTimed("Welcome", outcome.studentName);
  } else if (outcome.status == "left") {
    beep(2, 120, 120);
    lcdShowTimed("Goodbye", outcome.studentName);
  } else if (outcome.status == "already_recorded") {
    beep(3, 100, 100);
    lcdShowTimed("Already logged", outcome.studentName);
  } else if (outcome.status == "no_active_event") {
    beep(1, 500, 0);
    lcdShowTimed("No active event", "See admin");
  } else {
    beep(2, 120, 120);
    lcdShowTimed("Tap recorded", uid);
  }
}

String uidToString(byte *buffer, byte size) {
  String out;
  for (byte i = 0; i < size; i++) {
    if (buffer[i] < 0x10) out += "0";
    out += String(buffer[i], HEX);
  }
  out.toUpperCase();
  return out;
}

bool isKnownCard(const String &uid) {
  for (auto &c : knownCards) {
    if (c == uid) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tap delivery: try live POST /api/tap first, fall back to the offline queue
// ---------------------------------------------------------------------------
TapOutcome sendOrQueueTap(const String &uid) {
  unsigned long epoch = currentEpochSeconds();

  if (appReachable && serverIpResolved) {
    JsonDocument doc;
    doc["uid"] = uid;
    if (epoch > 0) doc["timestamp"] = (unsigned long)epoch * 1000UL; // ms, matches JS Date
    String body;
    serializeJson(doc, body);

    HTTPClient http;
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.begin(buildUrl("/api/tap"));
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(body);

    if (code == 200) {
      String resp = http.getString();
      http.end();
      JsonDocument respDoc;
      if (deserializeJson(respDoc, resp) == DeserializationError::Ok) {
        TapOutcome outcome;
        outcome.delivered = true;
        outcome.status = respDoc["status"].as<String>();
        outcome.studentName = respDoc["studentName"] | uid;
        return outcome;
      }
    }
    http.end();
    // Fall through to queueing — the request failed even though we thought
    // the app was reachable (e.g. it just went down between health checks).
    appReachable = false;
    digitalWrite(PIN_LED_APP, LOW);
  }

  queueTap(uid, epoch);
  TapOutcome outcome;
  outcome.delivered = false;
  return outcome;
}

// ---------------------------------------------------------------------------
// Offline queue (LittleFS) + periodic drain via POST /api/sync
// ---------------------------------------------------------------------------
void queueTap(const String &uid, unsigned long epoch) {
  pendingQueue.push_back(uid + "|" + String(epoch));
  saveQueue();
}

void periodicMaintenance() {
  if (!appReachable) return;

  if (millis() - lastQueueDrain > QUEUE_DRAIN_INTERVAL_MS) {
    lastQueueDrain = millis();
    drainQueue();
  }

  if (millis() - lastCardSync > CARD_SYNC_INTERVAL_MS) {
    lastCardSync = millis();
    syncCards();
  }
}

void drainQueue() {
  if (pendingQueue.empty()) return;

  size_t count = min(pendingQueue.size(), SYNC_BATCH_SIZE);

  JsonDocument doc;
  JsonArray taps = doc["taps"].to<JsonArray>();
  for (size_t i = 0; i < count; i++) {
    int sep = pendingQueue[i].indexOf('|');
    String uid = pendingQueue[i].substring(0, sep);
    unsigned long epoch = pendingQueue[i].substring(sep + 1).toInt();
    JsonObject tap = taps.add<JsonObject>();
    tap["uid"] = uid;
    if (epoch > 0) tap["timestamp"] = epoch * 1000UL;
  }

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(buildUrl("/api/sync"));
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  http.end();

  if (code == 200) {
    pendingQueue.erase(pendingQueue.begin(), pendingQueue.begin() + count);
    saveQueue();
    Serial.println("Synced " + String(count) + " queued tap(s), " +
                    String(pendingQueue.size()) + " remaining");
  } else {
    Serial.println("Queue sync failed, code " + String(code));
    appReachable = false;
    digitalWrite(PIN_LED_APP, LOW);
  }
}

void syncCards() {
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(buildUrl("/api/cards"));
  int code = http.GET();

  if (code != 200) {
    http.end();
    appReachable = false;
    digitalWrite(PIN_LED_APP, LOW);
    return;
  }

  String body = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, body) != DeserializationError::Ok) return;

  knownCards.clear();
  for (JsonVariant v : doc["uids"].as<JsonArray>()) {
    knownCards.push_back(v.as<String>());
  }
  saveCards();
  Serial.println("Card cache synced: " + String(knownCards.size()) + " card(s)");
}

// ---------------------------------------------------------------------------
// LittleFS persistence
// ---------------------------------------------------------------------------
void loadCards() {
  knownCards.clear();
  if (!LittleFS.exists("/cards.json")) return;

  File f = LittleFS.open("/cards.json", "r");
  if (!f) return;
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, f);
  f.close();
  if (err) return;

  for (JsonVariant v : doc["uids"].as<JsonArray>()) {
    knownCards.push_back(v.as<String>());
  }
  Serial.println("Loaded " + String(knownCards.size()) + " cached card(s) from flash");
}

void saveCards() {
  JsonDocument doc;
  JsonArray uids = doc["uids"].to<JsonArray>();
  for (auto &c : knownCards) uids.add(c);

  File f = LittleFS.open("/cards.json", "w");
  if (!f) return;
  serializeJson(doc, f);
  f.close();
}

void loadQueue() {
  pendingQueue.clear();
  if (!LittleFS.exists("/queue.json")) return;

  File f = LittleFS.open("/queue.json", "r");
  if (!f) return;
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, f);
  f.close();
  if (err) return;

  for (JsonObject tap : doc["taps"].as<JsonArray>()) {
    unsigned long epoch = tap["ts"] | 0UL;
    pendingQueue.push_back(String(tap["uid"].as<const char *>()) + "|" + String(epoch));
  }
  Serial.println("Loaded " + String(pendingQueue.size()) + " queued tap(s) from flash");
}

void saveQueue() {
  JsonDocument doc;
  JsonArray taps = doc["taps"].to<JsonArray>();
  for (auto &entry : pendingQueue) {
    int sep = entry.indexOf('|');
    JsonObject tap = taps.add<JsonObject>();
    tap["uid"] = entry.substring(0, sep);
    tap["ts"] = entry.substring(sep + 1).toInt();
  }

  File f = LittleFS.open("/queue.json", "w");
  if (!f) return;
  serializeJson(doc, f);
  f.close();
}

// ---------------------------------------------------------------------------
// Reset button — non-destructive: clears the local offline queue and forces
// a fresh card-cache pull, per OVERVIEW.md open question #1. A full factory
// wipe isn't offered here since the physical EN reset already covers that.
// ---------------------------------------------------------------------------
void handleResetButton() {
  bool state = digitalRead(PIN_RESET_BTN);

  if (state != resetBtnLastState) {
    lastResetBtnChange = millis();
    resetBtnLastState = state;
  }

  if (state == LOW && millis() - lastResetBtnChange > RESET_BTN_DEBOUNCE_MS) {
    static unsigned long lastTrigger = 0;
    if (millis() - lastTrigger < 2000) return; // ignore repeat triggers while held
    lastTrigger = millis();

    Serial.println("Reset button pressed: clearing queue, re-syncing cards");
    pendingQueue.clear();
    saveQueue();
    if (appReachable) syncCards();

    beep(3, 100, 100);
    lcdShowTimed("Reset", "Queue cleared");
  }
}

// ---------------------------------------------------------------------------
// LCD + buzzer helpers
// ---------------------------------------------------------------------------
void lcdShow(const String &line1, const String &line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, 16));
}

void lcdShowTimed(const String &line1, const String &line2) {
  lcdShow(line1, line2);
  lcdMessageUntil = millis() + LCD_MESSAGE_HOLD_MS;
}

void refreshIdleLcd() {
  if (lcdMessageUntil != 0 && millis() < lcdMessageUntil) return;
  lcdMessageUntil = 0;

  static unsigned long lastIdleDraw = 0;
  if (millis() - lastIdleDraw < 1000) return;
  lastIdleDraw = millis();

  String wifiState = WiFi.status() == WL_CONNECTED ? "OK" : "--";
  String appState = appReachable ? "OK" : "--";
  lcdShow("WiFi:" + wifiState + " App:" + appState, "Tap your card");
}

void beep(uint8_t count, uint16_t onMs, uint16_t offMs) {
  for (uint8_t i = 0; i < count; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(onMs);
    digitalWrite(PIN_BUZZER, LOW);
    if (offMs > 0 && i < count - 1) delay(offMs);
  }
}
