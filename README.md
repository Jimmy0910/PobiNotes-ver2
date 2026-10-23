# PobiNotes ver2 - 實體手帳風線上錯題本與學習診斷系統

PobiNotes ver2 是一個結合**實體手帳/活頁筆記本質感（Skeuomorphic Stationery）**與**科學化錯題診斷**的線上系統。採用 **React + Vite + TypeScript** 前端與 **Cloudflare Pages Functions + D1 + R2** 無伺服器架構，支援多維度知識管理、自訂錯因標籤、純程式碼 AI 複習提詞生成與雙模式 PDF 匯出。

---

## 🎨 ver2 核心亮點

1. **實體筆記本手帳體驗**：
   - 登入介面採用精裝皮革筆記本封面（Hardcover Book Cover），具備車縫線壓痕、緞面墨綠書籤織帶與古銅合金護角。
   - 淺色模式全面升級為溫潤柔和的**經典米黃書頁紙張（Warm Cream / Ivory `#FAF6ED`）**與手帳格線，告別冰冷死白的 AI 模板感。
   - 支援深色模式切換，全站文字皆經高對比無障礙調校。

2. **學科 ➔ 章節 ➔ 單元三層樹狀目錄**：
   - 支援即時剪貼新增科目、章節與細部單元，刪除章節時提供「保留錯題」或「連同錯題清除」雙選擇。

3. **獨立錯因標籤設定面板**：
   - 支援設定「全科目通用錯因」、「特定科目專屬錯因」與「特定章節專屬錯因」，並可自由新增、修改與刪除。

4. **錯題診斷儀表板總覽**：
   - 登入後直達儀表板，即時統計各科掌握度、未分類題數、錯因涉及率分布與章節題數。

5. **AI 複習提詞產生器**：
   - 內建學測自然科思考樹最推薦模板，支援純程式碼一鍵複製與匯出。

6. **雙模式 PDF 匯出**：
   - 支援練習卷（僅題目）與解析卷（含完整圖文詳解）高解析度列印。

## 🚀 本地測試步驟 (Localhost Testing)

請依照以下三個步驟，在本地端以 `localhost` 啟動並測試完整功能：

### 步驟 1：初始化本地 D1 資料庫
在專案根目錄下開啟 PowerShell 或終端機，執行以下指令將 SQL 結構表寫入本地 D1 模擬器：
```bash
npx wrangler d1 execute mistake-notebook-db --local --file=./db/schema.sql
```
> 執行此步驟後，Wrangler 會在本地建立 `.wrangler/state/v3/d1` 目錄來儲存資料庫檔案。

### 步驟 2：啟動前端 Vite 開發伺服器
在第一個終端機視窗中，啟動 Vite 前端伺服器（預設運行在 `http://localhost:5173`）：
```bash
npm run dev
```

### 步驟 3：啟動 Wrangler Pages 後端模擬與代理
在第二個終端機視窗中，啟動 Cloudflare Pages 後端 Functions 模擬器，並將前端請求代理至 Vite：
```bash
npx wrangler pages dev --port=8788 --proxy=http://localhost:5173
```
> 此時，Wrangler 會在 `http://localhost:8788` 啟動整合後的伺服器。
> **請在瀏覽器中直接開啟 `http://localhost:8788` 來進行測試！**

---

## 🎨 功能亮點與架構

1. **使用者註冊與登入**：採用 Web Crypto API (PBKDF2/SHA-256) 進行密碼雜湊，搭配 JWT Cookie 進行身分驗證，無須任何第三方 NPM 密碼庫。
2. **動態模板編輯器**：支援分別為「題目區」與「答案解析區」獨立設計欄位（文字、多行、選項、圖片），以 JSON 格式儲存在 D1 中。
3. **客戶端圖片壓縮**：上傳圖片時會自動透過 Canvas 等比例壓縮（寬度上限 1200px、品質 0.8），節省上傳時間並減少 R2 空間佔用。
4. **雙模式 PDF 匯出**：
   - **練習卷模式**：隱藏答案與解析，僅生成題目及作答區，方便重新練習。
   - **解析卷模式**：顯示所有欄位與詳細圖文解析，供複習對答案。
   - 利用瀏覽器原生列印 (`window.print()`) 將網頁渲染為精美的 A4 頁面，不佔用任何 Worker CPU 額度。

---

## ☁️ 部署到 Cloudflare (Cloudflare Production Deployment)

當您在本地測試滿意後，可以透過以下步驟免費部署至雲端：

### 1. 建立雲端 D1 資料庫與 R2 儲存桶
登入您的 Cloudflare 控制台，前往以下頁面建立資源：
- **D1 資料庫**：建立一個名為 `mistake-notebook-db` 的資料庫，並複製其 `database_id`。
- **R2 儲存桶**：建立一個名為 `mistake-notebook-bucket` 的儲存桶。

### 2. 更新資料庫 id
將 `wrangler.json` 中的 `database_id` 替換成您剛剛建立的雲端 D1 資料庫 ID：
```json
{
  "database_id": "您雲端的-D1-database-id"
}
```

### 3. 在 Cloudflare 執行雲端資料庫初始化
執行以下指令將結構表建立在雲端的 D1 資料庫中：
```bash
npx wrangler d1 execute mistake-notebook-db --remote --file=./db/schema.sql
```

### 4. 部署專案至 Cloudflare Pages
在 Cloudflare 控制台 -> **Workers & Pages** -> **Create an application** -> **Pages** 中，連結您的 GitHub 專案：
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **環境變數 (Environment Variables)**：在 Pages 設定中，新增變數 `JWT_SECRET`，填入您自訂的隨機安全金鑰字串。
- **綁定設定 (Bindings)**：在 Pages 的 **Settings -> Functions** 中，新增以下兩個 Bindings：
  1. **D1 database binding**: 綁定名稱為 `DB`，選擇您的 `mistake-notebook-db`。
  2. **R2 bucket binding**: 綁定名稱為 `BUCKET`，選擇您的 `mistake-notebook-bucket`。

重新觸發部署後，您的線上錯題本網站便已成功上線！
