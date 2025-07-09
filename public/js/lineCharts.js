export function createLineChart(ctx, label, borderColor='#4caf50') {
    return new Chart(ctx, {
      type:'line',
      data:{
        datasets:[{ label, data:[], fill:false, tension:0.3, pointRadius:0, borderColor }]
      },
      options:{
        scales:{
          x:{ type:'time', time:{unit:'minute'}, ticks:{color:'#aaa'} },
          y:{ min:0, max:100, ticks:{color:'#aaa'} }
        },
        plugins:{ legend:{labels:{color:'#eee'}} }
      }
    });
  }
  