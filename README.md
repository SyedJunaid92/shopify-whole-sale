<<<<<<< HEAD
# wholesale-test
=======
# Shopify Wholesale Discount Application

This Node.js application integrates with Shopify to provide tier-based wholesale discounts for customers with the "wholesale" tag.

## Features

- Tier-based wholesale discounts
- Automatic removal of retail discounts when wholesale discounts apply
- Cart total and item quantity-based tier qualification
- Lifetime spend tracking for tier qualification
- Real-time discount application on cart updates

## Tier Structure

### Tier 1 (Base Tier)

- Minimum $300 cart order value
- Default tier for all new wholesale customers

### Tier 2

- Method 1: Minimum $300 order + 12-23 items
- Method 2: Minimum $300 order + $5,000 lifetime spend

### Tier 3

- Method 1: Minimum $100 order + 24+ items
- Method 2: Minimum $100 order + $10,000 lifetime spend

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your Shopify credentials:

   ```
   SHOPIFY_SHOP_NAME=your-shop-name.myshopify.com
   SHOPIFY_ACCESS_TOKEN=your_access_token
   SHOPIFY_API_KEY=your_api_key
   SHOPIFY_API_SECRET=your_api_secret
   ```

4. Set up Shopify webhooks:
   - Go to your Shopify admin
   - Navigate to Settings > Notifications > Webhooks
   - Add a webhook for "Cart updates"
   - Set the webhook URL to: `https://your-domain.com/webhooks/cart/update`

## Running the Application

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## Discount Percentages

- Tier 1: 10% discount
- Tier 2: 15% discount
- Tier 3: 20% discount

## Notes

- The application automatically removes any retail discounts when applying wholesale discounts
- Discounts are applied in real-time as customers update their cart
- The system checks both cart value and item quantity requirements
- Lifetime spend is tracked to qualify for higher tiers
>>>>>>> 90a6126 (Test)
