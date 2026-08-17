# Automated Gas Detection and Ventilation Control System

An ESP32-based safety system that continuously monitors combustible gas (MQ-2) and air quality / VOC levels (MQ-135), automatically activates an exhaust fan and audible alarm when thresholds are exceeded, and serves a live SCADA dashboard over Wi-Fi.

---

## Hardware Components

| Component | Role |
|---|---|
| ESP32 DevKit V1 | Main controller |
| MQ-2 sensor | Detects LPG, propane, methane, smoke |
| MQ-135 sensor | Detects VOCs, CO2, ammonia, general air quality |
| Relay module | Switches the exhaust fan on/off |
| Buzzer (NPN-driven) | Audible alarm in DANGER state |
| Red LED | Visual alarm indicator |
| Green LED | Safe / heartbeat indicator |
| Alarm-reset button | Silences the buzzer without stopping the fan |
| 16×2 I2C LCD | Local status display |

---

## Pin Map

| GPIO | Function |
|---|---|
| 34 | MQ-2 analogue input (via 10 kΩ/20 kΩ divider) |
| 35 | MQ-135 analogue input (via 10 kΩ/20 kΩ divider) |
| 26 | Relay (fan) |
| 25 | Buzzer (NPN base via 1 kΩ) |
| 27 | Red LED (220 Ω series) |
| 14 | Green LED (220 Ω series) |
| 13 | Alarm-reset button (INPUT\_PULLUP, to GND) |
| 21 / 22 | I2C SDA / SCL for LCD |

The controller **EN** pin is wired to a hardware reset button — no firmware needed for that.

---

## System States

The system moves through four states. **The highest severity across both sensors always wins.**

| State | Condition | Fan | Buzzer | Red LED | Green LED |
|---|---|---|---|---|---|
| **WARMING UP** | First 3 minutes after power-on | Off | Off | Off | Slow heartbeat blink |
| **SAFE** | Both sensors below WARNING threshold | Off | Off | Off | Steady on |
| **WARNING** | Either sensor ≥ WARNING threshold | On | Off | Slow blink | Off |
| **DANGER** | Either sensor ≥ DANGER threshold | On | Pulsing | Steady on | Off |

A **hysteresis band of 120 ADC counts** prevents the system from chattering at a threshold boundary — the reading must drop 120 counts *below* a threshold before the state steps back down.

### Default Alarm Thresholds (12-bit ADC, 0 – 4095)

| Sensor | WARNING | DANGER |
|---|---|---|
| MQ-2 | 1200 | 2000 |
| MQ-135 | 1300 | 2100 |

> These are starting points. See **Calibration** below for how to tune them to your environment.

---

## LCD Display

The LCD shows different information depending on the current state.

### During Warm-up (first 3 minutes)

```
WARMING UP  42s
Alarms inhibitd
```

| Field | Meaning |
|---|---|
| `42s` | Seconds remaining until sensors are ready and alarms become active |
| `Alarms inhibitd` | Fixed message — no alarms will trigger during this period |

### Normal Operation

```
WARNING F:ON M
G2: 847 G135:1204
```

**Line 1 — Status bar**

| Field | Values | Meaning |
|---|---|---|
| State label | `SAFE   ` / `WARNING` / `DANGER!` | Current system state |
| `F:ON` / `F:OFF` | ON or OFF | Whether the exhaust fan is currently running |
| `M` (trailing) | Present or absent | Alarm has been **muted** by the operator pressing the reset button. The fan keeps running; only the buzzer is silenced. Clears automatically when the air returns to SAFE. |

**Line 2 — Raw sensor readings**

| Field | Meaning |
|---|---|
| `G2:` followed by a 4-digit number | Raw 12-bit ADC reading from the **MQ-2** sensor (LPG / propane / smoke). Range 0 – 4095. Compare against WARNING = 1200, DANGER = 2000. |
| `G135:` followed by a 4-digit number | Raw 12-bit ADC reading from the **MQ-135** sensor (VOC / air quality). Range 0 – 4095. Compare against WARNING = 1300, DANGER = 2100. |

