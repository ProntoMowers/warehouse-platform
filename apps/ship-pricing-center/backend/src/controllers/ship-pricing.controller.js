const fs = require('fs');
const path = require('path');
const { checkAllDatabases } = require('../services/database.service');
const queries = require('../services/query.service');

const DATA_ROOT = path.resolve(__dirname, '..', '..', 'data');
const SHIPPING_RULES_PATH = path.join(DATA_ROOT, 'shipping_rules.json');
const CAUSE_OPTIONS_PATH = path.join(DATA_ROOT, 'ship_pricing_causes.json');
const CAUSE_ASSIGNMENTS_PATH = path.join(DATA_ROOT, 'order_cause_assignments.json');
const SOLUTION_OPTIONS_PATH = path.join(DATA_ROOT, 'ship_pricing_solutions.json');
const SOLUTION_ASSIGNMENTS_PATH = path.join(DATA_ROOT, 'order_solution_assignments.json');
const CACHE_TTL_MS = 5 * 60 * 1000;
const mergedCache = new Map();

function defaultFrom() {
  return `${new Date().getFullYear()}-01-01`;
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function defaultRules() {
  return [
    { id: 1, zone: 'Zona 1 (Local)', states: 'FL, GA, AL, SC', min_order: 0, max_order: 49.99, shipping_actual: 4.99, shipping_rec: 4.99 },
    { id: 2, zone: 'Zona 1 (Local)', states: 'FL, GA, AL, SC', min_order: 50, max_order: 99.99, shipping_actual: 6.99, shipping_rec: 6.99 },
    { id: 3, zone: 'Zona 1 (Local)', states: 'FL, GA, AL, SC', min_order: 100, max_order: 999999, shipping_actual: 8.99, shipping_rec: 7.99 },
    { id: 4, zone: 'Zona 2 (Regional)', states: 'NC, TN, VA, KY', min_order: 0, max_order: 49.99, shipping_actual: 7.99, shipping_rec: 7.49 },
    { id: 5, zone: 'Zona 2 (Regional)', states: 'NC, TN, VA, KY', min_order: 50, max_order: 99.99, shipping_actual: 9.99, shipping_rec: 8.99 },
    { id: 6, zone: 'Zona 2 (Regional)', states: 'NC, TN, VA, KY', min_order: 100, max_order: 999999, shipping_actual: 12.99, shipping_rec: 11.49 }
  ];
}

function loadRules() {
  const rules = readJson(SHIPPING_RULES_PATH, null);
  return Array.isArray(rules) ? rules : defaultRules();
}

function saveRules(rules) {
  writeJson(SHIPPING_RULES_PATH, rules);
}

function defaultCauses() {
  return [
    'Shipping alto',
    'Precio bajo',
    'Costo producto alto',
    'Promocion / descuento',
    'Marketplace fee',
    'No match ShipWorks',
    'Revision pendiente'
  ];
}

function defaultSolutions() {
  return [
    'Pendiente revision',
    'Corregir precio SKU',
    'Ajustar shipping charge',
    'Revisar costo proveedor',
    'Solicitar credito',
    'No requiere accion',
    'Resuelto'
  ];
}

function dedupeText(values) {
  const seen = new Set();
  const clean = [];
  for (const value of values) {
    const text = String(value || '').trim();
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      clean.push(text);
    }
  }
  return clean;
}

function loadCauseOptions() {
  const data = readJson(CAUSE_OPTIONS_PATH, null);
  return Array.isArray(data) ? dedupeText(data) : defaultCauses();
}

function saveCauseOptions(options) {
  writeJson(CAUSE_OPTIONS_PATH, dedupeText(options));
}

function loadSolutionOptions() {
  const data = readJson(SOLUTION_OPTIONS_PATH, null);
  return Array.isArray(data) ? dedupeText(data) : defaultSolutions();
}

function saveSolutionOptions(options) {
  writeJson(SOLUTION_OPTIONS_PATH, dedupeText(options));
}

function loadCauseAssignments() {
  const data = readJson(CAUSE_ASSIGNMENTS_PATH, {});
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    const cause = typeof value === 'object' && value !== null
      ? String(value.cause || '').trim()
      : String(value || '').trim();
    const updatedAt = typeof value === 'object' && value !== null ? String(value.updated_at || '') : '';
    if (cause) {
      normalized[String(key)] = { cause, updated_at: updatedAt };
    }
  }
  return normalized;
}

function saveCauseAssignments(assignments) {
  writeJson(CAUSE_ASSIGNMENTS_PATH, assignments);
}

function loadSolutionAssignments() {
  const data = readJson(SOLUTION_ASSIGNMENTS_PATH, {});
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    const solution = typeof value === 'object' && value !== null
      ? String(value.solution || '').trim()
      : String(value || '').trim();
    const updatedAt = typeof value === 'object' && value !== null ? String(value.updated_at || '') : '';
    if (solution) {
      normalized[String(key)] = { solution, updated_at: updatedAt };
    }
  }
  return normalized;
}

function saveSolutionAssignments(assignments) {
  writeJson(SOLUTION_ASSIGNMENTS_PATH, assignments);
}

function applyOrderCauses(orders) {
  const assignments = loadCauseAssignments();
  const solutionAssignments = loadSolutionAssignments();
  return orders.map((order) => {
    const key = String(order.ARTRANSID || '').trim();
    const assignment = assignments[key] || {};
    const solutionAssignment = solutionAssignments[key] || {};
    return {
      ...order,
      cause: assignment.cause || '',
      cause_updated_at: assignment.updated_at || '',
      solution: solutionAssignment.solution || '',
      solution_updated_at: solutionAssignment.updated_at || ''
    };
  });
}

