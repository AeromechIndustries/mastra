# TessarAct's Mastra patches

Owner: aeromech-1. Executor: Codex.

This directory records the maintained changes used by TessarAct across Mastra.
The [manifest](manifest.json) identifies exact package versions, source
revisions and SHA-256 checksums. [MAINTENANCE.md](../MAINTENANCE.md) owns the
update and publication workflow.

## Recorded changes

| Package | Changes | Current consumer |
| --- | --- | --- |
| `@mastra/core@1.74.0` | Durable request-context projection and authorized recovery, execution checkpoints, preserved workspace/memory bindings, agent-factory composition, and remote filesystem/LSP queries. | TessarAct's package patch. |
| `@mastra/pg@1.29.0` | JSON serialization and background-task argument, result and suspension-payload handling. | TessarAct's package patch. |
| `@mastra/code-sdk@1.10.1` | Managed host instructions and tool/mode guidance. | TessarAct's package patch. |
| `mastracode@0.44.1` | Terminal injection and managed session, command, shell, plan and display seams. | TessarAct's retained managed-renderer integration. |
| [Code image recipe](adaptations/code-image.mjs) | Server-authorized model calls, persistent state location, credential boundaries, redraw, Files navigation and branding. | The native Code implementation branch; image acceptance remains pending under [#534](https://github.com/AeromechIndustries/TessarAct/issues/534). |

The four package snapshots were exported byte-for-byte from TessarAct revision
`aff10b6bb93080d40d8bb4b5fb3fe3ee5c9866b1`. Their upstream release tags all resolve
to `b21e46e19b469a25c8896bcee90afd58d6f1a890`.

The Code recipe is an exact snapshot from revision
`bfe45d966a2e91ab1a5502c25f0fac877a4e627f`. It depends on TessarAct entrypoints and
its staged package layout; run the application-owned build workflow for it.
The package patch retains older managed-renderer hooks. Porting reviews which
hooks the native Code path still needs rather than activating a second agent
owner.

## Porting status

`recorded` means the exact consumer patch or build recipe is preserved here.
The snapshots target compiled files in the pinned npm packages. Source-level
ports onto their matching upstream base, rebuilt packages and application
acceptance are separate steps. The fork's current upstream source has not had
these snapshots applied to it. Application dependency pins remain unchanged.

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

Upstream licenses and attribution remain in the repository. Preserve the
applicable package notices when producing downstream distributions.
