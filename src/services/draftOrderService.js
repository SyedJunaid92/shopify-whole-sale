const { calculateWholesaleDiscount } = require("./discountService");
const Shopify = require("shopify-api-node");
const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const { formatShopifyPrice } = require("./skuPricing");

const shopify = new Shopify({
  shopName: process.env.SHOPIFY_SHOP_NAME,
  apiKey: process.env.SHOPIFY_API_KEY,
  password: process.env.SHOPIFY_ACCESS_TOKEN,
  apiVersion: LATEST_API_VERSION,
});

async function createDraftOrder(cart, customer) {
  try {
    // Calculate wholesale discount if applicable
    let discount = null;
    if (customer.tags && customer.tags.includes("wholesale")) {
      discount = await calculateWholesaleDiscount(cart, customer);
    }

    // return discount;

    // Format line items
    const lineItems = discount.adjustments.map((item) => ({
      ...item,
      properties: [
        {
          name: "Discounted Price",
          value: `$${formatShopifyPrice(item.discounted_price)}`,
        },
        {
          name: "Original Price",
          value: `$${formatShopifyPrice(item.original_price)}`,
        },
      ],
      applied_discount: discount
        ? {
            description: `Wholesale ${discount.tier} Discount`,
            value_type: "fixed_amount",
            value: String(
              +formatShopifyPrice(item.original_price) -
                +formatShopifyPrice(item.discounted_price)
            ),
            amount: String(
              +formatShopifyPrice(item.original_price) -
                +formatShopifyPrice(item.discounted_price)
            ),
            title: `Wholesale ${discount.tier}`,
          }
        : null,
    }));

    // // Create draft order
    const draftOrder = {
      line_items: [...lineItems],
      customer: {
        ...customer,
      },
      use_customer_default_address: true,
      // send_invoice: true,
      // invoice_sent_at: new Date().toISOString(),
    };

    // return draftOrder;
    const response = await shopify.draftOrder.create(draftOrder);
    // const response = await shopify.draftOrder.create({
    //   line_items: discount?.adjustments?.map((item) => ({
    //     ...item,
    //     title: item.title, // e.g., "French Terry Set - Dark Grey"
    //     quantity: item.quantity,

    //     applied_discount: {
    //       description: "Tier Discount",
    //       value_type: "fixed_amount",
    //       value: String(
    //         parseFloat(formatShopifyPrice(item.original_price)) -
    //           parseFloat(formatShopifyPrice(item.discounted_price))
    //       ),
    //       amount: String(
    //         parseFloat(formatShopifyPrice(item.original_price)) -
    //           parseFloat(formatShopifyPrice(item.discounted_price))
    //       ),
    //     },

    //     properties: [
    //       {
    //         name: "Discounted Price",
    //         value: `$${formatShopifyPrice(item.discounted_price)}`,
    //       },
    //       {
    //         name: "Original Price",
    //         value: `$${formatShopifyPrice(item.original_price)}`,
    //       },
    //     ],
    //   })),
    //   customer: {
    //     ...customer,
    //   },
    //   use_customer_default_address: true,
    // });

    // const response = await client.post({
    //   path: "draft_orders",
    //   data: { draft_order: draftOrder },
    // });
    // console.log(response);

    return {
      // ...response,
      id: response.id,
      invoice_url: response.invoice_url,
      status: response.status,
      total_price: response.total_price,
    };
  } catch (error) {
    console.error("Error creating draft order:", error);
    throw error;
  }
}

async function getDraftOrderStatus(draftOrderId) {
  try {
    // const response = await client.get({
    //   path: `draft_orders/${draftOrderId}`,
    // });
    const response = await shopify.draftOrder.get(draftOrderId);

    return {
      id: response.id,
      invoice_url: response.invoice_url,
      status: response.status,
      total_price: response.total_price,
    };
  } catch (error) {
    console.error("Error getting draft order status:", error);
    throw error;
  }
}

async function deleteDraftOrder(draftOrderId) {
  try {
    // const response = await client.get({
    //   path: `draft_orders/${draftOrderId}`,
    // });
    const response = await shopify.draftOrder.delete(draftOrderId);
    return { message: "Draft order deleted" };

    // return {
    //   id: response.id,
    //   invoice_url: response.invoice_url,
    //   status: response.status,
    //   total_price: response.total_price,
    // };
  } catch (error) {
    console.error("Error getting draft order status:", error);
    throw error;
  }
}

