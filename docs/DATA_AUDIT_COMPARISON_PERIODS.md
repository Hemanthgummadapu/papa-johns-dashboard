# DATA AUDIT: Comparison Periods

**Audit date:** 2026-02-28  
**Reference date used in examples:** Today = **02/28/2026** (Saturday)

---

## 1. CURRENT PERIOD — What is queried?

### 1.1 Source of the date/period

- **Dashboard** (`app/dashboard/page.tsx`):
  - Initial state: `cubeDate` = `getYesterdayDate()`, `cubePeriod` = `'daily'`.
  - When user switches period (Day / Week / Month / Year), the date is set as follows:

```2826:2831:app/dashboard/page.tsx
                          onClick={() => {
                            const newDate = p === 'daily' ? getYesterdayDate() : p === 'weekly' ? getDefaultWeek() : p === 'monthly' ? getDefaultMonth() : '2025'
                            setCubePeriod(p)
                            setCubeDate(newDate)
                            void loadCubeData(newDate, p)
```

- So:
  - **Day:** `getYesterdayDate()` → `2026-02-27`
  - **Week:** `getDefaultWeek()` → see below
  - **Month:** `getDefaultMonth()` → `2026-02`
  - **Year:** **Hardcoded `'2025'`** (not current year; see Known Issues)

### 1.2 How “default week” is calculated

Used for **Week** view and in ComparisonPanel / SingleStoreDateCompare:

