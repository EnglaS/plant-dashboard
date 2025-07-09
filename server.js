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