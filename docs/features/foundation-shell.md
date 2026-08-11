# Foundation shell

## Behavior

The initial application is a real frameless Material Design 3 desktop shell. It reads live device facts without modifying the host, navigates through a responsive left tab rail, filters destinations through bounded plain-text or regex search, and opens a global command palette with `Ctrl+Shift+F`.

## Configuration

Display name, language mode, independent English and Cantonese funny levels, theme, density, accent, and dialog-emoji preference persist in local browser storage. Renaming changes display text only; package identity and data paths remain stable.

## Failure modes

If the system summary fails, an error notification remains visible until dismissed. Unimplemented parity lanes show an explicit unavailable state and disabled action with the unmet condition; they never imitate success.

## Security considerations

The renderer has no direct operating-system or filesystem access. Search evaluation is local, caps patterns at 256 characters and searchable text at 200,000 characters, and reports invalid syntax without throwing into the interface.

## Verification

`npm run check` type-checks both process boundaries, runs the focused unit suite, and produces the main, preload, and renderer build outputs. The capture harness drove the locally built unsigned Squirrel.Windows package from commit `bd2d1130a9720d675ad64accd5f42bdba34c9ffc` on a hidden Win32 desktop and recorded a deterministic, non-device-specific fixture.

![Material Tools overview in the real built desktop application](../captures/foundation/overview-dark.png)

![Material Tools command palette in the real built desktop application](../captures/foundation/command-palette.png)

![Material Tools overview at a narrow touch layout](../captures/foundation/overview-narrow.png)

## Suggested articles

- [Security and process architecture](../architecture/security-and-processes.md)
- [WinUtil parity contract](winutil-parity.md)
