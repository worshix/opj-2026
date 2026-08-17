/******************************************************************************
 *  AUTOMATED GAS DETECTION AND VENTILATION CONTROL SYSTEM
 *  ESP32 DevKit V1  +  MQ-2  +  MQ-135  +  Relay/Fan  +  Buzzer  +  16x2 I2C LCD
 *
 *  Built-in SCADA:  the ESP32 joins your phone's hotspot and serves a live
 *  monitoring dashboard.  Open http://<ip-shown-on-lcd>/ in any browser.
 *  The dashboard is monitor-only - no control buttons.
 *
 *  Libraries required (Library Manager):
 *      - LiquidCrystal I2C   by Frank de Brabander
 *      (WiFi.h, WebServer.h, Wire.h ship with the ESP32 board package)
 *
 *  Board: "ESP32 Dev Module"      Upload speed: 921600     Monitor: 115200
 ******************************************************************************/

#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

/* ==========================================================================
 * ||                                                                      ||
 * ||        1.  USER SETTINGS  -  EDIT EVERYTHING IN THIS BLOCK           ||
 * ||                                                                      ||
 * ========================================================================== */

/* ---- 1.1  Hotspot credentials ------------------------------------------ */
const char* WIFI_SSID     = "gas-detector";
const char* WIFI_PASSWORD = "gas-detector";

/* ---- 1.2  ALARM THRESHOLDS  (12-bit ADC scale: 0 - 4095) ---------------
 *
 *  HOW TO CALIBRATE:
 *    1. Flash this sketch and open the Serial Monitor at 115200 baud.
 *    2. Let the sensors warm up fully (see WARMUP_MS below) in clean air.
 *    3. Note the steady clean-air reading  -> that is your baseline.
 *    4. Set WARNING roughly 2x - 3x the baseline.
 *    5. Hold an unlit gas lighter near the sensor, note the reading,
 *       and set DANGER comfortably below that peak.
 *
 *  Typical starting point with a 10k/20k divider: baseline ~350-600.
 * ------------------------------------------------------------------------ */
const int MQ2_WARNING   = 1200;    // MQ-2  : fan ON, yellow/amber state
const int MQ2_DANGER    = 2000;    // MQ-2  : fan ON + buzzer + red

const int MQ135_WARNING = 1300;    // MQ-135: fan ON, warning state
const int MQ135_DANGER  = 2100;    // MQ-135: fan ON + buzzer + red

/* ---- 1.3  Hysteresis ---------------------------------------------------
 *  The reading must fall this many ADC counts BELOW a threshold before the
 *  system steps back down a level. Stops output chatter on the boundary.   */
const int HYSTERESIS = 120;

/* ---- 1.4  Timing ------------------------------------------------------- */
const unsigned long WARMUP_MS       = 180000UL;  // 3 min heater stabilisation
const unsigned long SAMPLE_MS       = 250;       // sensor sample interval
const unsigned long LCD_REFRESH_MS  = 800;       // LCD redraw interval
const unsigned long DEBOUNCE_MS     = 50;        // alarm-reset button debounce
const int           SAMPLE_AVERAGES = 12;        // readings averaged per sample

/* ---- 1.5  Relay polarity ----------------------------------------------
 *  Most cheap blue relay modules are LOW-level trigger -> leave as true.
 *  If your fan runs when it should be off, flip this to false.            */
const bool RELAY_ACTIVE_LOW = true;

/* ---- 1.6  Startup self-test beep ----------------------------------------
 *  Two short beeps right at boot, before Wi-Fi/LCD init finish, just to
 *  confirm the buzzer circuit is alive. Purely cosmetic / diagnostic.      */
const unsigned long STARTUP_BEEP_ON_MS  = 100;
const unsigned long STARTUP_BEEP_OFF_MS = 120;

/* ==========================================================================
 *          2.  PIN MAP  (matches the hardware specification)
 * ========================================================================== */

