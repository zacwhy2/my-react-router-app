import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("txns1", "routes/txns1.tsx"),
  route("accounts", "routes/accounts.tsx"),
  route("teams", "routes/teams.tsx"),
  route("signin", "routes/signin.tsx"),
  route("auth/callback", "routes/auth-callback.tsx"),
] satisfies RouteConfig;
