<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Facade;

use Dtyq\SuperMagic\Domain\Skill\Entity\UserSkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;

interface UserSkillRepositoryInterface
{
    public function save(SkillDataIsolation $dataIsolation, UserSkillEntity $entity): UserSkillEntity;

    public function findBySkillCode(SkillDataIsolation $dataIsolation, string $skillCode): ?UserSkillEntity;

    /**
     * @return array<string, UserSkillEntity>
     */
    public function findBySkillCodes(SkillDataIsolation $dataIsolation, array $skillCodes): array;

    public function deleteBySkillCode(SkillDataIsolation $dataIsolation, string $skillCode): bool;
}
