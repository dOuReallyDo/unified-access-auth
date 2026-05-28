export type App = {
  id: string;
  slug: string;
  name: string;
  redirect_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type User = {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type UserAppAccess = {
  id: string;
  user_id: string;
  app_id: string;
  role: string;
  is_active: boolean;
  granted_at: string;
};
