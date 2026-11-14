-- Stripe billing (optional; see docs/operations.md).
ALTER TABLE apps ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE apps ADD COLUMN stripe_subscription_id TEXT;