#define PIN_MQ2         34    // ADC1_CH6 - input only, via 10k/20k divider
#define PIN_MQ135       35    // ADC1_CH7 - input only, via 10k/20k divider
#define PIN_RELAY       26    // fan relay IN
#define PIN_BUZZER      25    // NPN base through 1k
#define PIN_LED_RED     27    // 220 ohm series
#define PIN_LED_GREEN   14    // 220 ohm series
#define PIN_BTN_ALARM   13    // alarm reset, INPUT_PULLUP, to GND
// Controller reset button is wired to EN - hardware only, no code needed.
// LCD I2C: SDA = GPIO21, SCL = GPIO22

#define LCD_I2C_ADDR    0x27  // try 0x3F if the screen stays blank

/* ==========================================================================
 *          3.  GLOBALS
 * ========================================================================== */

LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);
WebServer server(80);

enum SysState { ST_WARMUP = 0, ST_SAFE = 1, ST_WARNING = 2, ST_DANGER = 3 };

SysState state       = ST_WARMUP;
int   mq2Raw         = 0;
int   mq135Raw       = 0;
int   mq2Pct         = 0;      // 0-100 %, scaled against its DANGER threshold
int   mq135Pct       = 0;
bool  fanOn          = false;
bool  buzzerActive   = false;  // logical alarm demand
bool  alarmSilenced  = false;  // latched by the alarm-reset button
unsigned long stateSince = 0;
unsigned long bootTime   = 0;

unsigned long lastSample = 0, lastLcd = 0, lastBuzzTog = 0, lastBlink = 0;
bool  buzzPhase = false, blinkPhase = false;

int   lastBtn = HIGH;
unsigned long lastBtnChange = 0;

/* Rolling event log shown on the dashboard */
#define LOG_DEPTH 12
String logMsg[LOG_DEPTH];
unsigned long logTime[LOG_DEPTH];
int logCount = 0;

void pushLog(const String& m) {
  for (int i = LOG_DEPTH - 1; i > 0; i--) { logMsg[i] = logMsg[i-1]; logTime[i] = logTime[i-1]; }
  logMsg[0]  = m;
  logTime[0] = millis();
  if (logCount < LOG_DEPTH) logCount++;
  Serial.print("[LOG] "); Serial.println(m);
}

const char* stateName(SysState s) {
  switch (s) {
    case ST_WARMUP:  return "WARMING UP";
    case ST_SAFE:    return "SAFE";
    case ST_WARNING: return "WARNING";
    default:         return "DANGER";
  }
}

/* ==========================================================================
 *          4.  DASHBOARD  (served from flash)
 * ========================================================================== */

const char PAGE_INDEX[] PROGMEM = R"HTMLDOC(
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gas Detection SCADA</title>
<style>
:root{
  --bg:#0b0f14; --panel:#141b24; --panel2:#1b2531; --line:#26313f;
  --txt:#e6edf3; --dim:#8899a8;
  --safe:#22c55e; --warn:#f59e0b; --dang:#ef4444; --idle:#3b82f6;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);
  font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  padding:14px;max-width:900px;margin:0 auto;-webkit-tap-highlight-color:transparent}
header{display:flex;justify-content:space-between;align-items:center;
  border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:14px;flex-wrap:wrap;gap:8px}
h1{font-size:14px;letter-spacing:2px;font-weight:600;text-transform:uppercase}
h1 small{display:block;font-size:10px;color:var(--dim);letter-spacing:1px;font-weight:400;margin-top:3px}
#link{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--dim)}
#dot{width:8px;height:8px;border-radius:50%;background:var(--safe)}
#dot.bad{background:var(--dang)}

#banner{border-radius:10px;padding:22px 18px;text-align:center;margin-bottom:14px;
  border:1px solid var(--line);background:var(--panel);transition:background .25s,border-color .25s}
#bstate{font-size:34px;font-weight:700;letter-spacing:4px}
#bmsg{font-size:12px;color:var(--dim);margin-top:7px;letter-spacing:1px}
.s-safe  {background:rgba(34,197,94,.10) !important;border-color:var(--safe) !important}
.s-safe #bstate{color:var(--safe)}
.s-warn  {background:rgba(245,158,11,.10) !important;border-color:var(--warn) !important}
.s-warn #bstate{color:var(--warn)}
.s-dang  {background:rgba(239,68,68,.14) !important;border-color:var(--dang) !important;
          animation:pulse 1s infinite}
