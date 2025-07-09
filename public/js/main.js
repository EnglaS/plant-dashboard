import { createGauge }       from './gauges.js';
import { createLineChart }   from './lineCharts.js';
import { socket, subscribeUpdates } from './socketClient.js';

const LOW_THRESH  = 35;
const HIGH_THRESH = 80;

function getThresholdColor(value) {
  if (value < LOW_THRESH)        return '#e53935'; // red
  else if (value > HIGH_THRESH)  return '#1e88e5'; // blue (or yellow)
  else                            return '#43a047'; // green
}

const LOW_LIGHT_THRESH = 25;

function getLightColor(value) {
  if (value < LOW_LIGHT_THRESH)  return '#e53935'; // red
  else                            return '#43a047'; // green
}

document.addEventListener('DOMContentLoaded', () => {
  // 1) Initiera Soil & Light
  const gaugeSoil  = createGauge(
    document.getElementById('gaugeSoil').getContext('2d'),
    '#4caf50'
  );
  const gaugeLight = createGauge(
    document.getElementById('gaugeLight').getContext('2d'),
    '#ffc107'
  );
  const lineSoil   = createLineChart(
    document.getElementById('chartSoil').getContext('2d'),
    'Soil',
    '#4caf50'
  );
  const lineLight  = createLineChart(
    document.getElementById('chartLight').getContext('2d'),
    'Light',
    '#ffc107'
  );

  // 2) Hämta historik en gång
  fetch('/api/history/soil').then(r=>r.json()).then(points=>{
    lineSoil.data.datasets[0].data = points.map(p=>({
      x:new Date(p.time),
      y:p.value
    }));
    lineSoil.update();
  });
  fetch('/api/history/light').then(r=>r.json()).then(points=>{
    lineLight.data.datasets[0].data = points.map(p=>({
      x:new Date(p.time),
      y:p.value
    }));
    lineLight.update();
  });

  // 3) Realtids-uppdateringar via Socket.io
  //subscribeUpdates(gaugeSoil, lineSoil, 'soil_update');
  //subscribeUpdates(gaugeLight, lineLight, 'light_update');

  socket.on('soil_update', p => {
    // 1) update gauge data
    gaugeSoil.data.datasets[0].data = [p.value, 100 - p.value];
  
    // 2) recolor first slice based on thresholds
    gaugeSoil.data.datasets[0].backgroundColor[0] =
      getThresholdColor(p.value);
  
    // 3) push into line chart
    lineSoil.data.datasets[0].data.push({ x: new Date(p.time), y: p.value });
    if (lineSoil.data.datasets[0].data.length > 500) {
      lineSoil.data.datasets[0].data.shift();
    }
  
    // 4) redraw
    gaugeSoil.update();
    lineSoil.update();
  });

  socket.on('light_update', p => {
    gaugeLight.data.datasets[0].data = [p.value, 100 - p.value];
    gaugeLight.data.datasets[0].backgroundColor[0] =
      getLightColor(p.value);
  
    lineLight.data.datasets[0].data.push({ x:new Date(p.time), y:p.value });
    if (lineLight.data.datasets[0].data.length > 500) {
      lineLight.data.datasets[0].data.shift();
    }
  
    gaugeLight.update();
    lineLight.update();
  });

  // 4) Ambient Temperature: text-indikator + gauge
  const tempText = document.getElementById('tempDisplay');
  const gaugeTemp = createGauge(
    document.getElementById('gaugeTemp').getContext('2d'),
    '#ffeb3b'
  );
  
  // Be om användarens plats
  if ('geolocation' in navigator) {
    tempText.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(pos => {
      socket.emit('location', {
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude
      });
    }, err => {
      console.warn('Geolocation error', err);
      tempText.textContent = 'Location unavailable';
    });
  } else {
    tempText.textContent = 'No geolocation support';
  }

  // Ta emot temperatur och uppdatera UI
  socket.on('ambient_temperature', temp => {
    if (temp == null) {
      tempText.textContent = 'Error fetching weather';
      return;
    }
    // Visa text
    tempText.textContent = temp.toFixed(1) + ' °C';
    // Uppdatera gauge (0–40°C skala)
    const clamped = Math.max(0, Math.min(40, temp));
    gaugeTemp.data.datasets[0].data = [clamped, 40 - clamped];
    gaugeTemp.update();
  });
});