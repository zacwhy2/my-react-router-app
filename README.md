# Welcome to React Router!

A modern, production-ready template for building full-stack React applications using React Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Supabase setup

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your environment.
The app expects a `public.todos` table with an auto-generated numeric `id`
primary key and a required text `description` column.

The `/txns1` page expects a `public.txns1` table with `id` and `created_at`
defaults, required `occured_at` (date), `amount` (numeric), and `description`
columns, plus required `from_account_id` and `to_account_id` foreign keys to
`public.accounts(id)`. The `public.accounts` table has `id`, `name`, `can_from`,
and `can_to` columns.

To migrate an existing transaction table that still has text `from` and `to`
columns, make sure every existing value matches exactly one account name
(ignoring case and surrounding whitespace), then run
[`supabase/migrations/20261121233000_use_account_foreign_keys_for_transactions.sql`](./supabase/migrations/20261121233000_use_account_foreign_keys_for_transactions.sql)
in the Supabase SQL Editor. It fills any missing account IDs, checks for
unmatched or ambiguous values, makes both foreign keys required, and drops the
legacy text columns. If the migration reports unmatched values, create or
rename the corresponding accounts and retry.

### Email/password sign-in and private data

The app uses Supabase email/password authentication. Enable email authentication
in the Supabase Auth provider settings. The sign-in page supports creating an
account and requesting a password reset. Add the local callback URL
`http://localhost:5173/auth/callback` and your deployed
`https://<your-domain>/auth/callback` URL to the Supabase Auth redirect URL
allowlist for account confirmation and password recovery links.

If you previously signed in using an email link, use **Forgot password?** to
set a password for that account. Before applying the ownership migration, make
sure the `zacwhy@gmail.com` account exists in Supabase Auth (create it or reset
its password). Then run
[`supabase/migrations/20261118220000_add_email_auth_and_user_ownership.sql`](./supabase/migrations/20261118220000_add_email_auth_and_user_ownership.sql)
in the Supabase SQL Editor. It assigns existing todo and transaction rows to
that account, sets new rows to the signed-in user, and replaces existing table
policies with owner-scoped Row Level Security policies. The app also redirects
signed-out visitors to the sign-in page; RLS enforces ownership at the
database, not just in the UI.

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
