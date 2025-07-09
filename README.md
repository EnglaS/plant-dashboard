# Intelligent Plant Monitor – Basic Tutorial

## 1. Introduction

The Intelligent Plant Monitor is a simple IoT system designed to measure and visualize the health of a potted plant in real time. Using a Raspberry Pi Pico WH as the microcontroller platform, the project reads data from two analog sensors—a soil moisture sensor to track water content in the soil and a photoresistor to measure ambient light levels. Sensor readings are sent via MQTT to a Node.js server, which then broadcasts the data to a web dashboard built with Chart.js. The dashboard displays gauges and time‑series charts for both soil moisture and light intensity, allowing the user to easily observe trends and respond when conditions fall outside ideal ranges.

![image](https://github.com/user-attachments/assets/0540391e-7d19-4389-a0c4-bcaafaf72542)


## 2. Bill of Materials

| Component            | Quantity | Description                         | Approx. Price (SEK) | Purchase Link |
| -------------------- | -------- | ----------------------------------- | ------------------- | ------------- |
| Raspberry Pi Pico WH | 1        | Microcontroller with built-in Wi-Fi | 99.00               | [Pico WH](https://www.electrokit.com/raspberry-pi-pico-wh)|
| Soil moisture sensor                                                  | 1         | Analog moisture sensor (capacitive/ resistive) | 29.00 | [Soil Sensor](https://www.electrokit.com/jordfuktighetssensor)  |
| Photoresistor (LDR)                                                   | 1         | Light-dependent resistor for measuring light   | 9.50 | [LDR](https://www.electrokit.com/fotomotstand-cds-4-7-kohm)         |
| Fixed resistor (10 kΩ)                                                | 1         | For LDR voltage divider                        | 3.00 | [Resistor](https://www.electrokit.com/motstand-2w-10kohm-510k)      |
| Breadboard                                             | 1 | Solderless breadboard        | 69.00 | [Breadboard](https://www.electrokit.com/kopplingsdack-840-anslutningar) |
| Wires | As needed | Wires male/male        | 52.00 | [Wires male/male](https://www.electrokit.com/labbsladd-20-pin-15cm-hane/hane) |

## 3. Wiring Diagram

![kopplingsschema](https://github.com/user-attachments/assets/32092bbb-c468-4e13-b9d5-288c146bf2bc)

## 4. Software

### 4.1 MicroPython Code on Pico

Explain how to flash MicroPython, and include the code snippet that:

```python
import network
import time
from machine import ADC, Pin
from umqtt.simple import MQTTClient

# WiFi and Adafruit IO credentials
WIFI_SSID = "<your_ssid>"
WIFI_PASS = "<your_password>"
AIO_USER = "<aio_username>"
AIO_KEY  = "<aio_key>"
FEED     = f"{AIO_USER}/feeds/soil"

# Connect to Wi-Fi
# ...

# Read sensor and publish to Adafruit IO via MQTT
# ...
```

### 4.2 Node.js Server

Outline how you set up your Express/Socket.io server, and show the key parts:

```js
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import mqtt from 'mqtt'

// Setup, subscribe to feed, emit via socket.io
// ...
```

### 4.3 Front-End Dashboard

Show the HTML/JS that renders the gauge and time-series chart using Chart.js:

```html
<canvas id="gauge"></canvas>
<canvas id="chart"></canvas>
<script src="chart.umd.min.js"></script>
<script>
// Initialization, data fetch, socket updates
// ...
</script>
```

## 5. Results

- **Screenshot of gauge and chart** showing live data.
  ![image](https://github.com/user-attachments/assets/e64d4a47-b9ad-4cca-a119-2b70c3515976)

- **Console logs** demonstrating data flow from Pico → server → browser.

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

## 7. References

- Adafruit IO documentation: [https://io.adafruit.com](https://io.adafruit.com)
- Chart.js docs: [https://www.chartjs.org/](https://www.chartjs.org/)
- MQTT and umqtt.simple guide

