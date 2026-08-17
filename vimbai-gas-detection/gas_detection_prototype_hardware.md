# Automated Gas Detection & Ventilation Control — Prototype Hardware Specification

## 1. Project Overview

The prototype is a self-contained, ESP32-based safety node that continuously samples
hydrocarbon vapour concentration and drives a ventilation and alarm response without operator
intervention.

Two MQ-series semiconductor sensors (MQ-2 for LPG/propane/smoke, MQ-135 for VOCs and general
air quality) feed the ESP32's 12-bit ADC through resistive dividers. Firmware compares each
reading against calibrated thresholds and drives a three-state response:

| State | Condition | Fan | Buzzer | Green LED | Red LED | LCD |
|---|---|---|---|---|---|---|
| SAFE | ADC < warning | OFF | OFF | ON | OFF | "Gas Level Safe" |
| WARNING | warning ≤ ADC < danger | ON | OFF | OFF | Blink | "Warning: Gas Detected" |
| DANGER | ADC ≥ danger | ON | ON | OFF | ON | "DANGER — Evacuate" |

The fan is switched through a relay so the 12 V motor rail stays galvanically isolated from the
3.3 V logic. Two momentary buttons complete the interface: a **controller reset** (hardware
reboot via the EN line) and an **alarm reset** (firmware latch clear — silences the buzzer while
the fan continues to run until gas actually clears, so the acknowledgement can never disable
ventilation).

Scope is limited to a breadboard/veroboard prototype for functional demonstration and timing
measurement. It is not a certified safety instrument and carries no Ex/ATEX rating.

---

## 2. Device Connection Table

ESP32 DevKit V1 (30-pin) assumed. All sensor inputs use **ADC1** pins only — ADC2 is unusable
whenever Wi-Fi is active.

| # | Device | Purpose | Controller Pin | Power | Passives Required |
|---|---|---|---|---|---|
| 1 | MQ-2 gas sensor | Detects LPG, propane, methane, smoke; analogue output ∝ concentration | AO → **GPIO34** (ADC1_CH6, input-only) | VCC 5 V, GND | Divider: 10 kΩ series from AO, 20 kΩ to GND (5 V → 3.3 V). 100 nF from divider tap to GND |
| 2 | MQ-135 gas sensor | Detects VOCs, CO₂, ammonia; secondary/cross-check channel | AO → **GPIO35** (ADC1_CH7, input-only) | VCC 5 V, GND | Divider: 10 kΩ series, 20 kΩ to GND. 100 nF from tap to GND |
| 3 | 16×2 LCD (I²C, PCF8574) | Displays live gas level and system state | SDA → **GPIO21**, SCL → **GPIO22** | VCC 5 V, GND | 4.7 kΩ pull-ups on SDA and SCL to **3.3 V** (omit if backpack already has them — verify) |
| 4 | Relay module (5 V, 1-ch, opto-isolated) | Switches 12 V fan supply from 3.3 V logic | IN → **GPIO26** | VCC 5 V, GND (JD-VCC 5 V) | 1 kΩ series on IN. Use a low-level-trigger module, or add a BC547 driver if the module will not trigger reliably at 3.3 V |
| 5 | 12 V DC exhaust fan | Ventilates the monitored volume | Via relay NO/COM only — no direct MCU pin | 12 V rail, GND | 1N4007 flyback across fan terminals (cathode → +12 V). 100 µF electrolytic across fan terminals |
| 6 | Active buzzer (5 V) | Audible alarm at DANGER state | Base drive → **GPIO25** | 5 V through NPN transistor | BC547/2N2222 low-side switch, 1 kΩ base resistor, 1N4148 across buzzer |
| 7 | Red LED (5 mm) | Visual DANGER / WARNING indication | Anode → **GPIO27** | GPIO source, 3.3 V | 220 Ω series to GND |
| 8 | Green LED (5 mm) | Visual SAFE / system-healthy indication | Anode → **GPIO14** | GPIO source, 3.3 V | 220 Ω series to GND |
| 9 | Push button — Controller reset | Hard reboot of the ESP32 | **EN** pin → button → GND | — | 10 kΩ pull-up EN→3.3 V (usually onboard), 100 nF EN→GND for debounce |
| 10 | Push button — Alarm reset | Clears the latched buzzer/alarm flag in firmware | **GPIO13** → button → GND | — | Internal pull-up enabled (`INPUT_PULLUP`), 100 nF across the button for debounce. Optional external 10 kΩ pull-up to 3.3 V |
| 11 | ESP32 DevKit V1 | Central controller: ADC sampling, threshold logic, output actuation | — | 5 V into **VIN** (onboard AMS1117 → 3.3 V) | 10 µF + 100 nF at the 3V3 pin |

