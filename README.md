# kanban-md updates

Public, versioned HTML updates for existing kanban-md users. Application code stays in [kanban-md](https://github.com/antopolskiy/kanban-md); accepted report files live here.

Site: https://antopolskiy.github.io/kanban-md-updates/

## Hosting contract

- GitHub Pages publishes the root of `main`. `.nojekyll` preserves the standalone HTML without a site generator.
- A release report is `releases/vX.Y.Z/index.html`. Link to `https://antopolskiy.github.io/kanban-md-updates/releases/vX.Y.Z/` in that release's notes.
- Each report has a neighboring `manifest.json` with its release revision, capture revision, SHA256, release URL and successful release-workflow URL.
- Keep existing release paths. Do not replace an old version with a newer report. Corrections to a published report require an explicit correction commit and an updated manifest/hash; the staging helper refuses overwrites.
- `releases/index.json` lists the reports. `index.html` is generated from that list and `index.template.html`.
- Keep task examples synthetic and review screenshots for private information. Do not publish credentials, local file paths, draft reports or research logs.
- Reports remain standalone: embedded styles, scripts and screenshots; no remote runtime assets. Dark is the default, with a light reading option. Follow the canonical report skill for content and visual checks.

## Publish a release report

1. Merge and release the application through its own release flow. Push its version tag once, wait for the `release` workflow to succeed, and let GoReleaser create the release. Do not create the GitHub release locally or dispatch a duplicate release workflow.
2. Finalize the report only after that success. Remove preview notices, add the actual release version/date and a GitHub release link. Include `<meta name="kanban-md-release" content="vX.Y.Z">`. Keep the capture source revision truthful even if the release has an additional merge commit.
3. Validate the report through the canonical report skill. Check its examples against the released build, inspect the screenshots and remove private information.
4. From a clean checkout of this repository, pull `main` and stage the report:

   ```bash
   git pull --ff-only
   node scripts/stage-report.cjs \
     --version vX.Y.Z \
     --report /absolute/path/to/accepted-report.html \
     --capture-source FULL_CAPTURE_COMMIT_SHA \
     --title "Release theme"
   ```

   Prerequisites are Node.js and an authenticated `gh`. The helper verifies a published stable release, its exact tag revision, a successful tag-triggered release workflow, capture ancestry, standalone HTML and the release metadata. It copies the accepted report unchanged, creates the manifest and rebuilds the index. It does not commit, push or publish release notes.

5. Inspect the staged files and commit only the report, manifest and index updates:

   ```bash
   git diff --check
   git add releases/ index.html
   git commit -m "docs: publish vX.Y.Z release report"
   git push origin main
   ```

6. Wait for the `pages build and deployment` workflow to succeed. Fetch the versioned URL and compare its SHA256 to `manifest.json`; an HTTP 200 alone does not establish that the new page is deployed.
7. Add the verified versioned report URL to the human-written GitHub release notes with `gh release edit`. Keep the release's full diff link and contributor attribution.

Future report authors should prepare their previews locally. Publishing is a separate, explicitly authorized release step, not a side effect of report creation. Never publish a preview to a released-version path.

## Check the staging helper

```bash
node --test scripts/stage-report.test.cjs
```

The helper uses only built-in Node.js modules and the existing GitHub CLI. No package installation, Pages tokens or custom Actions workflow is needed.

GitHub references: [branch publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Pages API](https://docs.github.com/en/rest/pages/pages).
