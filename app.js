import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import logger from 'morgan';

import { getDb } from './lib/db.js';
import { syncRicePrices } from './lib/crawler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/prices', function(req, res) {
	const { saleDate, productName, price } = req.body || {};
	const parsedPrice = typeof price === 'string' ? Number(price) : price;

	if (!saleDate || !productName || Number.isNaN(parsedPrice)) {
		return res.status(400).json({ error: 'saleDate, productName, price are required.' });
	}

	try {
		const db = getDb();
		const stmt = db.prepare(
			`
				INSERT INTO prices (sale_date, product_name, price)
				VALUES (?, ?, ?)
				ON CONFLICT(sale_date, product_name) DO UPDATE SET price = excluded.price
			`
		);
		const result = stmt.run(saleDate, productName, parsedPrice);

		return res.json({ id: result.lastInsertRowid, changes: result.changes });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

app.get('/api/prices', function(req, res) {
	const { search, aggregate, startDate, endDate } = req.query || {};
	const searchTerm = search ? `%${search}%` : null;

	try {
		const db = getDb();
		if (aggregate === 'month') {
			const query = `
				SELECT
					strftime('%Y-%m', sale_date) AS month,
					product_name,
					AVG(price) AS avg_price,
					COUNT(*) AS record_count
				FROM prices
				WHERE (? IS NULL OR product_name LIKE ?)
				GROUP BY month, product_name
				ORDER BY month DESC, product_name ASC
			`;
			const rows = db.prepare(query).all(searchTerm, searchTerm);
			return res.json({ data: rows, aggregate: 'month' });
		}

		const query = `
			SELECT sale_date, product_name, price
			FROM prices
			WHERE (? IS NULL OR product_name LIKE ?)
			  AND (? IS NULL OR sale_date >= ?)
			  AND (? IS NULL OR sale_date <= ?)
			ORDER BY sale_date DESC
		`;
		const rows = db.prepare(query).all(
			searchTerm,
			searchTerm,
			startDate || null,
			startDate || null,
			endDate || null,
			endDate || null
		);
		return res.json({ data: rows });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

app.delete('/api/prices', function(req, res) {
	try {
		const db = getDb();
		const result = db.prepare('DELETE FROM prices').run();
		return res.json({ deleted: result.changes });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

app.post('/api/sync-prices', async (req, res) => {
	try {
		const data = await syncRicePrices();
		if (!Array.isArray(data) || data.length === 0) {
			return res.status(200).json({ inserted: 0, message: 'No data to insert.' });
		}

		const db = getDb();
		const insert = db.prepare(`
			INSERT INTO prices (sale_date, product_name, price)
			VALUES (?, ?, ?)
			ON CONFLICT(sale_date, product_name) DO UPDATE SET price = excluded.price
		`);

		const toIsoDate = (rocDate) => {
			if (typeof rocDate !== 'string') {
				return null;
			}

			const parts = rocDate.split('.');
			if (parts.length !== 3) {
				return null;
			}

			const year = Number(parts[0]) + 1911;
			const month = String(Number(parts[1])).padStart(2, '0');
			const day = String(Number(parts[2])).padStart(2, '0');
			return `${year}-${month}-${day}`;
		};

		const insertMany = db.transaction(() => {
			let count = 0;
			for (const item of data) {
				const saleDate = toIsoDate(item.pt_date_day);
				const productName = typeof item.name === 'string' ? item.name.trim() : null;
				const price = item.pt_1japt;

				if (!saleDate || !productName || typeof price !== 'number') {
					continue;
				}

				insert.run(saleDate, productName, price);
				count += 1;
			}
			return count;
		});

		const inserted = insertMany();
		return res.json({ inserted });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

app.post('/api/seed-mock-data', async (req, res) => {
    try {
        const db = getDb(); // 確保你有引入 getDb
        const basePrice = 48.5;
        const productName = '稉種白米(模擬數據)';
        
        // 準備插入語法 (ON CONFLICT 防止重複日期報錯)
        const insert = db.prepare(`
            INSERT INTO prices (sale_date, product_name, price)
            VALUES (?, ?, ?)
            ON CONFLICT(sale_date, product_name) DO UPDATE SET price = excluded.price
        `);

        // 使用 Transaction 加速寫入
        const insertMany = db.transaction(() => {
            for (let i = 0; i < 50; i++) {
                // 產生日期：從今天 (2026-05-11) 往回推
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateISO = date.toISOString().split('T')[0];

                // 隨機生成 45.00 ~ 52.00 之間的價格
                const randomPrice = (basePrice + (Math.random() * 6 - 3)).toFixed(2);

                insert.run(dateISO, productName, parseFloat(randomPrice));
            }
        });

        insertMany();

        console.log('✅ 50 筆模擬數據已成功插入');
        res.json({
            success: true,
            message: 'Successfully seeded 50 mock records',
            sample: `2026-05-11: ${basePrice}`
        });
    } catch (err) {
        console.error('❌ 模擬數據寫入失敗:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default app;