async function completeDraftOrder(draftOrderId) {
  try {
    const response = await client.put({
      path: `draft_orders/${draftOrderId}/complete`,
    });

    return {
      orderId: response.body.draft_order.order_id,
      status: "completed",
    };
  } catch (error) {
    console.error("Error completing draft order:", error);
    throw error;
  }
}

// async function updateDraftOrder(draftOrderId, updateData) {
//   try {
//     const response = await client.put({
//       path: `draft_orders/${draftOrderId}`,
//       data: { draft_order: updateData },
//     });

//     return {
//       draftOrderId: response.body.draft_order.id,
//       status: response.body.draft_order.status,
//       totalPrice: response.body.draft_order.total_price,
//     };
//   } catch (error) {
//     console.error("Error updating draft order:", error);
//     throw error;
//   }
// }

async function updateDraftOrder(draftOrderId, cart, customer) {
  try {
    // Calculate wholesale discount if applicable
    let discount = null;
    if (customer.tags && customer.tags.includes("wholesale")) {
      discount = await calculateWholesaleDiscount(cart, customer);
    }

    // return discount;

    // Format line items
    const lineItems = discount.adjustments.map((item) => ({
      ...item,
      properties: [
        {
          name: "Discounted Price",
          value: `$${formatShopifyPrice(item.discounted_price)}`,
        },
        {
          name: "Original Price",
          value: `$${formatShopifyPrice(item.original_price)}`,
        },
      ],
      applied_discount: discount
        ? {
            description: `Wholesale ${discount.tier} Discount`,
            value_type: "fixed_amount",
            value: String(
              +formatShopifyPrice(item.original_price) -
                +formatShopifyPrice(item.discounted_price)
            ),
            amount: String(
              +formatShopifyPrice(item.original_price) -
                +formatShopifyPrice(item.discounted_price)
            ),
            title: `Wholesale ${discount.tier}`,
          }
        : null,
    }));

    // // Create draft order
    const draftOrder = {
      line_items: [...lineItems],
      customer: {
        ...customer,
      },
      use_customer_default_address: true,
      // send_invoice: true,
      // invoice_sent_at: new Date().toISOString(),
    };

    // return draftOrder;
    const response = await shopify.draftOrder.update(draftOrderId, draftOrder);
    // const response = await shopify.draftOrder.create({
    //   line_items: discount?.adjustments?.map((item) => ({
    //     ...item,
    //     title: item.title, // e.g., "French Terry Set - Dark Grey"
    //     quantity: item.quantity,

    //     applied_discount: {
    //       description: "Tier Discount",
    //       value_type: "fixed_amount",
    //       value: String(
    //         parseFloat(formatShopifyPrice(item.original_price)) -
    //           parseFloat(formatShopifyPrice(item.discounted_price))
    //       ),
    //       amount: String(
    //         parseFloat(formatShopifyPrice(item.original_price)) -
    //           parseFloat(formatShopifyPrice(item.discounted_price))
    //       ),
    //     },

    //     properties: [
    //       {
    //         name: "Discounted Price",
    //         value: `$${formatShopifyPrice(item.discounted_price)}`,
    //       },
    //       {
    //         name: "Original Price",
    //         value: `$${formatShopifyPrice(item.original_price)}`,
    //       },
    //     ],
    //   })),
    //   customer: {
    //     ...customer,
    //   },
    //   use_customer_default_address: true,
    // });

    // const response = await client.post({
    //   path: "draft_orders",
    //   data: { draft_order: draftOrder },
    // });
    // console.log(response);

    return {
      // ...response,
      id: response.id,
      invoice_url: response.invoice_url,
      status: response.status,
      total_price: response.total_price,
    };
  } catch (error) {
    console.error("Error creating draft order:", error);
    throw error;
  }
}

module.exports = {
  createDraftOrder,
  getDraftOrderStatus,
  completeDraftOrder,
  updateDraftOrder,
  deleteDraftOrder,
};