.s-dang #bstate{color:var(--dang)}
.s-idle  {background:rgba(59,130,246,.10) !important;border-color:var(--idle) !important}
.s-idle #bstate{color:var(--idle);font-size:24px}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}50%{box-shadow:0 0 0 16px rgba(239,68,68,0)}}

.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-bottom:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
.ctitle{font-size:10px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.val{font-size:30px;font-weight:700;line-height:1}
.unit{font-size:11px;color:var(--dim);margin-left:6px;font-weight:400}
.bar{height:8px;background:var(--panel2);border-radius:4px;margin-top:12px;overflow:hidden}
.fill{height:100%;width:0;border-radius:4px;transition:width .4s,background .3s}
.marks{display:flex;justify-content:space-between;font-size:9px;color:var(--dim);margin-top:5px}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.slabel{font-size:9px;color:var(--dim);letter-spacing:1.5px;text-transform:uppercase}
.sval{font-size:16px;font-weight:600;margin-top:6px;display:flex;align-items:center;gap:7px}
.led{width:9px;height:9px;border-radius:50%;background:#39424f;flex:none}
.led.on{background:var(--safe);box-shadow:0 0 8px var(--safe)}
.led.red{background:var(--dang);box-shadow:0 0 8px var(--dang)}
.led.amb{background:var(--warn);box-shadow:0 0 8px var(--warn)}

#logbox{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
#log{list-style:none;font-size:11px;max-height:190px;overflow-y:auto}
#log li{padding:5px 0;border-bottom:1px solid var(--line);display:flex;gap:10px}
#log li:last-child{border:0}
#log .t{color:var(--dim);flex:none}
#audio{position:fixed;left:0;right:0;bottom:0;background:var(--warn);color:#000;
  text-align:center;padding:10px;font-size:11px;letter-spacing:1px;cursor:pointer;display:none}
</style></head><body>

<header>
  <h1>Gas Detection &amp; Ventilation Control<small>Fuel Depot Safety Node &middot; ESP32</small></h1>
  <div id="link"><span id="dot"></span><span id="linktxt">LINKED</span></div>
</header>

<div id="banner" class="s-idle">
  <div id="bstate">CONNECTING</div>
  <div id="bmsg">Contacting controller...</div>
</div>

<div class="grid">
  <div class="card">
    <div class="ctitle">MQ-2 &middot; LPG / Propane / Smoke</div>
    <div><span class="val" id="v2">--</span><span class="unit">% of danger level</span></div>
    <div class="bar"><div class="fill" id="f2"></div></div>
    <div class="marks"><span>RAW <b id="r2">--</b></span><span id="t2">--</span></div>
  </div>
  <div class="card">
    <div class="ctitle">MQ-135 &middot; VOC / Air Quality</div>
    <div><span class="val" id="v135">--</span><span class="unit">% of danger level</span></div>
    <div class="bar"><div class="fill" id="f135"></div></div>
    <div class="marks"><span>RAW <b id="r135">--</b></span><span id="t135">--</span></div>
  </div>
</div>

<div class="stats">
  <div class="stat"><div class="slabel">Exhaust Fan</div>
    <div class="sval"><span class="led" id="lfan"></span><span id="tfan">--</span></div></div>
  <div class="stat"><div class="slabel">Audible Alarm</div>
    <div class="sval"><span class="led" id="lbuz"></span><span id="tbuz">--</span></div></div>
  <div class="stat"><div class="slabel">Controller Uptime</div>
    <div class="sval"><span id="tup">--</span></div></div>
  <div class="stat"><div class="slabel">Signal / Heap</div>
    <div class="sval"><span id="trssi">--</span></div></div>
</div>

<div id="logbox">
  <div class="ctitle">Event Log</div>
  <ul id="log"></ul>
</div>

<div id="audio">TAP ANYWHERE TO ENABLE AUDIBLE + POPUP ALERTS</div>

<script>
let ac=null, siren=null, lastState=-1, misses=0, notifyOk=false;

function armAudio(){
  if(ac) return;
  try{ ac=new (window.AudioContext||window.webkitAudioContext)(); ac.resume(); }catch(e){}
  if("Notification" in window && Notification.permission==="default")
    Notification.requestPermission().then(p=>notifyOk=(p==="granted"));
  else notifyOk=("Notification" in window && Notification.permission==="granted");
  document.getElementById("audio").style.display="none";
}
if(!("AudioContext" in window||"webkitAudioContext" in window)){}
else document.getElementById("audio").style.display="block";
document.addEventListener("click",armAudio,{once:true});
document.addEventListener("touchstart",armAudio,{once:true});

function startSiren(){
  if(!ac||siren) return;
  const o=ac.createOscillator(), g=ac.createGain(), l=ac.createOscillator(), lg=ac.createGain();
  o.type="square"; o.frequency.value=740;
  l.type="sine";   l.frequency.value=3;      // wail rate
  lg.gain.value=260;                          // wail depth
  l.connect(lg); lg.connect(o.frequency);
  g.gain.value=0.16;
  o.connect(g); g.connect(ac.destination);
  o.start(); l.start();
  siren={o:o,l:l,g:g};
}
function stopSiren(){ if(!siren) return; try{siren.o.stop();siren.l.stop();}catch(e){} siren=null; }
function chirp(){
  if(!ac) return;
  const o=ac.createOscillator(), g=ac.createGain();
  o.type="triangle"; o.frequency.value=980; g.gain.value=0.12;
  o.connect(g); g.connect(ac.destination); o.start();
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+0.35);
  o.stop(ac.currentTime+0.36);
}
function notify(t,b){
  if(notifyOk){ try{ new Notification(t,{body:b}); }catch(e){} }
}

