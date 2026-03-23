<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Facade;

use Dtyq\SuperMagic\Domain\Skill\Entity\UserSkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;

interface UserSkillRepositoryInterface
{
    public function save(SkillDataIsolation $dataIsolation, UserSkillEntity $entity): UserSkillEntity;

    public function findBySkillCode(SkillDataIsolation $dataIsolation, string $skillCode): ?UserSkillEntity;

    /**
     * @return array<string>
     */
    public function findCurrentUserSkillCodes(SkillDataIsolation $dataIsolation): array;

    /**
     * @return array<string, UserSkillEntity>
     */
    public function findBySkillCodes(SkillDataIsolation $dataIsolation, array $skillCodes): array;

    /**
     * @return UserSkillEntity[]
     */
    public function findAllBySkillCode(SkillDataIsolation $dataIsolation, string $skillCode): array;

    /**
     * @return array<string>
     */
    public function findSkillCodesBySourceType(
        SkillDataIsolation $dataIsolation,
        SkillSourceType|string $sourceType
    ): array;

    public function deleteBySkillCodeExceptUser(SkillDataIsolation $dataIsolation, string $skillCode, string $excludedUserId): int;

    public function deleteAllBySkillCode(SkillDataIsolation $dataIsolation, string $skillCode): int;

    public function deleteBySkillCode(SkillDataIsolation $dataIsolation, string $skillCode): bool;
}
