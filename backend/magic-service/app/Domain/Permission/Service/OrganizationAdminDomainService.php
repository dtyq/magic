<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Facade\OrganizationAdminRepositoryInterface;
use App\ErrorCode\PermissionErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class OrganizationAdminDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly OrganizationAdminRepositoryInterface $organizationAdminRepository,
        private readonly MagicUserRepositoryInterface $userRepository,
        private readonly RoleDomainService $roleDomainService,
        private readonly OrganizationRepositoryInterface $organizationRepository
    ) {
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(static::class);
    }

    /**
     * 查询组织管理员列表.
     * @return array{total: int, list: OrganizationAdminEntity[]}
     */
    public function queries(DataIsolation $dataIsolation, Page $page, ?array $filters = null): array
    {
        return $this->organizationAdminRepository->queries($dataIsolation, $page, $filters);
    }

    /**
     * 保存组织管理员.
     */
    public function save(DataIsolation $dataIsolation, OrganizationAdminEntity $savingOrganizationAdminEntity): OrganizationAdminEntity
    {
        if ($savingOrganizationAdminEntity->shouldCreate()) {
            $organizationAdminEntity = clone $savingOrganizationAdminEntity;
            $organizationAdminEntity->prepareForCreation();

            // 检查用户是否已经是组织管理员
            if ($this->organizationAdminRepository->getByUserId($dataIsolation, $savingOrganizationAdminEntity->getUserId())) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.user_already_organization_admin', ['userId' => $savingOrganizationAdminEntity->getUserId()]);
            }
        } else {
            $organizationAdminEntity = $this->organizationAdminRepository->getById($dataIsolation, $savingOrganizationAdminEntity->getId());
            if (! $organizationAdminEntity) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.organization_admin_not_found', ['id' => $savingOrganizationAdminEntity->getId()]);
            }

            $savingOrganizationAdminEntity->prepareForModification();
            $organizationAdminEntity = $savingOrganizationAdminEntity;
        }

        return $this->organizationAdminRepository->save($dataIsolation, $organizationAdminEntity);
    }

    /**
     * 获取组织管理员详情.
     */
    public function show(DataIsolation $dataIsolation, int $id): OrganizationAdminEntity
    {
        $organizationAdminEntity = $this->organizationAdminRepository->getById($dataIsolation, $id);
        if (! $organizationAdminEntity) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.organization_admin_not_found', ['id' => $id]);
        }
        return $organizationAdminEntity;
    }

    /**
     * 根据用户ID获取组织管理员.
     */
    public function getByUserId(DataIsolation $dataIsolation, string $userId): ?OrganizationAdminEntity
    {
        return $this->organizationAdminRepository->getByUserId($dataIsolation, $userId);
    }

    /**
     * 删除组织管理员.
     */
    public function destroy(DataIsolation $dataIsolation, OrganizationAdminEntity $organizationAdminEntity): void
    {
        // 在删除组织管理员记录之前，先移除其在权限系统中的 role_user 关联
        try {
            // 创建权限隔离对象，用于操作角色服务
            $permissionIsolation = PermissionDataIsolation::create(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId() ?? ''
            );

            $this->roleDomainService->removeOrganizationAdmin($permissionIsolation, $organizationAdminEntity->getUserId());
        } catch (Throwable $e) {
            $this->logger->error('Failed to remove organization admin role when destroying admin', [
                'exception' => $e,
            ]);
        }

        // 删除组织管理员记录
        $this->organizationAdminRepository->delete($dataIsolation, $organizationAdminEntity);
    }

    /**
     * 检查用户是否为组织管理员.
     */
    public function isOrganizationAdmin(DataIsolation $dataIsolation, string $userId): bool
    {
        return $this->organizationAdminRepository->isOrganizationAdmin($dataIsolation, $userId);
    }

    /**
     * 授予用户组织管理员权限.
     */
    public function grant(DataIsolation $dataIsolation, string $userId, ?string $grantorUserId, ?string $remarks = null, bool $isOrganizationCreator = false): OrganizationAdminEntity
    {
        // 组织校验与限制
        $orgCode = $dataIsolation->getCurrentOrganizationCode();
        $organization = $this->organizationRepository->getByCode($orgCode);
        if (! $organization) {
            $this->logger->warning('找不到组织代码', ['organizationCode' => $orgCode]);
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_NOT_EXISTS);
        }
        // 个人组织不允许授予组织管理员
        if ($organization->getType() === 1) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.personal_organization_cannot_grant_admin');
        }

        // 检查用户是否已经是组织管理员
        if ($this->isOrganizationAdmin($dataIsolation, $userId)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.user_already_organization_admin', ['userId' => $userId]);
        }
        // 检查用户是否有效
        $user = $this->userRepository->getUserById($userId);
        if (! $user) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST, 'user.not_exist', ['userId' => $userId]);
        }

        // 授予组织管理员实体
        $organizationAdmin = $this->organizationAdminRepository->grant($dataIsolation, $userId, $grantorUserId, $remarks, $isOrganizationCreator);

        // 同步创建 / 更新组织管理员角色
        try {
            $permissionIsolation = PermissionDataIsolation::create(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId() ?? ''
            );
            $this->roleDomainService->addOrganizationAdmin($permissionIsolation, [$userId]);
        } catch (Throwable $e) {
            $this->logger->warning('Failed to add organization admin role', [
                'exception' => $e,
                'userId' => $userId,
                'organizationCode' => $dataIsolation->getCurrentOrganizationCode(),
            ]);
        }

        return $organizationAdmin;
    }

    /**
     * 撤销用户组织管理员权限.
     */
    public function revoke(DataIsolation $dataIsolation, string $userId): void
    {
        // 检查用户是否为组织管理员
        if (! $this->isOrganizationAdmin($dataIsolation, $userId)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.user_not_organization_admin', ['userId' => $userId]);
        }

        // 检查是否为组织创建人，组织创建人不可删除管理员权限
        $organizationAdmin = $this->getByUserId($dataIsolation, $userId);
        if ($organizationAdmin && $organizationAdmin->isOrganizationCreator()) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.organization_creator_cannot_be_revoked', ['userId' => $userId]);
        }

        $this->organizationAdminRepository->revoke($dataIsolation, $userId);

        // 同步移除组织管理员角色
        try {
            $permissionIsolation = PermissionDataIsolation::create(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId() ?? ''
            );
            $this->roleDomainService->removeOrganizationAdmin($permissionIsolation, $userId);
        } catch (Throwable $e) {
            $this->logger->warning('Failed to remove organization admin role', [
                'exception' => $e,
                'userId' => $userId,
                'organizationCode' => $dataIsolation->getCurrentOrganizationCode(),
            ]);
        }
    }

    /**
     * 获取组织下所有组织管理员.
     */
    public function getAllOrganizationAdmins(DataIsolation $dataIsolation): array
    {
        return $this->organizationAdminRepository->getAllOrganizationAdmins($dataIsolation);
    }

    /**
     * 批量检查用户是否为组织管理员.
     */
    public function batchCheckOrganizationAdmin(DataIsolation $dataIsolation, array $userIds): array
    {
        return $this->organizationAdminRepository->batchCheckOrganizationAdmin($dataIsolation, $userIds);
    }

    /**
     * 转让组织创建人身份.
     */
    public function transferOrganizationCreator(DataIsolation $dataIsolation, string $currentCreatorUserId, string $newCreatorUserId, string $operatorUserId): void
    {
        // 检查当前创建人是否存在且确实是创建人
        $currentCreator = $this->getByUserId($dataIsolation, $currentCreatorUserId);
        if (! $currentCreator || ! $currentCreator->isOrganizationCreator()) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.current_user_not_organization_creator', ['userId' => $currentCreatorUserId]);
        }

        // 检查新创建人是否已经是组织管理员
        $newCreator = $this->getByUserId($dataIsolation, $newCreatorUserId);
        if (! $newCreator) {
            // 如果新创建人还不是管理员，先授予管理员权限
            $newCreator = $this->grant($dataIsolation, $newCreatorUserId, $operatorUserId, '转让组织创建人身份时自动授予管理员权限');
        }

        // 取消当前创建人的创建人身份
        $currentCreator->unmarkAsOrganizationCreator();
        $currentCreator->prepareForModification();
        $this->organizationAdminRepository->save($dataIsolation, $currentCreator);

        // 授予新创建人的创建人身份
        $newCreator->markAsOrganizationCreator();
        $newCreator->prepareForModification();
        $this->organizationAdminRepository->save($dataIsolation, $newCreator);
    }

    /**
     * 获取组织创建人.
     */
    public function getOrganizationCreator(DataIsolation $dataIsolation): ?OrganizationAdminEntity
    {
        return $this->organizationAdminRepository->getOrganizationCreator($dataIsolation);
    }

    /**
     * 检查用户是否为组织创建人.
     */
    public function isOrganizationCreator(DataIsolation $dataIsolation, string $userId): bool
    {
        $admin = $this->getByUserId($dataIsolation, $userId);
        return $admin && $admin->isOrganizationCreator();
    }
}
