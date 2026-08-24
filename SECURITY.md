# Security policy

## Supported version

The latest published minor release receives security fixes.

## Reporting a vulnerability

Do not open a public issue containing exploit details.

Report the problem privately through GitHub's security-advisory form for
`OskarasM/scene-narrator`. Include:

- The affected package version and entry point.
- A minimal reproduction.
- What reaches the DOM that should not, or what a descriptor can be made to do.
- Any suggested mitigation.

You should receive an acknowledgement within seven days. No bounty programme is
currently offered.

## Scope

This package reads Three.js objects and writes text into the DOM. The realistic
attack surface is small and worth naming precisely rather than waving at:

- **Descriptor strings reach the DOM.** They are written with `textContent` and
  `setAttribute`, never `innerHTML`, so a label containing markup is displayed
  and announced as the characters it contains. An application that puts
  untrusted user input in a `label` should still treat it as user input.
- **`state()` and `detail()` are application callbacks.** The library calls
  them on a cadence; it does not sandbox them. A callback that is slow makes
  the scene slow, and a callback that throws propagates.
- **Descriptors live on `object.userData.a11y`**, which means a scene loaded
  from a glTF file can carry them in `extras`. A scene from an untrusted origin
  can therefore describe itself, and that description is spoken to the user.
  Validate descriptors from untrusted assets before mounting the narrator over
  them.

There are no runtime dependencies, no network requests, no storage APIs, no
`eval` and no `innerHTML` in this package. It provides no security boundary
around untrusted WebGL content and does not claim to.
