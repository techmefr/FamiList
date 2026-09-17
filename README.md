# FamiList

Shared shopping list for a household: collaborative lists, aisles ordered shop by shop, loyalty
cards, an accessibility magnifier, and one conversation per list with date polls and a split of
what everyone brings.

A SvelteKit app served as static files, data in Supabase, a local IndexedDB cache so it works
without network. The same build feeds the web and the Android app through Capacitor.

## Requirements

| Tool | Version | Why |
| --- | --- | --- |
| Node | **24 or later** | `@zxing/library` declares `engines.node >= 24`, and `.npmrc` sets `engine-strict=true`: installation fails on Node 22 |
| pnpm | **11.9** | pinned by `packageManager` in `package.json` |
| Docker | — | required by the local Supabase stack |
| JDK + Android SDK | API 36 | only to build the APK (Gradle 8.14.3, `compileSdk` 36, `minSdk` 24) |

The Supabase CLI does not need installing: it is pinned in the dev dependencies and called through
the `db:*` scripts.

```sh
nvm use 24
```

## Install

```sh
pnpm install
cp .env.example .env
```

Two variables, the only ones in the project:

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Both are public by construction: they ship in the client bundle, and security rests on the RLS
policies, not on keeping them secret. The `service_role` key has no place here.

## Development

```sh
pnpm db:start           # API 54321, database 54322, Studio 54323, mail 54324
pnpm db:reset           # applies the migrations then supabase/seed.sql
pnpm dev                # http://localhost:5173
```

`pnpm db:start` prints the API URL and the anon key to copy into `.env`.

`pnpm db:reset` creates a confirmed and approved test account, the one the end-to-end tests use. It
only exists in the local stack.

After any migration that changes the schema:

```sh
pnpm db:types           # regenerates src/lib/db/types.ts
```

## Tests

```sh
pnpm check              # types
pnpm test               # unit
pnpm test:coverage      # unit, with a coverage threshold
pnpm e2e                # end to end
```

The end-to-end tests need the local stack running, and the Playwright browser:

```sh
pnpm exec playwright install --with-deps chromium
```

> If `pnpm check` reports errors in files you have not touched, look for a stray `node_modules` in a
> parent folder: TypeScript walks up the tree to find `@types/node`, and then picks up a version
> that is foreign to the project.

## Web deployment

The build is static — `@sveltejs/adapter-static`, `index.html` fallback — so any file host will do,
as long as it rewrites every route to `index.html`.

```sh
pnpm build              # produces build/
pnpm preview            # serves that build locally
```

On Vercel, `vercel.json` already carries the build command, the output folder, the rewrite and the
security headers. The only setting to make in the interface is adding `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_ANON_KEY` to the project environment variables.

### Production database

```sh
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

`db push` applies the migrations. **Do not run `supabase/seed.sql` in production**: it creates a
test account whose password is written in the repository.

Finally set `site_url` and the redirect URLs to the real domain, in the Supabase project
authentication settings.

#### Writing a migration

One file per change, never an edit to a file already applied:

```
supabase/migrations/<timestamp>_<lowercase_name>.sql
```

The timestamp must be strictly later than every other, and **unique**: the CLI indexes its
migrations on that number alone, not on the file name. Two files with the same timestamp make
`db:start` fail on a primary key violation.

The client can only write the columns listed in a `grant update (...)`. A column added without
being listed there can be read, and silently refuses writes.

## Hosting an instance

To run FamiList for a household rather than to develop on it, see
[SELF-HOSTING.md](SELF-HOSTING.md): setting up the database, publishing the app, and configuring
email from the admin panel.

## First account

**The first account created becomes the administrator, approved outright.** The following ones
arrive pending and see no data until they are approved: every access function requires
`is_approved()`.

So create your admin account right after going live, then approve sign-ups from `/admin`. An
administrator cannot approve their own account.

## Android app

Capacitor wraps the web build (`webDir: 'build'`): there is no separate mobile code.

```sh
pnpm build
pnpm exec cap sync android
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/`.

The `android/` folder is versioned: it carries the camera permission and the native configuration
that a `cap add` on a fresh machine would not know how to recover. The iOS project is not
generated, it needs a Mac (`pnpm exec cap add ios`).

## Structure

```
src/lib/domain      pure logic, covered by the unit tests
src/lib/components  interface components
src/lib/db          IndexedDB schema and generated Supabase types
src/lib/sync        synchronisation and offline queue
src/lib/scan        barcode and QR decoding
src/lib/i18n        translations, ten languages
src/routes          pages
supabase/migrations schema and RLS policies
e2e                 end-to-end tests
```
