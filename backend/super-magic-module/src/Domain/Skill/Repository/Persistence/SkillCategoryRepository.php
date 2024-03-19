<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\SkillCategoryModel;

/**
 * Skill 分类仓储实现.
 */
class SkillCategoryRepository extends AbstractRepository implements SkillCategoryRepositoryInterface
{
    public function __construct(
        protected SkillCategoryModel $skillCategoryModel
    ) {
    }
}
