export const socket = io();  // ansluter mot samma origin

export function subscribeUpdates(gauge, line, eventName) {
  socket.on(eventName, p => {
    // Uppdatera gauge
    gauge.data.datasets[0].data = [p.value, 100-p.value];
    gauge.update();
    // Uppdatera line
    const data = line.data.datasets[0].data;
    data.push({ x:new Date(p.time), y:p.value });
    if (data.length>500) data.shift();
    line.update();
  });
}