# Version Description

## Version Rules

Magic adopts the x.y.z version numbering rule to name each version, such as version 1.2.3, where 1 is x, 2 is y, and 3 is z. You can use this versioning rule to plan your updates to the Magic project.
- x represents a major version. When Magic's core undergoes extensive refactoring changes, or when there are numerous breaking API/UI changes, it will be released as an x version. Changes in x versions typically cannot be compatible with previous x versions, although this doesn't necessarily mean complete incompatibility. Specific compatibility should be determined based on the upgrade guide for the corresponding version.
- y represents a major feature iteration version. When some public APIs/UIs undergo breaking changes, including changes and deletions of public APIs/UIs that may cause incompatibility with previous versions, it will be released as a y version.
- z represents a fully compatible fix version. When fixing bugs or security issues in existing features of various components, it will be released as a z version. When a bug completely prevents a feature from functioning, breaking API changes may also be made in a z version to fix this bug. However, since the feature was previously completely unusable, such changes will not be released as a y version. In addition to bug fixes, z versions may also include some new features or components, which will not affect the use of previous code.

## Upgrading Versions

When you want to upgrade Magic versions, if you are upgrading x and y versions, please follow the upgrade guide for the corresponding version in the documentation. 