# Hosting FamiList yourself

The README speaks to someone developing the project. This page speaks to someone who wants to run
it for their family, and will not open a terminal twice a week.

There are **not two twin services** to run. There is a Supabase database, running in Docker
containers, and a web app that is only a folder of static files — it executes nothing on the
server.

## What you need

| | |
| --- | --- |
| **Docker** | runs the database, authentication and storage |
| **Node 24 or later** | builds the app |
| **pnpm** | installed by `corepack enable pnpm` |
| a file host | Vercel, Netlify, an nginx — any of them |

The Supabase CLI does not need installing separately: it is pinned in the project dependencies.

## A Supabase account, or your own machine

Two paths, and the second is no more "pure" than the first.

**Hosted Supabase**: create a project on supabase.com, link the repository, push the schema.
Nothing to administer, a backed-up database. This is what the original instance does.

**Everything at home**: Supabase runs in Docker on your own machine. You then have to handle
backups, certificates and updates — which is real work, not a checkbox.

What follows describes the first path, with the differences of the second noted along the way.

## Setting up the database

```sh
git clone https://github.com/techmefr/Familiste.git
cd Familiste
pnpm install
```

Link the Supabase project, then apply the schema:

```sh
pnpm exec supabase link --project-ref <the-project-ref>
pnpm exec supabase db push
```

> **Never run `supabase/seed.sql` in production.** It creates a test account whose password is
> written in the repository, confirmed and approved outright. It only exists for the automated
> tests.

Some functions run on the server — email, publishing reports, importing a recipe. They are deployed
once:

```sh
pnpm exec supabase functions deploy notify-admins
pnpm exec supabase functions deploy publish-report-issues
pnpm exec supabase functions deploy import-recipe
pnpm exec supabase functions deploy test-instance-mail
```

For hosting at home, replace the first two commands with `pnpm exec supabase start`, and read the
URL and the key it prints.

## Building and publishing the app

Two variables, the only ones in the project:

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

They are public by construction: they ship in the file the browser downloads. Security rests on the
database rules, not on keeping them secret. The `service_role` key, on the other hand, has no place
here.

```sh
pnpm build
```

The result is in `build/`. Any unknown route must be sent back to `index.html`, otherwise a link
shared to a list will land on a missing page. On Vercel, `vercel.json` already takes care of it;
elsewhere, it is one line of configuration to write.

Finally, in the Supabase project authentication settings, set the site URL and the redirect URLs to
the real domain. Without that, the link received by email leads somewhere else.

## The first account

**The first account created becomes the administrator, and it is approved on the spot.** Every
following one arrives pending and sees nothing until it is approved.

So: create your own account **immediately** after going live. Someone else signing up before you
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
pnpm install
pnpm exec supabase db push
pnpm build
```

Redeploy the contents of `build/`, and redeploy the functions if they changed. Migrations only apply
once: running `db push` again on an up-to-date database does nothing.

## When it does not work

**Installation fails on the Node version.** A dependency requires Node 24, and `.npmrc` refuses to
override it. `node --version` must print 24 or later.

**Nobody receives any email.** Check the sender with the provider, then the test button in `/admin`.

**Someone signed up and sees nothing.** That is the intended behaviour: their account is waiting for
approval in `/admin`.

**A reloaded page returns a 404.** The host does not rewrite to `index.html`.
