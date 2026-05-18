const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const { Node: NodeRuntime } = require("@shopify/shopify-api/runtime");
const { nodeAdapter } = require("@shopify/shopify-api/adapters/node");

const LOG_PREFIX = "[PaymentAnalytics]";

function log(level, requestId, message, meta) {
  const ts = new Date().toISOString();
  const rid = requestId ? ` [rid=${requestId}]` : "";
  const base = `${ts} ${LOG_PREFIX} [${level}]${rid} ${message}`;
  if (meta !== undefined) {
    // Keep meta on the same logical line for easier grepping in log aggregators.
    let serialized;
    try {
      serialized = JSON.stringify(meta);
    } catch (e) {
      serialized = String(meta);
    }
    if (level === "ERROR") {
      console.error(base, serialized);
    } else if (level === "WARN") {
      console.warn(base, serialized);
    } else {
      console.log(base, serialized);
    }
  } else {
    if (level === "ERROR") {
      console.error(base);
    } else if (level === "WARN") {
      console.warn(base);
    } else {
      console.log(base);
    }
  }
}

function generateRequestId() {
  return (
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)
  );
}

function maskCursor(cursor) {
  if (!cursor) return null;
  if (cursor.length <= 12) return cursor;
  return `${cursor.slice(0, 6)}…${cursor.slice(-4)}`;
}

// Validate required env vars at module load so misconfiguration is loud.
const REQUIRED_ENV = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_SHOP_NAME",
  "SHOPIFY_ACCESS_TOKEN",
];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  log("WARN", null, "Missing required env vars at startup", {
    missing: missingEnv,
  });
}

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ["read_orders"],
  hostName: process.env.SHOPIFY_SHOP_NAME,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
  hostScheme: "https",
  runtime: NodeRuntime,
  adminApiAccessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  adapter: nodeAdapter,
});

const graphqlClient = new shopify.clients.Graphql({
  session: {
    shop: process.env.SHOPIFY_SHOP_NAME,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  },
});

