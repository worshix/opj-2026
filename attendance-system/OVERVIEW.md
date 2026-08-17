# RFID Attendance System — Project Overview

## 1. Purpose

An offline-first attendance system for events. Students/attendees tap an RFID
card on an ESP32-based reader station. The station works standalone (no WiFi
needed) and syncs to a PC-based Next.js application when connectivity is
available. The PC app is the single source of truth for student records and
attendance history.

Each student taps **twice per event**: once to mark arrival, once to mark
departure. The dashboard shows three states per student for the active event:
**Present** (arrived, not yet left), **Left** (arrived and departed), and
**Absent** (never tapped).

---

## 2. System Actors

| Actor | Role |
|---|---|
| ESP32 Reader Station | Reads cards, gives audible/visual feedback, caches taps locally, syncs to server |
| Next.js App (PC, localhost) | Manages students, events, attendance dashboard, receives sync data from ESP32 |
| SQLite + Prisma | Persistent storage on the PC |
| Admin (you) | Creates events, registers unknown cards via the dashboard |

---

## 3. High-Level Architecture

```
 ┌─────────────────────┐         WiFi (mDNS: attendance.local)      ┌──────────────────────────┐
 │   ESP32 + RC522      │ ───────────────────────────────────────── │   Next.js App (PC)       │
 │                       │        HTTP POST /api/tap                │                            │
 │  - Reads card UID     │ ───────────────────────────────────────► │  - Validates card         │
 │  - Local card cache   │        HTTP GET  /api/cards (sync)       │  - Writes AttendanceRecord│
 │  - Offline tap queue  │ ◄───────────────────────────────────────  │  - Returns known-card list│
 │  - 2x LED, buzzer, LCD│                                            │  SQLite (via Prisma)      │
 └─────────────────────┘                                            └──────────────────────────┘
```

- ESP32 is always the initiator of HTTP requests (PC never pushes to ESP32 in v1 — simpler, and avoids needing a server running *on* the ESP32).
- ESP32 resolves the PC via **mDNS** (`attendance.local`) instead of a hardcoded IP, so hotspot IP churn doesn't break it.
- Every tap is written to the ESP32's local flash **first**, then an attempt is made to forward it live. If that fails, it stays queued and is retried/synced later.

---

## 4. ESP32 Responsibilities

