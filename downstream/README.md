# Aeromech Mastra adaptations

Owner: aeromech-1. Executor: Codex.

This directory records the migration evidence and maintained changes used by
TessarAct across Mastra.
The [manifest](manifest.json) identifies exact package versions, source
revisions and SHA-256 checksums. [MAINTENANCE.md](../MAINTENANCE.md) owns the
update and publication workflow.

## Recorded changes

| Package                                         | Historical change                                                                                                                                                                     | Maintained source owner                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mastra/core@1.74.0`                           | Durable request-context projection and authorized recovery, execution checkpoints, preserved workspace/memory bindings, agent-factory composition, and remote filesystem/LSP queries. | `packages/core` on this fork's `master`.                                                                                                                 |
| `@mastra/pg@1.29.0`                             | JSON serialization and background-task argument, result and suspension-payload handling.                                                                                              | `stores/pg` on this fork's `master`.                                                                                                                     |
| `@mastra/code-sdk@1.10.1`                       | Managed host instructions, model selection, state paths, thinking defaults and retry ownership.                                                                                       | `mastracode/sdk` on this fork's `master`.                                                                                                                |
| `mastracode@0.44.1`                             | Terminal injection and managed session, command, shell, plan, redraw and display seams.                                                                                               | `mastracode/tui` on this fork's `master`.                                                                                                                |
| [Code image recipe](adaptations/code-image.mjs) | Server-authorized model calls, persistent state location, credential boundaries, redraw, Files navigation and branding.                                                               | Historical integration evidence; TessarAct consumes the maintained source APIs under [#623](https://github.com/AeromechIndustries/TessarAct/issues/623). |

The four package snapshots were exported byte-for-byte from TessarAct revision
`aff10b6bb93080d40d8bb4b5fb3fe3ee5c9866b1`. Their upstream release tags all resolve
to `b21e46e19b469a25c8896bcee90afd58d6f1a890`.

The Code recipe is an exact historical snapshot from revision
`e5f71086cc44463383d956c36e4b31427e0f3a4f`. It depends on TessarAct entrypoints and
its former staged package layout and must not be applied to current packages.
The checked prompt and thinking seams feed published mode guidance and intensity
efforts into native Code controls while retaining conversation overrides. This
configuration slice is tracked in [TessarAct #610](https://github.com/AeromechIndustries/TessarAct/issues/610).
The current source API retains only the managed seams the native Code path uses.

## Porting status

`recorded` means the exact historical consumer patch or build recipe is
preserved here as migration evidence; it is not an accepted delivery path.
The snapshots target compiled files in the former pinned npm packages. Their
maintained equivalents are source-owned in this fork and published only through
the open-package workflow. TessarAct migration and acceptance are tracked in
its issue #623; the snapshots must never be reapplied there.

The open-package build is fail-closed: every listed package must complete code
and declaration generation before sanitization, packed-content inspection and
publication. Existing output from a failed build is never accepted as release
evidence.

The separate `@ai-sdk/provider-utils@3.0.28` patch is listed under
`externalPatches` for complete accounting of the application patch list. Its
owner is the Vercel AI SDK project, and its patch remains in TessarAct.

## Verify the record

Run from this repository:

```sh
node downstream/check-inventory.mjs
```

To compare every snapshot and the declared package inventory with an existing
TessarAct checkout containing the recorded commits:

```sh
node downstream/check-inventory.mjs --application /projects/TessarAct
```

These checks verify provenance, patch syntax and inventory completeness. The
affected package tests verify behavior when the source ports are implemented.

Upstream licenses and attribution remain in the repository. Before publishing,
pack each affected package and run the release-boundary check described in
[MAINTENANCE.md](../MAINTENANCE.md). Preserve all notices required by the files
that remain in the artifact.
