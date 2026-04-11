import fs from 'node:fs'
import path from 'node:path'
import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  console.error('Missing STRIPE_SECRET_KEY.')
  process.exit(1)
}

const stripe = new Stripe(stripeSecretKey)

const catalog = {
  pro: {
    productName: 'Body Double Pro',
    productDescription:
      'Unlimited body doubling sessions, scheduling, priority matching, and weekly reports.',
    productLookupKey: 'body_double_pro',
    priceLookupKey: 'body_double_pro_monthly',
    unitAmount: 900,
    recurring: { interval: 'month' },
  },
  lifetime: {
    productName: 'Body Double Lifetime',
    productDescription: 'One-time early access unlock for all Pro features forever.',
    productLookupKey: 'body_double_lifetime',
    priceLookupKey: 'body_double_lifetime',
    unitAmount: 4900,
  },
}

async function ensureProduct(planKey, config) {
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

async function ensurePrice(planKey, config, productId) {
  const prices = await stripe.prices.list({
    lookup_keys: [config.priceLookupKey],
    active: true,
    limit: 1,
  })

  if (prices.data[0]) return prices.data[0]

  return stripe.prices.create({
    product: productId,
    unit_amount: config.unitAmount,
    currency: 'usd',
    lookup_key: config.priceLookupKey,
    recurring: config.recurring,
    metadata: {
      app: 'body-double',
      catalog_key: planKey,
    },
  })
}

function upsertEnvValue(content, key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')

  if (pattern.test(content)) {
    return content.replace(pattern, line)
  }

  return `${content.trimEnd()}\n${line}\n`
}

async function main() {
  const proProduct = await ensureProduct('pro', catalog.pro)
  const lifetimeProduct = await ensureProduct('lifetime', catalog.lifetime)
  const proPrice = await ensurePrice('pro', catalog.pro, proProduct.id)
  const lifetimePrice = await ensurePrice('lifetime', catalog.lifetime, lifetimeProduct.id)

  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8')
    envContent = upsertEnvValue(envContent, 'STRIPE_PRO_PRODUCT_ID', proProduct.id)
    envContent = upsertEnvValue(envContent, 'STRIPE_LIFETIME_PRODUCT_ID', lifetimeProduct.id)
    envContent = upsertEnvValue(envContent, 'STRIPE_PRO_PRICE_ID', proPrice.id)
    envContent = upsertEnvValue(envContent, 'STRIPE_LIFETIME_PRICE_ID', lifetimePrice.id)
    fs.writeFileSync(envPath, envContent)
  }

  console.log('Stripe catalog ready.')
  console.log(`Pro product: ${proProduct.id}`)
  console.log(`Pro price: ${proPrice.id}`)
  console.log(`Lifetime product: ${lifetimeProduct.id}`)
  console.log(`Lifetime price: ${lifetimePrice.id}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
