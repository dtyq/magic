<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Domain\Permission\Repository\Facade\OrganizationAdminRepositoryInterface;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

class OrganizationAdminDomainService
{
    public function __construct(
        private readonly OrganizationAdminRepositoryInterface $organizationAdminRepository
    ) {
    }

    /**
     * 查询组织管理员列表.
     * @return array{total: int, list: OrganizationAdminEntity[]}
     */
    public function queries(string $organizationCode, Page $page, ?array $filters = null): array
    {
        return $this->organizationAdminRepository->queries($organizationCode, $page, $filters);
    }

    /**
     * 保存组织管理员.
     */
    public function save(string $organizationCode, OrganizationAdminEntity $savingOrganizationAdminEntity): OrganizationAdminEntity
    {
        if ($savingOrganizationAdminEntity->shouldCreate()) {
            $organizationAdminEntity = clone $savingOrganizationAdminEntity;
            $organizationAdminEntity->prepareForCreation();

            // 检查用户是否已经是组织管理员
            if ($this->organizationAdminRepository->getByUserId($organizationCode, $savingOrganizationAdminEntity->getUserId())) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.user_already_organization_admin', ['userId' => $savingOrganizationAdminEntity->getUserId()]);
            }
        } else {
            $organizationAdminEntity = $this->organizationAdminRepository->getById($organizationCode, $savingOrganizationAdminEntity->getId());
            if (! $organizationAdminEntity) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.organization_admin_not_found', ['id' => $savingOrganizationAdminEntity->getId()]);
            }

            $savingOrganizationAdminEntity->prepareForModification();
            $organizationAdminEntity = $savingOrganizationAdminEntity;
        }

        return $this->organizationAdminRepository->save($organizationCode, $organizationAdminEntity);
    }

    /**
     * 获取组织管理员详情.
     */
    public function show(string $organizationCode, int $id): OrganizationAdminEntity
    {
        $organizationAdminEntity = $this->organizationAdminRepository->getById($organizationCode, $id);
        if (! $organizationAdminEntity) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.organization_admin_not_found', ['id' => $id]);
        }
        return $organizationAdminEntity;
    }

    /**
     * 根据用户ID获取组织管理员.
     */
    public function getByUserId(string $organizationCode, string $userId): ?OrganizationAdminEntity
    {
        return $this->organizationAdminRepository->getByUserId($organizationCode, $userId);
    }

    /**
     * 删除组织管理员.
     */
    public function destroy(string $organizationCode, OrganizationAdminEntity $organizationAdminEntity): void
    {
        $this->organizationAdminRepository->delete($organizationCode, $organizationAdminEntity);
    }

    /**
     * 检查用户是否为组织管理员.
     */
    public function isOrganizationAdmin(string $organizationCode, string $userId): bool
    {
        return $this->organizationAdminRepository->isOrganizationAdmin($organizationCode, $userId);
    }

    /**
     * 授予用户组织管理员权限.
     */
    public function grant(string $organizationCode, string $userId, string $grantorUserId, ?string $remarks = null): OrganizationAdminEntity
    {
        // 检查用户是否已经是组织管理员
        if ($this->isOrganizationAdmin($organizationCode, $userId)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.user_already_organization_admin', ['userId' => $userId]);
        }

        return $this->organizationAdminRepository->grant($organizationCode, $userId, $grantorUserId, $remarks);
    }

    /**
     * 撤销用户组织管理员权限.
     */
    public function revoke(string $organizationCode, string $userId): void
    {
        // 检查用户是否为组织管理员
        if (! $this->isOrganizationAdmin($organizationCode, $userId)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.user_not_organization_admin', ['userId' => $userId]);
        }

        $this->organizationAdminRepository->revoke($organizationCode, $userId);
    }

    /**
     * 获取组织下所有组织管理员.
     */
    public function getAllOrganizationAdmins(string $organizationCode): array
    {
        return $this->organizationAdminRepository->getAllOrganizationAdmins($organizationCode);
    }

    /**
     * 批量检查用户是否为组织管理员.
     */
    public function batchCheckOrganizationAdmin(string $organizationCode, array $userIds): array
    {
        return $this->organizationAdminRepository->batchCheckOrganizationAdmin($organizationCode, $userIds);
    }

    /**
     * 启用组织管理员.
     */
    public function enable(string $organizationCode, int $id): void
    {
        $organizationAdmin = $this->show($organizationCode, $id);
        $organizationAdmin->enable();
        $this->organizationAdminRepository->save($organizationCode, $organizationAdmin);
    }

    /**
     * 禁用组织管理员.
     */
    public function disable(string $organizationCode, int $id): void
    {
        $organizationAdmin = $this->show($organizationCode, $id);
        $organizationAdmin->disable();
        $this->organizationAdminRepository->save($organizationCode, $organizationAdmin);
    }
}