function storeFilterValue(order) {
  return String(order.sw_store || '').trim();
}

function storeOptions(orders) {
  return [...new Set(orders.map(storeFilterValue).filter(Boolean))].sort();
}

async function mergeOrders(rawOrders, swMap, storeMap, dateFrom, dateTo) {
  const { swCharges, prontoCharges } = await queries.shippingChargeMaps(dateFrom, dateTo);
  return queries.mergeOrdersShipping(rawOrders, swMap, storeMap, swCharges, prontoCharges);
}

async function loadMergedOrdersForPeriod(dateFrom, dateTo) {
  const key = `${dateFrom}|${dateTo}`;
  const cached = mergedCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const rawOrders = await queries.getOrders(dateFrom, dateTo);
  const swMap = await queries.getShipments(dateFrom, dateTo);
  const storeMap = await queries.getStoreMapFromBq();
  const merged = applyOrderCauses(await mergeOrders(rawOrders, swMap, storeMap, dateFrom, dateTo));
  mergedCache.set(key, { timestamp: Date.now(), data: merged });
  return merged;
}

async function applySamePartsReference(orders, referencePool, dateFrom, dateTo) {
  const signatures = await queries.getOrderPartSignatures(dateFrom, dateTo);
  const bySignature = new Map();

  for (const order of referencePool) {
    const key = String(order.ARTRANSID || '').trim();
    const meta = signatures[key] || {};
    Object.assign(order, meta);
    const signature = String(meta.part_signature || '');
    if (!signature) continue;
    if (!bySignature.has(signature)) bySignature.set(signature, []);
    bySignature.get(signature).push(order);
  }

  for (const order of orders) {
    const key = String(order.ARTRANSID || '').trim();
    const meta = signatures[key] || {};
    Object.assign(order, meta);
    const signature = String(meta.part_signature || '');
    const peers = signature ? bySignature.get(signature) || [] : [];
    const otherCosts = peers
      .filter((peer) => String(peer.ARTRANSID || '').trim() !== key)
      .map((peer) => Number(peer.total_shipping || 0));
    if (otherCosts.length) {
      const avgPaid = round(otherCosts.reduce((sum, value) => sum + value, 0) / otherCosts.length);
      order.same_parts_other_orders = otherCosts.length;
      order.same_parts_avg_shipping_paid = avgPaid;
      order.same_parts_delta_vs_avg = round(Number(order.total_shipping || 0) - avgPaid);
    } else {
      order.same_parts_other_orders = 0;
      order.same_parts_avg_shipping_paid = null;
      order.same_parts_delta_vs_avg = null;
    }
  }
}

function applyProfitFilters(orders, filters = {}) {
  let filtered = [...orders];
  const { store = 'all', cause = 'all', marginMax, marginMin, shippingPctMin } = filters;

  if (store && store.toLowerCase() !== 'all') {
    const wanted = store.trim().toLowerCase();
    filtered = filtered.filter((order) => storeFilterValue(order).toLowerCase() === wanted);
  }

  if (cause && cause.toLowerCase() !== 'all') {
    if (cause === '__assigned__') {
      filtered = filtered.filter((order) => String(order.cause || '').trim());
    } else if (cause === '__unassigned__') {
      filtered = filtered.filter((order) => !String(order.cause || '').trim());
    } else {
      const wanted = cause.trim().toLowerCase();
      filtered = filtered.filter((order) => String(order.cause || '').trim().toLowerCase() === wanted);
    }
  }

  if (marginMax !== undefined && marginMax !== null && marginMax !== '') {
    filtered = filtered.filter((order) => Number(order.final_margin || 0) <= Number(marginMax));
  }

  if (marginMin !== undefined && marginMin !== null && marginMin !== '') {
    filtered = filtered.filter((order) => Number(order.final_margin || 0) >= Number(marginMin));
  }

  if (shippingPctMin !== undefined && shippingPctMin !== null && shippingPctMin !== '') {
    filtered = filtered.filter((order) => Number(order.shipping_pct || 0) >= Number(shippingPctMin));
  }

  return filtered;
}

