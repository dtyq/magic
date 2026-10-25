# HTML API Skill Maintenance Notice

The frontend `iframe-api/skill` directory is not the source of truth for HTML micro-app API guidance.

Prompt for agents:

> MagicBase and HTML database guidance is maintained in [backend/super-magic/agents/skills/magicbase](../../../../../../../../../../../backend/super-magic/agents/skills/magicbase). Use that skill for `window.Magic.getContext()`, current-user identity, permissions, MagicBase schema workflow, and `window.Magic.db` row operations. General HTML runtime APIs are maintained in [backend/super-magic/agents/skills/html-api-sdk](../../../../../../../../../../../backend/super-magic/agents/skills/html-api-sdk). Do not update this frontend directory as the source of truth.