const ORDERS_WITH_TRANSACTIONS_QUERY = `
  query getOrdersWithTransactions($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          transactions(first: 20) {
            id
            kind
            status
            gateway
            errorCode
            processedAt
            amountSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

// Treat these kinds as "the customer tried to pay".
// Refunds/voids/changes are excluded so they don't pollute the rejection rate.
const PAYMENT_KINDS = new Set(["SALE", "AUTHORIZATION", "CAPTURE"]);
const FAILURE_STATUSES = new Set(["FAILURE", "ERROR"]);

function buildOrderSearchQuery({ startDate, endDate } = {}) {
  const parts = [];
  if (startDate) parts.push(`created_at:>='${startDate}'`);
  if (endDate) parts.push(`created_at:<='${endDate}'`);
  return parts.join(" AND ") || null;
}

async function fetchOrdersPage({
  first,
  after,
  searchQuery,
  requestId,
  pageNumber,
}) {
  const pageStart = Date.now();
  log("DEBUG", requestId, "Fetching orders page", {
    pageNumber,
    first,
    after: maskCursor(after),
    searchQuery,
  });

  let response;
  try {
    response = await graphqlClient.request(ORDERS_WITH_TRANSACTIONS_QUERY, {
      variables: { first, after, query: searchQuery },
    });
  } catch (err) {
    log("ERROR", requestId, "GraphQL request threw", {
      pageNumber,
      first,
      after: maskCursor(after),
      searchQuery,
      errorName: err?.name,
      errorMessage: err?.message,
      // Shopify client errors often expose response.body / response.code
      responseCode: err?.response?.code,
      responseBody: err?.response?.body,
      stack: err?.stack,
    });
    throw err;
  }

  // Surface GraphQL throttle/cost info if present — this is gold for prod debugging.
  const cost = response?.extensions?.cost;
  if (cost) {
    const available = cost.throttleStatus?.currentlyAvailable;
    const maxBucket = cost.throttleStatus?.maximumAvailable;
    const restoreRate = cost.throttleStatus?.restoreRate;
    log("DEBUG", requestId, "GraphQL cost", {
      pageNumber,
      requestedQueryCost: cost.requestedQueryCost,
      actualQueryCost: cost.actualQueryCost,
      currentlyAvailable: available,
      maximumAvailable: maxBucket,
      restoreRate,
    });
    if (
      typeof available === "number" &&
      typeof maxBucket === "number" &&
      available < maxBucket * 0.2
    ) {
      log("WARN", requestId, "Throttle bucket low — nearing rate limit", {
        currentlyAvailable: available,
        maximumAvailable: maxBucket,
      });
    }
  }

  if (response.errors) {
    const message = Array.isArray(response.errors)
      ? response.errors.map((e) => e.message).join("; ")
      : JSON.stringify(response.errors);
    log("ERROR", requestId, "Shopify GraphQL returned errors", {
      pageNumber,
      errors: response.errors,
    });
    throw new Error(`Shopify GraphQL error: ${message}`);
  }

  const orders = response.data?.orders;
  if (!orders) {
    log("WARN", requestId, "No orders payload in response", {
      pageNumber,
      rawDataKeys: response.data ? Object.keys(response.data) : null,
    });
  } else {
    log("INFO", requestId, "Orders page fetched", {
      pageNumber,
      count: orders.edges?.length || 0,
      hasNextPage: orders.pageInfo?.hasNextPage,
      durationMs: Date.now() - pageStart,
    });
  }

  return orders;
}

async function getPaymentRejectionRate({
  startDate,
  endDate,
  pageSize = 100,
  maxOrders = 5000,
} = {}) {
  const requestId = generateRequestId();
  const runStart = Date.now();
  const searchQuery = buildOrderSearchQuery({ startDate, endDate });

  log("INFO", requestId, "getPaymentRejectionRate started", {
    startDate: startDate || null,
    endDate: endDate || null,
    pageSize,
    maxOrders,
    searchQuery,
    shop: process.env.SHOPIFY_SHOP_NAME,
    apiVersion: LATEST_API_VERSION,
  });

  let afterCursor = null;
  let hasNextPage = true;
  let pageNumber = 0;

  let totalAttempts = 0;
  let successfulAttempts = 0;
  let failedAttempts = 0;

  const failureByGateway = {};
  const failureByErrorCode = {};
  const ordersWithFailures = [];
  const scannedOrderIds = new Set();
  const ordersWithFailedTx = new Set();

  try {
    while (hasNextPage && scannedOrderIds.size < maxOrders) {
      pageNumber += 1;
      const remaining = maxOrders - scannedOrderIds.size;
      const first = Math.min(pageSize, remaining);

      const orders = await fetchOrdersPage({
        first,
        after: afterCursor,
        searchQuery,
        requestId,
        pageNumber,
      });

      if (!orders) {
        log("WARN", requestId, "Stopping pagination — empty page", {
          pageNumber,
        });
        break;
      }

      for (const edge of orders.edges) {
        const order = edge.node;
        scannedOrderIds.add(order.id);

        let orderHadFailure = false;

        for (const tx of order.transactions || []) {
          if (!PAYMENT_KINDS.has(tx.kind)) continue;

          totalAttempts++;

          if (FAILURE_STATUSES.has(tx.status)) {
            failedAttempts++;
            orderHadFailure = true;

            const gw = tx.gateway || "unknown";
            failureByGateway[gw] = (failureByGateway[gw] || 0) + 1;

            const code = tx.errorCode || "no_error_code";
            failureByErrorCode[code] = (failureByErrorCode[code] || 0) + 1;

            log("DEBUG", requestId, "Failed transaction recorded", {
              orderId: order.id,
              orderName: order.name,
              kind: tx.kind,
              status: tx.status,
              gateway: gw,
              errorCode: code,
              processedAt: tx.processedAt,
            });
          } else if (tx.status === "SUCCESS") {
            successfulAttempts++;
          }
        }

        if (orderHadFailure) {
          ordersWithFailedTx.add(order.id);
          if (ordersWithFailures.length < 50) {
            ordersWithFailures.push({
              orderId: order.id,
              orderName: order.name,
              createdAt: order.createdAt,
              financialStatus: order.displayFinancialStatus,
              total: order.totalPriceSet?.shopMoney?.amount,
              currency: order.totalPriceSet?.shopMoney?.currencyCode,
            });
          }
        }
      }

      hasNextPage = orders.pageInfo.hasNextPage;
      afterCursor = orders.pageInfo.endCursor;

      log("DEBUG", requestId, "Page processed — running totals", {
        pageNumber,
        scannedOrders: scannedOrderIds.size,
        totalAttempts,
        failedAttempts,
        successfulAttempts,
        hasNextPage,
      });
    }
  } catch (err) {
    log("ERROR", requestId, "getPaymentRejectionRate aborted", {
      pageNumber,
      scannedOrders: scannedOrderIds.size,
      totalAttempts,
      failedAttempts,
      successfulAttempts,
      durationMs: Date.now() - runStart,
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
    });
    throw err;
  }

  const rejectionRate =
    totalAttempts === 0 ? 0 : (failedAttempts / totalAttempts) * 100;

  const ordersWithFailureRate =
    scannedOrderIds.size === 0
      ? 0
      : (ordersWithFailedTx.size / scannedOrderIds.size) * 100;

  const result = {
    requestId,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    ordersScanned: scannedOrderIds.size,
    truncated: hasNextPage,
    paymentAttempts: {
      total: totalAttempts,
      successful: successfulAttempts,
      failed: failedAttempts,
    },
    rejectionRate: Number(rejectionRate.toFixed(2)),
    ordersWithAtLeastOneFailure: ordersWithFailedTx.size,
    ordersWithFailureRate: Number(ordersWithFailureRate.toFixed(2)),
    breakdown: {
      byGateway: failureByGateway,
      byErrorCode: failureByErrorCode,
    },
    sampleFailedOrders: ordersWithFailures,
    note:
      "Rejection rate is based on order transactions (SALE/AUTHORIZATION/CAPTURE) " +
      "with status FAILURE or ERROR. Payment attempts that were rejected before an " +
      "order was created (e.g. card declined on the checkout page with no order " +
      "record) are not surfaced by the Shopify API and are therefore not included.",
  };

  log("INFO", requestId, "getPaymentRejectionRate completed", {
    durationMs: Date.now() - runStart,
    pagesFetched: pageNumber,
    ordersScanned: result.ordersScanned,
    truncated: result.truncated,
    totalAttempts: result.paymentAttempts.total,
    failed: result.paymentAttempts.failed,
    successful: result.paymentAttempts.successful,
    rejectionRate: result.rejectionRate,
    ordersWithFailureRate: result.ordersWithFailureRate,
  });

  return result;
}

module.exports = { getPaymentRejectionRate };
