---
provenance: AAC
---

# Releasing

Pre-1.0: no release has been cut. Consumers pin a tag `vX.Y.Z` or a full commit, never a branch.

1. Run the tests and the boundary check in `START.md`.
2. Run the personal-data and secrets scan on the whole diff.
3. The owner creates the tag and the release. Agents do not tag.
