<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Facade;

use App\Domain\Contact\Entity\MagicThirdPlatformDepartmentEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use JetBrains\PhpStorm\ArrayShape;

/**
 * @deprecated
 */
interface MagicThirdPlatformDepartmentRepositoryInterface
{
    public function getDepartmentById(string $thirdDepartmentId, string $organizationCode, PlatformType $thirdPlatformType): ?MagicThirdPlatformDepartmentEntity;

    /**
     * @return MagicThirdPlatformDepartmentEntity[]
     */
    public function getDepartmentByIds(array $departmentIds, string $organizationCode, bool $keyById = false): array;

    /**
     * @return MagicThirdPlatformDepartmentEntity[]
     */
    public function getSubDepartmentsById(string $departmentId, string $organizationCode, int $size, int $offset): array;

    /**
     * 获取某一层级的部门.
     * @return MagicThirdPlatformDepartmentEntity[]
     */
    public function getSubDepartmentsByLevel(int $currentDepartmentLevel, string $organizationCode, int $depth, int $size, int $offset): array;

    // 给定的部门id是否有下级部门
    #[ArrayShape([
        'third_parent_department_id' => 'string',
    ])]
    public function hasChildDepartment(array $departmentIds, string $organizationCode): array;

    public function getDepartmentByParentId(string $departmentId, string $organizationCode): ?MagicThirdPlatformDepartmentEntity;

    /**
     * 获取组织的所有部门.
     * @return MagicThirdPlatformDepartmentEntity[]
     */
    public function getOrganizationDepartments(string $organizationCode, array $fields = ['*']): array;
}
