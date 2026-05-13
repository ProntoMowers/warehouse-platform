const { bigqueryAll, mysqlAll, sqlserverAll } = require('./database.service');

const LOCATION = Number(process.env.PRONTO_LOCATION_ID || 4);
const SALESREP = process.env.PRONTO_SALESREP || 'INTERNET';
const SHIPPING_PARTS = new Set(['SHIP', 'SHIP10', 'SHIP20', 'SHIPSUP']);

let bqStoreCache = {};
let bqStoreCacheTime = 0;
const BQ_STORE_CACHE_TTL = 60 * 60 * 1000;

const BQ_STORES_SQL = `
SELECT
    CAST(Customer_ID AS STRING) AS cid,
    STORE,
    Domain
FROM \`bigcommerce-analitics.GENERAL.stores\`
WHERE Customer_ID IS NOT NULL
`;

async function getStoreMapFromBq() {
  if (Object.keys(bqStoreCache).length && Date.now() - bqStoreCacheTime < BQ_STORE_CACHE_TTL) {
    return bqStoreCache;
  }

  try {
    const rows = await bigqueryAll(BQ_STORES_SQL);
    const result = {};
    for (const row of rows) {
      const cid = String(row.cid || '').trim();
      const store = String(row.STORE || '').trim();
      const domain = String(row.Domain || '').trim();
      if (cid) {
        result[cid] = domain || store || cid;
      }
    }
    bqStoreCache = result;
    bqStoreCacheTime = Date.now();
    return result;
  } catch (error) {
    return {};
  }
}

function cleanRef(raw) {
  let value = String(raw || '').trim();
  value = value.replace(/-RN$/i, '');
  for (const prefix of ['E-815-', 'E-820-', 'E-810-', 'E-800-', 'E-']) {
    if (value.toUpperCase().startsWith(prefix.toUpperCase())) {
      return value.slice(prefix.length).trim();
    }
  }
  return value;
}

function extractStore(ref) {
  const match = String(ref || '').trim().match(/^[Ee]-(\d+)-/);
  return match ? match[1] : 'OTROS';
}

const PRONTO_ORDERS_SQL = `
SELECT
    si.ARTRANSID,
    si.SALESORDERID,
    si.TRANSDATE,
    si.ORDERDATE,
    si.CUSTOMERID,
    si.CUSTOMERNAME,
    si.REFERENCE,
    si.SALESREP,
    COALESCE(SUM(sid.NETAMOUNT), 0) AS total_sale,
    COALESCE(SUM(ABS(sid.ICCOSTAMOUNT)), 0) AS total_cost,
    COUNT(sid.ITEMID) AS line_count
FROM salesinvoice si
JOIN salesinvoicedetail sid ON sid.ARTRANSID = si.ARTRANSID
WHERE si.LOCATIONID = ?
  AND UPPER(TRIM(si.SALESREP)) = ?
  AND sid.SHIPPEDQUANTITY > 0
  AND si.TRANSDATE BETWEEN ? AND ?
GROUP BY
    si.ARTRANSID, si.SALESORDERID, si.TRANSDATE, si.ORDERDATE,
    si.CUSTOMERID, si.CUSTOMERNAME, si.REFERENCE, si.SALESREP
ORDER BY si.TRANSDATE DESC, si.ARTRANSID DESC
`;

async function getOrders(dateFrom, dateTo) {
  return mysqlAll(PRONTO_ORDERS_SQL, [LOCATION, SALESREP, dateFrom, dateTo]);
}

const PRONTO_LINES_SQL = `
SELECT
    sid.ITEMID,
    sid.MFRID AS brand,
    sid.PARTNUMBER AS sku,
    sid.DESCRIPTION,
    sid.SHIPPEDQUANTITY AS qty,
    sid.PRICE AS unit_price,
    sid.NET AS unit_net,
    sid.NETAMOUNT AS line_sale,
    ABS(sid.ICCOSTAMOUNT) AS line_cost
FROM salesinvoicedetail sid
WHERE sid.ARTRANSID = ?
  AND sid.SHIPPEDQUANTITY > 0
ORDER BY sid.ITEMID
`;

