<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Facade;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Infrastructure\Core\ValueObject\Page;

interface OrganizationAdminRepositoryInterface
{
    /**
     * 保存组织管理员.
     */
    public function save(DataIsolation $dataIsolation, OrganizationAdminEntity $organizationAdminEntity): OrganizationAdminEntity;

    /**
     * 根据ID获取组织管理员.
     */
    public function getById(DataIsolation $dataIsolation, int $id): ?OrganizationAdminEntity;

    /**
     * 根据用户ID获取组织管理员.
     */
    public function getByUserId(DataIsolation $dataIsolation, string $userId): ?OrganizationAdminEntity;

    /**
     * 查询组织管理员列表.
     * @return array{total: int, list: OrganizationAdminEntity[]}
     */
    public function queries(DataIsolation $dataIsolation, Page $page, ?array $filters = null): array;

    /**
     * 删除组织管理员.
     */
    public function delete(DataIsolation $dataIsolation, OrganizationAdminEntity $organizationAdminEntity): void;

    /**
     * 检查用户是否为组织管理员.
     */
    public function isOrganizationAdmin(DataIsolation $dataIsolation, string $userId): bool;

    /**
     * 授予用户组织管理员权限.
     */
    public function grant(DataIsolation $dataIsolation, string $userId, ?string $grantorUserId, ?string $remarks = null, bool $isOrganizationCreator = false): OrganizationAdminEntity;

    /**
     * 撤销用户组织管理员权限.
     */
    public function revoke(DataIsolation $dataIsolation, string $userId): void;

    /**
     * 获取组织创建人.
     */
    public function getOrganizationCreator(DataIsolation $dataIsolation): ?OrganizationAdminEntity;

    /**
     * 获取组织下所有组织管理员.
     */
    public function getAllOrganizationAdmins(DataIsolation $dataIsolation): array;

    /**
     * 批量检查用户是否为组织管理员.
     */
    public function batchCheckOrganizationAdmin(DataIsolation $dataIsolation, array $userIds): array;
}