function upt(s){
  const d=Math.floor(s/86400), h=Math.floor(s%86400/3600),
        m=Math.floor(s%3600/60), x=s%60;
  return (d?d+"d ":"")+String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(x).padStart(2,"0");
}
function clk(ms){ const s=Math.floor(ms/1000); return upt(s); }

function meter(pct,fill,val){
  pct=Math.max(0,Math.min(150,pct));
  fill.style.width=Math.min(100,pct)+"%";
  fill.style.background = pct>=100 ? "var(--dang)" : pct>=60 ? "var(--warn)" : "var(--safe)";
  val.textContent=pct;
}

const BAN={0:["s-idle","SENSOR WARM-UP","Heaters stabilising - alarms inhibited"],
           1:["s-safe","SAFE","Atmosphere clear - ventilation idle"],
           2:["s-warn","WARNING","Gas detected - ventilation running"],
           3:["s-dang","DANGER","EVACUATE AREA - full ventilation and alarm active"]};

async function poll(){
  try{
    const r=await fetch("/api/state",{cache:"no-store"});
    const d=await r.json();
    misses=0;
    document.getElementById("dot").classList.remove("bad");
    document.getElementById("linktxt").textContent="LINKED";

    const b=document.getElementById("banner"), s=BAN[d.state];
    b.className=s[0];
    document.getElementById("bstate").textContent=s[1];
    document.getElementById("bmsg").textContent=s[2];

    meter(d.mq2Pct, document.getElementById("f2"),   document.getElementById("v2"));
    meter(d.mq135Pct,document.getElementById("f135"),document.getElementById("v135"));
    document.getElementById("r2").textContent=d.mq2;
    document.getElementById("r135").textContent=d.mq135;
    document.getElementById("t2").textContent="W "+d.thr.w2+" / D "+d.thr.d2;
    document.getElementById("t135").textContent="W "+d.thr.w135+" / D "+d.thr.d135;

    const lf=document.getElementById("lfan");
    lf.className="led"+(d.fan?" on":"");
    document.getElementById("tfan").textContent=d.fan?"RUNNING":"STOPPED";

    const lb=document.getElementById("lbuz");
    lb.className="led"+(d.buzzer?(d.silenced?" amb":" red"):"");
    document.getElementById("tbuz").textContent=
      d.buzzer?(d.silenced?"SILENCED":"SOUNDING"):"OFF";

    document.getElementById("tup").textContent=upt(d.uptime);
    document.getElementById("trssi").textContent=d.rssi+" dBm / "+Math.round(d.heap/1024)+"kB";

    const ul=document.getElementById("log"); ul.innerHTML="";
    d.log.forEach(e=>{
      const li=document.createElement("li");
      li.innerHTML='<span class="t">'+clk(d.now-e.t)+' ago</span><span>'+e.m+'</span>';
      ul.appendChild(li);
    });

    if(d.state!==lastState){
      if(d.state===3){ startSiren(); notify("DANGER - GAS DETECTED","Evacuate. Ventilation at full speed."); }
      else{ stopSiren(); if(d.state===2){ chirp(); notify("Warning - gas detected","Ventilation running."); } }
      lastState=d.state;
    }
    if(d.state===3 && !siren) startSiren();
  }catch(e){
    if(++misses>2){
      document.getElementById("dot").classList.add("bad");
      document.getElementById("linktxt").textContent="LINK LOST";
    }
  }
}
poll(); setInterval(poll,700);
</script></body></html>
)HTMLDOC";

