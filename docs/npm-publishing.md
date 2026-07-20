# npm publishing

`@deploid/cli` is the single user-facing Deploid distribution. Core and the built-in
plugins remain separate workspace packages for development, but they are bundled into
the CLI tarball and are not independently published by the release workflow.

`@deploid/plugin-storage` remains separate because it is installed into the consumer
application and has its own Capacitor peer dependency. The legacy Studio workspace is
private and is not an npm distribution.

## Enable trusted publishing

Configure a trusted publisher for `@deploid/cli` on npm with:

- Organization or user: `vardirhq`
- Repository: `deploid`
- Workflow filename: `release.yml`
- Environment: leave empty

Then create the GitHub Actions repository variable
`NPM_TRUSTED_PUBLISHING=true`. The workflow is gated by this variable, so merging it
before npm is configured cannot trigger a broken or token-based publish.

After setup, either merge another change to `main` or run the Release workflow
manually. Every successful main run publishes a new version with npm provenance.
`feat:` commits receive a minor bump, breaking changes receive a major bump, and
all other main updates receive a patch bump.

## Status

Trusted publishing is enabled for the production release workflow.
