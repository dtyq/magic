<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Facade;

use App\Domain\Chat\DTO\PageResponseDTO\DepartmentUsersPageResponseDTO;
use App\Domain\Contact\Entity\MagicDepartmentUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;

interface MagicDepartmentUserRepositoryInterface
{
    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function getDepartmentUsersByUserIds(array $userIds, string $organizationCode): array;

    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function getDepartmentUsersByUserIdsInMagic(array $userIds): array;

    public function getDepartmentUsersByDepartmentId(string $departmentId, string $organizationCode, int $limit, int $offset): DepartmentUsersPageResponseDTO;

    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function getDepartmentUsersByDepartmentIds(array $departmentIds, string $organizationCode, int $limit, array $fields = ['*']): array;

    public function getDepartmentIdsByUserIds(DataIsolation $dataIsolation, array $userIds, bool $withAllParentIds = false): array;

    public function createDepartmentUsers(array $createDepartmentUserDTOs): bool;

    public function updateDepartmentUser(string $magicDepartmentUserPrimaryId, array $updateData): int;

    public function deleteDepartmentUsersByMagicIds(array $magicIds, string $departmentId, string $magicOrganizationCode): int;

    public function searchDepartmentUsersByJobTitle(string $keyword, string $magicOrganizationCode): array;
}
