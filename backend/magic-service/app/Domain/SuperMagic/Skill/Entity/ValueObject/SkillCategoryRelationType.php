<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Entity\ValueObject;

enum SkillCategoryRelationType: string
{
    case SkillVersion = 'SKILL_VERSION';
    case SkillMarket = 'SKILL_MARKET';
}
