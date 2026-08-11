# Handoff

## Current scope

The repository is being initialized from an empty baseline into a Windows Electron application with full WinUtil behavioral parity and the complete shared product contract.

## Current evidence

- Baseline: `d82f4527af21c8c153cc423bb4997cf346ba7e71` on `main`.
- Upstream capability pin: `ChrisTitusTech/winutil@ea5de27b6c66fe4f4a4c6513887d0fe5a1cd8bff`.
- Foundation verification command: `npm run check`.
- Current local result: 1 test file and 4 tests passed; TypeScript and production renderer/main builds passed.
- Foundation commit: `c91398b6aa9c4d11863c0540e5cc9f546b3dd728` is verified on `origin/main`.
- First release run: [31536631258](https://github.com/Ding-Ding-Projects/material-tools/actions/runs/31536631258) completed successfully.
- First release: [`build-0.1.0.1`](https://github.com/Ding-Ding-Projects/material-tools/releases/tag/build-0.1.0.1) targets the foundation commit and carries the unsigned setup executable, full package, and Squirrel.Windows update index.
- The first release notes initially exposed unresolved PowerShell expressions. The public notes were repaired and read back; the workflow now uses literal placeholders plus a post-publication completeness check.
- Hidden-desktop inspection found that the first released renderer was blank because its sandboxed preload retained an unsupported local module import. The build now bundles the preload, validates its channel surface, and allows only exact same-document reload navigation. A corrected installer is locally built and unsigned; published-artifact captures remain pending the correction dew.
- The initial workflow listened to unfiltered pushes, so each release tag triggered another release. The active tag-triggered run was cancelled, and the workflow plus local contract check now restrict push-triggered publication to branches. The accidental release inventory must remain visible until final release cleanup is reviewed.

## Remaining work

System-changing operations, built-artifact captures, full universal features, the complete documentation site, final release verification, and repository cleanup remain incomplete. Do not describe the product as WinUtil-equivalent until every capability-matrix row has direct behavioral proof.

## Next action

Land and verify the release-evidence correction, then implement the pinned catalog schemas and real application-management executor as the first consequential vertical slice.
