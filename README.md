# DUDSHOP777 Key Generator

A Next.js + Supabase starter for a digital-product reseller portal.

## Included
- Dark purple/pink responsive dashboard
- Supabase email/password signup and login
- Member points display
- Product selection and key generation UI
- Atomic PostgreSQL key generation RPC with inventory locking, points deduction, and transaction history
- User-scoped history via Row Level Security

## Requirements
- Node.js 20+
- Supabase project

## Setup
1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase/schema.sql`.
3. In Supabase Project Settings > API, copy the Project URL and anon/public key.
4. Copy `.env.example` to `.env.local` and fill in the values.
5. In a terminal in this folder run:
   ```bash
   npm install
   npm run dev
   ```
6. Open http://localhost:3000.

## Create an admin
After registering your own account, find its UUID in Supabase Authentication > Users.
In SQL Editor run:
```sql
update public.profiles set role = 'admin' where id = 'YOUR-USER-UUID';
```

## Add a product and keys
Run in Supabase SQL Editor (replace values):
```sql
insert into public.products(name, category, description, price_points)
values ('DEMO PRODUCT', 'PANEL FREE FIRE', 'ตัวอย่างสินค้า', 25)
returning id;
```
Copy the returned product UUID, then add inventory:
```sql
insert into public.key_inventory(product_id, duration, key_value)
values
('PRODUCT-UUID', '30 วัน', 'DEMO-KEY-001'),
('PRODUCT-UUID', '30 วัน', 'DEMO-KEY-002');
```
Do not put real keys in public source code or expose the inventory table to members.

## Important payment note
The Web2U Slip API instructions supplied for this project state that its API key works only inside Web2U stores and cannot be called by an external website/program. Therefore this project does not pretend to integrate it. The payment gateway must be selected separately and integrated server-side with verified webhooks before enabling real top-ups. Never credit a user based only on a browser redirect or uploaded image.

## Production checklist
- Configure Supabase Auth email confirmation and redirect URLs.
- Set up a supported payment provider and verify signed webhooks server-side.
- Add rate limits, monitoring, backups, and admin audit logs.
- Restrict admin role changes to a trusted owner.
- Review legal, tax, and provider requirements before accepting payments.
