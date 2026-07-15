// SKU pricing configuration based on tiers
const SKU_PRICING = {
  "MJT/MJP82": {
    description: "FRENCH TERRY HOODIE SET",
    prices: {
      TIER_1: 42.5,
      TIER_2: 40.0,
      TIER_3: 38.0,
      RETAIL: 56.99,
    },
  },
  MJT82: {
    description: "FRENCH TERRY HOODIE",
    prices: {
      TIER_1: 22.5,
      // TIER_1: 36.99,
      TIER_2: 20.0,
      TIER_3: 20.0,
      RETAIL: 29.99,
    },
  },
  MJP82: {
    description: "FRENCH TERRY JOGGER",
    prices: {
      TIER_1: 20.0,
      TIER_2: 20.0,
      TIER_3: 18.0,
      RETAIL: 29.99,
    },
  },
  MJT83: {
    description: "FRENCH TERRY ZIP-UP",
    prices: {
      TIER_1: 25.0,
      TIER_2: 24.0,
      TIER_3: 23.0,
      RETAIL: 37.99,
    },
  },
  MJT84: {
    description: "FRENCH TERRY CREWNECK",
    prices: {
      TIER_1: 17.5,
      TIER_2: 16.5,
      TIER_3: 15.0,
      RETAIL: 24.99,
    },
  },
  "MJT/MJP64": {
    description: "MEN'S FLEECE HOODIE SET",
    prices: {
      TIER_1: 32.5,
      TIER_2: 30.0,
      TIER_3: 28.0,
      RETAIL: 41.99,
    },
  },
  MJT64: {
    description: "MEN'S FLEECE HOODIE",
    prices: {
      TIER_1: 17.5,
      TIER_2: 16.0,
      TIER_3: 15.0,
      RETAIL: 22.19,
    },
  },
  MJP64: {
    description: "MEN'S FLEECE JOGGER",
    prices: {
      TIER_1: 15.0,
      TIER_2: 14.0,
      TIER_3: 14.0,
      RETAIL: 22.19,
    },
  },
  "WJT/WJP64": {
    description: "WOMEN'S FLEECE HOODIE SET",
    prices: {
      TIER_1: 32.5,
      TIER_2: 30.0,
      TIER_3: 28.0,
      RETAIL: 41.99,
    },
  },
  WJT64: {
    description: "WOMEN'S FLEECE HOODIE",
    prices: {
      TIER_1: 17.5,
      TIER_2: 16.0,
      TIER_3: 15.0,
      RETAIL: 22.19,
    },
  },
  WJP64: {
    description: "WOMEN'S FLEECE JOGGER",
    prices: {
      TIER_1: 15.0,
      TIER_2: 14.0,
      TIER_3: 13.0,
      RETAIL: 22.19,
    },
  },
  "MJT/MJP65": {
    description: "EN'S FLEECE ZIP-UP O.B SET",
    prices: {
      TIER_1: 36.0,
      TIER_2: 34.0,
      TIER_3: 32.0,
      RETAIL: 47.99,
    },
  },
  "MJT/MJP75": {
    description: "MEN'S FAUX-SUEDE SET",
    prices: {
      TIER_1: 38.0,
      TIER_2: 36.0,
      TIER_3: 34.0,
      RETAIL: 49.99,
    },
  },
  MT51: {
    description: "CANVAS MUSCLE T-SHIRT",
    prices: {
      TIER_1: 9.0,
      TIER_2: 8.5,
      TIER_3: 8.0,
      RETAIL: 16.99,
    },
  },
  MT52: {
    description: "CANVAS T-SHIRT",
    prices: {
      TIER_1: 9.5,
      TIER_2: 9.0,
      TIER_3: 8.5,
      RETAIL: 16.99,
    },
  },
  MS52: {
    description: "CANVAS FLEECE SHORTS",
    prices: {
      TIER_1: 12.5,
      TIER_2: 11.5,
      TIER_3: 10.5,
      RETAIL: 16.49,
    },
  },
  MS52T: {
    description: "CANVAS TERRY SHORTS",
    prices: {
      TIER_1: 12.5,
      TIER_2: 11.5,
      TIER_3: 10.5,
      RETAIL: 17.49,
    },
  },
  MS82: {
    description: "FRENCH TERRY SHORTS",
    prices: {
      TIER_1: 15.0,
      TIER_2: 13.5,
      TIER_3: 12.5,
      RETAIL: 19.49,
    },
  },
  MT62: {
    description: "VINTAGE WAX DYE T-SHIRT",
    prices: {
      TIER_1: 14.5,
      TIER_2: 13.5,
      TIER_3: 12.5,
      RETAIL: 24.99,
    },
  },
  MS62: {
    description: "VINTAGE WASH TERRY SHORTS",
    prices: {
      TIER_1: 19.0,
      // TIER_1: 28.99,
      TIER_2: 25.99,
      TIER_3: 23.99,
      RETAIL: 23.99,
    },
  },
  "MJT/MJP43": {
    description: "MEN'S TECH FLEECE SETS",
    prices: {
      TIER_1: 30.0,
      TIER_2: 27.5,
      TIER_3: 25.0,
      RETAIL: 35.99,
    },
  },
  "WJT/WJP43": {
    description: "WOMEN'S TECH FLEECE SETS",
    prices: {
      TIER_1: 30.0,
      TIER_2: 27.5,
      TIER_3: 25.0,
      RETAIL: 35.99,
    },
  },
};

