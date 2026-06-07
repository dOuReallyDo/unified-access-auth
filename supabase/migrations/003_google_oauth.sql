-- Add provider column to users table for tracking auth method (google, email, etc.)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'email';

-- Add google_id column for linking Google accounts
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id text UNIQUE;

-- Add index for google_id lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_provider ON public.users(provider);