async function buildSkuAnalytics(dateFrom, dateTo, store = 'all', search = '') {
  let merged = await loadMergedOrdersForPeriod(dateFrom, dateTo);
  if (store && store.toLowerCase() !== 'all') {
    const wanted = store.trim().toLowerCase();
    merged = merged.filter((order) => storeFilterValue(order).toLowerCase() === wanted);
  }

  const orderMap = new Map(merged.map((order) => [String(order.ARTRANSID || '').trim(), order]));
  const stores = storeOptions(merged);
  const lines = (await queries.getSkuLines(dateFrom, dateTo))
    .filter((line) => orderMap.has(String(line.ARTRANSID || '').trim()));

  const orderMerchSale = {};
  for (const line of lines) {
    const key = String(line.ARTRANSID || '').trim();
    orderMerchSale[key] = Number(orderMerchSale[key] || 0) + Number(line.line_sale || 0);
  }

  const searchText = search.trim().toLowerCase();
  const grouped = new Map();
  for (const line of lines) {
    const mfr = String(line.mfr || '').trim();
    const sku = String(line.sku || '').trim();
    const description = String(line.DESCRIPTION || '').trim();
    if (searchText && !sku.toLowerCase().includes(searchText) && !mfr.toLowerCase().includes(searchText) && !description.toLowerCase().includes(searchText)) {
      continue;
    }

    const orderId = String(line.ARTRANSID || '').trim();
    const order = orderMap.get(orderId) || {};
    const sale = Number(line.line_sale || 0);
    const cost = Number(line.line_cost || 0);
    const profit = Number(line.line_profit || 0);
    const ratio = orderMerchSale[orderId] ? sale / orderMerchSale[orderId] : 0;
    const allocShipCost = round(Number(order.total_shipping || 0) * ratio);
    const allocShipCharge = round(Number(order.shipping_charged || 0) * ratio);
    const shippingLoss = round(Math.max(0, allocShipCost - allocShipCharge));
    const profitAfterShipping = round(profit - shippingLoss);
    const key = skuKey(mfr, sku);

    if (!grouped.has(key)) {
      grouped.set(key, {
        mfr,
        sku,
        description,
        orders_set: new Set(),
        qty: 0,
        total_sale: 0,
        total_cost: 0,
        gross_profit: 0,
        order_profits: [],
        order_margins: [],
        allocated_shipping_cost: 0,
        allocated_shipping_charge: 0,
        shipping_loss: 0,
        negative_shipping_orders: 0,
        negative_shipping_profit: 0
      });
    }

    const bucket = grouped.get(key);
    bucket.orders_set.add(orderId);
    bucket.qty += Number(line.qty || 0);
    bucket.total_sale += sale;
    bucket.total_cost += cost;
    bucket.gross_profit += profit;
    bucket.order_profits.push(profit);
    bucket.order_margins.push(Number(line.line_margin || 0));
    bucket.allocated_shipping_cost += allocShipCost;
    bucket.allocated_shipping_charge += allocShipCharge;
    bucket.shipping_loss += shippingLoss;
    if (profit > 0 && profitAfterShipping < 0) {
      bucket.negative_shipping_orders += 1;
      bucket.negative_shipping_profit += Math.abs(profitAfterShipping);
    }
  }

  const rows = [];
  for (const bucket of grouped.values()) {
    const totalSale = Number(bucket.total_sale || 0);
    const grossProfit = Number(bucket.gross_profit || 0);
    rows.push({
      mfr: bucket.mfr,
      sku: bucket.sku,
      description: bucket.description,
      order_count: bucket.orders_set.size,
      qty: round(bucket.qty, 2),
      total_sale: round(totalSale),
      total_cost: round(bucket.total_cost),
      gross_profit: round(grossProfit),
      gross_margin: round(totalSale ? (grossProfit / totalSale) * 100 : 0),
      avg_order_profit: avg(bucket.order_profits),
      max_order_profit: bucket.order_profits.length ? round(Math.max(...bucket.order_profits)) : 0,
      low_order_profit: bucket.order_profits.length ? round(Math.min(...bucket.order_profits)) : 0,
      avg_order_margin: avg(bucket.order_margins),
      max_order_margin: bucket.order_margins.length ? round(Math.max(...bucket.order_margins)) : 0,
      low_order_margin: bucket.order_margins.length ? round(Math.min(...bucket.order_margins)) : 0,
      allocated_shipping_cost: round(bucket.allocated_shipping_cost),
      allocated_shipping_charge: round(bucket.allocated_shipping_charge),
      shipping_loss: round(bucket.shipping_loss),
      negative_shipping_orders: bucket.negative_shipping_orders,
      negative_shipping_profit: round(bucket.negative_shipping_profit)
    });
  }

  rows.sort((a, b) => Number(b.gross_profit || 0) - Number(a.gross_profit || 0));
  const shippingNegative = rows
    .filter((row) => Number(row.negative_shipping_orders || 0) > 0)
    .sort((a, b) => Number(b.negative_shipping_profit || 0) - Number(a.negative_shipping_profit || 0));

  const totalSale = rows.reduce((sum, row) => sum + Number(row.total_sale || 0), 0);
  const totalProfit = rows.reduce((sum, row) => sum + Number(row.gross_profit || 0), 0);

  return {
    summary: {
      sku_count: rows.length,
      order_count: new Set(lines.map((line) => String(line.ARTRANSID || '').trim())).size,
      total_sale: round(totalSale),
      gross_profit: round(totalProfit),
      gross_margin: round(totalSale ? (totalProfit / totalSale) * 100 : 0),
      shipping_negative_sku_count: shippingNegative.length,
      shipping_negative_profit: round(shippingNegative.reduce((sum, row) => sum + Number(row.negative_shipping_profit || 0), 0))
    },
    stores,
    skus: rows.slice(0, 500),
    shipping_negative: shippingNegative.slice(0, 250)
  };
}

async function skuOrderRows(dateFrom, dateTo, mfr, sku, store = 'all') {
  let merged = await loadMergedOrdersForPeriod(dateFrom, dateTo);
  if (store && store.toLowerCase() !== 'all') {
    const wanted = store.trim().toLowerCase();
    merged = merged.filter((order) => storeFilterValue(order).toLowerCase() === wanted);
  }

  const orderMap = new Map(merged.map((order) => [String(order.ARTRANSID || '').trim(), order]));
  const lines = (await queries.getSkuLines(dateFrom, dateTo))
    .filter((line) => orderMap.has(String(line.ARTRANSID || '').trim()));
  const orderMerchSale = {};
  for (const line of lines) {
    const orderId = String(line.ARTRANSID || '').trim();
    orderMerchSale[orderId] = Number(orderMerchSale[orderId] || 0) + Number(line.line_sale || 0);
  }

  const wantedKey = skuKey(mfr, sku);
  const rows = [];
  for (const line of lines) {
    if (skuKey(line.mfr, line.sku) !== wantedKey) continue;
    const orderId = String(line.ARTRANSID || '').trim();
    const order = orderMap.get(orderId) || {};
    const sale = Number(line.line_sale || 0);
    const profit = Number(line.line_profit || 0);
    const ratio = orderMerchSale[orderId] ? sale / orderMerchSale[orderId] : 0;
    const allocShipCost = round(Number(order.total_shipping || 0) * ratio);
    const allocShipCharge = round(Number(order.shipping_charged || 0) * ratio);
    const shippingLoss = round(Math.max(0, allocShipCost - allocShipCharge));
    const profitAfterShipping = round(profit - shippingLoss);
    rows.push({
      ...order,
      sku_mfr: line.mfr,
      sku: line.sku,
      sku_description: line.DESCRIPTION,
      sku_qty: line.qty,
      sku_sale: line.line_sale,
      sku_cost: line.line_cost,
      sku_profit: line.line_profit,
      sku_margin: line.line_margin,
      allocated_shipping_cost: allocShipCost,
      allocated_shipping_charge: allocShipCharge,
      sku_profit_after_shipping: profitAfterShipping,
      sku_margin_after_shipping: round(sale ? (profitAfterShipping / sale) * 100 : 0)
    });
  }

  rows.sort((a, b) => String(b.TRANSDATE || '').localeCompare(String(a.TRANSDATE || '')));
  return rows;
}