function getSkuPrice(sku, tier) {
  if (!SKU_PRICING[sku]) {
    throw new Error(`SKU ${sku} not found in pricing configuration`);
  }

  if (!SKU_PRICING[sku].prices[tier]) {
    throw new Error(`Tier ${tier} not found for SKU ${sku}`);
  }

  return SKU_PRICING[sku].prices[tier];
}

function validateCartItems(cart) {
  const skuQuantities = {};
  const invalidSkus = [];
  let totalItems = 0;
  let originalCartTotal = 0;

  // Group items by SKU and validate SKUs
  cart.items.forEach((item) => {
    if (!SKU_PRICING[item.sku?.split(" ")[0]]) {
      invalidSkus.push(item.sku);
    } else {
      skuQuantities[item.sku?.split(" ")[0]] =
        (skuQuantities[item.sku?.split(" ")[0]] || 0) + item.quantity;
      totalItems += item.quantity;
      // originalCartTotal += parseDisplayPriceToShopify(
      //   decimalFix(
      //     parseDisplayPriceToShopify(item.original_price) * item.quantity,
      //   ),
      // );
      originalCartTotal += parseDisplayPriceToShopify(
        decimalFix(
          getSkuPrice(item.sku?.split(" ")[0], "RETAIL") * item.quantity,
        ),
        true,
      );
    }
  });

  return {
    isValid: invalidSkus.length === 0,
    invalidSkus,
    skuQuantities,
    totalItems,
    originalCartTotal: originalCartTotal,
  };
}

function checkTier1Eligibility(skuQuantities, cartTotal, customer) {
  // Check if either condition is met:
  // 1. Any item type has 3 or more quantity
  // 2. Cart total is $250 or more   //300
  const hasMinQuantity = Object.values(skuQuantities).some(
    (quantity) => quantity >= 3,
  );
  const meetsMinTotal = cartTotal >= 25000; //30000
  const normalizedTags = new Set(
    (customer.tags ?? []).map((tag) => tag.trim().toLowerCase()),
  );

  return {
    eligible: normalizedTags.has("tier_1") || meetsMinTotal, //hasMinQuantity ||
    reason: normalizedTags.has("tier_1")
      ? "Customer tag"
      : meetsMinTotal
        ? "minimum_total"
        : null, //hasMinQuantity ? "minimum_quantity" : null,
    details: {
      hasMinQuantity,
      meetsMinTotal,
      cartTotal: cartTotal,
      itemQuantities: skuQuantities,
    },
  };
}

function calculateDetailedPrices(cart, tier, validation) {
  const details = {
    items: [],
    subtotal: 0,
    totalSavings: 0,
    originalTotal: 0,
  };

  // For Tier 1, we need special handling
  if (tier === "TIER_1") {
    const validation = validateCartItems(cart);
    // const cartMeetsMinTotal = validation.originalCartTotal >= 30000;
    const cartMeetsMinTotal = validation.originalCartTotal >= 25000;

    cart.items.forEach((item) => {
      const originalPrice = parseDisplayPriceToShopify(
        decimalFix(
          parseDisplayPriceToShopify(item.original_price) * item.quantity,
        ),
      );
      const quantity = item.quantity;
      let discountedUnitPrice;
      let discountedUnitFromSkuTable = false;

      // Apply discount if cart total >= $300 OR this specific item has quantity >= 3
      if (
        cartMeetsMinTotal ||
        quantity >= 3 ||
        validation.skuQuantities[item.sku?.split(" ")[0]] >= 3
      ) {
        discountedUnitPrice = getSkuPrice(item.sku?.split(" ")[0], tier);
        discountedUnitFromSkuTable = true;
      } else {
        discountedUnitPrice = item.original_price; // Keep original price
      }

      const discountedTotal = parseDisplayPriceToShopify(
        decimalFix(
          parseDisplayPriceToShopify(
            discountedUnitPrice,
            discountedUnitFromSkuTable,
          ) * quantity,
        ),
      );
      const savings = parseDisplayPriceToShopify(
        decimalFix(originalPrice - discountedTotal),
      );

      details.items.push({
        ...item,
        sku: item.sku,
        description: SKU_PRICING[item.sku?.split(" ")[0]].description,
        quantity: quantity,
        originalUnitPrice: parseDisplayPriceToShopify(item.original_price),
        discountedUnitPrice: parseDisplayPriceToShopify(
          discountedUnitPrice,
          discountedUnitFromSkuTable,
        ),
        originalTotal: parseDisplayPriceToShopify(originalPrice),
        discountedTotal,
        savings,
        discountApplied:
          parseDisplayPriceToShopify(
            discountedUnitPrice,
            discountedUnitFromSkuTable,
          ) !== parseDisplayPriceToShopify(item.original_price),
      });

      details.subtotal += discountedTotal;
      details.totalSavings += parseDisplayPriceToShopify(savings);
      details.originalTotal += parseDisplayPriceToShopify(originalPrice);
    });
  } else {
    // For Tier 2 and 3, apply discounts to all items
    cart.items.forEach((item) => {
      const originalPrice = parseDisplayPriceToShopify(
        decimalFix(
          parseDisplayPriceToShopify(item.original_price) * item.quantity,
        ),
      );
      const discountedUnitPrice = getSkuPrice(item.sku?.split(" ")[0], tier);
      const discountedTotal = parseDisplayPriceToShopify(
        decimalFix(
          parseDisplayPriceToShopify(discountedUnitPrice, true) * item.quantity,
        ),
      );
      const savings = parseDisplayPriceToShopify(
        decimalFix(originalPrice - discountedTotal),
      );

      details.items.push({
        ...item,
        sku: item.sku,
        description: SKU_PRICING[item.sku?.split(" ")[0]].description,
        quantity: item.quantity,
        originalUnitPrice: parseDisplayPriceToShopify(item.original_price),
        discountedUnitPrice: parseDisplayPriceToShopify(
          discountedUnitPrice,
          true,
        ),
        originalTotal: parseDisplayPriceToShopify(originalPrice),
        discountedTotal,
        savings,
        discountApplied: true,
      });

      details.subtotal += discountedTotal;
      details.totalSavings += parseDisplayPriceToShopify(savings);
      details.originalTotal += parseDisplayPriceToShopify(originalPrice);
    });
  }

  return details;
}

