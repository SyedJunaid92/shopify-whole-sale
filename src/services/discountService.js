const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
require("@shopify/shopify-api/adapters/node");
const Shopify = require("shopify-api-node");
const {
  calculateCartPricing,
  validateCartItems,
  checkTier1Eligibility,
  parseDisplayPriceToShopify,
  formatShopifyPrice,
  decimalFix,
} = require("./skuPricing");
const { TIER_REQUIREMENTS } = require("../constant");

// Initialize Shopify client
// const shopify2 = shopifyApi({
//   apiKey: process.env.SHOPIFY_API_KEY,
//   apiSecretKey: process.env.SHOPIFY_API_SECRET,
//   scopes: [
//     "read_products",
//     "write_products",
//     "read_customers",
//     "write_customers",
//     "read_orders",
//     "write_orders",
//   ],
//   hostName: process.env.SHOPIFY_SHOP_NAME,
//   apiVersion: LATEST_API_VERSION,
//   isEmbeddedApp: false,
//   hostScheme: "https",
//   adminApiAccessToken: process.env.SHOPIFY_ACCESS_TOKEN,
// });
const shopify = new Shopify({
  shopName: process.env.SHOPIFY_SHOP_NAME,
  apiKey: process.env.SHOPIFY_API_KEY,
  password: process.env.SHOPIFY_ACCESS_TOKEN,
  apiVersion: LATEST_API_VERSION,
});
// const shopifyTest = new Shopify({
//   shopName: process.env.SHOPIFY_SHOP_NAME,
//   apiKey: process.env.SHOPIFY_API_KEY,
//   password: process.env.SHOPIFY_ACCESS_TOKEN,
//   apiVersion: LATEST_API_VERSION,
// });
// Create REST client with proper session
// const createClient = () => {
//   return new shopify2.clients.Rest({
//     session: {
//       shop: process.env.SHOPIFY_SHOP_NAME,
//       accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
//     },
//   });
// };

// Minimum requirements for each tier

async function calculateWholesaleDiscount(cart, customer) {
  try {
    // Remove any existing retail discounts

    // await removeRetailDiscounts(cart.token);

    // Validate cart items first
    const validation = validateCartItems(cart);
    if (!validation.isValid) {
      console.error("Invalid SKUs in cart:", validation.invalidSkus);
      return null;
    }

    const cartTotal = validation.originalCartTotal;
    const itemCount = validation.totalItems;
    const lifetimeSpend = await getCustomerLifetimeSpend(customer.id);

    // Determine tier based on cart contents and customer history
    const tier = determineTier(cartTotal, itemCount, lifetimeSpend, validation);

    // Calculate what's remaining to achieve next tier
    const nextTierRequirements = calculateNextTierRequirements(
      cartTotal,
      itemCount,
      lifetimeSpend,
      tier
    );

    if (!tier) {
      return {
        type: "no_discount",
        reason: "Cart does not meet any tier requirements",
        originalTotal: parseDisplayPriceToShopify(cartTotal),
        nextTierRequirements, // Add next tier requirements even when no discount
      };
    }

    // Calculate detailed pricing for the tier
    const pricing = calculateCartPricing(cart, tier);

    // If pricing shows not eligible (especially for Tier 1), return original prices
    if (!pricing.eligible) {
      return {
        type: "no_discount",
        reason: pricing.reason,
        originalTotal: pricing.originalTotal,
        items: pricing.items,
      };
    }
    // Create line item adjustments
    const lineItemAdjustments = pricing.items.map((item) => ({
      ...item,
      id: cart.items.find((i) => i.sku === item.sku).id,
      savings: item.savings,
      description: `${tier.replace("_", " ")} Price: $${formatShopifyPrice(
        item.discountedUnitPrice
      )}`,
      discounted_price: parseDisplayPriceToShopify(item.discountedUnitPrice),
      total_discounted_price: parseDisplayPriceToShopify(
        item.discountedUnitPrice * item.quantity
      ),
    }));
    return {
      type: "line_item_adjustment",
      adjustments: lineItemAdjustments,
      title: `Wholesale ${tier.replace("_", " ")} Pricing`,
      summary: {
        totalSavings: pricing.totalSavings,
        discountedSubtotal: pricing.subtotal,
        originalTotal: pricing.originalTotal,
        tier,
        requirements: pricing.requirements,
      },
      tier: tier?.replace("_", " "),
      lifetimeSpend,
      nextTierRequirements, // Add next tier requirements
      ...calculateTotalValues(lineItemAdjustments),
      // total_original: cartTotal,
      // total_discount: lineItemAdjustments
      //   ?.filter((item) => !item.is_cart)
      //   .reduce((total, item) => total + item.total_discounted_price, 0),
      // total_savings: lineItemAdjustments
      //   ?.filter((item) => !item.is_cart)
      //   .reduce((total, item) => total + item.savings, 0),
      // total_quantity: lineItemAdjustments
      //   ?.filter((item) => !item.is_cart)
      //   .reduce((total, item) => total + item.quantity, 0),
    };
  } catch (error) {
    console.error("Error calculating wholesale discount:", error);
    throw error;
  }
}