Higher numbers mean higher gas concentration. Clean-air baseline is typically 350 – 600 with the recommended voltage divider.

---

## SCADA Web Dashboard

Once connected to Wi-Fi, the ESP32 serves a dashboard at the IP address shown on the LCD during boot. Open that address in any browser on the same network.

The dashboard auto-refreshes every 700 ms. All fields are **read-only** — the dashboard monitors only.

### State Banner (top coloured panel)

| Colour | State | Message |
|---|---|---|
| Blue | SENSOR WARM-UP | Heaters stabilising — alarms inhibited |
| Green | SAFE | Atmosphere clear — ventilation idle |
| Amber | WARNING | Gas detected — ventilation running |
| Red (pulsing) | DANGER | EVACUATE AREA — full ventilation and alarm active |

### Sensor Cards

Each sensor card shows:

| Field | Meaning |
|---|---|
| **% of danger level** (large number) | The raw reading expressed as a percentage of the DANGER threshold. 100 % means the DANGER threshold has been reached. Values above 100 % are capped visually at 100 % on the bar but the number can go up to 150 %. |
| Progress bar | Colour-coded fill: green below 60 %, amber 60 – 99 %, red at 100 %+ |
| `RAW` | The actual 12-bit ADC value (same as `G2:` / `G135:` on the LCD) |
| `W … / D …` | The configured WARNING and DANGER thresholds for that sensor |

### Status Tiles

| Tile | Meaning |
|---|---|
| **Exhaust Fan** | RUNNING (green dot) or STOPPED |
| **Audible Alarm** | OFF / SOUNDING (red dot) / SILENCED (amber dot — buzzer muted by operator but alarm condition still active) |
| **Controller Uptime** | Time since the ESP32 last powered on, formatted as `hh:mm:ss` or `Xd hh:mm:ss` |
| **Signal / Heap** | Wi-Fi signal strength in dBm, and free RAM on the ESP32 in kilobytes |

### Event Log

A rolling list of the last 12 system events (state changes, fan start/stop, alarm silenced, Wi-Fi status, etc.) with a timestamp showing how long ago each event occurred.

### Browser Audio Alerts

If you tap the yellow bar at the bottom of the page to grant permission, the browser will:
- Play a **siren** when the state enters DANGER.
- Play a **chirp** when the state enters WARNING.
- Show a **desktop notification** for WARNING and DANGER transitions.

---

## Calibration

1. Flash the firmware and open **Serial Monitor** at 115 200 baud.
2. Allow the sensors to warm up fully (3 minutes — watch the LCD countdown or Serial output).
3. Note the stable clean-air readings for both sensors — this is your **baseline**.
4. Set `MQ2_WARNING` and `MQ135_WARNING` to roughly **2× – 3× the baseline**.
5. Hold an unlit gas lighter near each sensor, note the peak reading, and set `MQ2_DANGER` / `MQ135_DANGER` comfortably below that peak.
6. Adjust `HYSTERESIS` if the outputs chatter at the boundary.

---

## Wi-Fi Setup

The firmware connects to an existing hotspot (e.g. a phone hotspot) as a **station** (client). Set your hotspot credentials in the sketch:

```cpp
const char* WIFI_SSID     = "your-hotspot-name";
const char* WIFI_PASSWORD = "your-hotspot-password";
```

If Wi-Fi fails to connect within 25 seconds the system continues in **standalone mode** — all local alarms (fan, buzzer, LEDs, LCD) remain fully active; only the web dashboard is unavailable.

---

## Libraries Required

Install via Arduino Library Manager:

- **LiquidCrystal I2C** by Frank de Brabander

The following ship with the ESP32 board package and need no separate install:
`WiFi.h`, `WebServer.h`, `Wire.h`

**Board settings:** ESP32 Dev Module · Upload speed 921600 · Serial monitor 115200 baud