function bucketLabel(transdateValue, granularity) {
  const text = String(transdateValue || '').trim();
  if (!text) return '';
  const dayText = text.slice(0, 10);
  if (granularity === 'day') return dayText;
  if (granularity === 'month') return dayText.slice(0, 7);
  return dayText.slice(0, 4);
}

function composeStoreBucketMetrics(orders) {
  const orderCount = orders.length;
  const totalSale = sumBy(orders, 'total_sale');
  const totalCost = sumBy(orders, 'total_cost');
  const totalShipping = sumBy(orders, 'total_shipping');
  const totalShippingCharged = sumBy(orders, 'shipping_charged');
  const grossProfit = sumBy(orders, 'gross_profit');
  const finalProfit = sumBy(orders, 'final_profit');
  const shippingProfit = totalShippingCharged - totalShipping;
  return {
    order_count: orderCount,
    total_sale: round(totalSale),
    total_cost: round(totalCost),
    total_shipping: round(totalShipping),
    total_shipping_charged: round(totalShippingCharged),
    shipping_profit: round(shippingProfit),
    shipping_gap: round(totalShipping - totalShippingCharged),
    gross_profit: round(grossProfit),
    final_profit: round(finalProfit),
    gross_margin: safeRatio(grossProfit, totalSale),
    final_margin: safeRatio(finalProfit, totalSale),
    shipping_margin: safeRatio(shippingProfit, totalShippingCharged),
    shipping_pct: safeRatio(totalShipping, totalSale)
  };
}

function alertLevel(finalMargin, changePp, revenueChangePct, shippingCostChangePct) {
  if (finalMargin <= 15) return 'critical';
  if (finalMargin <= 25) return 'risk';
  if (changePp <= -3) return 'risk';
  if (revenueChangePct <= -20 || shippingCostChangePct >= 15) return 'risk';
  if (finalMargin <= 35) return 'medium';
  return 'good';
}

function metricValue(metrics, metricKey) {
  return Number((metrics || {})[metricKey] || 0);
}

async function getDatabasesStatus(req, res) {
  const result = await checkAllDatabases();
  const hasErrors = Object.values(result.databases).some((entry) => entry.status === 'error');
  res.status(hasErrors ? 207 : 200).json({
    ok: !hasErrors,
    ...result
  });
}

