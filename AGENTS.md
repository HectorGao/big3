# Project Workflow

- This project is 举个铁子. Keep web and WeChat core calculations shared in `miniprogram/lib/`.
- The owner approved ongoing GitHub sync on 2026-09-22: after completing requested changes and passing relevant tests, review the diff, explicitly stage the related paths, commit, and push to `origin` (`https://github.com/HectorGao/big3.git`). Do not automatically commit unfinished work or run a background file watcher.
- Run `npm test`, `npm run check:repo`, `npm run build:static`, and browser checks proportional to changed behavior before pushing. Run `npm run check:repo -- --staged --history` after staging. Verify the remote commit and GitHub checks after pushing. If checks or authentication fail, preserve work and report the failure; never force push.
- Preserve existing work, training histories, active drafts, and local passwords. No bulk file deletion, hard resets, broad `git add .` / `git add -A`, or automatic history rewrites.
- Never commit `runtime/`, user backups, research datasets/models, raw generated images, local credentials, private keys, or reusable demo passwords. New test credentials must be random and local only.
- Bump `miniprogram/lib/release.js` plus package versions for user-facing releases. Keep release evidence separate from planned work.
- Push only to the user-requested GitHub remote. Do not push `sites`, change DNS, connect hosting services, or publish a website/native app unless the user requests that external action.
- Push an explicit branch refspec only; never use `--mirror`, `--all` or push local recovery/checkpoint refs. Publication history checks cover `HEAD` and its ancestors, not unrelated local snapshots.
- Build `dist/` through the existing allowlist; only that directory may be served as static content. Static hosting does not supply account login, sync, admin backup, or shared messages. These require the separately deployed backend/database.
