# Aeromech Industries fork maintenance

Owner: aeromech-1. Codex executes interactive work for the owner.

## Purpose

This fork is the maintained home for all TessarAct changes to Mastra. Maintain
framework, agent, storage, workspace and Code patches here, with their upstream
base, consuming application revision and focused verification recorded in the
[downstream inventory](downstream/README.md).

| Source | Role |
| --- | --- |
| `packages/core` | Durable execution, agent composition and remote workspace language services. |
| `stores/pg` | PostgreSQL persistence and background-task serialization. |
| `mastracode/tui` | Native terminal interface and TessarAct branding. |
| `mastracode/sdk` | Coding controller, model resolution and persistent Code state. |
| [TessarAct #534](https://github.com/AeromechIndustries/TessarAct/issues/534) | Application integration and native Code acceptance. |
| [infrastrActure build contract](https://github.com/AeromechIndustries/infrastrActure/blob/dev/docs/operations/README.md) | Governed image build, publication and deployment. |

## Branches and setup

`master` is this fork's default maintained branch. Open focused issue branches
and pull requests against it. Record the upstream source commit and linked
TessarAct issue on changes that affect the integration.

When preparing a new or forked Aeromech Industries repository, create or rename
its principal branch to `master` and verify its GitHub default-branch setting.
Preserve existing project-specific integration branches such as TessarAct's
`dev`. GitHub's organization default-branch setting governs new repositories;
fork setup also checks the inherited upstream branch name.

### Maintained upstream forks

Apply this convention to every maintained upstream fork used by TessarAct,
including Mastra, Mobile-TUI and future adopted projects:

- `origin` identifies our Aeromech Industries fork. `origin/master` carries our
  reviewed downstream changes and is the fork's default maintained branch.
- `upstream` identifies the original project. Fetch its actual default branch
  into `upstream/<branch>` and set `upstream/HEAD` to that reference. Preserve
  upstream's branch name; its `main` and our `master` have distinct owners.
- Treat `upstream/*` as fetched references. Develop downstream changes on issue
  branches, then open PRs against our maintained branch.
- Record the exact upstream release tag and source commit for consumed
  packages. Tracking upstream's latest branch is separate from upgrading a
  pinned dependency.
- Review imports of upstream changes together with our patch set and focused
  checks. Publish a deliberate integration through our fork's PR workflow.

| Fork | Downstream | Upstream |
| --- | --- | --- |
| `AeromechIndustries/mastra` | `origin/master` | `mastra-ai/mastra`, `upstream/main` |
| `AeromechIndustries/Mobile-TUI` | `origin/master` | `connorads/remobi`, `upstream/main` |

After clone, inspect `git remote -v` and `git branch -r`. Verify the original
repository and its current default branch before adding a missing `upstream`
remote. For this Mastra fork, the current setup commands are:

```sh
git remote add upstream https://github.com/mastra-ai/mastra.git
git fetch --no-tags upstream main:refs/remotes/upstream/main
git remote set-head upstream main
```

Reuse an existing verified remote rather than adding it twice. Resolve release
tags separately when preparing the source ports or dependency update.

Use noninteractive, explicitly targeted pull-request commands for downstream
work, such as `gh pr create --repo AeromechIndustries/mastra --base master`.
Attach each created PR to its Codex task. Choose checks for the changed package
or documentation rather than installing and testing the entire monorepo for
repository bookkeeping.

## Source updates and builds

The recorded application patch set pins `@mastra/core@1.74.0`,
`@mastra/pg@1.29.0`, `@mastra/code-sdk@1.10.1` and `mastracode@0.44.1`.
All four release tags resolve to upstream commit
`b21e46e19b469a25c8896bcee90afd58d6f1a890`. The inventory preserves their exact
compiled-package patches and Code image-build adaptations. TessarAct's existing
package and image workflow remains the consumer until source ports and rebuilt
packages pass their integration checks.

Record each new Mastra patch or amendment in the inventory. Keep exact package
snapshots distinct from applied source commits and published packages. Mark
source ports accepted only after the corresponding package checks pass. Track
patches to other upstream projects with their own owner; TessarAct's
`@ai-sdk/provider-utils` patch belongs to Vercel AI SDK rather than this fork.

For an integration update:

1. Resolve and record the exact upstream release and commit.
2. Review upstream changes and carry the relevant downstream adaptations as
   source-level commits.
3. Build and check the affected packages using the upstream workspace tools.
4. Record the package versions, source commit, checks and license notices.
5. Update TessarAct's pinned dependencies through its dependency workflow.
6. Verify the changed TessarAct journey. For sandbox components, build the
   workspace image through the infrastructure build contract before deployment
   acceptance.

Inherited GitHub Actions are disabled during fork preparation. Enable focused
downstream validation when the package migration introduces its build contract.
Package and image publication use reviewed, explicitly configured workflows.

## Naming and licenses

Choose names describing the job, such as `workspace-sandbox`, `codeProcess` or
`providerBridge`. Improve existing integration names when working on their
modules and update the affected references together. Preserve exact upstream
API identifiers where integrations depend on them.

Retain upstream attribution and each component's license. The pinned Code
packages identify Apache-2.0; the monorepo's [LICENSE.md](LICENSE.md) describes
the separate license for `ee/` directories and third-party components.
