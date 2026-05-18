require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const { Node: NodeRuntime } = require("@shopify/shopify-api/runtime");
const {
  calculateWholesaleDiscount,
  getCustomerLifetimeSpend,
  calculateRetailPriceForDraftOrder,
} = require("./services/discountService");
const {
  SKU_PRICING,
  parseDisplayPriceToShopify,
} = require("./services/skuPricing");
const { nodeAdapter } = require("@shopify/shopify-api/adapters/node");
const {
  createDraftOrder,
  getDraftOrderStatus,
  completeDraftOrder,
  updateDraftOrder,
  deleteDraftOrder,
} = require("./services/draftOrderService");
const {
  getPaymentRejectionRate,
} = require("./services/paymentAnalyticsService");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Initialize Shopify client
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: [
    "write_products",
    "read_products",
    "write_orders",
    "read_orders",
    "write_cart_transforms",
    "read_cart_transforms",
    "read_all_cart_transforms",
    "write_draft_orders",
    "read_draft_orders",
    "write_customers",
    "read_customer",
  ],
  hostName: process.env.SHOPIFY_SHOP_NAME,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
  hostScheme: "https",
  runtime: NodeRuntime,
  adminApiAccessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  adapter: nodeAdapter,
});

// Create REST client for API calls
const client = new shopify.clients.Rest({
  session: {
    shop: process.env.SHOPIFY_SHOP_NAME,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  },
  apiVersion: "2024-01",
});

// Test the connection
async function testConnection() {
  try {
    console.log("🔌 Testing Shopify connection...");
    const response = await client.get({
      path: "shop",
    });
    console.log("✅ Connected to shop:", response.body.shop.name);
    return true;
  } catch (error) {
    console.error("❌ Connection test failed:", error);
    if (error.response) {
      console.error(
        "Error details:",
        JSON.stringify(error.response.body, null, 2),
      );
    }
    return false;
  }
}

// Test connection on startup
//testConnection();

// Test endpoint to verify Shopify connection
app.get("/test-connection", async (req, res) => {
  try {
    const response = await client.get({
      path: "shop",
    });
    res.json({
      status: "success",
      shop: response.body.shop,
      message: "Successfully connected to Shopify!",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to connect to Shopify",
      error: error.message,
    });
  }
});

// Endpoint for wholesale prices
app.post("/api/wholesale-prices", async (req, res) => {
  try {
    const { cart, customer, current_sku } = req.body;

    // Verify wholesale customer
    if (!customer.tags.includes("wholesale")) {
      return res.json({ prices: {} });
    }

    // Calculate discounts
    const discount = await calculateWholesaleDiscount(cart, customer);
    let current_sku_price;

    if (current_sku && discount) {
      let sku = current_sku?.includes(" ")
        ? current_sku?.split(" ")[0]
        : current_sku;
      if (
        discount.tier === "TIER_2" ||
        discount.tier === "TIER_3" ||
        discount.tier === "TIER_1" || // (discount.tier == "TIER_1" &&
        discount.tier === "TIER 1"
        // discount?.summary?.requirements?.eligibility?.reason ==
        //   "minimum_total")
      ) {
        current_sku_price = parseDisplayPriceToShopify(
          SKU_PRICING[sku]?.prices[discount.tier] ||
            SKU_PRICING[sku]?.prices["TIER_1"],
          true,
        );
      } else if (
        discount.tier == "TIER_1" &&
        discount?.summary?.requirements?.eligibility?.reason ==
          "minimum_quantity" &&
        discount?.summary?.requirements?.eligibility?.details?.itemQuantities[
          sku
        ] >= 3
      ) {
        current_sku_price = parseDisplayPriceToShopify(
          SKU_PRICING[sku]?.prices[discount.tier],
          true,
        );
      }
    }

    // Return SKU-specific prices for each tier

    res.json({
      appliedTier: discount ? discount.tier : null,
      discount,
      current_sku_price,
    });
  } catch (error) {
    console.error("Error calculating wholesale prices:", error);
    res.status(500).json({
      error: "Error calculating wholesale prices",
      message: error.message,
    });
  }
});

// Endpoint for wholesale prices on the cart page
app.post("/api/cart-details", async (req, res) => {
  try {
    const { cart, customer } = req.body;

    // Verify wholesale customer
    if (!customer.tags.includes("wholesale")) {
      return res.json({ prices: {} });
    }
    let discount = null;

    // Calculate discounts
    discount = await calculateWholesaleDiscount(cart, customer);
    if (discount?.type === "no_discount") {
      discount = await calculateRetailPriceForDraftOrder(cart, customer);
    }

    // Return SKU-specific prices for each tier

    res.json({
      appliedTier: discount ? discount.tier : null,
      discount,
    });
  } catch (error) {
    console.error("Error calculating wholesale prices:", error);
    res.status(500).json({ error: "Error calculating wholesale prices" });
  }
});

// Helper function to get customer details
async function getCustomerDetails(customerId) {
  try {
    const response = await client.get({
      path: `customers/${customerId}`,
    });
    return response.body.customer;
  } catch (error) {
    console.error("Error fetching customer details:", error);
    throw error;
  }
}

