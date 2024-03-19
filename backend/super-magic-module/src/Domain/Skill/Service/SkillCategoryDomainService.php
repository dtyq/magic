<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Service;

use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillCategoryRepositoryInterface;

/**
 * Skill 分类领域服务.
 */
class SkillCategoryDomainService
{
    public function __construct(
        protected SkillCategoryRepositoryInterface $skillCategoryRepository
    ) {
    }
}
