const ctx = document.getElementById('price-chart');
let chartInstance;

// 防止 XSS 的工具函式
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 抓取圖表資料
 * 直接抓取資料庫資料，並取近一個月
 */
async function fetchChartData() {
  const response = await fetch('/api/prices');
  if (!response.ok) {
    throw new Error('Failed to load chart data');
  }

  const payload = await response.json();
  return Array.isArray(payload.data) ? payload.data : [];
}

function isWithinLastMonth(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);
  return date >= oneMonthAgo && date <= today;
}

/**
 * 渲染圖表
 */
function renderChart(rows) {
  const filtered = rows
    .filter((row) => isWithinLastMonth(row.sale_date))
    .sort((a, b) => a.sale_date.localeCompare(b.sale_date));

  const labels = filtered.map((row) => row.sale_date);
  const values = filtered.map((row) => Number(row.price));

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '每日價格',
          data: values,
          borderColor: '#c46a2b',
          backgroundColor: 'rgba(196, 106, 43, 0.15)',
          fill: true,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // 讓圖表更能適應容器
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => escapeHtml(items[0].label),
            label: (item) => `平均價格: ${item.formattedValue}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#5b5b68' },
          grid: { display: false },
        },
        y: {
          beginAtZero: false, // 讓波動看起來更明顯
          ticks: { color: '#5b5b68' },
          grid: { color: 'rgba(27, 27, 31, 0.08)' },
        },
      },
    },
  });
}

/**
 * 初始化函式：頁面載入後自動執行
 */
async function init() {
  try {
    console.log('正在自動載入價格趨勢...');
    const rows = await fetchChartData();
    if (rows.length === 0) {
      console.warn('資料庫目前沒有資料。');
      return;
    }
    renderChart(rows);
  } catch (error) {
    console.error('圖表載入失敗:', error);
  }
}

// 執行初始化
init();