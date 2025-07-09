// Value-in-center-plugin
const valueInCenter = {
    id: 'valueInCenter',
    afterDraw(chart) {
      const {ctx,chartArea:{left,right,top,bottom}} = chart;
      const value = chart.data.datasets[0].data[0];
      const x = (left+right)/2, y=(top+bottom)/2+10;
      ctx.save();
      ctx.fillStyle='#fff';
      ctx.font='bold 24px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(value+'%', x, y);
      ctx.restore();
    }
  };
  
  // Skapar en doughnut-gauge
  export function createGauge(ctx, color) {
    return new Chart(ctx, {
      type:'doughnut',
      data:{ labels:['',''], datasets:[{ data:[0,100], backgroundColor:[color,'#333'], borderWidth:0 }]},
      options:{
        aspectRatio:2, circumference:180, rotation:-90,
        cutout:'70%', plugins:{legend:{display:false},tooltip:{enabled:false}}, responsive:false
      },
      plugins:[valueInCenter]
    });
  }