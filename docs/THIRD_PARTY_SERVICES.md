# Third-Party Services

Every external service AdsGenius talks to, what it's used for, and what data it sees. This list is the factual basis for the data-processing sections of `docs/PRIVACY_POLICY.md` -- keep the two in sync when a service is added or removed, and confirm each provider's own data-processing terms before relying on this list for a real privacy policy or customer contract.

| Service | Used for | What it receives | Configured via |
|---|---|---|---|
| **Neon** (PostgreSQL) | Primary database -- all workspace, user, product, order, creative, audience, and campaign data | Everything the product stores, including customer order details (name, phone, address) and (if configured) encrypted Meta access tokens | `DATABASE_URL` |
| **Anthropic (Claude)** | AI ad copy generation, product/creative analysis, audience suggestions | Product name/description/category, selling price, and prompts built from these -- no customer PII (order data is never sent to Claude) | `ANTHROPIC_API_KEY` |
| **OpenAI** | AI image generation for creative concepts | A text prompt describing the desired image, derived from product/creative context -- no customer PII | `OPENAI_API_KEY` |
| **Meta Platforms** (Graph/Marketing API) | Reading a connected ad account's campaigns, ad sets, ads, and spend/impressions/click insights | An OAuth access token scoped to `ads_read` (read-only); AdsGenius never writes to or creates anything on Meta today | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` |
| **Vercel Blob** | Storing AI-generated creative images | The generated image files themselves (not customer PII) | `BLOB_READ_WRITE_TOKEN` |
| **ZR Express (Procolis)** | Creating real courier shipments for confirmed orders | Customer name, phone, address, wilaya/commune, and order/product details for the shipment | `ZR_EXPRESS_TOKEN`, `ZR_EXPRESS_KEY` |
| **Vercel** | Application hosting (frontend static build + API serverless functions) | All production traffic passes through Vercel's infrastructure; Vercel's own platform logs (request metadata) are subject to Vercel's privacy policy | Deployment platform |

## Data that never leaves the primary database

Customer order data (name, phone, address) is only sent to a third party when a shipment is actually created via ZR Express for that specific order. It is never sent to Anthropic, OpenAI, or Meta.

## Optional / not yet integrated

The Integrations page shows illustrative entries for a website/e-commerce platform connection and other delivery providers. These are not real connections today (see the main README's Roadmap section) and send no data anywhere.