### Pins to avoid
- **GPIO0, 2, 12, 15** — strapping pins; a load at boot can prevent the ESP32 starting.
- **GPIO6–11** — connected to internal SPI flash, unusable.
- **GPIO34–39** — input-only and have **no internal pull-ups**, so never put a button on them.

---

## 3. Power Architecture

### 3.1 Rails

| Rail | Source | Feeds | Minimum current budget |
|---|---|---|---|
| 12 V | External 12 V ≥ 2 A adapter (or 12 V SLA) | Exhaust fan, buck converter input | Fan stall current + 500 mA headroom |
| 5 V | LM2596 / MP1584 buck from 12 V, ≥ 2 A | MQ-2, MQ-135, relay coil, LCD, buzzer, ESP32 VIN | ≈ 1.5 A |
| 3.3 V | ESP32 onboard AMS1117 regulator | ESP32 core, I²C pull-ups, LEDs | ≈ 500 mA peak (Wi-Fi TX bursts) |

**Critical:** each MQ sensor heater draws roughly **150–160 mA continuously**, so both sensors
alone are around 320 mA of steady heater load. Never power them from the ESP32's onboard 5 V
pin or from a USB port alone — take them straight from the buck converter output. This is the
single most common cause of erratic ADC readings and random reboots in MQ-based builds.

Star-ground the whole prototype: run the sensor grounds, relay/fan ground and ESP32 ground back
to a single point at the buck converter output. Do not daisy-chain the fan ground through the
sensor ground rail — motor return current through a shared trace will inject noise directly into
the ADC readings.

### 3.2 Capacitor Schedule

| Location | Value | Type | Function |
|---|---|---|---|
| 12 V input, at barrel jack | 1000 µF / 25 V | Electrolytic | Bulk reservoir; absorbs fan inrush and stops the 12 V rail sagging when the relay closes |
| 12 V input, in parallel with above | 100 nF | Ceramic | High-frequency bypass; electrolytics have too much ESR/ESL to filter switching noise alone |
| Buck converter output (5 V) | 470 µF / 16 V | Low-ESR electrolytic | Bulk energy store for the MQ heater load and relay coil pull-in surge |
| 5 V rail, at converter output | 100 nF | Ceramic | Switching-ripple bypass |
| MQ-2 VCC → GND, at the module | 100 µF + 100 nF | Electrolytic + ceramic | Local reservoir for the heater; prevents heater current draw from modulating its own sense voltage |
| MQ-135 VCC → GND, at the module | 100 µF + 100 nF | Electrolytic + ceramic | Same as above |
| Each sensor divider tap → GND | 100 nF | Ceramic | Forms an RC low-pass with the ~6.7 kΩ divider impedance (τ ≈ 0.67 ms) — filters ADC sampling noise without slowing the real gas response |
| ESP32 3V3 pin → GND | 10 µF + 100 nF | Electrolytic/tantalum + ceramic | Supplies Wi-Fi TX current bursts; prevents brownout resets |
| Relay module VCC → GND | 100 µF + 100 nF | Electrolytic + ceramic | Absorbs coil energisation surge; stops the 5 V rail dipping and resetting the MCU on every switch event |
| LCD backpack VCC → GND | 100 nF | Ceramic | Standard IC decoupling |
| Across fan terminals | 100 µF | Electrolytic | Suppresses brush commutation noise at the source |
| Across each push button | 100 nF | Ceramic | Hardware debounce (pair with a firmware debounce of ~50 ms) |

### 3.3 Protection

- **1N4007** flyback diode across the fan (cathode to +12 V) — mandatory for an inductive motor load.
- **1N4148** across the buzzer if it is a magnetic (not piezo) type.
- Relay module must be the **opto-isolated** variety; keep the 12 V and logic grounds joined at
  one point only.
- Fuse the 12 V input at 2 A.
- If fan switching still causes resets after the above, add a 100 Ω + 100 nF RC snubber across
  the relay contacts.

---

## 4. Threshold & Calibration Notes

- ESP32 ADC is 12-bit → **0–4095**, and is noticeably non-linear near both rails. Keep the
  divider tap operating in roughly the 0.3–2.9 V band; use `analogSetAttenuation(ADC_11db)`.
- Average 10–20 samples per reading to suppress residual noise.
- Allow a **5–10 minute heater warm-up** before treating any reading as valid. Hold the system in
  a "WARMING UP" LCD state during this window and inhibit alarms.
- Set the SAFE baseline from clean-air readings taken *after* warm-up, then place WARNING and
  DANGER thresholds relative to that baseline rather than at fixed absolute values.
- Apply hysteresis of roughly 5–10 % on the downward transitions so the outputs do not chatter
  when the concentration hovers on a boundary.
