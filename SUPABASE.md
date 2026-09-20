# Supabase security

Apply `supabase/migrations/001_security.sql` after the `pipelines` table exists. It enables RLS and creates owner-only select/insert/update/delete policies using `auth.uid() = user_id`. It also adds an atomic per-user, per-route one-minute request counter for all LLM routes. Expensive `blueprint` and `refine-batch` routes allow 5 requests/minute; other routes allow 10. Production fails closed if the limiter RPC is unavailable.

## RLS integration check
With the local Supabase stack, create User A and User B. Insert a pipeline with User A's authenticated client. Using User B's authenticated client, assert select returns no row and update/delete affect zero rows. Then assert User A can still select/update/delete it. This requires two real auth sessions and belongs in the deployment smoke test, not a mocked unit test.
