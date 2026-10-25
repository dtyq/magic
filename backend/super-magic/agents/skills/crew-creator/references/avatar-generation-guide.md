# Digital Employee Logo Generation Guidelines

This document provides guidance for automatically generating a default logo (avatar) from `IDENTITY.md` and `SOUL.md` when creating or updating a digital employee. The logo is the digital employee's persistent `icon`, representing the visual persona and face avatar portrait of the employee, not a temporary placeholder or a generic tool icon.

## Basic Requirements

| Item | Requirement |
|------|-------------|
| Subject | **Must be an avatar / face portrait of a person (headshot)**. Digital employees are personified virtual employees. The avatar must depict a close-up face/head portrait with hair, facial features, friendly expression, and collar/neckline of professional attire. It must NEVER be pure tools, objects, logos, emblems, or mannequins |
| Format | PNG or JPG (`logo.png` or `logo.jpg`) |
| Generation size | `1024x1024` |
| Display size | Square; typically scaled to `512x512` in the marketplace and circular in chat/cards |
| Style | Consistent modern cartoon/illustration avatar style that is professional, clean, approachable, and recognizable |
| Content | Must align with the employee's role and character identity; focus on the character's face, expression, and hairstyle; small role elements (e.g. glasses, stylish collar, earrings, small badge) may complement the face |
| Text | Do not generate text in the image by default, to avoid garbled text at small display sizes |
| Storage path | Strictly `.magic/logo.png` or `.magic/logo.jpg` directly under `.magic/` (NOT in `assets/`, NOT in subdirectories) |

## Negative Constraints (Strict Prohibitions)

- **No object-only images**: Do NOT generate images containing only tools, stationery, scissors, measuring tapes, rulers, sewing needles, computers, or devices.
- **No pure logos or emblems**: Do NOT generate graphic logos, app icons, badges, crests, or symbolic emblems.
- **No mannequins or dress forms**: Do NOT generate lifeless dress forms, headless mannequins, or clothing displays.
- **No full-body or complex wide shots**: Do NOT generate full-body figures or distant silhouettes. It must be a clear, close-up face/head avatar.
- **Always feature a human character avatar**: The avatar must always depict a living, personified character headshot (face, hair, eyes, expression, upper collar).

## Prompt Input Sources

The logo prompt must be generated from the current employee files and must construct a specific personified character headshot rather than relying on abstract symbols or tools:

1. Read the YAML frontmatter in `IDENTITY.md` and extract `name`, `role`, and `description`.
2. Read the body of `IDENTITY.md` and extract the character identity, professional capabilities, target users, and typical work scenarios.
3. Read `SOUL.md`, if present, and extract the core personality, aesthetic preferences, communication style, and behavioral temperament.
4. Translate the role into a personified professional figure (e.g., fashion designer, financial analyst, customer service specialist) with suitable hairstyle, friendly facial expression, and neat collar/neckline.
5. Do not infer sensitive personal attributes from the name. The name may only be used to establish the visual theme and recognizability.

## Prompt Structure

Assemble the prompt in the following order. The specific content must come from the employee files:

```text
[consistent style prefix] + [character subject: close-up headshot avatar portrait of a person] + [hairstyle & attire collar/accessories] + [facial expression, personality and temperament] + [clean background and color palette] + [quality suffix]
```

Recommended fixed prefix:

```text
Professional cartoon-style illustration avatar of a person, close-up headshot face portrait, clean professional composition, warm lighting and soft shadows,
```

Recommended fixed suffix:

```text
Square 1:1 composition, close-up head and shoulders avatar portrait, centered subject, clean simple background, vibrant and friendly, no text, no watermark, high quality, professional, natural.
```

If `SOUL.md` is missing, generate the prompt using only the contents of `IDENTITY.md`. If the identity information is also incomplete, use the available fields to depict a generic professional character avatar for that role without inventing a specific personal background.

## Generation and Storage

Treat the current working directory as the employee workspace root. All paths below are workspace-relative; do not prepend `.workspace/` even if the repository stores the workspace in a directory with that name.

1. Use the `generate_images` tool to generate one image. The `size` must be `1024x1024`.
2. Save the image directly as `.magic/logo.png` (or `.magic/logo.jpg`) in the current employee workspace. If the tool writes to another path, move or rename the generated image to `.magic/logo.png` (or `.magic/logo.jpg`).
3. After generating and saving the image, immediately write or update the `icon` field in `.magic/IDENTITY.md` frontmatter to point to `.magic/logo.png` (or `.magic/logo.jpg`).
4. Confirm that the image exists directly under `.magic/`, is readable, and is square, and verify that its file size does not exceed `500KB`. If it cannot be compressed to fit the limit, prefer converting it to a JPG of suitable quality while preserving the square aspect ratio.
5. If generation fails, do not falsely report success. Record the reason for failure and proceed with saving the employee definition files.
6. If a user-provided logo already exists, or the Agent already has an image icon, do not overwrite the existing image without user confirmation.

## Acceptance Criteria

- `.magic/logo.png`, or `.magic/logo.jpg`, has been generated directly under `.magic/` and is square.
- The avatar clearly features a professional person's face headshot/avatar, not an object, tool, logo, or mannequin.
- `.magic/IDENTITY.md` contains `icon: .magic/logo.png` (or `.magic/logo.jpg`).
- The avatar file is persisted in `.magic/` as part of the employee definition files.
- An existing user-provided logo is not overwritten by the automatically generated logo without confirmation.