async function getOrders(req, res) {
  const df = req.query.date_from || defaultFrom();
  const dt = req.query.date_to || defaultTo();
  const page = Math.max(1, Number(req.query.page || 1));
  const perPage = Math.min(500, Math.max(1, Number(req.query.per_page || 50)));

  let rawOrders;
  try {
    rawOrders = await queries.getOrders(df, dt);
  } catch (error) {
    return res.status(502).json({ ok: false, message: `Pronto DB error: ${error.message}` });
  }

  const swMap = await queries.getShipments(df, dt);
  const storeMap = await queries.getStoreMapFromBq();
  let merged = applyOrderCauses(await mergeOrders(rawOrders, swMap, storeMap, df, dt));
  const availableStores = storeOptions(merged);

  if (parseBool(req.query.no_match)) {
    merged = merged.filter((order) => !order.sw_matched);
  }

  merged = applyProfitFilters(merged, {
    store: req.query.store || 'all',
    cause: req.query.cause || 'all',
    marginMax: req.query.margin_max,
    marginMin: req.query.margin_min,
    shippingPctMin: req.query.shipping_pct_min
  });

  if (req.query.search) {
    const search = String(req.query.search).toLowerCase();
    merged = merged.filter((order) => [
      order.ARTRANSID,
      order.SALESORDERID,
      order.CUSTOMERNAME,
      order.REFERENCE,
      order.store,
      order.sw_store,
      order.cause
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }

  sortOrders(merged, req.query.sort_by, req.query.sort_dir);

  const total = merged.length;
  const start = (page - 1) * perPage;
  const pageData = merged.slice(start, start + perPage);
  const assignments = loadCauseAssignments();
  const causeOptions = dedupeText([...loadCauseOptions(), ...Object.values(assignments).map((value) => value.cause)]);
  const solutionAssignments = loadSolutionAssignments();
  const solutionOptions = dedupeText([...loadSolutionOptions(), ...Object.values(solutionAssignments).map((value) => value.solution)]);

  res.json({
    ok: true,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    summary: queries.getOrdersSummary(merged),
    orders: pageData,
    filters: {
      stores: availableStores,
      causes: causeOptions,
      solutions: solutionOptions,
      active: {
        store: req.query.store || 'all',
        cause: req.query.cause || 'all',
        margin_max: nullableNumber(req.query.margin_max),
        margin_min: nullableNumber(req.query.margin_min),
        shipping_pct_min: nullableNumber(req.query.shipping_pct_min),
        no_match: parseBool(req.query.no_match)
      }
    }
  });
}

async function getOrderLines(req, res) {
  try {
    const artransid = Number(req.params.artransid);
    const lines = await queries.getOrderLines(artransid);
    res.json({ ok: true, artransid, lines });
  } catch (error) {
    res.status(502).json({ ok: false, message: `Pronto DB error: ${error.message}` });
  }
}

async function getOrderShipping(req, res) {
  const swOrderNum = String(req.query.sw_order_num || '').trim();
  if (!swOrderNum) {
    return res.json({ ok: true, shipments: [] });
  }
  const shipments = await queries.getShipmentsForOrder(swOrderNum);
  res.json({ ok: true, sw_order_num: swOrderNum, shipments });
}

function getCauses(req, res) {
  const assignments = loadCauseAssignments();
  const assignedCauses = Object.values(assignments).map((value) => value.cause);
  res.json({
    ok: true,
    options: dedupeText([...loadCauseOptions(), ...assignedCauses]),
    assignments
  });
}

function updateCauseOptions(req, res) {
  const assignments = loadCauseAssignments();
  const assignedCauses = Object.values(assignments).map((value) => value.cause);
  const options = dedupeText([...(req.body.options || []), ...assignedCauses]);
  saveCauseOptions(options);
  res.json({ ok: true, options });
}

function getSolutions(req, res) {
  const assignments = loadSolutionAssignments();
  const assignedSolutions = Object.values(assignments).map((value) => value.solution);
  res.json({
    ok: true,
    options: dedupeText([...loadSolutionOptions(), ...assignedSolutions]),
    assignments
  });
}

function updateSolutionOptions(req, res) {
  const assignments = loadSolutionAssignments();
  const assignedSolutions = Object.values(assignments).map((value) => value.solution);
  const options = dedupeText([...(req.body.options || []), ...assignedSolutions]);
  saveSolutionOptions(options);
  res.json({ ok: true, options });
}

function updateOrderCause(req, res) {
  const artransid = Number(req.params.artransid);
  const assignments = loadCauseAssignments();
  const key = String(artransid);
  const cause = String(req.body.cause || '').trim();

  if (cause) {
    assignments[key] = {
      cause,
      updated_at: new Date().toISOString().slice(0, 19)
    };
    const options = loadCauseOptions();
    if (!options.some((option) => option.toLowerCase() === cause.toLowerCase())) {
      options.push(cause);
      saveCauseOptions(options);
    }
  } else {
    delete assignments[key];
  }

  saveCauseAssignments(assignments);
  mergedCache.clear();
  res.json({ ok: true, artransid, cause });
}

function updateOrderSolution(req, res) {
  const artransid = Number(req.params.artransid);
  const assignments = loadSolutionAssignments();
  const key = String(artransid);
  const solution = String(req.body.solution || '').trim();

  if (solution) {
    assignments[key] = {
      solution,
      updated_at: new Date().toISOString().slice(0, 19)
    };
    const options = loadSolutionOptions();
    if (!options.some((option) => option.toLowerCase() === solution.toLowerCase())) {
      options.push(solution);
      saveSolutionOptions(options);
    }
  } else {
    delete assignments[key];
  }

  saveSolutionAssignments(assignments);
  mergedCache.clear();
  res.json({ ok: true, artransid, solution });
}

async function getSummary(req, res) {
  const df = req.query.date_from || defaultFrom();
  const dt = req.query.date_to || defaultTo();
  try {
    const merged = await loadMergedOrdersForPeriod(df, dt);
    res.json({ ok: true, ...queries.getOrdersSummary(merged) });
  } catch (error) {
    res.status(502).json({ ok: false, message: error.message });
  }
}

async function getSegments(req, res) {
  const df = req.query.date_from || defaultFrom();
  const dt = req.query.date_to || defaultTo();
  let merged;
  try {
    merged = await loadMergedOrdersForPeriod(df, dt);
  } catch (error) {
    return res.status(502).json({ ok: false, message: `Pronto DB error: ${error.message}` });
  }

  const stores = storeOptions(merged);
  const referencePool = applyProfitFilters(merged, { store: req.query.store || 'all', cause: 'all' });
  const assigned = applyProfitFilters(merged, {
    store: req.query.store || 'all',
    cause: '__assigned__',
    marginMax: req.query.margin_max,
    shippingPctMin: req.query.shipping_pct_min
  });
  await applySamePartsReference(assigned, referencePool, df, dt);

  const grouped = new Map();
  for (const order of assigned) {
    const cause = String(order.cause || '').trim();
    if (!grouped.has(cause)) grouped.set(cause, []);
    grouped.get(cause).push(order);
  }

  const groups = [...grouped.entries()].map(([cause, orders]) => {
    const sortedOrders = [...orders].sort((a, b) => String(b.TRANSDATE || '').localeCompare(String(a.TRANSDATE || '')));
    return {
      cause,
      summary: queries.getOrdersSummary(orders),
      orders: sortedOrders.slice(0, 100),
      visible_orders: Math.min(sortedOrders.length, 100)
    };
  });
  groups.sort((a, b) => Number(b.summary.order_count || 0) - Number(a.summary.order_count || 0));

  const assignments = loadCauseAssignments();
  const causeOptions = dedupeText([...loadCauseOptions(), ...Object.values(assignments).map((value) => value.cause)]);
  const solutionAssignments = loadSolutionAssignments();
  const solutionOptions = dedupeText([...loadSolutionOptions(), ...Object.values(solutionAssignments).map((value) => value.solution)]);
  res.json({
    ok: true,
    groups,
    total_assigned: assigned.length,
    stores,
    causes: causeOptions,
    solutions: solutionOptions,
    active_filters: {
      date_from: df,
      date_to: dt,
      store: req.query.store || 'all',
      margin_max: nullableNumber(req.query.margin_max),
      shipping_pct_min: nullableNumber(req.query.shipping_pct_min)
    }
  });
}

async function getSkus(req, res) {
  const df = req.query.date_from || defaultFrom();
  const dt = req.query.date_to || defaultTo();
  try {
    const data = await buildSkuAnalytics(df, dt, req.query.store || 'all', req.query.search || '');
    data.active_filters = {
      date_from: df,
      date_to: dt,
      store: req.query.store || 'all',
      search: req.query.search || ''
    };
    res.json({ ok: true, ...data });
  } catch (error) {
    res.status(502).json({ ok: false, message: `SKU analytics error: ${error.message}` });
  }
}

async function getSkuOrders(req, res) {
  const df = req.query.date_from || defaultFrom();
  const dt = req.query.date_to || defaultTo();
  try {
    const rows = await skuOrderRows(df, dt, req.query.mfr || '', req.query.sku || '', req.query.store || 'all');
    res.json({
      ok: true,
      sku: req.query.sku || '',
      mfr: req.query.mfr || '',
      date_from: df,
      date_to: dt,
      orders: rows
    });
  } catch (error) {
    res.status(502).json({ ok: false, message: `SKU orders error: ${error.message}` });
  }
}

function getShippingRules(req, res) {
  res.json({ ok: true, rules: loadRules() });
}

function updateShippingRule(req, res) {
  const ruleId = Number(req.params.rule_id);
  const rules = loadRules();
  const index = rules.findIndex((rule) => Number(rule.id) === ruleId);
  if (index < 0) {
    return res.status(404).json({ ok: false, message: 'Rule not found' });
  }
  rules[index] = { ...normalizeRule(req.body), id: ruleId };
  saveRules(rules);
  res.json({ ok: true, rule: rules[index] });
}

function addShippingRule(req, res) {
  const rules = loadRules();
  const newId = Math.max(0, ...rules.map((rule) => Number(rule.id || 0))) + 1;
  const rule = { ...normalizeRule(req.body), id: newId };
  rules.push(rule);
  saveRules(rules);
  res.json({ ok: true, rule });
}

function deleteShippingRule(req, res) {
  const ruleId = Number(req.params.rule_id);
  saveRules(loadRules().filter((rule) => Number(rule.id) !== ruleId));
  res.json({ ok: true });
}

function getShippingMap(req, res) {
  const stateData = {};
  for (const rule of loadRules()) {
    for (const state of String(rule.states || '').split(',').map((value) => value.trim()).filter(Boolean)) {
      if (!stateData[state]) {
        stateData[state] = {
          state,
          zone: rule.zone,
          shipping_actual: rule.shipping_actual,
          shipping_rec: rule.shipping_rec,
          delta: round(Number(rule.shipping_actual || 0) - Number(rule.shipping_rec || 0))
        };
      }
    }
  }
  res.json({ ok: true, states: Object.values(stateData) });
}

async function getShippingAnalysis(req, res) {
  const df = req.query.date_from || defaultFrom();
  const dt = req.query.date_to || defaultTo();
  let rawOrders;
  try {
    rawOrders = await queries.getOrders(df, dt);
  } catch (error) {
    return res.status(502).json({ ok: false, message: `Pronto DB error: ${error.message}` });
  }

  const swMap = await queries.getShipments(df, dt);
  const stores = [...new Set(Object.values(swMap).flat().map((shipment) => shipment.store_name).filter(Boolean))].sort();
  const storeMap = await queries.getStoreMapFromBq();
  let merged = await mergeOrders(rawOrders, swMap, storeMap, df, dt);
  const swStateDict = await queries.getShipmentsWithState(df, dt);

  const store = req.query.store || 'all';
  if (store && store.toLowerCase() !== 'all') {
    merged = merged.filter((order) => order.sw_store === store);
  }

  if (req.query.price_min !== undefined || req.query.price_max !== undefined) {
    const min = req.query.price_min !== undefined ? Number(req.query.price_min) : -Infinity;
    const max = req.query.price_max !== undefined ? Number(req.query.price_max) : Infinity;
    merged = merged.filter((order) => {
      const sale = Number(order.total_sale || 0);
      return sale >= min && sale <= max;
    });
  }

  const selectedState = String(req.query.ship_state || '').toUpperCase().trim();
  if (selectedState && selectedState !== 'ALL') {
    merged = merged.filter((order) => String(swStateDict[String(order.sw_order_num || '').trim()] || '').toUpperCase().trim() === selectedState);
  }

  const analysis = queries.analyzeShipping(merged, loadRules(), swStateDict);
  analysis.stores = stores;
  analysis.filtered_store = store;
  analysis.order_count = merged.length;
  analysis.active_filters = {
    date_from: df,
    date_to: dt,
    store,
    price_min: nullableNumber(req.query.price_min),
    price_max: nullableNumber(req.query.price_max),
    ship_state: selectedState || null
  };
  res.json({ ok: true, ...analysis });
}

async function getStoreTimeline(req, res) {
  const df = req.query.date_from || defaultFrom();
  const dt = req.query.date_to || defaultTo();
  const bucket = normalizeBucket(req.query.granularity || 'month', true);
  if (!bucket) {
    return res.status(400).json({ ok: false, message: 'granularity must be day, month, or year' });
  }

  let merged;
  try {
    merged = await loadMergedOrdersForPeriod(df, dt);
  } catch (error) {
    return res.status(502).json({ ok: false, message: `Store timeline error: ${error.message}` });
  }

  const stores = storeOptions(merged);
  if (req.query.store && String(req.query.store).toLowerCase() !== 'all') {
    const wanted = String(req.query.store).trim().toLowerCase();
    merged = merged.filter((order) => storeFilterValue(order).toLowerCase() === wanted);
  }

  const grouped = groupByStoreAndBucket(merged, bucket);
  const series = [];
  const summary = [];
  for (const [storeName, byBucket] of sortedMapEntries(grouped)) {
    const points = [];
    for (const [label, orders] of sortedMapEntries(byBucket)) {
      points.push({ bucket: label, ...composeStoreBucketMetrics(orders) });
    }
    if (points.length) {
      series.push({ store: storeName, points });
    }
    const orders = [...byBucket.values()].flat();
    summary.push({ store: storeName, ...composeStoreBucketMetrics(orders) });
  }
  summary.sort((a, b) => Number(b.total_sale || 0) - Number(a.total_sale || 0));

  res.json({
    ok: true,
    date_from: df,
    date_to: dt,
    granularity: bucket,
    store_filter: req.query.store || 'all',
    stores,
    series,
    summary
  });
}

async function getStoreAnalytics(req, res) {
  const df = req.query.date_from || defaultFrom();
  const dt = req.query.date_to || defaultTo();
  const bucket = normalizeBucket(req.query.granularity || 'month', false) || 'month';
  const metric = req.query.metric || 'final_margin';

  let merged;
  try {
    merged = await loadMergedOrdersForPeriod(df, dt);
  } catch (error) {
    return res.status(502).json({ ok: false, message: `Store analytics error: ${error.message}` });
  }

  const storesList = storeOptions(merged);
  const grouped = groupByStoreAndBucket(merged, bucket);
  const allBuckets = [...new Set([...grouped.values()].flatMap((byBucket) => [...byBucket.keys()]))].sort();

  const bucketAllOrders = new Map();
  for (const order of merged) {
    const label = bucketLabel(order.TRANSDATE, bucket);
    if (!label) continue;
    if (!bucketAllOrders.has(label)) bucketAllOrders.set(label, []);
    bucketAllOrders.get(label).push(order);
  }

  const averageMonthly = allBuckets.map((label) => ({
    bucket: label,
    ...composeStoreBucketMetrics(bucketAllOrders.get(label) || [])
  }));

  const storesData = [];
  for (const [storeName, byBucket] of sortedMapEntries(grouped)) {
    const allStoreOrders = [...byBucket.values()].flat();
    const totals = composeStoreBucketMetrics(allStoreOrders);
    const monthly = allBuckets.map((label) => ({
      bucket: label,
      ...(byBucket.has(label) ? composeStoreBucketMetrics(byBucket.get(label)) : {})
    }));

    const bucketsWithData = allBuckets.filter((label) => byBucket.has(label) && byBucket.get(label).length);
    let currentMetrics = {};
    let prevMetrics = {};
    if (bucketsWithData.length >= 2) {
      currentMetrics = composeStoreBucketMetrics(byBucket.get(bucketsWithData[bucketsWithData.length - 1]));
      prevMetrics = composeStoreBucketMetrics(byBucket.get(bucketsWithData[bucketsWithData.length - 2]));
    } else if (bucketsWithData.length === 1) {
      currentMetrics = composeStoreBucketMetrics(byBucket.get(bucketsWithData[0]));
    }

    const changePp = Object.keys(prevMetrics).length
      ? round(metricValue(currentMetrics, 'final_margin') - metricValue(prevMetrics, 'final_margin'))
      : 0;
    const revenueChangePct = safeChangePct(metricValue(currentMetrics, 'total_sale'), metricValue(prevMetrics, 'total_sale'));
    const shippingCostChangePct = safeChangePct(metricValue(currentMetrics, 'total_shipping'), metricValue(prevMetrics, 'total_shipping'));

    storesData.push({
      store: storeName,
      ...totals,
      change_pp: changePp,
      revenue_change_pct: revenueChangePct,
      shipping_cost_change_pct: shippingCostChangePct,
      alert: alertLevel(Number(totals.final_margin || 0), changePp, revenueChangePct, shippingCostChangePct),
      monthly,
      current_bucket_metrics: currentMetrics,
      prev_bucket_metrics: prevMetrics
    });
  }

  const metricMap = {
    final_margin: 'final_margin',
    shipping_margin: 'shipping_margin',
    shipping_pct: 'shipping_pct',
    total_shipping: 'total_shipping',
    total_shipping_charged: 'total_shipping_charged',
    shipping_gap: 'shipping_gap',
    final_profit: 'final_profit',
    total_sale: 'total_sale',
    order_count: 'order_count',
    gross_margin: 'gross_margin'
  };
  const sortKey = metricMap[metric] || 'final_margin';
  storesData.sort((a, b) => Number(b[sortKey] || 0) - Number(a[sortKey] || 0));

  const activeStores = storesData.length;
  const totalOrders = storesData.reduce((sum, store) => sum + Number(store.order_count || 0), 0);
  const margins = storesData.filter((store) => store.order_count).map((store) => Number(store.final_margin || 0));
  const avgMargin = margins.length ? round(margins.reduce((sum, value) => sum + value, 0) / margins.length) : 0;

  let avgMarginChangePp = 0;
  let ordersChangePct = 0;
  try {
    const fromDate = parseDateOnly(df);
    const toDate = parseDateOnly(dt);
    const periodDays = Math.max(Math.floor((toDate - fromDate) / 86400000), 1);
    const prevToDate = new Date(fromDate.getTime() - 86400000);
    const prevFromDate = new Date(fromDate.getTime() - periodDays * 86400000);
    const previousMerged = await loadMergedOrdersForPeriod(toDateOnly(prevFromDate), toDateOnly(prevToDate));
    const previousGrouped = new Map();
    for (const order of previousMerged) {
      const key = storeFilterValue(order) || 'Sin store';
      if (!previousGrouped.has(key)) previousGrouped.set(key, []);
      previousGrouped.get(key).push(order);
    }
    const previousMargins = [...previousGrouped.values()]
      .map((orders) => composeStoreBucketMetrics(orders))
      .filter((metrics) => metrics.order_count)
      .map((metrics) => Number(metrics.final_margin || 0));
    const prevAvgMargin = previousMargins.length ? round(previousMargins.reduce((sum, value) => sum + value, 0) / previousMargins.length) : 0;
    avgMarginChangePp = round(avgMargin - prevAvgMargin);
    ordersChangePct = safeChangePct(totalOrders, previousMerged.length);
  } catch (error) {
    avgMarginChangePp = 0;
    ordersChangePct = 0;
  }

  const bestStore = storesData[0] || {};
  const worstStore = storesData.length
    ? storesData.reduce((worst, store) => Number(store.final_margin || 0) < Number(worst.final_margin || 0) ? store : worst, storesData[0])
    : {};
  const alertCount = storesData.filter((store) => ['critical', 'risk'].includes(store.alert)).length;

  res.json({
    ok: true,
    date_from: df,
    date_to: dt,
    granularity: bucket,
    metric,
    stores: storesList,
    buckets: allBuckets,
    summary: {
      avg_margin: avgMargin,
      avg_margin_change_pp: avgMarginChangePp,
      best_store: bestStore.store || '',
      best_store_margin: Number(bestStore.final_margin || 0),
      worst_store: worstStore.store || '',
      worst_store_margin: Number(worstStore.final_margin || 0),
      active_stores: activeStores,
      total_stores: activeStores,
      total_orders: totalOrders,
      orders_change_pct: ordersChangePct,
      alert_count: alertCount
    },
    average_monthly: averageMonthly,
    stores_data: storesData
  });
}

function sortOrders(rows, sortBy = 'transdate', sortDir = 'desc') {
  const fieldMap = {
    artransid: 'ARTRANSID',
    salesorderid: 'SALESORDERID',
    transdate: 'TRANSDATE',
    total_sale: 'total_sale',
    total_cost: 'total_cost',
    gross_profit: 'gross_profit',
    total_shipping: 'total_shipping',
    shipping_pct: 'shipping_pct',
    final_profit: 'final_profit',
    final_margin: 'final_margin',
    store: 'store',
    cause: 'cause'
  };
  const numericFields = new Set(['total_sale', 'total_cost', 'gross_profit', 'total_shipping', 'shipping_pct', 'final_profit', 'final_margin', 'artransid']);
  const key = fieldMap[String(sortBy || '').toLowerCase()] ? String(sortBy).toLowerCase() : 'transdate';
  const field = fieldMap[key];
  const reverse = String(sortDir || 'desc').toLowerCase() !== 'asc';
  rows.sort((a, b) => {
    const av = numericFields.has(key) ? Number(a[field] || 0) : String(a[field] || '');
    const bv = numericFields.has(key) ? Number(b[field] || 0) : String(b[field] || '');
    if (av < bv) return reverse ? 1 : -1;
    if (av > bv) return reverse ? -1 : 1;
    return 0;
  });
}

function normalizeRule(body) {
  return {
    zone: String(body.zone || '').trim(),
    states: String(body.states || '').trim(),
    min_order: Number(body.min_order || 0),
    max_order: Number(body.max_order || 999999),
    shipping_actual: Number(body.shipping_actual || 0),
    shipping_rec: Number(body.shipping_rec || 0)
  };
}

function groupByStoreAndBucket(orders, bucket) {
  const grouped = new Map();
  for (const order of orders) {
    const storeName = storeFilterValue(order) || 'Sin store';
    const label = bucketLabel(order.TRANSDATE, bucket);
    if (!label) continue;
    if (!grouped.has(storeName)) grouped.set(storeName, new Map());
    const byBucket = grouped.get(storeName);
    if (!byBucket.has(label)) byBucket.set(label, []);
    byBucket.get(label).push(order);
  }
  return grouped;
}

function sortedMapEntries(map) {
  return [...map.entries()].sort(([a], [b]) => String(a).toLowerCase().localeCompare(String(b).toLowerCase()));
}

function parseBool(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBucket(value, strict) {
  const bucket = String(value || 'month').trim().toLowerCase();
  if (['day', 'month', 'year'].includes(bucket)) return bucket;
  return strict ? '' : 'month';
}

function skuKey(mfr, sku) {
  return `${String(mfr || '').trim().toUpperCase()}||${String(sku || '').trim().toUpperCase()}`;
}

function sumBy(rows, key) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function safeRatio(numerator, denominator) {
  return round(denominator ? (numerator / denominator) * 100 : 0);
}

function safeChangePct(current, previous) {
  return round(previous ? ((current - previous) / previous) * 100 : 0);
}

function avg(values) {
  return values.length ? round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : 0;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function parseDateOnly(value) {
  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
}

function toDateOnly(value) {
  return value.toISOString().slice(0, 10);
}

module.exports = {
  addShippingRule,
  deleteShippingRule,
  getCauses,
  getDatabasesStatus,
  getOrderLines,
  getOrderShipping,
  getOrders,
  getSegments,
  getShippingAnalysis,
  getShippingMap,
  getShippingRules,
  getSkus,
  getSkuOrders,
  getSolutions,
  getStoreAnalytics,
  getStoreTimeline,
  getSummary,
  updateCauseOptions,
  updateOrderCause,
  updateOrderSolution,
  updateSolutionOptions,
  updateShippingRule
};
