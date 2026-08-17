# RFID Attendance System

An offline-first attendance system: an ESP32 + RC522 reader station scans
student ID cards at the door, and a Next.js app on a PC on the same network
is the single source of truth for students, events, and attendance history.
The reader keeps working with no WiFi/server at all — taps are cached
locally and synced once connectivity comes back.

For the full design (data model, API contract, decisions behind the
behavior below), see [`OVERVIEW.md`](OVERVIEW.md). This README is the
day-to-day "how do I actually run this" guide.

## What's in this repo

| Path | What it is |
|---|---|
| `attendance-application/` | Next.js app — dashboard, student/event management, API the reader talks to |
| `attendance-firmware/attendance-firmware.ino` | ESP32 Arduino sketch for the reader station |
| `OVERVIEW.md` | Full system design and architecture |
| `ESP32-Pinout.jpg`, `OVERVIEW.md` §7–8 | Wiring diagram and voltage/power notes |
| `Project Backups/`, `attendance-system.pdsprj*` | Proteus circuit simulation files (hardware design only, not needed to run the software) |

---

## 1. Hardware setup

Wire the ESP32 per **`OVERVIEW.md` section 7** (pinout table) and read
**section 8** (voltage & power) before connecting anything — the RC522 and
the LCD's I2C lines both have voltage caveats that can damage the ESP32 if
skipped.

Summary of what's connected:

- RC522 RFID reader — SPI (SS → GPIO 4, RST → GPIO 16, SCK/MOSI/MISO → default VSPI pins), powered from **3.3V only**
- WiFi status LED — GPIO 25
- App-reachable status LED — GPIO 26
- Buzzer — GPIO 27
- Reset button — GPIO 32 (to GND, internal pull-up)
- 16×2 I2C LCD — SDA GPIO 21, SCL GPIO 22, powered from 3.3V (see §8 for why)

## 2. Firmware setup

1. Install the **ESP32 board package** in the Arduino IDE (Boards Manager → search "esp32").
2. Install these libraries via Library Manager:
   - `MFRC522` (GithubCommunity)
   - `LiquidCrystal_I2C`
   - `ArduinoJson` (v7.x)
3. Open `attendance-firmware/attendance-firmware.ino`.
4. Edit the config block at the top:
   ```cpp
   static const char *WIFI_SSID = "YOUR_WIFI_SSID";
   static const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   static const char *SERVER_MDNS_NAME = "attendance"; // must match the PC — see §3.2
   ```
5. Select your board (e.g. "ESP32 Dev Module") and the correct COM port, then upload.
6. Open the Serial Monitor at 115200 baud to watch boot/connect/tap logs while testing.

No separate filesystem upload step is needed — the sketch creates
`cards.json` and `queue.json` on the ESP32's LittleFS itself the first time
it syncs with the server.

## 3. App setup

### 3.1 Install and run

```bash
cd attendance-application
pnpm install
pnpm exec prisma migrate dev --name init   # creates the local SQLite database
pnpm dev                                    # http://localhost:3000
```

For a permanent front-desk PC, run it as a production build instead:

```bash
pnpm build
pnpm start
```

### 3.2 Making the PC discoverable as `attendance.local`

The reader finds the PC via mDNS instead of a hardcoded IP, so it survives
DHCP/hotspot IP changes. How you get a `.local` name depends on the OS:

- **Windows 10/11**: mDNS resolution for the PC's own machine name works out
  of the box — no extra install needed. The simplest path is to set
  `SERVER_MDNS_NAME` in the firmware to your **actual PC name** (Settings →
  System → About) instead of `attendance`, e.g. `FRONTDESK-PC`.
- **Want the name to literally be `attendance.local`?** Install Bonjour
  (bundled with iTunes, or "Bonjour Print Services" standalone) and
  advertise a service with `dns-sd`, or run a small mDNS responder package
  alongside the app. Not required — the per-PC-name approach above is
  simpler for a single front-desk machine.
- **macOS / Linux**: mDNS (`.local`) is supported natively; the machine's
  hostname is already advertised.

Whatever hostname you land on, make sure both devices are on the **same
WiFi network/subnet** and that Windows Firewall allows Node.js to accept
inbound connections on port 3000 (you'll be prompted the first time you run
`pnpm dev`/`pnpm start` — allow it on "Private" networks).

---

## 4. Running an event

1. **Register students ahead of time** on the **Students** page — name,
   registration number, and card UID. If you don't know a card's UID yet,
   tap it on the reader once (it'll show up as an "Unknown card" toast on
   the **Dashboard** with a **Register** button that jumps you here with the
   UID pre-filled).
2. Go to **Events** and start a new event. Starting a new event
   automatically ends whichever one was previously active, so you don't
   have to remember to close out the last one.
3. Power on the reader station near the door. The two onboard LEDs tell you
   its connectivity at a glance:
   - **WiFi LED** — joined the network.
   - **App LED** — the Next.js app is actually reachable (can be off while
     WiFi is on, which tells you the network's fine but the app/PC isn't).
4. As people tap in and out, the **Dashboard** updates live with
   Present / Left / Absent counts and a per-student table. Each person taps
   **twice**: once on arrival, once on departure.
5. When the event wraps up, hit **End event** on the Events page (or just
   start the next event later, which does this for you).

### Offline behavior

If the reader loses WiFi or the app goes down mid-event, it keeps working:
taps are written to the reader's flash storage immediately and forwarded
once connectivity returns, in the order they happened. The known-card list
is also cached on the reader, so a student registered five minutes ago on
the dashboard is still recognized offline as long as a sync has happened
since (cards re-sync automatically every 60 seconds while the app is
reachable).

### Reset button

A short press on the reader's reset button clears its local offline queue
and forces an immediate re-pull of the known-card list from the server. It
does **not** touch anything on the server/database — it's a "get this
device back in a known-good state" button, not a factory reset (the
physical EN button on the ESP32 board already covers a full reboot).

---

## 5. Behavior decisions worth knowing

`OVERVIEW.md` §6 leaves a few behaviors as open questions; this build makes
the following calls:

| Situation | Behavior |
|---|---|
| Student taps a 3rd time (already has arrival + departure) | No-op — no record change. Reader gives a distinct triple-beep and the LCD shows "Already logged" instead of the normal two-beep ack. |
| Unknown card tapped | Reader recognizes it's not in its local cache immediately (even offline) and gives a single long beep + "Unknown card" on the LCD, rather than beeping the same as a known card. |
| New event started while one is active | The previous event is auto-ended; no manual "End event" step required first. |
| Card cache freshness | Reader re-pulls the known-card list every 60s whenever the app is reachable, plus immediately after a reset-button press. |

## 6. Troubleshooting

- **LCD is blank** — wrong I2C address; try `0x3F` instead of `0x27` in the firmware config, or run an I2C scanner sketch to find it.
- **RC522 never reads a card** — double-check it's powered from **3.3V**, not 5V (see `OVERVIEW.md` §8); a 5V-powered RC522 can be damaged.
- **App LED never turns on** — confirm the PC and reader are on the same WiFi network, that `pnpm dev`/`pnpm start` is running, and that `SERVER_MDNS_NAME` in the firmware matches how the PC is actually discoverable (§3.2 above). The Serial Monitor logs the resolved IP (or the resolve failure) so you can confirm what the reader is trying to reach.
