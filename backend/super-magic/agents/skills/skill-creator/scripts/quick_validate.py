#!/usr/bin/env python3
"""
Quick validation script for skills - minimal version
"""

import asyncio
import re
import sys
import unicodedata
from pathlib import Path

import aiofiles
import yaml


def is_valid_skill_name(skill_name: str) -> bool:
    """Return whether a skill name is safe as a single workspace directory."""
    if not skill_name or len(skill_name) > 64:
        return False
    if not unicodedata.category(skill_name[0]).startswith("L"):
        return False
    if any(
        not (unicodedata.category(character).startswith(("L", "N")) or character in "-_")
        for character in skill_name
    ):
        return False
    if skill_name.endswith(("-", "_")):
        return False
    return not any(separator in skill_name for separator in ("--", "__", "-_", "_-"))


async def validate_skill(skill_path):
    """Basic validation of a skill"""
    skill_path = Path(skill_path)

    # Check SKILL.md exists
    skill_md = skill_path / 'SKILL.md'
    if not await asyncio.to_thread(skill_md.exists):
        return False, "SKILL.md not found"

    # Read and validate frontmatter
    async with aiofiles.open(skill_md, encoding='utf-8') as f:
        content = await f.read()

    if not content.startswith('---'):
        return False, "No YAML frontmatter found"

    # Extract frontmatter
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format"

    frontmatter_text = match.group(1)

    # Parse YAML frontmatter
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, "Frontmatter must be a YAML dictionary"
    except yaml.YAMLError as e:
        return False, f"Invalid YAML in frontmatter: {e}"

    # Check required fields; other frontmatter keys are extensible and not allow-listed.
    if 'name' not in frontmatter:
        return False, "Missing 'name' in frontmatter"
    if 'description' not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    # Extract name for validation
    name = frontmatter.get('name', '')
    if not isinstance(name, str):
        return False, f"Name must be a string, got {type(name).__name__}"
    name = name.strip()
    if not name:
        return False, "Name cannot be empty"
    # Keep the name safe as a single filesystem directory while allowing localized text.
    if not is_valid_skill_name(name):
        return False, f"Name '{name}' is not a valid skill directory name"
    # The skill name must match the directory name.
    dir_name = skill_path.name
    if name != dir_name:
        return False, f"Name '{name}' in frontmatter does not match directory name '{dir_name}'"

    # Extract and validate description
    description = frontmatter.get('description', '')
    if not isinstance(description, str):
        return False, f"Description must be a string, got {type(description).__name__}"
    description = description.strip()
    if description:
        # Check for angle brackets
        if '<' in description or '>' in description:
            return False, "Description cannot contain angle brackets (< or >)"
        # Check description length (max 1024 characters per spec)
        if len(description) > 1024:
            return False, f"Description is too long ({len(description)} characters). Maximum is 1024 characters."

    # Validate compatibility field if present (optional)
    compatibility = frontmatter.get('compatibility', '')
    if compatibility:
        if not isinstance(compatibility, str):
            return False, f"Compatibility must be a string, got {type(compatibility).__name__}"
        if len(compatibility) > 500:
            return False, f"Compatibility is too long ({len(compatibility)} characters). Maximum is 500 characters."

    return True, "Skill is valid!"


async def _main():
    if len(sys.argv) != 2:
        print("Usage: python quick_validate.py <skill_directory>")
        sys.exit(1)

    valid, message = await validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)


if __name__ == "__main__":
    asyncio.run(_main())