1. **Boot sequence**: init RC522, init storage, load cached card list, beep buzzer twice (boot confirmation).
2. **WiFi connect**: attempt to join configured WiFi. On success → WiFi LED on. On failure → keep retrying in background, WiFi LED off, system still fully usable offline.
3. **App reachability check**: once WiFi is up, periodically ping the Next.js app (e.g. `GET /api/health` over mDNS). On success → App LED on. If it stops responding → App LED off, but WiFi LED can stay on (distinguishes "no WiFi" from "WiFi fine, server unreachable").
4. **Card read**:
   - Read UID from RC522.
   - Check UID against **local cached card list** (synced copy of the PC's known cards).
   - **Known card** → beep twice, log tap locally (UID + timestamp), attempt immediate forward to server if App LED is on.
   - **Unknown card** → beep twice (same pattern per your spec — distinguishing tone is a nice-to-have you can add later, e.g. different pitch), log the "unknown tap" locally too, so it can still be surfaced in the sonner alert once synced.
5. **Offline queue**: any tap that couldn't be forwarded immediately is stored in a queue in flash (NVS or LittleFS/SPIFFS — see note below). Queue is drained in order once the App LED condition is met.
6. **Sync**:
   - **ESP32 → PC**: push queued taps (UID + local timestamp) once reachable.
   - **PC → ESP32**: pull the current list of known cards (UID only — no names/regNumbers needed on-device) periodically, so the device can work offline immediately after a new student is registered.
7. **Reset button**: clears something *local* — recommend this means "clear local tap queue / re-sync card list from server" rather than a full factory reset, since a hardware EN reset already exists physically on most ESP32 dev boards. Worth deciding explicitly (see Open Questions).

### Local storage note
ESP32 doesn't have a filesystem by default — you'll want to explicitly use either:
- **NVS (Preferences library)** — simplest, good for small key-value data, but clunkier for a growing list of taps/cards.
- **LittleFS** — better fit here: store `cards.json` (known UIDs) and `queue.json` / append-only log (pending taps) as actual files. Recommend LittleFS for this project given you're storing lists, not just a few flags.

---

## 5. PC Application (Next.js) Responsibilities

1. **API endpoints** for the ESP32:
   - `GET /api/health` — liveness check for the App LED.
   - `POST /api/tap` — receive a single tap (UID, timestamp, online/offline flag).
   - `POST /api/sync` — receive a batch of queued taps after reconnect.
   - `GET /api/cards` — return all known card UIDs, for the ESP32's local cache.
2. **Tap handling logic**:
   - UID not in DB → do **not** create an attendance record. Instead surface a **sonner toast** on the dashboard: "Unknown card `A1B2C3D4` tapped" with a **Register** action button.
   - Register action → navigates to / opens the student registration flow, pre-filling the scanned UID.
   - UID in DB → find the **active event**. If student has no arrival record yet for this event → create one (status: Present). If student has an arrival but no departure → this tap is the departure (status: Left). If already has both → decide behavior (likely: ignore, or log as a duplicate/re-entry — worth deciding, see Open Questions).
3. **Event model**: one "active" event at a time. All taps while an event is active are attributed to it. Starting a new event should probably require explicitly closing/ending the previous one (or auto-closing on new event creation — decide).
4. **Dashboard**:
   - List of all students with computed status for the active event: **Present / Left / Absent**.
   - Students page: full roster, "Add Student" button (manual add, separate from the tap-triggered registration flow).
5. **Data model (Prisma/SQLite)** — draft:

```prisma
model Student {
  id         String   @id @default(cuid())
  name       String
  regNumber  String   @unique
  cardUid    String   @unique
  createdAt  DateTime @default(now())
  records    AttendanceRecord[]
}

model Event {
  id         String   @id @default(cuid())
  name       String
  startedAt  DateTime @default(now())
  endedAt    DateTime?
  isActive   Boolean  @default(true)
  records    AttendanceRecord[]
}

model AttendanceRecord {
  id          String   @id @default(cuid())
  student     Student  @relation(fields: [studentId], references: [id])
  studentId   String
  event       Event    @relation(fields: [eventId], references: [id])
  eventId     String
  arrivedAt   DateTime?
  leftAt      DateTime?

  @@unique([studentId, eventId])
}
```

This gives you Present (`arrivedAt` set, `leftAt` null), Left (both set), Absent (no record for that student+event at all — computed, not stored).

---

## 6. Open Questions (decide before/while building)

1. **Reset button behavior**: clear local queue only? Re-pull card cache? Full local wipe? (Recommend: re-sync card cache + clear synced-queue entries, keep it non-destructive to server data.)
2. **Duplicate tap after arrival+departure already recorded**: ignore silently, beep an "already recorded" pattern, or log as a new re-entry event? Matters for buzzer/LED feedback design.
3. **Unknown-card taps while offline**: do you want these queued and only surfaced via sonner once back online, or should the ESP32 itself give a distinct "unknown" beep pattern in real time so the person at the door knows immediately? (Your spec currently has known and unknown cards beeping identically twice — worth revisiting so front-desk staff get audible differentiation.)
4. **Event lifecycle**: manual "End Event" action, or auto-end previous event when a new one starts?
5. **Card list sync frequency**: pull on a timer (e.g. every 60s) vs. only on boot/reconnect. Affects how fast a newly-registered card becomes usable offline at the device.

---

## 7. ESP32 Pinout Table

Assumes a standard ESP32-WROOM-32 DevKit (30 or 38-pin). VSPI bus used for RC522 (default SPI pins).

| Component | Pin on Component | ESP32 GPIO | Notes |
|---|---|---|---|
| RC522 (RFID reader) | SDA (SS/CS) | GPIO 4 | Chip select, configurable in code — moved from GPIO 21 to free the I2C bus |
| RC522 | SCK | GPIO 18 | VSPI clock (fixed) |
| RC522 | MOSI | GPIO 23 | VSPI MOSI (fixed) |
| RC522 | MISO | GPIO 19 | VSPI MISO (fixed) |
| RC522 | IRQ | Not connected | Not used in typical polling implementations |
| RC522 | GND | GND | Common ground |
| RC522 | RST | GPIO 16 | Reset line for the module — moved from GPIO 22 to free the I2C SCL |
| RC522 | VCC | 3.3V | **Do not connect to 5V — see Section 8** |
| WiFi Status LED | Anode (+) | GPIO 25 | Through current-limiting resistor (see below) |
| WiFi Status LED | Cathode (–) | GND | |
| App-Reachable LED | Anode (+) | GPIO 26 | Through current-limiting resistor |
| App-Reachable LED | Cathode (–) | GND | |
| Buzzer (active) | Signal/+ | GPIO 27 | See driving notes in Section 8 |
| Buzzer | GND | GND | |
| Reset Button | One leg | GPIO 32 | Other leg to GND, use `INPUT_PULLUP`, active-low |
| Reset Button | Other leg | GND | |
| LCD 16×2 I2C (PCF8574 backpack) | SDA | GPIO 21 | I2C data line — see I2C voltage caution in Section 8 |
| LCD 16×2 I2C | SCL | GPIO 22 | I2C clock line |
| LCD 16×2 I2C | VCC | 5V | Powers LCD panel and backlight |
| LCD 16×2 I2C | GND | GND | |

GPIO choices above avoid ESP32's input-only pins (34–39) and boot-strapping pins (0, 2, 5, 12, 15) to prevent boot conflicts. All are freely usable as regular digital I/O.

---

## 8. Voltage & Power Requirements

| Component | Logic/Signal Voltage | Supply Voltage | Notes |
|---|---|---|---|
| ESP32 (dev board) | 3.3V GPIO logic | 5V in via USB (onboard LDO drops to 3.3V for the chip) | All GPIOs are 3.3V and **not 5V tolerant** |
| RC522 RFID module | 3.3V | **3.3V only** | Common mistake: many cheap RC522 breakout boards are silkscreened for "3.3–5V" but the actual chip (MFRC522) requires 3.3V — running it at 5V can damage it. Power it from the ESP32's 3.3V pin. |
| Standard LED (5mm) | N/A (current-driven) | Forward voltage ~1.8–2.2V (red/yellow) or ~2.8–3.2V (blue/white) | Needs a series resistor from a 3.3V GPIO. For ~2V Vf LED at 3.3V: R ≈ (3.3−2.0)/0.01A ≈ **130Ω**, 220Ω is a safe common choice for a visible-but-safe current (~5mA). |
| Active buzzer (magnetic/piezo, GPIO-driven) | Digital HIGH/LOW | 3.3–5V depending on module | Small active buzzer modules typically draw 10–30mA — check the datasheet. If under ~12mA, can often drive directly from a GPIO. **If current draw is higher, don't drive it directly** — use an NPN transistor (e.g. 2N2222) or a MOSFET as a switch, with the buzzer powered from 5V/3.3V and the GPIO only switching the transistor's base/gate. This protects the GPIO from damage. |
| Push button | N/A | 3.3V (via internal pull-up) | No external resistor needed if using `INPUT_PULLUP` in firmware; button just shorts pin to GND when pressed. |
| LCD 16×2 + PCF8574 I2C backpack | I2C lines at 3.3V logic; LCD panel at 5V | **5V** (panel + backlight) | **I2C level caution**: the PCF8574 powered at 5V has internal pull-ups to 5V — those 5V line levels feed straight back into ESP32 SDA/SCL which are **not 5V-tolerant**. Fix with one of: (a) replace on-board pull-ups with 4.7kΩ resistors to **3.3V**, (b) add a bidirectional I2C level-shifter module between ESP32 and backpack, or (c) power the entire backpack from the ESP32's **3.3V** pin instead of 5V (LCD will still display; backlight may be slightly dimmer but works). Option (c) is easiest. I2C address is typically `0x27` or `0x3F` depending on the PCF8574 variant — check your board's A0–A2 solder jumpers. |

**Power budget sanity check**: RC522 (~13–26mA typical, up to ~26mA during card read), 2x LEDs (~5–10mA each), buzzer (~10–30mA), LCD 16×2 backlight (~20–60mA depending on backlight current-limit resistor on the board — can disable in code to save power), ESP32 itself (~80–250mA depending on WiFi TX activity). All comfortably within what a standard 5V/1A USB supply into the ESP32's onboard regulator can handle — no separate power supply needed for this component set.

---

## 9. Suggested Build Order

1. RC522 read/write basics — get UID reading reliably first, in isolation.
2. Buzzer + LEDs wired and driven by simple test code (no networking yet).
3. LittleFS local card cache + tap queue (test fully offline).
4. WiFi connect + mDNS resolution + health check → WiFi LED / App LED logic.
5. Next.js API routes (`/health`, `/tap`, `/sync`, `/cards`) against Prisma/SQLite.
6. Wire ESP32 sync logic against the real endpoints.
7. Dashboard UI: student list with Present/Left/Absent, sonner unknown-card flow, event creation, student registration page.
