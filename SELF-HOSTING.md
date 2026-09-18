# Hosting FamiList yourself

The README speaks to someone developing the project. This page speaks to someone who wants to run
it for their family, and will not open a terminal twice a week.

There are **not two twin services** to run. There is a Supabase database, and a web app that is
only a folder of static files — it executes nothing on the server. The app is one container; the
database is either somebody else's problem or a second stack on your machine.

## What you need

| | |
| --- | --- |
| **Docker** | runs the app, and the database if you host it yourself |
| **Node 24 or later** | only to apply the schema, from the command line |
| **pnpm** | installed by `corepack enable pnpm` |

The Supabase CLI does not need installing separately: it is pinned in the project dependencies.

## A Supabase account, or your own machine

Two paths, and the second is no more "pure" than the first.

**Hosted Supabase**: create a project on supabase.com, push the schema. Nothing to administer, a
backed-up database. This is what the original instance does.

**Everything at home**: Supabase runs in Docker on your own machine, with secrets generated for you.
You then have to handle backups, certificates and updates — which is real work, not a checkbox.

Both end at the same place: an address and a public key.

## Setting up the database

```sh
git clone https://github.com/techmefr/Familiste.git
cd Familiste
pnpm install
```

Hosted Supabase — one command links the project, applies the schema and deploys the functions:

```bash
pnpm setup --ref <the-project-ref>
```

The reference is in the address of your project: `supabase.com/dashboard/project/<the-project-ref>`.
`pnpm setup --dry-run` prints what it would run without running any of it, if you would rather do
it by hand. It asks for your database password, because linking does.

At home, one command fetches the self-hosting stack, generates its secrets, starts it and applies
the schema:

```bash
pnpm selfhost
```

It lands in `./supabase-stack`, which is deliberately not versioned: that folder holds every secret
of your instance. Back it up. `pnpm selfhost --schema` reapplies the schema to a stack already
running — after a `git pull`, for instance.

The stack itself is Supabase's own self-hosting bundle, fetched at a version pinned in
`scripts/selfhost.mjs` rather than copied into this repository: a dozen containers whose versions
move together, vendored here, would be a fork of theirs going stale, and the day that matters is
the day a security fix lands upstream and not in the copy.

> `pnpm db:start` is a different thing and stays: a development stack with fixed, public keys, meant
> to be thrown away and rebuilt. Never put real data in it.

> **Never run `supabase/seed.sql` in production.** It creates a test account whose password is
> written in the repository, confirmed and approved outright. It only exists for the automated
> tests.

Some functions run on the server — email, publishing reports, importing a recipe. `pnpm setup`
deploys them all; on a stack at home they come with it. Deploying one on its own, after a change:

```sh
pnpm exec supabase functions deploy notify-admins
```

## Starting the app

```sh
cp .env.example .env
```

Two variables, the only ones in the project:

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

On supabase.com they are in Project settings, API: the "Project URL" and the "anon public" key. At
home, `pnpm db:start` printed them. They are public by construction: they ship in the file the
browser downloads. Security rests on the database rules, not on keeping them secret. The
`service_role` key, on the other hand, has no place here.

```bash
docker compose up -d
```

The app answers on http://localhost:8080 — change `PORT` in `.env` for another one. Put it behind
your usual reverse proxy for a real domain and a certificate.

Nothing is built here: the image comes from `ghcr.io/techmefr/familiste`, published for amd64 and
arm64 on every change. Your machine downloads a folder of files and a web server, and that is all.

These two values are read when the page opens, not written into the build. Changing database means
editing `.env` and `docker compose up -d` again; there is nothing to rebuild.

Finally, in the Supabase project authentication settings, set the site URL and the redirect URLs to
the real domain. Without that, the link received by email leads somewhere else.

### Without Docker

`pnpm build` produces `build/`, to be served by any file host. Any unknown route must be sent back
to `index.html`, otherwise a link shared to a list will land on a missing page. On Vercel,
`vercel.json` already takes care of it; elsewhere, it is one line of configuration to write. The
two variables are then read from the environment at build time.

### Fork, Vercel and hosted Supabase

The path the original instance takes, and the one that costs nothing to try:

1. Fork the repository, create a project on supabase.com.
2. `pnpm setup --ref <the-project-ref>` from your clone.
3. Import the fork into Vercel. `vercel.json` already carries the build command, the output folder,
   the rewrite and the security headers; the only thing to set in the interface is
   `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
4. Set the site URL and the redirect URLs in the Supabase authentication settings, then
   `SUPABASE_SERVICE_ROLE_KEY=... pnpm admin create`.

Nothing here is specific to Vercel beyond that one file: the build is a folder of static files.

## The first account

Name it, from the command line:

```bash
SUPABASE_SERVICE_ROLE_KEY=... pnpm admin create
```

It asks for an email and a password, and creates the account confirmed, approved and administrator.
`pnpm admin promote <email>` promotes an account that has already signed up instead.

The service key is on supabase.com in Project settings, API — the `service_role` one — and is
printed by `pnpm db:start` at home. Pass it on that one command and nowhere else: it bypasses every
RLS policy, and it has no business in `.env`, which is read by the browser.

The account is confirmed without an email being sent, deliberately: sending is configured from
`/admin`, which needs an administrator, which is this command.

Failing that, **the first account created becomes the administrator**, approved on the spot. It
keeps a fresh database from being a dead end, but it is a race: someone else signing up before you
would become the administrator of your instance.

Later sign-ups are approved from `/admin`. An administrator cannot approve their own account — that
is deliberate.

## The rest is set from inside the app

From `/admin`, with no terminal:

- **Sending email** — server, port, username, password, sender. The password goes into the
  database vault and is never read back, not even by an administrator.
- **The GitHub token**, if you want a report to open an issue.

A test button sends a message and says what failed.

> The most common mistake is an **unverified sender**. Brevo, Sendgrid and the others refuse to send
> from an address you have not proven to them. Verify the address with the provider before setting
> it here.

As long as nothing is configured, emails pile up without leaving. The screen says so. Sign-ups stay
visible in `/admin`, which is the authority.

## Updating

```sh
git pull
pnpm exec supabase db push
docker compose pull
docker compose up -d
```

Redeploy the functions if they changed. Migrations only apply once: running `db push` again on an
up-to-date database does nothing.

`docker compose pull` fetches the image rebuilt by the project; nothing is compiled on your side.

## When it does not work

**The app shows "instance not configured".** The container started without its two variables, or
with an address that is not a URL. Check `.env`, then `docker compose up -d` again.

**Installation fails on the Node version.** A dependency requires Node 24, and `.npmrc` refuses to
override it. `node --version` must print 24 or later.

**Nobody receives any email.** Check the sender with the provider, then the test button in `/admin`.

**Someone signed up and sees nothing.** That is the intended behaviour: their account is waiting for
approval in `/admin`.

**A reloaded page returns a 404.** You are not going through the provided container, and the host
does not rewrite to `index.html`.
