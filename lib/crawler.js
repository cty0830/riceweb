import axios from 'axios';

/**
 * 爬取農業部白米價格資料
 * 篩選：台中市、近一個月內，存入時改名為蓬萊米
 */
export async function syncRicePrices() {
    // 農業部開放資料 API 網址
    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/RicepriceData.aspx?$top=1000&$skip=0&UnitId=266';

    try {
        console.log("正在從農業部 API 獲取資料...");
        const response = await axios.get(url);
        
        // 農業部 API 通常直接回傳 JSON 陣列，不需額外處理字串
        const allData = response.data;

        // 1. 設定日期篩選基準 (以系統今天日期 2026-05-12 為準)
        const today = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(today.getMonth() - 1);

        // 2. 進行篩選與欄位挑選
        const filteredResult = allData.filter(item => {
            // A. 篩選台中市 (使用 trim() 移除空格)
            const isTaichung = item.name && item.name.trim() === "台中市";
            if (!isTaichung) return false;

            // B. 解析民國日期 "115.5.12"
            // 格式轉換：115.5.12 -> 西元 2026-05-12
            const dateParts = item.pt_date_day.split('.');
            if (dateParts.length !== 3) return false;

            const year = parseInt(dateParts[0]) + 1911;
            const month = parseInt(dateParts[1]) - 1; // JS 月份 0-11
            const day = parseInt(dateParts[2]);
            const itemDate = new Date(year, month, day);

            // C. 檢查是否在最近一個月範圍內
            return itemDate >= oneMonthAgo && itemDate <= today;
        }).map(item => {
            // 3. 僅挑選您要求的 3 個欄位
            return {
                name: '蓬萊米',
                pt_date_day: item.pt_date_day,
                pt_1japt: item.pt_1japt
            };
        });

        // 4. 輸出結果
        if (filteredResult.length > 0) {
            console.log(`成功找到 ${filteredResult.length} 筆台中市近一個月的資料 (存為蓬萊米)：`);
            console.table(filteredResult); // 用表格形式顯示更清晰
        } else {
            console.log("找到台中市資料，但日期不在最近一個月內。");
        }

        return filteredResult;

    } catch (error) {
        console.error('API 請求失敗:', error.message);
        return [];
    }
}

