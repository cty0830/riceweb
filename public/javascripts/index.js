// 取得表單元件
const priceForm = document.getElementById('price-form');
const tableShell = document.getElementById('price-table-shell');
const tableStatus = document.getElementById('price-table-status');
const searchForm = document.getElementById('search-form');

// 防止 XSS 的工具函式 (保留備用，是個好習慣)
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 處理表單提交
 */
if (priceForm) {
  priceForm.addEventListener('submit', async (e) => {
    // 1. 重要！阻止瀏覽器預設的 GET 提交行為 (防止網址出現問號)
    e.preventDefault();

    // 2. 封裝表單資料
    const formData = new FormData(priceForm);
    const payload = {
      saleDate: formData.get('saleDate'),
      productName: formData.get('productName'),
      price: formData.get('price')
    };

    // 簡單前端檢查
    if (!payload.saleDate || !payload.productName || !payload.price) {
      alert('請填寫所有欄位');
      return;
    }

    try {
      // 3. 發送 POST 請求到後端 API
      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        alert('✅ 紀錄已成功送出！');
        priceForm.reset(); // 清空輸入框
        await loadPrices();
      } else {
        // 顯示後端回傳的錯誤 (例如：資料重複或格式錯誤)
        alert('❌ 儲存失敗：' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('連線錯誤:', error);
      alert('系統異常，無法連線至伺服器');
    }
  });
}

async function loadPrices() {
  if (!tableShell || !tableStatus) {
    return;
  }

  let startDate = null;
  let endDate = null;

  if (searchForm) {
    const formData = new FormData(searchForm);
    startDate = formData.get('startDate') || null;
    endDate = formData.get('endDate') || null;
  }

  tableStatus.textContent = '載入中...';
  tableShell.innerHTML = '';
  tableShell.appendChild(tableStatus);

  try {
    const params = new URLSearchParams();
    if (startDate) {
      params.set('startDate', startDate);
    }
    if (endDate) {
      params.set('endDate', endDate);
    }

    const url = params.toString() ? `/api/prices?${params.toString()}` : '/api/prices';
    const response = await fetch(url);
    const result = await response.json();

    if (!response.ok) {
      tableStatus.textContent = `讀取失敗：${result.error || '未知錯誤'}`;
      return;
    }

    const rows = Array.isArray(result.data) ? result.data : [];
    if (rows.length === 0) {
      tableStatus.textContent = '目前沒有任何資料。';
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>日期</th>
          <th>商品</th>
          <th>價格</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.sale_date)}</td>
                <td>${escapeHtml(item.product_name)}</td>
                <td>${escapeHtml(item.price)}</td>
              </tr>
            `
          )
          .join('')}
      </tbody>
    `;

    tableShell.innerHTML = '';
    tableShell.appendChild(table);
  } catch (error) {
    console.error('載入資料失敗:', error);
    tableStatus.textContent = '系統異常，無法載入資料。';
    tableShell.innerHTML = '';
    tableShell.appendChild(tableStatus);
  }
}

loadPrices();

if (searchForm) {
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await loadPrices();
  });
}