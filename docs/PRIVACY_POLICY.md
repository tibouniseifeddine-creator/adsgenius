> **Draft, not legal advice.** This is a starting template built from what the AdsGenius codebase actually does (see `docs/THIRD_PARTY_SERVICES.md`, which this document is based on) -- it is not a substitute for review by a lawyer qualified in the jurisdiction(s) where you operate and where your customers are located. Fill in every `[bracketed]` placeholder, confirm accuracy against the current codebase before each publication, and have it reviewed before this is shown to a real customer. Data protection requirements (e.g. Algeria's Law 18-07, GDPR if you have EU users, or others) impose specific obligations this draft does not attempt to fully satisfy on its own.

# Privacy Policy

**Effective date:** [date]
**Last updated:** [date]

## Who we are

[Company/operator legal name], ("**we**", "**us**"), operating AdsGenius (the "**Service**") at [domain/URL]. Contact: [privacy contact email].

## What information we collect

### Account information
Name, email address, business/workspace name, and a hashed password (we never store your password in plain text) when you register.

### Information you add to the Service
Product data, ad creatives, audience definitions, and campaign plans you create. Order data for your own customers, including their name, phone number, and delivery address, when you record an order or a customer submits one through your public order form.

### Connected third-party accounts
If you connect a Meta (Facebook/Instagram) ad account, we store an access token (encrypted at rest -- see `docs/SECURITY.md`) and read your ad account's name, currency, and campaign/ad-set/ad performance data (spend, impressions, clicks). We request read-only access; we do not create, edit, or publish anything to your ad account.

### Automatically collected information
Standard request metadata (IP address, timestamps) is processed transiently for security purposes such as rate-limiting login and registration attempts; it is not compiled into a stored user profile.

## How we use information

- To provide the Service: storing your products/orders/creatives, computing your dashboard metrics, generating AI copy/images/audience suggestions on your behalf, and creating real courier shipments when you ask us to.
- To secure the Service: rate-limiting abusive requests, detecting and preventing fraud/abuse.
- We do **not** sell your data or your customers' order data to third parties, and we do not use your product or order data to train AI models.

## Who we share information with

See `docs/THIRD_PARTY_SERVICES.md` for the complete, current list. In summary:

- **Anthropic** and **OpenAI** receive product/creative text (and, for image generation, descriptive prompts) to generate AI content on your behalf. They do not receive your customers' order data.
- **Meta** is contacted only if and when you connect an ad account, using a read-only access token you grant through Meta's own OAuth consent screen.
- **ZR Express (Procolis)** receives a specific customer's order and delivery details only when you (or an automated flow you trigger) create a real shipment for that order.
- **[Your hosting/database providers, e.g. Vercel, Neon]** host the infrastructure the Service runs on.

We do not share data with any other third party except as required by law or with your explicit direction.

## Data retention

[Describe how long account, order, and campaign data is retained after account closure, and your deletion process. The codebase does not currently implement automatic data expiry -- decide and document a real retention policy before publishing this.]

## Your rights

Depending on your jurisdiction, you may have rights to access, correct, export, or delete your personal data. Contact us at [privacy contact email] to exercise these rights. [Add jurisdiction-specific rights language -- e.g., GDPR Articles 15-22 for EU users -- if applicable.]

## Security

See `docs/SECURITY.md` for a description of the technical measures in place (encryption of Meta access tokens at rest, password hashing, rate limiting, and so on). No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.

## Children's privacy

The Service is not directed at, and we do not knowingly collect information from, individuals under [16/18 -- pick per applicable law].

## Changes to this policy

We will update the "Last updated" date above when this policy changes and, for material changes, notify account holders by [email / in-app notice].

## Contact

[Company/operator legal name]
[Address]
[Privacy contact email]