// Helper function to check if customer has wholesale tag
function hasWholesaleTag(customer) {
  return customer.tags && customer.tags.includes("wholesale");
}

// Create draft order from cart
app.post("/api/draft-orders", async (req, res) => {
  try {
    const { cart, customer } = req.body;

    if (!cart || !customer) {
      return res.status(400).json({
        error: "Missing required fields: cart and customer",
      });
    }

    const draftOrder = await createDraftOrder(cart, customer);
    res.json(draftOrder);
  } catch (error) {
    console.error("Error creating draft order:", error);
    res.status(500).json({ error: "Error creating draft order" });
  }
});

// Get draft order status
app.get("/api/draft-orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const status = await getDraftOrderStatus(id);
    res.json(status);
  } catch (error) {
    console.error("Error getting draft order status:", error);
    res.status(500).json({ error: "Error getting draft order status" });
  }
});

// Delete draft order
app.delete("/api/draft-orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const status = await deleteDraftOrder(id);
    res.json(status);
  } catch (error) {
    console.error("Error getting draft order status:", error);
    res.status(500).json({ error: "Error getting draft order status" });
  }
});

// Complete draft order
app.post("/api/draft-orders/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await completeDraftOrder(id);
    res.json(result);
  } catch (error) {
    console.error("Error completing draft order:", error);
    res.status(500).json({ error: "Error completing draft order" });
  }
});

// Update draft order
app.put("/api/draft-orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { cart, customer } = req.body;
    const result = await updateDraftOrder(id, cart, customer);
    res.json(result);
  } catch (error) {
    console.error("Error updating draft order:", error);
    res.status(500).json({ error: "Error updating draft order" });
  }
});

// Payment rejection rate analytics
// Examples:
//   GET /api/payment-analytics/rejection-rate
//   GET /api/payment-analytics/rejection-rate?start_date=2026-01-01&end_date=2026-05-18
//   GET /api/payment-analytics/rejection-rate?start_date=2026-04-01&max_orders=1000
app.get("/api/payment-analytics/rejection-rate", async (req, res) => {
  const routeRequestId =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const startedAt = Date.now();
  const ts = new Date().toISOString();
  const ROUTE_TAG = "[PaymentAnalyticsRoute]";

  console.log(
    `${ts} ${ROUTE_TAG} [INFO] [rid=${routeRequestId}] Request received`,
    JSON.stringify({
      path: req.originalUrl,
      query: req.query,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }),
  );

  try {
    const { start_date, end_date, max_orders, page_size } = req.query;

    const parsedMaxOrders = max_orders ? parseInt(max_orders, 10) : undefined;
    const parsedPageSize = page_size ? parseInt(page_size, 10) : undefined;

    if (
      parsedMaxOrders !== undefined &&
      (Number.isNaN(parsedMaxOrders) || parsedMaxOrders <= 0)
    ) {
      console.warn(
        `${new Date().toISOString()} ${ROUTE_TAG} [WARN] [rid=${routeRequestId}] Invalid max_orders`,
        JSON.stringify({ max_orders }),
      );
      return res
        .status(400)
        .json({ error: "max_orders must be a positive integer", requestId: routeRequestId });
    }
    if (
      parsedPageSize !== undefined &&
      (Number.isNaN(parsedPageSize) ||
        parsedPageSize <= 0 ||
        parsedPageSize > 250)
    ) {
      console.warn(
        `${new Date().toISOString()} ${ROUTE_TAG} [WARN] [rid=${routeRequestId}] Invalid page_size`,
        JSON.stringify({ page_size }),
      );
      return res.status(400).json({
        error: "page_size must be an integer between 1 and 250",
        requestId: routeRequestId,
      });
    }

    const result = await getPaymentRejectionRate({
      startDate: start_date,
      endDate: end_date,
      maxOrders: parsedMaxOrders,
      pageSize: parsedPageSize,
    });

    console.log(
      `${new Date().toISOString()} ${ROUTE_TAG} [INFO] [rid=${routeRequestId}] Request completed`,
      JSON.stringify({
        durationMs: Date.now() - startedAt,
        serviceRequestId: result.requestId,
        ordersScanned: result.ordersScanned,
        rejectionRate: result.rejectionRate,
        truncated: result.truncated,
      }),
    );

    res.json({ ...result, routeRequestId });
  } catch (error) {
    console.error(
      `${new Date().toISOString()} ${ROUTE_TAG} [ERROR] [rid=${routeRequestId}] Request failed`,
      JSON.stringify({
        durationMs: Date.now() - startedAt,
        errorName: error?.name,
        errorMessage: error?.message,
        stack: error?.stack,
      }),
    );
    res.status(500).json({
      error: "Error computing payment rejection rate",
      message: error.message,
      requestId: routeRequestId,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server started!");
  console.log(`📡 Listening on port ${PORT}`);
  //console.log(`🏪 Connected to shop: ${process.env.SHOPIFY_SHOP_NAME}`);
});
