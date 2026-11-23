# news-digest

Project background, plan, and decisions: `docs/project-notes.md`.

Run `npm run check` (typecheck, lint, tests) before reporting a chunk as done.
Commit once per chunk, on a feature branch off `main` (e.g. `feat/rss-fetch`).
Never commit directly to `main` and never merge into it; the user reviews the
branch and merges.

## No personal details in commits

This repo is public. Nothing personal to the user goes into committed files
or commit messages:

- No real name, email address, usernames, or home-folder paths (`/Users/...`).
- No personal circumstances: employment or job search, finances or holdings,
  location, family, health, specific teams or companies they follow.
- Interests, feeds, and sample data in the repo stay generic. The user's real
  interest profile and feed list belong in a gitignored file.
- Write docs in neutral project terms, not first person about the user.

Before every commit, run `npm run leakscan` (scans staged files) and read the
staged diff (`git diff --cached`) for the above. Fix anything found before
committing. The scan catches patterns; circumstances and interests it cannot
recognise are still on the author. Never use `git commit --no-verify`.

Take extra care with fixtures, test data, logs, and snapshots: write them from
scratch with placeholder values, never copied from real feeds or real output.

## Permissions and sandbox

Bash runs in an OS sandbox. A few commands are excluded from it in the user's
settings, but the exclusion only matches when the command is run **on its own**.

### Runs outside the sandbox (bare command only)

`git push`, `git fetch`, `git pull`, `gh pr create`, `gh pr view`,
`gh run list`, `gh run view`.

- Run these as a single bare command, e.g. `git push`.
- Do not prefix with `cd ... &&`, chain with `&&`, or pipe into `tail`/`head`.
  A compound command runs sandboxed, where SSH keys are unreadable, and the
  push fails with "Host key verification failed".
- The working directory is already the project root, so no `cd` is needed.

### Works inside the sandbox

- `git add`, `git commit`, `git status`, `git log`, `git diff`.
- `npm install`, `npm run ...`, `node src/...`.
- Network to `github.com`, `registry.npmjs.org`, `npm.pkg.github.com`,
  `pypi.org`, `files.pythonhosted.org`. Any other host has to be requested
  per command.

### Blocked; ask the user to do it

- **Anything that writes `.git/config`**: `git remote add`, `git config`,
  `git branch -u`. Give the user the exact command to run.
- **`.env*` files**: cannot be read, created, or edited, and processes Claude
  runs cannot load them. The API key lives in `.env`, so the user does live
  model runs; build and test against mocks. Template file is `env.example`
  (no leading dot) for this reason.
- **`~/.ssh`**: unreadable inside the sandbox.
- **`.claude/settings.json`** and the user's global Claude settings.
- **`tsx`**: fails in the sandbox (it opens a local socket). Run TypeScript
  with `node` directly; Node 24 strips types natively.

When a command fails with "Operation not permitted", check this list before
concluding the action is impossible: first try it as a bare command if it is
on the excluded list.