async function getOrderLines(artransid) {
  const rows = await mysqlAll(PRONTO_LINES_SQL, [artransid]);
  return rows.map((row) => {
    const sale = Number(row.line_sale || 0);
    const cost = Number(row.line_cost || 0);
    const profit = sale - cost;
    return {
      ...row,
      line_profit: round(profit),
      line_margin: round(sale ? (profit / sale) * 100 : 0),
      line_sale: round(sale),
      line_cost: round(cost)
    };
  });
}

const PRONTO_SKU_LINES_SQL = `
SELECT
    si.ARTRANSID,
    si.SALESORDERID,
    si.TRANSDATE,
    si.ORDERDATE,
    si.CUSTOMERID,
    si.CUSTOMERNAME,
    si.REFERENCE,
    UPPER(TRIM(COALESCE(sid.MFRID, ''))) AS mfr,
    UPPER(TRIM(COALESCE(sid.PARTNUMBER, ''))) AS sku,
    MAX(COALESCE(sid.DESCRIPTION, '')) AS DESCRIPTION,
    SUM(COALESCE(sid.SHIPPEDQUANTITY, 0)) AS qty,
    SUM(COALESCE(sid.NETAMOUNT, 0)) AS line_sale,
    SUM(ABS(COALESCE(sid.ICCOSTAMOUNT, 0))) AS line_cost
FROM salesinvoice si
JOIN salesinvoicedetail sid ON sid.ARTRANSID = si.ARTRANSID
WHERE si.LOCATIONID = ?
  AND UPPER(TRIM(si.SALESREP)) = ?
  AND si.TRANSDATE BETWEEN ? AND ?
  AND sid.SHIPPEDQUANTITY > 0
  AND UPPER(TRIM(COALESCE(sid.PARTNUMBER, ''))) NOT IN ('SHIP','SHIP10','SHIP20','SHIPSUP')
GROUP BY
    si.ARTRANSID, si.SALESORDERID, si.TRANSDATE, si.ORDERDATE,
    si.CUSTOMERID, si.CUSTOMERNAME, si.REFERENCE, mfr, sku
ORDER BY si.TRANSDATE DESC, si.ARTRANSID DESC, mfr, sku
`;

async function getSkuLines(dateFrom, dateTo) {
  try {
    const rows = await mysqlAll(PRONTO_SKU_LINES_SQL, [LOCATION, SALESREP, dateFrom, dateTo]);
    return rows.map((row) => {
      const sale = Number(row.line_sale || 0);
      const cost = Number(row.line_cost || 0);
      const profit = sale - cost;
      return {
        ...row,
        qty: round(Number(row.qty || 0), 4),
        line_sale: round(sale),
        line_cost: round(cost),
        line_profit: round(profit),
        line_margin: round(sale ? (profit / sale) * 100 : 0)
      };
    });
  } catch (error) {
    return [];
  }
}

const PRONTO_SHIPPING_CHARGES_SQL = `
SELECT
    si.ARTRANSID,
    COALESCE(SUM(sid.NET), 0) AS shipping_charged
FROM salesinvoice si
JOIN salesinvoicedetail sid ON sid.ARTRANSID = si.ARTRANSID
WHERE si.LOCATIONID = ?
  AND UPPER(TRIM(si.SALESREP)) = ?
  AND si.TRANSDATE BETWEEN ? AND ?
  AND UPPER(TRIM(COALESCE(sid.PARTNUMBER, ''))) IN ('SHIP','SHIP10','SHIP20','SHIPSUP')
GROUP BY si.ARTRANSID
`;

async function getProntoShippingCharges(dateFrom, dateTo) {
  try {
    const rows = await mysqlAll(PRONTO_SHIPPING_CHARGES_SQL, [LOCATION, SALESREP, dateFrom, dateTo]);
    return Object.fromEntries(
      rows
        .map((row) => [String(row.ARTRANSID || '').trim(), round(Number(row.shipping_charged || 0))])
        .filter(([key]) => key)
    );
  } catch (error) {
    return {};
  }
}