function calculateCartPricing(cart, tier, customer) {
  // First validate the cart
  const validation = validateCartItems(cart);

  if (!validation.isValid) {
    throw new Error(
      `Invalid SKUs found in cart: ${validation.invalidSkus.join(", ")}`,
    );
  }

  // For Tier 1, check eligibility
  if (tier === "TIER_1") {
    const tier1Check = checkTier1Eligibility(
      validation.skuQuantities,
      validation.originalCartTotal,
      customer,
    );
    if (!tier1Check.eligible) {
      return {
        eligible: false,
        reason: "Cart does not meet Tier 1 requirements",
        details: {
          requirementsMet: {
            minQuantity: tier1Check.details.hasMinQuantity
              ? "Yes"
              : "No (need 3+ of any item)",
            minTotal: tier1Check.details.meetsMinTotal
              ? "Yes"
              : `No (cart total $${tier1Check.details.cartTotal} < $300)`,
          },
        },
        originalTotal: validation.originalCartTotal,
        items: cart.items.map((item) => ({
          sku: item.sku,
          description: SKU_PRICING[item.sku?.split(" ")[0]].description,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          key: item.key,
        })),
      };
    }
  }

  // Calculate detailed pricing
  const priceDetails = calculateDetailedPrices(cart, tier, validation);

  return {
    ...priceDetails,
    eligible: true,
    itemCount: validation.totalItems,
    tier,
    discountSummary: `${tier.replace("_", " ")} Pricing Applied`,
    requirements: {
      eligibility: checkTier1Eligibility(
        validation.skuQuantities,
        validation.originalCartTotal,
        customer,
      ),
      totalItems: validation.totalItems,
      originalCartTotal: validation.originalCartTotal,
    },
  };
}

function calculateItemPrice(sku, quantity, tier) {
  const unitPrice = getSkuPrice(sku?.split(" ")[0], tier);
  return {
    unitPrice,
    total: unitPrice * quantity,
    description: SKU_PRICING[sku].description,
  };
}

// Example cart structure for reference
const formatShopifyPrice = (amount) => {
  if (amount?.toString()?.includes(".")) {
    return amount;
  }
  return parseFloat(amount / 100).toFixed(2); // returns a string like "99.99"
};
const parseDisplayPriceToShopify = (price, priceIsInDollars = false) => {
  if (price == null || price === "") return price;
  if (priceIsInDollars) {
    return Math.round(parseFloat(price) * 100);
  }
  if (price?.toString()?.includes(".")) {
    return Math.round(parseFloat(price) * 100); // e.g., "99.99" → 9999
  }
  return price;
};

const decimalFix = (amount, decimalPlaces = 2) => {
  return parseFloat(parseFloat(amount).toFixed(decimalPlaces));
};

module.exports = {
  SKU_PRICING,
  getSkuPrice,
  calculateItemPrice,
  calculateCartPricing,
  validateCartItems,
  checkTier1Eligibility,
  parseDisplayPriceToShopify,
  formatShopifyPrice,
  decimalFix,
};
