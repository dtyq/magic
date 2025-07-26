<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Facade;

use App\Domain\Chat\DTO\PageResponseDTO\DepartmentsPageResponseDTO;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\ValueObject\DepartmentOption;
use JetBrains\PhpStorm\ArrayShape;

interface MagicDepartmentRepositoryInterface
{
    public function getDepartmentById(string $departmentId, string $organizationCode): ?MagicDepartmentEntity;

    // 获取父部门下的一个子部门
    public function getDepartmentByParentId(string $departmentId, string $organizationCode): ?MagicDepartmentEntity;

    /**
     * @return MagicDepartmentEntity[]
     */
    public function getDepartmentsByIds(array $departmentIds, string $organizationCode, bool $keyById = false): array;

    /**
     * @return MagicDepartmentEntity[]
     */
    public function getDepartmentsByIdsInMagic(array $departmentIds, bool $keyById = false): array;

    /**
     * 批量获取部门的下n级部门.
     */
    public function getSubDepartmentsById(string $departmentId, string $organizationCode, int $size, int $offset): DepartmentsPageResponseDTO;

    /**
     * 获取某一层级的部门.
     */
    public function getSubDepartmentsByLevel(int $level, string $organizationCode, int $depth, int $size, int $offset): DepartmentsPageResponseDTO;

    // 给定的部门id是否有下级部门
    #[ArrayShape([
        [
            'parent_department_id' => 'string',
        ],
    ])]
    public function hasChildDepartment(array $departmentIds, string $organizationCode): array;

    /**
     * @return MagicDepartmentEntity[]
     */
    public function searchDepartments(string $departmentName, string $organizationCode, string $pageToken = '', ?int $pageSize = null): array;

    /**
     * 获取组织的所有部门.
     * @return MagicDepartmentEntity[]
     */
    public function getOrganizationDepartments(string $organizationCode, array $fields = ['*'], bool $keyById = false): array;

    /**
     * 增加部门说明书.
     */
    public function addDepartmentDocument(string $departmentId, string $documentId): void;

    /**
     * 获取部门的所有子部门的成员总数.
     */
    public function getSelfAndChildrenEmployeeSum(MagicDepartmentEntity $magicDepartmentEntity): int;

    /**
     * @param MagicDepartmentEntity[] $magicDepartmentsDTO
     * @return MagicDepartmentEntity[]
     */
    public function createDepartments(array $magicDepartmentsDTO): array;

    public function updateDepartment(string $departmentId, array $data, string $organizationCode): int;

    public function updateDepartmentsOptionByIds(array $departmentIds, ?DepartmentOption $departmentOption = null): int;

    /**
     * 根据部门ID批量删除部门（逻辑删除，设置 deleted_at 字段）。
     */
    public function deleteDepartmentsByIds(array $departmentIds, string $organizationCode): int;

    /**
     * 获取组织的根部门ID.
     */
    public function getDepartmentRootId(string $organizationCode): ?string;

    /**
     * 批量获取多个组织的根部门信息.
     * @param array $organizationCodes 组织代码数组
     * @return MagicDepartmentEntity[] 根部门实体数组
     */
    public function getOrganizationsRootDepartment(array $organizationCodes): array;

    /**
     * Get all organizations root departments with pagination support.
     * @param int $page Page number
     * @param int $pageSize Page size
     * @param string $organizationName Organization name for fuzzy search (optional)
     * @return array Array containing total and list
     */
    public function getAllOrganizationsRootDepartments(int $page = 1, int $pageSize = 20, string $organizationName = ''): array;
}
