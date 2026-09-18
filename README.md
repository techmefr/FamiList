# FamiList

A shared shopping list for a household, on your own database.

The list everyone in the house edits at once, in the order of the aisles of the shop you are
actually standing in, that keeps working when the supermarket has no signal, and that nobody sells
anything from.

[What it looks like](https://techmefr.github.io/Familiste/) · [Try the demo](https://familiste.vercel.app) ·
[Run your own](#run-it-yourself) · [Self-hosting guide](SELF-HOSTING.md)

## Why another shopping list

Most of them are one of two things: a note shared in a messaging app, which nobody can reorder and
which loses half of what was typed; or a free app that reads the list to sell what is on it.

FamiList is the third option. It is one Docker command and a database you own. Nothing leaves it,
there is no account to create with anyone, no advert, no product suggestion paid for by a brand.
The data is in *your* Supabase — hosted or on a machine at home, your choice — and the app is a
folder of static files that executes nothing on a server.

## What it does

- **Lists several people edit at once.** A change shows up on the other phones straight away.
- **Aisles ordered shop by shop.** The app learns where things are in the shop you go to, so the
  list reads in walking order rather than in the order things were thought of.
- **It works without network.** Everything is written locally first and sent when signal comes
  back — a supermarket basement changes nothing.
- **Barcode and QR scanning**, to add an item or a loyalty card without typing.
- **Loyalty cards**, so the plastic stays at home.
- **One conversation per list**, with date polls and a split of who brings what — the part that
  normally lives in a separate group chat.
- **A magnifier**, and a whole appearance section: type size, font, contrast, reduced motion,
  left- or right-handed layout. Built in, not bolted on.
- **Ten languages**: French, English, German, Spanish, Italian, Portuguese, Russian, Chinese,
  Arabic, Malagasy.
- **An Android app**, the same build wrapped by Capacitor.

## Run it yourself

You need Docker, and somewhere for the database to live. The second is either a free project on
supabase.com or a stack on your own machine — the guide covers both.

```sh
git clone https://github.com/techmefr/Familiste.git
cd Familiste
cp .env.example .env
```

Put the address of your database and its public key in `.env`, then:

```bash
docker compose up -d
```

The app is on http://localhost:8080. Nothing is compiled on your machine: the image is published
for amd64 and arm64, so a Raspberry Pi pulls it like anything else. The two values are read when
the page opens, not baked into the build, so the same image serves any instance: to move to another
database, change `.env` and restart. Started without them, the app shows a screen saying what is
missing rather than a blank page.

Updating is two commands:

```bash
docker compose pull && docker compose up -d
```

Then name the administrator, rather than racing for it:

```bash
SUPABASE_SERVICE_ROLE_KEY=... pnpm admin create
```

It asks for an email and a password and creates the account confirmed, approved, administrator.
`pnpm admin promote <email>` does the same to an account that already signed up. The service key is
passed for the length of that one command and never written to `.env`: it bypasses every RLS policy,
and the app must never hold it.

Failing that, **the first account created becomes the administrator**, approved on the spot — which
keeps a fresh database from being a dead end, but is a race: someone signing up before you would own
the instance. Every following sign-up arrives pending and sees nothing until it is approved from
`/admin`.

The rest is set from inside the app, with no terminal: sending email, and a GitHub token if you
want a bug report to open an issue. [SELF-HOSTING.md](SELF-HOSTING.md) walks through all of it.

## How it is built

A SvelteKit app served as static files, data in Supabase, a local IndexedDB cache so it works
without network. The same build feeds the web and the Android app through Capacitor.

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

## Developing

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
pnpm install
cp .env.example .env
```

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

### Tests

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

### Configuration

Two variables, the only ones in the project:

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Both are public by construction: they ship in what the browser downloads, and security rests on the
RLS policies, not on keeping them secret. The `service_role` key has no place here.

They are read at start-up from `config.js`, served next to the app: in development a Vite plugin
serves it from the environment, in the container the entrypoint writes it. Nothing is inlined in
the bundle, which is what lets one published image serve any instance.

### Writing a migration

One file per change, never an edit to a file already applied:

```
supabase/migrations/<timestamp>_<lowercase_name>.sql
```

The timestamp must be strictly later than every other, and **unique**: the CLI indexes its
migrations on that number alone, not on the file name. Two files with the same timestamp make
`db:start` fail on a primary key violation.

The client can only write the columns listed in a `grant update (...)`. A column added without
being listed there can be read, and silently refuses writes.

### Deploying without Docker

The build is static — `@sveltejs/adapter-static`, `index.html` fallback — so any file host will do,
as long as it rewrites every route to `index.html`.

```sh
pnpm build              # produces build/
pnpm preview            # serves that build locally
```

On Vercel, `vercel.json` already carries the build command, the output folder, the rewrite and the
security headers. The only setting to make in the interface is adding `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_ANON_KEY` to the project environment variables.

### Android app

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
