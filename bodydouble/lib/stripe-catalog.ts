import Stripe from 'stripe'

export type StripePlanKey = 'pro' | 'lifetime'

type CatalogDefinition = {
  productName: string
  productDescription: string
  productLookupKey: string
  priceLookupKey: string
  unitAmount: number
  recurring?: {
    interval: 'month'
  }
}

const STRIPE_CATALOG: Record<StripePlanKey, CatalogDefinition> = {
  pro: {
    productName: 'Body Double Core',
    productDescription:
      '20 sessions per month with scheduling, priority matching, and weekly reports.',
    productLookupKey: 'body_double_pro',
    priceLookupKey: 'body_double_pro_monthly',
    unitAmount: 900,
    recurring: { interval: 'month' },
  },
  lifetime: {
    productName: 'Body Double Plus',
    productDescription: '50 sessions per month with highest priority matching and advanced insights.',
    productLookupKey: 'body_double_lifetime',
    priceLookupKey: 'body_double_lifetime',
    unitAmount: 1900,
    recurring: { interval: 'month' },
  },
}

function isCompatiblePrice(price: Stripe.Price, config: CatalogDefinition, productId: string) {
  const expectedInterval = config.recurring?.interval
  const actualInterval = price.recurring?.interval

  return (
    price.active &&
    price.product === productId &&
    price.currency === 'usd' &&
    price.unit_amount === config.unitAmount &&
    (expectedInterval ? actualInterval === expectedInterval : actualInterval == null)
  )
}

async function ensureProduct(stripe: Stripe, planKey: StripePlanKey) {
  const config = STRIPE_CATALOG[planKey]
  const products = await stripe.products.list({ active: true, limit: 100 })

  const existing = products.data.find(
    (product) =>
      product.metadata?.catalog_key === planKey ||
      product.metadata?.lookup_key === config.productLookupKey ||
      product.name === config.productName
  )

  if (existing) return existing

  return stripe.products.create({
    name: config.productName,
    description: config.productDescription,
    metadata: {
      app: 'body-double',
      catalog_key: planKey,
      lookup_key: config.productLookupKey,
    },
  })
}

async function ensurePrice(stripe: Stripe, planKey: StripePlanKey, productId: string) {
  const config = STRIPE_CATALOG[planKey]
  const prices = await stripe.prices.list({
    lookup_keys: [config.priceLookupKey],
    limit: 100,
  })

  const existing = prices.data.find((price) => isCompatiblePrice(price, config, productId))

  if (existing) return existing

  return stripe.prices.create({
    product: productId,
    unit_amount: config.unitAmount,
    currency: 'usd',
    lookup_key: config.priceLookupKey,
    transfer_lookup_key: true,
    recurring: config.recurring,
    metadata: {
      app: 'body-double',
      catalog_key: planKey,
    },
  })
}

export async function ensureStripeCatalog(stripe: Stripe) {
  const [proProduct, lifetimeProduct] = await Promise.all([
    ensureProduct(stripe, 'pro'),
    ensureProduct(stripe, 'lifetime'),
  ])

  const [proPrice, lifetimePrice] = await Promise.all([
    ensurePrice(stripe, 'pro', proProduct.id),
    ensurePrice(stripe, 'lifetime', lifetimeProduct.id),
  ])

  return {
    pro: {
      productId: proProduct.id,
      priceId: proPrice.id,
    },
    lifetime: {
      productId: lifetimeProduct.id,
      priceId: lifetimePrice.id,
    },
  }
}
