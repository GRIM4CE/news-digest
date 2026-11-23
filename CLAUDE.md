# news-digest

Project background, plan, and decisions: `docs/project-notes.md`.

Run `npm run check` (typecheck, lint, tests) before reporting a chunk as done.
Commit once per chunk; the user has given a standing yes for that.

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