```880:886:app/dashboard/page.tsx
function getDefaultWeek(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const w = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`
}
```

- Moves `d` to the **Thursday** of the current week, then computes week number from Jan 1 of that year. This is **ISO week** (week containing Thursday).
- **Example (today = 2026-02-28):** Thursday of that week = 2026-02-26 → week 9 → **`2026-W09`**.

### 1.3 What gets sent to the cube API

- `formatDateForApi` normalizes the date string before calling the API:

```928:937:app/dashboard/page.tsx
function formatDateForApi(dateStr: string, period: CubePeriod): string {
  if (period === 'yearly') return /^\d{4}$/.test(dateStr) ? dateStr : String(new Date().getFullYear())
  if (period === 'monthly') return /^\d{4}-\d{2}$/.test(dateStr) ? dateStr : new Date().toISOString().slice(0, 7)
  if (period === 'weekly') {
    const m = dateStr.match(/^(\d{4})-W(\d{1,2})$/)
    if (m) return `${m[1]}-W${m[2].padStart(2, '0')}`
    return getDefaultWeek()
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getYesterdayDate()
}
```

- So for **Week** with cubeDate `2026-W09`, the API receives `date=2026-W09` and `period=weekly`.

### 1.4 MDX WHERE clause (cube route)

```19:32:app/api/cube/route.ts
  let whereClause = ''
  if (period === 'daily') {
    whereClause = `[Calendar].[Calendar Date].&[${date}]`
  } else if (period === 'monthly') {
    const [year, month] = date.split('-')
    whereClause = `[Calendar].[Calendar Year Month].&[Y${year} M${month}]`
  } else if (period === 'weekly') {
    const weekNum = date.split('-W')[1] || date
    const year = date.split('-')[0]
    whereClause = `([Calendar].[Fiscal Year].&[${year}],[Calendar].[Fiscal Week].&[${weekNum}])`
  } else if (period === 'yearly') {
    whereClause = `[Calendar].[Fiscal Year].&[${date}]`
  } else {
    whereClause = `[Calendar].[Calendar Date].&[${date}]`
  }
```

**Summary — current period:**

| View  | Example (today 02/28/2026) | Date sent to API   | MDX WHERE clause |
|-------|-----------------------------|--------------------|------------------|
| Day   | 2026-02-27                  | `2026-02-27`       | `[Calendar].[Calendar Date].&[2026-02-27]` |
| Week  | 2026-W09                    | `2026-W09`         | `([Calendar].[Fiscal Year].&[2026],[Calendar].[Fiscal Week].&[09])` |
| Month | 2026-02                     | `2026-02`          | `[Calendar].[Calendar Year Month].&[Y2026 M02]` |
| Year  | 2025 (hardcoded)            | `2025`             | `[Calendar].[Fiscal Year].&[2025]` |

**Risk:** Week view uses **ISO week number** (from JavaScript) but the cube uses **Fiscal Year** and **Fiscal Week**. If Papa Johns fiscal week ≠ ISO week, Week view will be wrong.

---

## 2. LAST YEAR SAME PERIOD

### 2.1 How “last year” is calculated

**SingleStoreDateCompare** (`getLastYearDate`):

```139:158:components/SingleStoreDateCompare.tsx
function getLastYearDate(date: string, period: string): string {
  if (period === 'daily') {
    return date.replace(/^(\d{4})/, (y) => String(parseInt(y) - 1))
  }
  if (period === 'monthly') {
    return date.replace(/^(\d{4})/, (y) => String(parseInt(y) - 1))
  }
  if (period === 'yearly') {
    return date.replace(/^(\d{4})/, (y) => String(parseInt(y) - 1))
  }
  if (period === 'weekly') {
    const match = date.match(/^(\d{4})-W(\d+)$/)
    if (match) {
      const year = parseInt(match[1])
      const week = match[2]
      return `${year - 1}-W${week}`
    }
  }
  return date
}
```

- **Daily:** same calendar date, year − 1 → `2025-02-27`.
- **Monthly:** same calendar month, year − 1 → `2025-02`.
- **Yearly:** year − 1 → `2024` (if cubeDate was `2025`).
- **Weekly:** same week number, year − 1 → `2025-W09`.

So LY is **same period last year** (same day / same month / same week number / previous year), not “−365 days”.

**ComparisonPanel** (year mode) uses the same idea:

```189:189:components/ComparisonPanel.tsx
      const lastYearDate = cubeDate.replace(/^(\d{4})/, (y) => String(parseInt(y, 10) - 1))
```

- For weekly `2026-W09`, this only replaces the first 4 digits → `2025-W09` (correct).
- For monthly `2026-02` → `2025-02` (correct).

### 2.2 How LY is fetched

- **SingleStoreDateCompare (“vs Same Period Last Year”):**  
  One extra cube request with `date=lastYearDate` and same `period`:

```244:246:components/SingleStoreDateCompare.tsx
    const lastYearDate = getLastYearDate(cubeDate, cubePeriod)
    fetch(`/api/cube?date=${encodeURIComponent(lastYearDate)}&period=${cubePeriod}`, { cache: 'no-store' })
```

- **ComparisonPanel (year mode, non-monthly):**  
  Two requests — TY and LY:

```303:309:components/ComparisonPanel.tsx
        Promise.all([
          fetch(`/api/cube?date=${encodeURIComponent(cubeDate)}&period=${cubePeriod}`, { cache: 'no-store' })
            ...
          fetch(`/api/cube?date=${encodeURIComponent(lastYearDate)}&period=${cubePeriod}`, { cache: 'no-store' })
```

So LY is always **a second cube query** with the same period and last-year date. The cube returns that period’s **TY** measures (netSales, dddSales, etc.), which are the “last year” values for that period.

**Example (today 02/28/2026, Week view):**

- Current: `date=2026-W09`, `period=weekly` → WHERE `([Calendar].[Fiscal Year].&[2026],[Calendar].[Fiscal Week].&[09])`.
- Last year: `date=2025-W09`, `period=weekly` → WHERE `([Calendar].[Fiscal Year].&[2025],[Calendar].[Fiscal Week].&[09])`.

---

## 3. PREVIOUS PERIOD (vs last week / vs last month)

### 3.1 How “previous” is calculated

**SingleStoreDateCompare** uses local helpers:

```59:68:components/SingleStoreDateCompare.tsx
function getPrevWeek(current: string): string {
  const [y, w] = current.split('-W').map((x, i) => (i === 0 ? parseInt(x, 10) : parseInt(x, 10)))
  if (w <= 1) return `${y - 1}-W52`
  return `${y}-${String(w - 1).padStart(2, '0')}`
}

function getPrevMonth(current: string): string {
  const [y, m] = current.split('-').map(Number)
  if (m <= 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}
```

- **Previous week:** Same year, week − 1; if week 1 → previous year week 52.  
  Example: `2026-W09` → `2026-W08`. So it’s **previous fiscal/ISO week**, not “previous 7 days”.
- **Previous month:** Same year, month − 1; if Jan → Dec of previous year.  
  Example: `2026-02` → `2026-01`.

### 3.2 What gets queried for “vs Previous Week” / “vs Previous Month”

**SingleStoreDateCompare:**

- **vs Previous Week:**  
  - Current: `getDefaultWeek()` → e.g. `2026-W09`, request with `period=weekly`.  
  - Previous: `getPrevWeek(2026-W09)` → `2026-W08`, second request with `period=weekly`.
- **vs Previous Month:**  
  - Current: `getDefaultMonth()` → `2026-02`.  
  - Previous: `getPrevMonth(2026-02)` → `2026-01`.  
  Two requests, both `period=monthly`.

So “previous” is **previous full week** (cube fiscal week) and **previous full month** (calendar month), not rolling 7/30 days.

**ComparisonPanel (week mode):**

- Uses `getDefaultWeek()` and `getPrevWeeks(currentWeek, 8)` to get the last 8 weeks, then splits into “previous 4” and “recent 4” and fetches **each week** via cube with `period=weekly`:

```414:422:components/ComparisonPanel.tsx
      const currentWeek = getDefaultWeek()
      const allWeeks = getPrevWeeks(currentWeek, 8)
      ...
      Promise.all(
        allWeeks.map((w) =>
          fetch(`/api/cube?date=${encodeURIComponent(w)}&period=weekly`, { cache: 'no-store' })
```

**ComparisonPanel (month mode):**

- Uses `getDefaultMonth()` and `getPrevMonths(currentMonth, 6)`, then “previous 3 months” vs “recent 3 months”, each month one cube request with `period=monthly`.

**MDX:** Same as in §1.4: weekly uses Fiscal Year + Fiscal Week; monthly uses Calendar Year Month. No separate “previous period” WHERE; previous period is a separate request with the previous week/month date.

---

## 4. COMP % CALCULATION

### 4.1 Where it’s calculated

- **Dashboard (main cube data):** In the backend mapping inside `fetchCubeData` (and in the effect that builds reports from `cubeData`), comp % is derived on the **frontend** from cube fields:

```961:964:app/dashboard/page.tsx
        const lyNetSales = s.lyNetSales ?? 0
        const compPct = lyNetSales ? ((netSales - lyNetSales) / lyNetSales * 100) : undefined
        ...
          comp_pct: compPct != null ? Number(compPct.toFixed(1)) : undefined,
```

- So comp % is **computed in the frontend** from cube response fields, but the **inputs** (netSales, lyNetSales) come from the **cube** in a **single** request for the selected period.

### 4.2 Formula

- `comp_pct = (TY Net Sales − LY Net Sales) / LY Net Sales * 100`.
- Same as `(netSales - lyNetSales) / lyNetSales * 100`.  
- If `lyNetSales` is 0 or null, `comp_pct` is left undefined.

### 4.3 What provides LY for comp %

- **Dashboard store cards / main view:**  
  One cube query for the current period. The cube returns both [TY Net Sales USD] and [LY Net Sales USD] in that same query. So **LY for comp % comes from the cube’s LY measures** in that single request, not from a separate LY query.

- **ComparisonPanel “year” mode and SingleStoreDateCompare “vs Same Period Last Year”:**  
  They do **not** use the cube’s LY measures for the comparison. They run **two** queries (current period + last year period) and use each response’s **TY** values as “current” and “last year” respectively. So for those UIs, LY is “re-query with last year’s date,” not [LY Net Sales USD] from the first query.

---

## 5. MEASURES USED FOR EACH PERIOD

### 5.1 Single-query response (dashboard main view)

The cube is called once per period. The MDX requests both TY and LY measures:

```37:53:app/api/cube/route.ts
  const mdx = `SELECT {
  [Measures].[TY Net Sales USD],
  [Measures].[LY Net Sales USD],
  ...
  [Measures].[TY Aggregator Delivery Net Sales USD],
  [Measures].[LY Aggregator Delivery Net Sales USD],
  ...
} ON COLUMNS, ...
```

Result mapping:

- `netSales` ← TY Net Sales USD  
- `lyNetSales` ← LY Net Sales USD  
- `aggregatorSales` ← TY Aggregator Delivery Net Sales USD  
- `lyAggregatorSales` ← LY Aggregator Delivery Net Sales USD  

So for the **dashboard’s main cards and comp %**, LY Net Sales and LY Aggregator come from **cube’s LY measures** in that single query.

### 5.2 Two-query flows (ComparisonPanel year, SingleStoreDateCompare last year)

- **TY:** Request with `cubeDate` (e.g. `2026-W09`). Use `netSales`, `dddSales`, `aggregatorSales` (all TY measures).
- **LY:** Request with `lastYearDate` (e.g. `2025-W09`). Use the **same** fields from that response (`netSales`, `dddSales`, `aggregatorSales`), which are TY for that (last year) period — i.e. “last year’s” values.

So in those flows we **do not** use the cube’s [LY Net Sales USD] or [LY Aggregator Delivery Net Sales USD]; we use a **separate LY query** and that query’s TY measures. That is correct for “same period last year” comparison.

---

## 6. KNOWN ISSUES / RISKS

### 6.1 Hardcoded dates

- **Year view default:** Clicking “Year” sets `cubeDate` to **`'2025'`**:

```2827:2827:app/dashboard/page.tsx
                            const newDate = p === 'daily' ? getYesterdayDate() : p === 'weekly' ? getDefaultWeek() : p === 'monthly' ? getDefaultMonth() : '2025'
```

- So in 2026 the default year is still 2025. It should likely be `String(new Date().getFullYear())` (e.g. `'2026'`).

### 6.2 Fiscal vs calendar mismatch (Week)

- **Default week** is computed with **ISO week** (week containing Thursday, Jan 1-based).
- **Cube** filters by `[Calendar].[Fiscal Year]` and `[Calendar].[Fiscal Week]`.
- If Papa Johns’ fiscal week definition differs from ISO (e.g. different start day or year boundary), then “Week” view and “vs Previous Week” / “vs Last Year” for week will point to the **wrong** fiscal period. This can affect both dashboard and ComparisonPanel / SingleStoreDateCompare.

### 6.3 lib/comparison.ts “year” mode with CSV/demo data

When **cube is not used** and `getComparisonData(..., periodMode: 'year')` runs on CSV/demo reports:

```111:114:lib/comparison.ts
    } else {
      // year: compare current period value vs same index last year (use projected as proxy if no data)
      previous = current * (0.9 + Math.random() * 0.2)
    }
```

- LY is **fake**: 90–110% of current with random factor. So in demo/CSV mode, year-over-year is **not** real LY data.

### 6.4 getDateComparisonData “lastYear” (lib/comparison.ts)

When mode is `'lastYear'` and data is from reports (not cube):

```184:196:lib/comparison.ts
    // lastYear: use projected as proxy
    previous = {
      ...current,
      net_sales: current.net_sales * 0.95,
      ...
      doordash_sales: (current.doordash_sales ?? 0) * 0.9,
      ubereats_sales: (current.ubereats_sales ?? 0) * 0.9,
    }
```

- Again, “last year” is **synthetic** (e.g. 95% of current net sales, 90% of delivery). So any UI that uses `getDateComparisonData` with `lastYear` on non-cube data will show fake LY.

### 6.5 LY data could be null/0

- If the cube has no data for the LY period (e.g. store didn’t exist, or cube not loaded for that period), the LY response may have empty or null cells. The code uses `?? 0` and `?? null` in mapping; comp % then uses `lyNetSales ? ... : undefined`, so comp % is omitted when LY is 0. Division by zero is avoided, but the card may show no comp % or 0 for LY.

### 6.6 Week number format (cube route)

- Weekly date from the client is like `2026-W09`. The route does:

  `const weekNum = date.split('-W')[1] || date`

- So for `2026-W9` (no leading zero) we’d send `9`. The cube may expect two-digit week (e.g. `09`). `formatDateForApi` pads: `m[2].padStart(2, '0')`, so when the dashboard sends the date it’s normalized. SingleStoreDateCompare and ComparisonPanel build `currentWeek` / `currWeek` with `getDefaultWeek()` which already pads. So week is consistently two-digit in normal flows; only if something passed `2026-W9` without going through `formatDateForApi` could the cube get a single-digit week.

---

## Summary table (example: today = 02/28/2026)

| View  | Current period query      | LY / previous logic                          | Comp % source (main dashboard)      |
|-------|---------------------------|----------------------------------------------|-------------------------------------|
| Day   | `2026-02-27` (calendar)  | LY: `2025-02-27` (second query)               | Cube LY measure in single query     |
| Week  | `2026-W09` (fiscal)       | Prev week: `2026-W08`; LY: `2025-W09`        | Cube LY measure in single query     |
| Month | `2026-02` (calendar)      | Prev month: `2026-01`; LY: `2025-02`        | Cube LY measure in single query     |
| Year  | `2025` (hardcoded)        | LY: `2024` (second query)                    | N/A (year view uses 2 queries)      |

**Files touched:**

- `app/api/cube/route.ts` — MDX WHERE and measure list.
- `app/dashboard/page.tsx` — Default dates, period switching, formatDateForApi, fetchCubeData, comp_pct from lyNetSales.
- `components/SingleStoreDateCompare.tsx` — getLastYearDate, getPrevWeek/Month, LY and prev fetches.
- `components/ComparisonPanel.tsx` — getDefaultWeek/Month, getPrevWeeks/Months, TY vs LY and vs previous week/month fetches.
- `lib/comparison.ts` — getPctChange formula, getComparisonData (week/month/year on reports), getDateComparisonData (lastYear proxy).
