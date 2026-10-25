# Knowledge-Base Skill Specification

This document defines the design, directory, indexing, and maintenance requirements for Skills that include reference images, reference files, templates, material collections, or knowledge indexes. Read and follow it before creating or modifying this type of Skill.

## 1. Scope

A Skill is a knowledge-base Skill when it relies on a reusable set of external materials or needs to retrieve content through directories, indexes, or cross-references. Temporarily reading one file during a conversation does not by itself make a Skill a knowledge-base Skill.

## 2. Directory Boundaries

- All knowledge-base resources must stay inside the Skill's dedicated directory.
- `SKILL.md` defines the capability, trigger conditions, workflow, and resource-loading rules.
- `references/` stores on-demand text materials, structured knowledge, and index documentation.
- `assets/` stores reference images, templates, fonts, and other binary or non-instructional resources.
- `scripts/` stores processing, validation, conversion, or index-generation scripts only.
- `evals/` stores evaluation cases and evaluation results only.
- Do not place knowledge-base resources outside the Skill directory or include temporary files, private user data, or credentials.

## 3. Reference Image Requirements

- Reference images must use stable, readable, sortable filenames with extensions that match their content.
- Organize images by topic, purpose, or processing stage; keep the directory hierarchy shallow and stable.
- Every image must have an index entry containing at least its path, purpose, topic or tags, source status, and description.
- SKILL.md describes how to select and load images; it must not embed image content or large image descriptions.
- When processing multiple images, identify them from the index or input order instead of relying on guessed filenames.

## 4. Reference File Requirements

- Organize reference files by topic or purpose, preferring searchable Markdown, plain text, or structured formats.
- Split large materials into independently loadable files so that one file does not contain unrelated topics.
- Every reference file must have a clear title, stable path, and identifiable topic boundary.
- Keep source files, converted files, and summary files separate, and record their relationships in the index.
- SKILL.md must not copy reference material; it defines when to read which files and how to use the results.

## 5. Directory Index Requirements

- The knowledge base must have one stable root index file inside the Skill's resource directory.
- Each index entry must contain at least: resource path, resource type, topic or tags, purpose, and source or version status.
- Paths must be relative to the Skill root and must not depend on local absolute paths.
- Every index entry must resolve to an actual resource; update the index whenever a resource is moved or removed.
- For larger collections, topic indexes or per-directory indexes may be added, but the root index must provide a path to them.
- Do not maintain only an unverifiable list of resource names; the index must support selection, location, and validation.

## 6. Loading and Citation Rules

- Load only the index and resources relevant to the current request instead of reading the entire knowledge base.
- Read the index first, then select resources by topic, tags, file type, or task stage.
- After using resources, state which resources were used; when exact support is needed, cite relative paths and relevant sections or records.
- If no matching resource is found, state that explicitly and do not present unverified content as a knowledge-base conclusion.
- When resources have dependencies, load them in the order defined by the index and preserve their source relationships.

## 7. Updates and Quality Checks

- Update the index after adding, deleting, moving, or replacing any resource.
- Resources and indexes must remain parseable, path-valid, consistently named, and free of duplicate records.
- The creation plan must include at least one index-integrity check and one resource-reference check.
- Evaluations must cover successful resource retrieval, missing resources, missing indexes, and invalid resource paths.
- Do not download, copy, rewrite, or expand knowledge-base content without user confirmation.