/* ==========================================================================
 *          5.  WEB HANDLERS
 * ========================================================================== */

void handleRoot() {
  server.sendHeader("Cache-Control", "no-store");
  server.send_P(200, "text/html", PAGE_INDEX);
}

void handleState() {
  String j = "{";
  j += "\"state\":" + String((int)state);
  j += ",\"mq2\":" + String(mq2Raw);
  j += ",\"mq135\":" + String(mq135Raw);
  j += ",\"mq2Pct\":" + String(mq2Pct);
  j += ",\"mq135Pct\":" + String(mq135Pct);
  j += ",\"fan\":" + String(fanOn ? "true" : "false");
  j += ",\"buzzer\":" + String(buzzerActive ? "true" : "false");
  j += ",\"silenced\":" + String(alarmSilenced ? "true" : "false");
  j += ",\"uptime\":" + String((millis() - bootTime) / 1000UL);
  j += ",\"now\":" + String(millis());
  j += ",\"rssi\":" + String(WiFi.RSSI());
  j += ",\"heap\":" + String(ESP.getFreeHeap());
  j += ",\"thr\":{\"w2\":" + String(MQ2_WARNING) + ",\"d2\":" + String(MQ2_DANGER) +
       ",\"w135\":" + String(MQ135_WARNING) + ",\"d135\":" + String(MQ135_DANGER) + "}";
  j += ",\"log\":[";
  for (int i = 0; i < logCount; i++) {
    if (i) j += ",";
    j += "{\"t\":" + String(logTime[i]) + ",\"m\":\"" + logMsg[i] + "\"}";
  }
  j += "]}";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", j);
}

/* ==========================================================================
 *          6.  HARDWARE HELPERS
 * ========================================================================== */

void setFan(bool on) {
  if (on == fanOn) return;
  fanOn = on;
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_LOW ? (on ? LOW : HIGH) : (on ? HIGH : LOW));
  pushLog(on ? "Exhaust fan STARTED" : "Exhaust fan STOPPED");
}

int readSensor(int pin) {
  long sum = 0;
  for (int i = 0; i < SAMPLE_AVERAGES; i++) { sum += analogRead(pin); delayMicroseconds(300); }
  return (int)(sum / SAMPLE_AVERAGES);
}

int toPercent(int raw, int danger) {
  int p = (int)((long)raw * 100L / (long)danger);
  return p < 0 ? 0 : (p > 150 ? 150 : p);
}

/* Two short blocking beeps at boot - a quick audible self-test to confirm
 * the buzzer/NPN driver circuit is wired and working. Runs once, before
 * Wi-Fi connects, so it never interferes with normal alarm timing. */
void startupBeep() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(STARTUP_BEEP_ON_MS);
    digitalWrite(PIN_BUZZER, LOW);
    delay(STARTUP_BEEP_OFF_MS);
  }
}

/* ==========================================================================
 *          7.  SETUP
 * ========================================================================== */