function determineTier(cartTotal, itemCount, lifetimeSpend, validation) {
  // Check Tier 3 requirements first (highest discount)
  if (
    (cartTotal >= TIER_REQUIREMENTS.TIER_3.minOrderValue &&
      itemCount >= TIER_REQUIREMENTS.TIER_3.minItems) ||
    (cartTotal >= TIER_REQUIREMENTS.TIER_3.minOrderValue &&
      lifetimeSpend >= TIER_REQUIREMENTS.TIER_3.minLifetimeSpend)
  ) {
    return "TIER_3";
  }

  // Check Tier 2 requirements
  if (
    (cartTotal >= TIER_REQUIREMENTS.TIER_2.minOrderValue &&
      itemCount >= TIER_REQUIREMENTS.TIER_2.minItems &&
      itemCount <= TIER_REQUIREMENTS.TIER_2.maxItems) ||
    (cartTotal >= TIER_REQUIREMENTS.TIER_2.minOrderValue &&
      lifetimeSpend >= TIER_REQUIREMENTS.TIER_2.minLifetimeSpend)
  ) {
    return "TIER_2";
  }

  // Check Tier 1 requirements
  const tier1Eligibility = checkTier1Eligibility(
    validation.skuQuantities,
    cartTotal
  );
  if (tier1Eligibility.eligible) {
    return "TIER_1";
  }

  return null;
}

function calculateNextTierRequirements(
  cartTotal,
  itemCount,
  lifetimeSpend,
  currentTier
) {
  // If already at highest tier, return null
  if (currentTier === "TIER_3") {
    return {
      nextTier: null,
      message: "You've reached the highest discount tier!",
      requirements: null,
    };
  }

  let nextTier, requirements;

  if (currentTier === "TIER_1") {
    nextTier = "TIER_2";
    requirements = {
      minOrderValue: Math.max(
        0,
        TIER_REQUIREMENTS.TIER_2.minOrderValue - cartTotal
      ),
      minItems: Math.max(0, TIER_REQUIREMENTS.TIER_2.minItems - itemCount),
      minLifetimeSpend: Math.max(
        0,
        TIER_REQUIREMENTS.TIER_2.minLifetimeSpend - lifetimeSpend
      ),
    };
  } else if (currentTier === "TIER_2") {
    nextTier = "TIER_3";
    requirements = {
      minOrderValue: Math.max(
        0,
        TIER_REQUIREMENTS.TIER_3.minOrderValue - cartTotal
      ),
      minItems: Math.max(0, TIER_REQUIREMENTS.TIER_3.minItems - itemCount),
      minLifetimeSpend: Math.max(
        0,
        TIER_REQUIREMENTS.TIER_3.minLifetimeSpend - lifetimeSpend
      ),
    };
  } else {
    // No current tier - check what's needed for Tier 1
    nextTier = "TIER_1";
    requirements = {
      minOrderValue: Math.max(
        0,
        TIER_REQUIREMENTS.TIER_1.minOrderValue - cartTotal
      ),
      minItems: 0, // Tier 1 doesn't have minItems requirement
      minLifetimeSpend: 0, // Tier 1 doesn't have lifetime spend requirement
    };
  }

  // Generate message based on what's needed
  const messages = [];
  if (requirements.minOrderValue > 0) {
    messages.push(
      `Add $${requirements.minOrderValue.toFixed(2)} more to your order`
    );
  }
  if (requirements.minItems > 0) {
    messages.push(`Add ${requirements.minItems} more items`);
  }
  if (requirements.minLifetimeSpend > 0) {
    messages.push(
      `Spend $${requirements.minLifetimeSpend.toFixed(
        2
      )} more lifetime to qualify`
    );
  }

  const message =
    messages.length > 0
      ? `To reach ${nextTier.replace("_", " ")}: ${messages.join(" OR ")}`
      : `You qualify for ${nextTier.replace("_", " ")}!`;

  return {
    nextTier,
    message,
    requirements,
    currentValues: {
      cartTotal,
      itemCount,
      lifetimeSpend,
    },
  };
}

function calculateCartTotal(cart) {
  return cart.items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);
}

function calculateItemCount(cart) {
  return cart.items.reduce((total, item) => {
    return total + item.quantity;
  }, 0);
}
function calculateTotalValues(lineItemAdjustments) {
  const initialValues = {
    total_discount: 0,
    total_savings: 0,
    total_quantity: 0,
    total_original: 0,
  };

  return (
    lineItemAdjustments
      ?.filter((item) => !item.is_cart)
      .reduce(
        (totals, item) => ({
          total_discount: totals.total_discount + item.total_discounted_price,
          total_savings: totals.total_savings + item.savings,
          total_quantity: totals.total_quantity + item.quantity,
          total_original:
            totals.total_original +
            parseDisplayPriceToShopify(item.original_price) * item.quantity,
        }),
        initialValues
      ) || initialValues
  );
}
async function getCustomerLifetimeSpend(customerId) {
  try {
    // const client = createClient();
    // const response = await client.get({
    //   path: `customers/${customerId}/orders`,
    //   query: { status: "any" },
    // });
    const totalSpent = (await shopify.customer.get(customerId)).total_spent;

    return +totalSpent;

    // return response.body.orders.reduce((total, order) => {
    //   return total + parseFloat(order.total_price);
    // }, 0);
  } catch (error) {
    console.error("Error getting customer lifetime spend:", error);
    return 0;
  }
}

async function removeRetailDiscounts(cartId) {
  // const client = createClient();
  try {
    // Get current discounts
    // const response = await client.get({
    //   path: `carts/${cartId}/discounts`,
    // });
    const response = await shopify.cart.getDiscounts(cartId);

    // Remove retail discounts
    for (const discount of response.body.discounts) {
      if (discount.title.toLowerCase().includes("retail")) {
        await client.delete({
          path: `carts/${cartId}/discounts/${discount.id}`,
        });
      }
    }
  } catch (error) {
    console.error("Error removing retail discounts:", error);
  }
}

module.exports = {
  calculateWholesaleDiscount,
  getCustomerLifetimeSpend,
  calculateNextTierRequirements,
};
