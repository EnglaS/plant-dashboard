# Intelligent Plant Monitor – Basic Tutorial
**Author:** Engla Sundström (es226if)  
- [x] Estimated time: 2–3 hours

![image](https://github.com/user-attachments/assets/0540391e-7d19-4389-a0c4-bcaafaf72542)

## 1. Introduction & Objectives  
**What**: A Wi‑Fi–connected plant monitoring system that tracks soil moisture and ambient light in real time, displaying live gauges and historical charts via a web dashboard.  
**Why**: Over‑ and under‑watering are the leading causes of houseplant failure; by visualizing trends, users can water precisely and keep plants healthy.  
**Insights**: Correlate watering schedules with plant health, and extend the system with additional sensors or automated controls.  

**This tutorial guides you through:**  
1. Hardware & wiring setup  
2. CircuitPython code on Raspberry Pi Pico WH  
3. Node.js/MQTT server configuration  
4. Chart.js dashboard implementation

---

## 2. Bill of Materials

| Component            | Quantity | Description                         | Approx. Price (SEK) | Purchase Link |
| -------------------- | -------- | ----------------------------------- | ------------------- | ------------- |
| Raspberry Pi Pico WH    | 1   | Microcontroller with built‑in Wi‑Fi              | 99.00               | [Electrokit](https://www.electrokit.com/raspberry-pi-pico-wh) |
| Soil moisture sensor    | 1   | Analog capacitive/resistive moisture sensor      | 29.00               | [Electrokit](https://www.electrokit.com/jordfuktighetssensor) |
| Photoresistor (LDR)     | 1   | Light‑dependent resistor for light measurement  | 9.50                | [Electrokit](https://www.electrokit.com/fotomotstand-cds-4-7-kohm) |
| Resistor, 10 kΩ         | 1   | For LDR voltage divider                         | 3.00                | [Electrokit](https://www.electrokit.com/motstand-2w-10kohm-510k) |
| Breadboard              | 1   | Solderless prototyping board                    | 69.00               | [Electrokit](https://www.electrokit.com/kopplingsdack-840-anslutningar) |
| Jumper wires            | As needed | Male‑female jumpers for connections       | 52.00               | [Electrokit](https://www.electrokit.com/labbsladd-20-pin-15cm-hane/hane) |
| **Red LED**             | 1   | Indicator: soil outside safe moisture range     | 5.00                | [Electrokit](https://www.electrokit.com/led-5mm-rod-diffus-1500mcd) |
| **Green LED**           | 1   | Indicator: soil within safe moisture range      | 5.00                | [Electrokit](https://www.electrokit.com/led-5mm-pure-gron-diffus-4000mcd) |
| Resistor, 330 Ω         | 2   | For LEDs                                        | 4.00 (2×2.00)       | [Electrokit](https://www.electrokit.com/motstand-1w-5330ohm-330r) |

---

## 3. Wiring Diagram

![kopplingsschema](https://github.com/user-attachments/assets/32092bbb-c468-4e13-b9d5-288c146bf2bc)

**Connections:**  
1. **GP27 → Soil sensor Vout** (soil moisture)  
2. **GP26 → LDR divider → 10 kΩ → GND** (light level)  
3. **GP13 → 330 Ω → Red LED → GND**  
4. **GP14 → 330 Ω → Green LED → GND**  
5. **3.3 V & GND rails** to sensor Vcc/GND  

Voltage divider for LDR:  
> Vout = 3.3 V × (10 kΩ / (10 kΩ + R_LDR)) → maps to 0–3.3 V → 0–100 % light

---

## 4. Software Setup
### 4.1 CircuitPython on Pico WH
- **IDE:** Thonny (set interpreter to Raspberry Pi Pico CircuitPython)  
- **Dependencies:** none (built‑in `machine`, `time`, `analogio` classes)
- **Flash firmware:** Hold BOOTSEL, drag file to RPI‑RP2 drive.

### 4.2 CircuitPython Code (code.py)

```python
import time
import wifi
import socketpool
from analogio import AnalogIn
import board
import digitalio 
from adafruit_minimqtt.adafruit_minimqtt import MQTT   # OBS: så importerar du MQTT-klassen
import keys   # WIFI_SSID, WIFI_PASS, ADAFRUIT_IO_USERNAME, ADAFRUIT_IO_KEY, FEED_KEY

# 1) WiFi
print("Connecting to WiFi…")
wifi.radio.connect(keys.WIFI_SSID, keys.WIFI_PASS)
print("WiFi connected, IP =", wifi.radio.ipv4_address)

# 2) SocketPool (utan SSL på port 1883)
pool = socketpool.SocketPool(wifi.radio)

# 3) MQTT-klient mot Adafruit IO
mqtt = MQTT(
    broker="io.adafruit.com",
    port=1883,
    username=keys.ADAFRUIT_IO_USERNAME,
    password=keys.ADAFRUIT_IO_KEY,
    client_id = keys.ADAFRUIT_IO_USERNAME,
    socket_pool=pool
)

# --- 4) Anslut en gång ---
print("Connecting to MQTT broker…")
mqtt.connect()
print("MQTT connected!")

# --- Sensorer ---
soil_sensor  = AnalogIn(board.GP27)
light_sensor = AnalogIn(board.GP26)

# torr: 65535
#våt (mättad jord): 11858

# --- 6) Loop: läs & publicera ---
# kalibreringsvärden:
raw_dry = 65535
raw_wet = 0
raw_dark = 60000   # när det är helt mörkt
raw_bright = 10000 # när det är fullt ljust

# Topics
soil_topic  = f"{keys.ADAFRUIT_IO_USERNAME}/feeds/{keys.FEED_KEY}"
light_topic = f"{keys.ADAFRUIT_IO_USERNAME}/feeds/{keys.LIGHT_FEED_KEY}"

# --- LED Setup, pins and thresholds ---
led_red   = digitalio.DigitalInOut(board.GP13)
led_green = digitalio.DigitalInOut(board.GP14)
for led in (led_red, led_green):
    led.direction = digitalio.Direction.OUTPUT

LOW_THRESH  = 35   # below dry 
HIGH_THRESH = 80   # above wet

def update_leds(m):
    # Om m är under LOW eller över HIGH → utanför safe zone
    outside = (m < LOW_THRESH) or (m > HIGH_THRESH)
    led_red.value   = outside       # tänd röd LED när utanför
    led_green.value = not outside   # (valfritt) tänd grön LED när innanför


def scale(raw, lo, hi):
    """Skalar raw‐värde från [lo..hi] till 0–100 %."""
    frac = (raw - lo) / (hi - lo)
    if frac < 0: frac = 0.0
    if frac > 1: frac = 1.0
    return int(frac * 100)

while True:
    # Jordfuktighet
    raw_soil = soil_sensor.value
    soil_pct = scale(raw_soil, raw_wet, raw_dry)  
    print(f"Soil: {soil_pct}% (raw={raw_soil})")
    update_leds(soil_pct)  
    try:
        mqtt.publish(soil_topic, str(soil_pct), retain=True)
    except Exception as e:
        print("Soil publish failed:", e)

    # Ljusstyrka
    raw_light = light_sensor.value
    light_pct = scale(raw_light, raw_bright, raw_dark)
    print(f"Light: {light_pct}% (raw={raw_light})")
    try:
        mqtt.publish(light_topic, str(light_pct), retain=True)
    except Exception as e:
        print("Light publish failed:", e)

    time.sleep(20)
```

### 4.3 Node.js + Socket.io Server
(Full code here on GitHub)
```js
import express from "express"
import http from "http"
import mqtt from "mqtt"
import { Server } from "socket.io"
import cors from "cors"
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const OWM_KEY = process.env.OPENWEATHERMAP_KEY;

const AIO_USER = process.env.AIO_USER;
const AIO_KEY  = process.env.AIO_KEY;
const SOIL_FEED  = `${AIO_USER}/feeds/soil`
const LIGHT_FEED = `${AIO_USER}/feeds/light`

const app  = express()
const srv  = http.createServer(app)
const io   = new Server(srv, { cors: { origin: '*' } })

app.use(cors())
app.use(express.static('public'))

let soilHistory  = []
let lightHistory = []

// connect & subscribe båda feeds i EN subscribe-körning
const client = mqtt.connect('mqtt://io.adafruit.com', {
  username: AIO_USER,
  password: AIO_KEY,
  resubscribe: false    // undvik mqtt.js-buggen med `_resubscribeTopics`
})

client.on('connect', () => {
  console.log('MQTT connected, subscribing…')
  client.subscribe([ SOIL_FEED, LIGHT_FEED ], (err, granted) => {
    if (err) console.error('Subscribe error', err)
    else    console.log('Subscribed to', granted.map(g=>g.topic).join(', '))
  })
})

client.on('message', (topic, msg) => {
  const value = parseFloat(msg.toString())
  const point = { time: Date.now(), value }

  if (topic === SOIL_FEED) {
    soilHistory.push(point)
    if (soilHistory.length > 500) soilHistory.shift()
    io.emit('soil_update', point)

  } else if (topic === LIGHT_FEED) {
    lightHistory.push(point)
    if (lightHistory.length > 500) lightHistory.shift()
    io.emit('light_update', point)
  }
})

// --- WebSocket: ta emot geolocation och skicka temperatur ---
io.on('connection', socket => {
  let intervalId = null

  socket.on('location', async ({ latitude, longitude }) => {   // ← NYTT
    // Radera eventuell tidigare schemaläggning
    if (intervalId) clearInterval(intervalId)

    // Funktion för att hämta väder och skicka ut
    const fetchAndEmitTemp = async () => {
      try {
        const url = `https://api.openweathermap.org/data/2.5/weather`
                  + `?lat=${latitude}&lon=${longitude}`
                  + `&units=metric&appid=${OWM_KEY}`
        const resp = await fetch(url)
        const data = await resp.json()
        const temp = data.main?.temp ?? null
        socket.emit('ambient_temperature', temp)               // ← NYTT
      } catch (err) {
        console.error('Weather fetch failed:', err)
        socket.emit('ambient_temperature', null)               // ← NYTT
      }
    }

    // Kör omedelbart, och sedan var 10:e minut
    await fetchAndEmitTemp()
    intervalId = setInterval(fetchAndEmitTemp, 10 * 60 * 1000) // ← NYTT
  })

  // Rensa intervallet om socket disconnectar
  socket.on('disconnect', () => {
    if (intervalId) clearInterval(intervalId)
  })
})

// REST-endpoints
app.get('/api/history/soil',  (req, res) => res.json(soilHistory))
app.get('/api/history/light', (req, res) => res.json(lightHistory))

srv.listen(3000, () => console.log('Server på http://localhost:3000'))
```

### 4.4 Front‑End Dashboard

![Dashboard](https://github.com/user-attachments/assets/e64d4a47-b9ad-4cca-a119-2b70c3515976)

Key points:  
- Chart.js gauges + time‑series charts  
- Threshold coloring and animations  
- Prototype info box for weather API

  ![image](https://github.com/user-attachments/assets/f20127c5-6b60-4b8f-b9e1-a3d15c9603a2)


---

## 5. Results & Demonstration  
- Real‑time updates every 20 s (MQTT → WebSocket)  
- LEDs provide immediate visual feedback on device  
  
  ![image](https://github.com/user-attachments/assets/4fe4bbca-3b5c-4885-8e20-75eefddd8b3a)


## 6. Conclusion

This project successfully demonstrated a complete data pipeline: the Raspberry Pi Pico WH read values from a soil moisture sensor and a photoresistor, published them via MQTT to a Node.js server, and displayed both real‑time gauges and historical line charts in a Chart.js dashboard. Users can easily monitor soil and light conditions and identify trends over time.

**Challenges encountered:**

* **DHT11 sensor failure:** Attempts to integrate a DHT11 temperature and humidity sensor repeatedly failed due to inconsistent initialization and noisy readings. As a workaround, ambient temperature is now retrieved via the OpenWeatherMap API based on the device’s geolocation.

* **Soil moisture sensor accuracy:** The low‑cost resistive moisture sensor produced noisy, non‑linear values that required filtering and frequent recalibration. In future iterations, a capacitive or factory‑calibrated soil moisture sensor would provide more stable, reliable measurements.

* **MicroPython compatibility issues:** Early MicroPython code encountered library compatibility errors, especially with MQTT and sensor drivers. Switching the Pico firmware to CircuitPython resolved these issues and improved library support and debugging.

**Next steps:**

* Implement threshold‑based alerts (e.g., email or mobile push) when moisture or light levels fall outside desired ranges.

* Add automated watering or lighting control via a relay module for closed‑loop plant care.

* Integrate additional sensors (e.g., DHT22 for humidity, air quality sensors) to build a more comprehensive environmental monitor.

* Migrate data storage from in‑memory arrays to a time‑series database (e.g., InfluxDB) for long‑term analytics.

---

## 7. References
- Adafruit IO docs: https://io.adafruit.com  
- Chart.js: https://www.chartjs.org  
- MQTT fundamentals: https://mqtt.org  
- Raspberry Pi Pico MicroPython: https://www.raspberrypi.org/documentation/microcontrollers/micropython.html  