void setup() {
  Serial.begin(115200);
  delay(200);
  bootTime = millis();

  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_LOW ? HIGH : LOW);   // fan OFF at boot
  pinMode(PIN_BUZZER, OUTPUT);      digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_LED_RED, OUTPUT);     digitalWrite(PIN_LED_RED, LOW);
  pinMode(PIN_LED_GREEN, OUTPUT);   digitalWrite(PIN_LED_GREEN, LOW);
  pinMode(PIN_BTN_ALARM, INPUT_PULLUP);

  startupBeep();   // <-- two beeps to confirm buzzer is alive
  pushLog("Startup self-test beep");

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_MQ2,   ADC_11db);
  analogSetPinAttenuation(PIN_MQ135, ADC_11db);

  Wire.begin(21, 22);
  lcd.init(); lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("Gas Detection");
  lcd.setCursor(0, 1); lcd.print("Booting...");

  pushLog("Controller powered on");

  /* ---- Wi-Fi ---- */
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lcd.clear(); lcd.setCursor(0, 0); lcd.print("WiFi connecting");
  Serial.print("Connecting to "); Serial.println(WIFI_SSID);

  unsigned long t0 = millis();
  int dots = 0;
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 25000UL) {
    delay(400);
    lcd.setCursor(dots % 16, 1); lcd.print(".");
    Serial.print(".");
    if (++dots % 16 == 0) { lcd.setCursor(0, 1); lcd.print("                "); }
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("SCADA at  http://"); Serial.println(WiFi.localIP());
    pushLog("Wi-Fi connected: " + WiFi.localIP().toString());
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("SCADA IP:");
    lcd.setCursor(0, 1); lcd.print(WiFi.localIP().toString());
    delay(4000);
  } else {
    Serial.println("Wi-Fi FAILED - running standalone (local alarms still active)");
    pushLog("Wi-Fi connect failed - standalone mode");
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("WiFi FAILED");
    lcd.setCursor(0, 1); lcd.print("Local mode only");
    delay(2500);
  }

  server.on("/", handleRoot);
  server.on("/api/state", handleState);
  server.onNotFound([]() { server.sendHeader("Location", "/"); server.send(302, "text/plain", ""); });
  server.begin();

  pushLog("Sensor warm-up started");
  state = ST_WARMUP;
  stateSince = millis();
}

/* ==========================================================================
 *          8.  MAIN LOOP
 * ========================================================================== */

