<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Facade;

use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Infrastructure\Core\ValueObject\Page;

interface OrganizationAdminRepositoryInterface
{
    /**
     * 保存组织管理员.
     */
    public function save(string $organizationCode, OrganizationAdminEntity $organizationAdminEntity): OrganizationAdminEntity;

    /**
     * 根据ID获取组织管理员.
     */
    public function getById(string $organizationCode, int $id): ?OrganizationAdminEntity;

    /**
     * 根据用户ID获取组织管理员.
     */
    public function getByUserId(string $organizationCode, string $userId): ?OrganizationAdminEntity;

    /**
     * 查询组织管理员列表.
     * @return array{total: int, list: OrganizationAdminEntity[]}
     */
    public function queries(string $organizationCode, Page $page, ?array $filters = null): array;

    /**
     * 删除组织管理员.
     */
    public function delete(string $organizationCode, OrganizationAdminEntity $organizationAdminEntity): void;

    /**
     * 检查用户是否为组织管理员.
     */
    public function isOrganizationAdmin(string $organizationCode, string $userId): bool;

    /**
     * 授予用户组织管理员权限.
     */
    public function grant(string $organizationCode, string $userId, string $grantorUserId, ?string $remarks = null): OrganizationAdminEntity;

    /**
     * 撤销用户组织管理员权限.
     */
    public function revoke(string $organizationCode, string $userId): void;

    /**
     * 获取组织下所有组织管理员.
     */
    public function getAllOrganizationAdmins(string $organizationCode): array;

    /**
     * 批量检查用户是否为组织管理员.
     */
    public function batchCheckOrganizationAdmin(string $organizationCode, array $userIds): array;
}