const PRONTO_ORDER_PARTS_SQL = `
SELECT
    si.ARTRANSID,
    UPPER(TRIM(COALESCE(sid.MFRID, ''))) AS mfr,
    UPPER(TRIM(COALESCE(sid.PARTNUMBER, ''))) AS sku,
    SUM(COALESCE(sid.SHIPPEDQUANTITY, 0)) AS qty
FROM salesinvoice si
JOIN salesinvoicedetail sid ON sid.ARTRANSID = si.ARTRANSID
WHERE si.LOCATIONID = ?
  AND UPPER(TRIM(si.SALESREP)) = ?
  AND si.TRANSDATE BETWEEN ? AND ?
  AND sid.SHIPPEDQUANTITY > 0
  AND UPPER(TRIM(COALESCE(sid.PARTNUMBER, ''))) NOT IN ('SHIP','SHIP10','SHIP20','SHIPSUP')
GROUP BY si.ARTRANSID, mfr, sku
ORDER BY si.ARTRANSID, mfr, sku
`;

function qtyKey(value) {
  const qty = Number(value || 0);
  return qty.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') || '0';
}

async function getOrderPartSignatures(dateFrom, dateTo) {
  let rows = [];
  try {
    rows = await mysqlAll(PRONTO_ORDER_PARTS_SQL, [LOCATION, SALESREP, dateFrom, dateTo]);
  } catch (error) {
    return {};
  }

  const grouped = new Map();
  for (const row of rows) {
    const key = String(row.ARTRANSID || '').trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const result = {};
  for (const [artransid, parts] of grouped.entries()) {
    const cleanParts = parts
      .map((part) => ({
        mfr: String(part.mfr || '').trim(),
        sku: String(part.sku || '').trim(),
        qty: qtyKey(part.qty)
      }))
      .filter((part) => part.sku)
      .sort((a, b) => `${a.mfr}|${a.sku}|${a.qty}`.localeCompare(`${b.mfr}|${b.sku}|${b.qty}`));

    const distinctSkus = new Set(cleanParts.map((part) => part.sku));
    result[artransid] = {
      part_signature: cleanParts.map((part) => `${part.mfr}|${part.sku}|${part.qty}`).join('||'),
      sku_count: distinctSkus.size,
      part_line_count: cleanParts.length,
      sku_mix: distinctSkus.size === 1 ? 'SKU unico' : 'Multiple',
      parts_label: cleanParts.slice(0, 4).map((part) => `${part.sku} x${part.qty}`).join(', '),
      parts_export_sku: cleanParts.map((part) => `${part.sku} x${part.qty}`).join(', '),
      parts_export_mfr: [...new Set(cleanParts.map((part) => part.mfr).filter(Boolean))].sort().join(', ')
    };
  }
  return result;
}

const SW_SHIPMENTS_SQL = `
SELECT
    p.[OrderNumberComplete],
    s.[ShipmentID],
    CAST(s.[ShipmentCost] AS FLOAT) AS ShipmentCost,
    p.[ReturnShipment] AS IsReturn,
    s.[ShipDate],
    o.[StoreID],
    st.[StoreName]
FROM [Shipment] s
JOIN [ProcessedShipmentsView] p ON p.[ShipmentID] = s.[ShipmentID]
LEFT JOIN [Order] o ON o.[OrderID] = p.[OrderID]
LEFT JOIN [Store] st ON st.[StoreID] = o.[StoreID]
WHERE s.[ShipDate] >= ? AND s.[ShipDate] < DATEADD(day,1,?)
  AND s.[ShipmentCost] IS NOT NULL
  AND s.[ShipmentCost] > 0
  AND (s.[Voided] IS NULL OR s.[Voided] = 0)
ORDER BY p.[OrderNumberComplete], s.[ShipmentID]
`;

async function getShipments(dateFrom, dateTo) {
  try {
    const rows = await sqlserverAll(SW_SHIPMENTS_SQL, [dateFrom, dateTo]);
    const result = {};
    for (const row of rows) {
      const key = String(row.OrderNumberComplete || '').trim();
      if (!result[key]) result[key] = [];
      result[key].push({
        shipment_id: row.ShipmentID,
        cost: round(Number(row.ShipmentCost || 0)),
        is_return: Boolean(row.IsReturn),
        ship_date: row.ShipDate,
        store_id: row.StoreID,
        store_name: String(row.StoreName || '').trim()
      });
    }
    return result;
  } catch (error) {
    return {};
  }
}

const SW_SHIPPING_CHARGES_SQL = `
WITH shipped_orders AS (
    SELECT DISTINCT
        p.[OrderID],
        p.[OrderNumberComplete]
    FROM [Shipment] s
    JOIN [ProcessedShipmentsView] p ON p.[ShipmentID] = s.[ShipmentID]
    WHERE s.[ShipDate] >= ? AND s.[ShipDate] < DATEADD(day,1,?)
      AND (s.[Voided] IS NULL OR s.[Voided] = 0)
),
charges AS (
    SELECT
        [OrderID],
        SUM(CAST([Amount] AS FLOAT)) AS shipping_charged
    FROM [OrderCharge]
    WHERE UPPER([Type]) = 'SHIPPING'
    GROUP BY [OrderID]
)
SELECT
    so.[OrderNumberComplete],
    COALESCE(c.[shipping_charged], 0) AS shipping_charged
FROM shipped_orders so
LEFT JOIN charges c ON c.[OrderID] = so.[OrderID]
`;

async function getShipworksShippingCharges(dateFrom, dateTo) {
  try {
    const rows = await sqlserverAll(SW_SHIPPING_CHARGES_SQL, [dateFrom, dateTo]);
    return Object.fromEntries(
      rows
        .map((row) => [String(row.OrderNumberComplete || '').trim(), round(Number(row.shipping_charged || 0))])
        .filter(([key]) => key)
    );
  } catch (error) {
    return {};
  }
}

async function getShipmentsForOrder(orderNumberComplete) {
  const sql = `
    SELECT
        s.[ShipmentID],
        CAST(s.[ShipmentCost] AS FLOAT) AS ShipmentCost,
        p.[ReturnShipment] AS IsReturn,
        s.[ShipDate],
        s.[ShipmentType]
    FROM [Shipment] s
    JOIN [ProcessedShipmentsView] p ON p.[ShipmentID] = s.[ShipmentID]
    WHERE p.[OrderNumberComplete] = ?
      AND (s.[Voided] IS NULL OR s.[Voided] = 0)
    ORDER BY s.[ShipmentID]
  `;

  try {
    const rows = await sqlserverAll(sql, [orderNumberComplete]);
    return rows.map((row) => {
      const isReturn = Boolean(row.IsReturn);
      return {
        shipment_id: row.ShipmentID,
        cost: round(Number(row.ShipmentCost || 0)),
        is_return: isReturn,
        label: isReturn ? 'Return Label' : 'Shipping',
        description: `${isReturn ? 'Return' : 'Outbound'} - ShipmentID ${row.ShipmentID}`,
        ship_date: row.ShipDate
      };
    });
  } catch (error) {
    return [];
  }
}

const SW_STATE_SQL = `
SELECT DISTINCT
    p.[OrderNumberComplete],
    s.[ShipStateProvCode] AS ship_state
FROM [Shipment] s
JOIN [ProcessedShipmentsView] p ON p.[ShipmentID] = s.[ShipmentID]
WHERE s.[ShipDate] >= ? AND s.[ShipDate] < DATEADD(day,1,?)
  AND (s.[Voided] IS NULL OR s.[Voided] = 0)
  AND p.[ReturnShipment] = 0
  AND s.[ShipStateProvCode] IS NOT NULL
  AND s.[ShipStateProvCode] != ''
`;

async function getShipmentsWithState(dateFrom, dateTo) {
  try {
    const rows = await sqlserverAll(SW_STATE_SQL, [dateFrom, dateTo]);
    return Object.fromEntries(
      rows.map((row) => [
        String(row.OrderNumberComplete || '').trim(),
        String(row.ship_state || '').toUpperCase().trim()
      ])
    );
  } catch (error) {
    return {};
  }
}

async function shippingChargeMaps(dateFrom, dateTo) {
  const [swCharges, prontoCharges] = await Promise.all([
    getShipworksShippingCharges(dateFrom, dateTo),
    getProntoShippingCharges(dateFrom, dateTo)
  ]);
  return { swCharges, prontoCharges };
}

function mergeOrdersShipping(orders, swMap, storeMap = {}, shippingChargeMap = {}, prontoShippingChargeMap = {}) {
  return orders.map((invoice) => {
    const ref = String(invoice.REFERENCE || '').trim();
    const clean = cleanRef(ref);
    const entries = swMap[clean] || [];
    const outbound = entries.filter((entry) => !entry.is_return);
    const returns = entries.filter((entry) => entry.is_return);

    const totalOut = round(outbound.reduce((sum, entry) => sum + Number(entry.cost || 0), 0));
    const totalRet = round(returns.reduce((sum, entry) => sum + Number(entry.cost || 0), 0));
    const totalAll = round(totalOut + totalRet);

    const sale = Number(invoice.total_sale || 0);
    const cost = Number(invoice.total_cost || 0);
    const grossProfit = round(sale - cost);
    const grossMargin = round(sale ? (grossProfit / sale) * 100 : 0);
    const finalProfit = round(grossProfit - totalAll);
    const finalMargin = round(sale ? (finalProfit / sale) * 100 : 0);
    const shippingPct = round(sale ? (totalAll / sale) * 100 : 0);

    const swChargeKnown = Object.prototype.hasOwnProperty.call(shippingChargeMap, clean);
    const prontoKey = String(invoice.ARTRANSID || '').trim();
    const prontoChargeKnown = Object.prototype.hasOwnProperty.call(prontoShippingChargeMap, prontoKey);
    const swCharge = Number(shippingChargeMap[clean] || 0);
    const prontoCharge = Number(prontoShippingChargeMap[prontoKey] || 0);

    let shippingCharged = 0;
    let shippingChargeSource = '';
    if (swChargeKnown && swCharge) {
      shippingCharged = swCharge;
      shippingChargeSource = 'ShipWorks';
    } else if (prontoChargeKnown && prontoCharge) {
      shippingCharged = prontoCharge;
      shippingChargeSource = 'Pronto';
    } else if (swChargeKnown) {
      shippingCharged = swCharge;
      shippingChargeSource = 'ShipWorks';
    } else {
      shippingCharged = prontoCharge;
      shippingChargeSource = prontoChargeKnown ? 'Pronto' : '';
    }

    const shippingProfit = round(shippingCharged - totalAll);
    const shippingMargin = round(shippingCharged ? (shippingProfit / shippingCharged) * 100 : 0);

    const prontoStoreId = extractStore(ref);
    const prontoStoreName = storeMap[prontoStoreId] || prontoStoreId;
    const storeEntry = outbound.find((entry) => entry.store_name) || entries.find((entry) => entry.store_name);
    const swStoreId = storeEntry ? storeEntry.store_id : null;
    const swStoreName = storeEntry ? String(storeEntry.store_name || '').trim() : '';
    const storeName = swStoreName || prontoStoreName;

    return {
      ...invoice,
      sw_matched: entries.length > 0,
      sw_order_num: clean,
      store: storeName,
      store_id: swStoreId || prontoStoreId,
      sw_store: swStoreName,
      sw_store_id: swStoreId,
      pronto_store: prontoStoreName,
      pronto_store_id: prontoStoreId,
      total_sale: round(sale),
      total_cost: round(cost),
      gross_profit: grossProfit,
      gross_margin: grossMargin,
      total_shipping_out: totalOut,
      total_shipping_ret: totalRet,
      total_shipping: totalAll,
      shipping_pct: shippingPct,
      shipping_charged: round(shippingCharged),
      shipping_charge_source: shippingChargeSource,
      shipping_profit: shippingProfit,
      shipping_margin: shippingMargin,
      final_profit: finalProfit,
      final_margin: finalMargin,
      label_count: outbound.length,
      return_label_count: returns.length
    };
  });
}

function recommendedShippingPrice(avgCost, fallbackRate = 0) {
  const cost = Number(avgCost || 0);
  if (cost <= 0) return round(Number(fallbackRate || 0));
  const target = cost * 1.05;
  const base = 0.45;
  const step = 0.5;
  const increments = Math.max(0, Math.ceil((target - base) / step));
  return round(base + increments * step);
}

const PRICE_TIERS = [
  [0.01, 10.0, 6.45],
  [10.01, 20.0, 7.2],
  [20.01, 30.0, 8.7],
  [30.01, 40.0, 9.7],
  [40.01, 50.0, 10.7],
  [50.01, 60.0, 10.95],
  [60.01, 70.0, 11.95],
  [70.01, 80.0, 12.95],
  [80.01, 90.0, 12.95],
  [90.01, 200.0, 13.95],
  [200.01, 300.0, 16.45],
  [300.01, 400.0, 19.45],
  [400.01, Infinity, 19.45]
];

function priceTierForSale(totalSale) {
  const sale = Number(totalSale || 0);
  for (const [lo, hi, rate] of PRICE_TIERS) {
    if (sale >= lo && sale <= hi) {
      const label = hi !== Infinity ? `$${lo.toFixed(2)} - $${hi.toFixed(2)}` : `Mas de $${(lo - 0.01).toFixed(2)}`;
      return { lo, hi, rate, label };
    }
  }
  return null;
}

function analyzeShipping(ordersMerged, rules, swStateDict = {}) {
  const rulesAnalysis = rules.map((rule) => {
    const min = Number(rule.min_order || 0);
    const max = Number(rule.max_order || 999999);
    const shipCharge = Number(rule.shipping_actual || 0);
    const inRange = ordersMerged.filter((order) => {
      const sale = Number(order.total_sale || 0);
      return sale >= min && sale <= max;
    });
    const count = inRange.length;
    const totalSw = inRange.reduce((sum, order) => sum + Number(order.total_shipping || 0), 0);
    const avgSw = count ? round(totalSw / count) : 0;
    const suggestedRate = recommendedShippingPrice(avgSw, shipCharge);
    return {
      ...rule,
      order_count: count,
      avg_sw_shipping: avgSw,
      total_sw_shipping: round(totalSw),
      avg_charged: shipCharge,
      recommended_rate: suggestedRate,
      recommended_delta: round(suggestedRate - shipCharge),
      recommended_impact: round((suggestedRate - shipCharge) * count),
      gap_per_order: round(avgSw - shipCharge),
      total_gap: round(totalSw - shipCharge * count),
      is_loss: avgSw - shipCharge > 0
    };
  });

  const priceRangeSummary = [];
  const tierRecommended = new Map();

  for (const [lo, hi, recRate] of PRICE_TIERS) {
    const inTier = ordersMerged.filter((order) => {
      const sale = Number(order.total_sale || 0);
      return sale >= lo && sale <= hi;
    });
    const count = inTier.length;
    const totalSw = inTier.reduce((sum, order) => sum + Number(order.total_shipping || 0), 0);
    const avgSw = count ? round(totalSw / count) : 0;
    const suggestedRate = recommendedShippingPrice(avgSw, recRate);
    const currentUncovered = inTier.filter((order) => Number(order.total_shipping || 0) > recRate);
    const recommendedUncovered = inTier.filter((order) => Number(order.total_shipping || 0) > suggestedRate);
    const label = hi !== Infinity ? `$${lo.toFixed(2)} - $${hi.toFixed(2)}` : `Mas de $${(lo - 0.01).toFixed(2)}`;
    tierRecommended.set(`${lo}|${hi}`, suggestedRate);
    priceRangeSummary.push({
      label,
      min_price: lo,
      max_price: hi !== Infinity ? hi : 9999999,
      rec_rate: recRate,
      order_count: count,
      avg_sw_cost: avgSw,
      recommended_rate: suggestedRate,
      recommended_delta: round(suggestedRate - recRate),
      recommended_impact: round((suggestedRate - recRate) * count),
      gap_per_order: round(avgSw - recRate),
      total_gap: round((avgSw - recRate) * count),
      current_uncovered_count: currentUncovered.length,
      current_uncovered_pct: round(count ? (currentUncovered.length / count) * 100 : 0),
      recommended_uncovered_count: recommendedUncovered.length,
      recommended_uncovered_pct: round(count ? (recommendedUncovered.length / count) * 100 : 0),
      is_loss: avgSw - recRate > 0
    });
  }

  const pricedOrders = [];
  for (const order of ordersMerged) {
    const tier = priceTierForSale(Number(order.total_sale || 0));
    if (!tier) continue;
    const universalRate = tierRecommended.get(`${tier.lo}|${tier.hi}`) || tier.rate;
    const swNum = String(order.sw_order_num || '').trim();
    const state = String(swStateDict[swNum] || '').toUpperCase().trim();
    const cost = Number(order.total_shipping || 0);
    pricedOrders.push({
      order,
      state: state.length === 2 ? state : '',
      tier_label: tier.label,
      current_rate: tier.rate,
      universal_rate: universalRate,
      cost,
      gap_current: cost - tier.rate,
      gap_universal: cost - universalRate
    });
  }

  const stateMap = new Map();
  for (const row of pricedOrders) {
    if (!row.state) continue;
    if (!stateMap.has(row.state)) {
      stateMap.set(row.state, {
        rows: [],
        total_cost: 0,
        total_current: 0,
        total_universal: 0,
        current_uncovered_count: 0,
        remaining_count: 0,
        remaining_gap: 0
      });
    }
    const data = stateMap.get(row.state);
    data.rows.push(row);
    data.total_cost += row.cost;
    data.total_current += row.current_rate;
    data.total_universal += row.universal_rate;
    if (row.gap_current > 0) data.current_uncovered_count += 1;
    if (row.gap_universal > 0) {
      data.remaining_count += 1;
      data.remaining_gap += row.gap_universal;
    }
  }

  const stateRates = {};
  const stateSummary = [];
  for (const [state, data] of stateMap.entries()) {
    const rows = data.rows;
    const count = rows.length;
    const remainingRows = rows.filter((row) => row.gap_universal > 0);
    const avgCost = count ? round(data.total_cost / count) : 0;
    const avgCurrent = count ? round(data.total_current / count) : 0;
    const avgUniversal = count ? round(data.total_universal / count) : 0;
    let stateRate = avgUniversal;
    if (remainingRows.length) {
      const avgRemainingCost = remainingRows.reduce((sum, row) => sum + row.cost, 0) / remainingRows.length;
      const avgRemainingUniversal = remainingRows.reduce((sum, row) => sum + row.universal_rate, 0) / remainingRows.length;
      stateRate = recommendedShippingPrice(avgRemainingCost, avgRemainingUniversal);
    }
    stateRates[state] = stateRate;

    let priority = 'Baja';
    if (data.remaining_count >= 100 || data.remaining_gap >= 1000) priority = 'Alta';
    else if (data.remaining_count >= 20 || data.remaining_gap >= 250) priority = 'Media';
    const priorityScore = data.remaining_gap + data.remaining_count * 10;

    stateSummary.push({
      state,
      order_count: count,
      avg_sw_cost: avgCost,
      avg_charged: avgCurrent,
      avg_universal_rate: avgUniversal,
      recommended_rate: round(stateRate),
      recommended_delta: round(stateRate - avgUniversal),
      gap_per_order: round(avgCost - avgCurrent),
      total_gap: round(rows.reduce((sum, row) => sum + row.gap_current, 0)),
      current_uncovered_count: data.current_uncovered_count,
      current_uncovered_pct: round(count ? (data.current_uncovered_count / count) * 100 : 0),
      remaining_count: data.remaining_count,
      remaining_pct: round(count ? (data.remaining_count / count) * 100 : 0),
      remaining_gap: round(data.remaining_gap),
      priority,
      priority_score: round(priorityScore),
      is_loss: data.remaining_count > 0,
      zone: 'Universal + Estado'
    });
  }
  stateSummary.sort((a, b) => b.priority_score - a.priority_score);

  const uncovered = [];
  for (const row of pricedOrders) {
    if (row.gap_universal <= 0) continue;
    const order = row.order;
    const stateRate = stateRates[row.state] || 0;
    uncovered.push({
      ARTRANSID: order.ARTRANSID,
      SALESORDERID: order.SALESORDERID,
      REFERENCE: order.REFERENCE,
      store: order.store,
      state: row.state || 'NA',
      tier: row.tier_label,
      total_sale: order.total_sale,
      total_shipping: order.total_shipping,
      universal_rate: round(row.universal_rate),
      state_rate: round(stateRate),
      recommended_rate: round(stateRate || row.universal_rate),
      remaining_gap: round(row.gap_universal),
      TRANSDATE: String(order.TRANSDATE || '').slice(0, 10)
    });
  }
  uncovered.sort((a, b) => Number(b.remaining_gap || 0) - Number(a.remaining_gap || 0));

  return {
    rules_analysis: rulesAnalysis,
    uncovered_orders: uncovered.slice(0, 500),
    uncovered_count: uncovered.length,
    state_summary: stateSummary,
    price_range_summary: priceRangeSummary
  };
}

function getOrdersSummary(ordersMerged) {
  const count = ordersMerged.length;
  if (!count) return {};

  const totalSale = sumBy(ordersMerged, 'total_sale');
  const totalCost = sumBy(ordersMerged, 'total_cost');
  const totalShipping = sumBy(ordersMerged, 'total_shipping');
  const totalShippingCharged = sumBy(ordersMerged, 'shipping_charged');
  const totalShipProfit = totalShippingCharged - totalShipping;
  const grossProfit = sumBy(ordersMerged, 'gross_profit');
  const finalProfit = sumBy(ordersMerged, 'final_profit');
  const lowMarginOrders = ordersMerged.filter((order) => Number(order.final_margin || 0) < 20);
  const zeroOrLessMarginOrders = ordersMerged.filter((order) => Number(order.final_margin || 0) < 0);

  return {
    order_count: count,
    low_margin_count: lowMarginOrders.length,
    low_margin_pct: round((lowMarginOrders.length / count) * 100),
    low_margin_sale_total: round(sumBy(lowMarginOrders, 'total_sale')),
    low_margin_loss_total: round(lowMarginOrders.reduce((sum, order) => sum + Math.abs(Math.min(Number(order.final_profit || 0), 0)), 0)),
    zero_or_less_margin_count: zeroOrLessMarginOrders.length,
    zero_or_less_margin_pct: round((zeroOrLessMarginOrders.length / count) * 100),
    zero_or_less_sale_total: round(sumBy(zeroOrLessMarginOrders, 'total_sale')),
    zero_or_less_loss_total: round(zeroOrLessMarginOrders.reduce((sum, order) => sum + Math.abs(Math.min(Number(order.final_profit || 0), 0)), 0)),
    total_sale: round(totalSale),
    total_cost: round(totalCost),
    total_shipping: round(totalShipping),
    total_shipping_charged: round(totalShippingCharged),
    shipping_profit: round(totalShipProfit),
    shipping_margin: round(totalShippingCharged ? (totalShipProfit / totalShippingCharged) * 100 : 0),
    gross_profit: round(grossProfit),
    gross_margin: round(totalSale ? (grossProfit / totalSale) * 100 : 0),
    final_profit: round(finalProfit),
    final_margin: round(totalSale ? (finalProfit / totalSale) * 100 : 0)
  };
}

function sumBy(rows, key) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

module.exports = {
  analyzeShipping,
  getOrderLines,
  getOrderPartSignatures,
  getOrders,
  getOrdersSummary,
  getProntoShippingCharges,
  getShipments,
  getShipmentsForOrder,
  getShipmentsWithState,
  getShipworksShippingCharges,
  getSkuLines,
  getStoreMapFromBq,
  mergeOrdersShipping,
  priceTierForSale,
  recommendedShippingPrice,
  shippingChargeMaps
};