void loop() {
  server.handleClient();

  /* ---- 8.1 Wi-Fi watchdog ---- */
  static unsigned long lastWifiCheck = 0;
  if (millis() - lastWifiCheck > 15000UL) {
    lastWifiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      pushLog("Wi-Fi dropped - reconnecting");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  /* ---- 8.2 Alarm-reset button (silences buzzer only, fan keeps running) ---- */
  int b = digitalRead(PIN_BTN_ALARM);
  if (b != lastBtn) { lastBtnChange = millis(); lastBtn = b; }
  else if (b == LOW && millis() - lastBtnChange > DEBOUNCE_MS && !alarmSilenced && buzzerActive) {
    alarmSilenced = true;
    digitalWrite(PIN_BUZZER, LOW);
    pushLog("Audible alarm SILENCED by operator");
  }

  /* ---- 8.3 Sample and evaluate ---- */
  if (millis() - lastSample >= SAMPLE_MS) {
    lastSample = millis();

    mq2Raw   = readSensor(PIN_MQ2);
    mq135Raw = readSensor(PIN_MQ135);
    mq2Pct   = toPercent(mq2Raw,   MQ2_DANGER);
    mq135Pct = toPercent(mq135Raw, MQ135_DANGER);

    if (state == ST_WARMUP) {
      if (millis() - bootTime >= WARMUP_MS) {
        state = ST_SAFE; stateSince = millis();
        pushLog("Warm-up complete - monitoring active");
      }
    } else {
      /* Highest severity of the two channels wins, with hysteresis on the
         way back down so the outputs do not chatter on a boundary. */
      SysState want = ST_SAFE;

      bool danger  = (mq2Raw   >= MQ2_DANGER)    || (mq135Raw >= MQ135_DANGER);
      bool warning = (mq2Raw   >= MQ2_WARNING)   || (mq135Raw >= MQ135_WARNING);

      bool clearOfDanger  = (mq2Raw   < MQ2_DANGER  - HYSTERESIS) &&
                            (mq135Raw < MQ135_DANGER - HYSTERESIS);
      bool clearOfWarning = (mq2Raw   < MQ2_WARNING - HYSTERESIS) &&
                            (mq135Raw < MQ135_WARNING - HYSTERESIS);

      if (state == ST_DANGER)       want = clearOfDanger  ? (warning ? ST_WARNING : ST_SAFE) : ST_DANGER;
      else if (state == ST_WARNING) want = danger ? ST_DANGER : (clearOfWarning ? ST_SAFE : ST_WARNING);
      else                          want = danger ? ST_DANGER : (warning ? ST_WARNING : ST_SAFE);

      if (want != state) {
        state = want; stateSince = millis();
        pushLog(String("State -> ") + stateName(state) +
                "  (MQ2 " + mq2Raw + " / MQ135 " + mq135Raw + ")");
        if (state == ST_SAFE) {
          alarmSilenced = false;        // re-arm the buzzer for the next event
        }
      }
    }

    /* ---- 8.4 Actuate ---- */
    switch (state) {
      case ST_WARMUP:
        setFan(false); buzzerActive = false;
        digitalWrite(PIN_BUZZER, LOW);
        digitalWrite(PIN_LED_RED, LOW);
        break;

      case ST_SAFE:
        setFan(false); buzzerActive = false;
        digitalWrite(PIN_BUZZER, LOW);
        digitalWrite(PIN_LED_RED, LOW);
        digitalWrite(PIN_LED_GREEN, HIGH);
        break;

      case ST_WARNING:
        setFan(true);  buzzerActive = false;
        digitalWrite(PIN_BUZZER, LOW);
        digitalWrite(PIN_LED_GREEN, LOW);
        break;

      case ST_DANGER:
        setFan(true);  buzzerActive = true;
        digitalWrite(PIN_LED_GREEN, LOW);
        digitalWrite(PIN_LED_RED, HIGH);
        break;
    }

    Serial.printf("MQ2=%4d  MQ135=%4d  state=%-10s fan=%s buz=%s\n",
                  mq2Raw, mq135Raw, stateName(state),
                  fanOn ? "ON" : "OFF", buzzerActive ? (alarmSilenced ? "MUTE" : "ON") : "OFF");
  }

  /* ---- 8.5 Non-blocking indicator patterns ---- */
  if (state == ST_WARMUP) {                       // slow green heartbeat
    if (millis() - lastBlink >= 700) {
      lastBlink = millis(); blinkPhase = !blinkPhase;
      digitalWrite(PIN_LED_GREEN, blinkPhase);
    }
  } else if (state == ST_WARNING) {               // red blink, no sound
    if (millis() - lastBlink >= 400) {
      lastBlink = millis(); blinkPhase = !blinkPhase;
      digitalWrite(PIN_LED_RED, blinkPhase);
    }
  }

  if (buzzerActive && !alarmSilenced) {           // pulsed buzzer in DANGER
    if (millis() - lastBuzzTog >= 250) {
      lastBuzzTog = millis(); buzzPhase = !buzzPhase;
      digitalWrite(PIN_BUZZER, buzzPhase);
    }
  }

  /* ---- 8.6 LCD ---- */
  if (millis() - lastLcd >= LCD_REFRESH_MS) {
    lastLcd = millis();
    char l0[17], l1[17];

    if (state == ST_WARMUP) {
      unsigned long left = (WARMUP_MS - (millis() - bootTime)) / 1000UL;
      snprintf(l0, 17, "WARMING UP %3lus", left);
      snprintf(l1, 17, "Alarms inhibitd");
    } else {
      const char* tag = (state == ST_SAFE) ? "SAFE   " : (state == ST_WARNING) ? "WARNING" : "DANGER!";
      snprintf(l0, 17, "%s F:%s%s", tag, fanOn ? "ON " : "OFF", alarmSilenced ? "M" : " ");
      snprintf(l1, 17, "G2:%3d%%G135:%3d%%", mq2Pct, mq135Pct);
    }
    lcd.setCursor(0, 0); lcd.print("                "); lcd.setCursor(0, 0); lcd.print(l0);
    lcd.setCursor(0, 1); lcd.print("                "); lcd.setCursor(0, 1); lcd.print(l1);
  }
}
