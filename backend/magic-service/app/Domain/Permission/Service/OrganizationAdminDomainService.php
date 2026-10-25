<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Gateway\OrganizationAdminSyncInterface;
use App\Domain\Permission\Repository\Facade\OrganizationAdminRepositoryInterface;
use App\ErrorCode\PermissionErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\DataIsolation\DataIsolationInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Context\ApplicationContext;
use Hyperf\DbConnection\Db;
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
        private readonly OrganizationRepositoryInterface $organizationRepository,
        private readonly OrganizationAdminSyncInterface $organizationAdminSync,
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
        if ($organizationAdminEntity->isOrganizationCreator()
            || $this->isOrganizationCreator($dataIsolation, $organizationAdminEntity->getUserId())) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.organization_creator_cannot_be_revoked', [
                'userId' => $organizationAdminEntity->getUserId(),
            ]);
        }

        Db::transaction(function () use ($dataIsolation, $organizationAdminEntity): void {
            // 在删除组织管理员记录之前，先移除其在权限系统中的 role_user 关联
            try {
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
        });

        $this->syncTeamshareAdmin($dataIsolation, $organizationAdminEntity->getUserId(), 'revoke');
    }

    /**
     * 检查用户是否为组织管理员.
     */
    public function isOrganizationAdmin(DataIsolation $dataIsolation, string $userId): bool
    {
        if ($userId === '') {
            return false;
        }

        $organization = $this->organizationRepository->getByCode($dataIsolation->getCurrentOrganizationCode());
        // 所有组织的创建人身份都由 magic_organizations.creator_id 直接派生，
        // 不因历史管理员记录缺失而丢失管理员权限。
        if ($organization?->isOwnedBy($userId)) {
            return true;
        }

        return $this->organizationAdminRepository->isOrganizationAdmin($dataIsolation, $userId);
    }

    /**
     * 授予用户组织管理员权限.
     */
    public function grant(DataIsolation $dataIsolation, string $userId, ?string $grantorUserId, ?string $remarks = null, bool $isOrganizationCreator = false): OrganizationAdminEntity
    {
        // Do not rely solely on the HTTP permission annotation here.  That
        // permission can be changed through role management, while the
        // grantor must be an administrator recorded for this organization.
        $isBootstrapCreatorGrant = $isOrganizationCreator
            && $grantorUserId !== null
            && $grantorUserId !== ''
            && $grantorUserId === $userId
            && $this->isOrganizationCreator($dataIsolation, $grantorUserId);
        if (
            ($grantorUserId === null || $grantorUserId === '' || ! $this->isOrganizationAdmin($dataIsolation, $grantorUserId))
            && ! $isBootstrapCreatorGrant
        ) {
            ExceptionBuilder::throw(PermissionErrorCode::AccessDenied, 'permission.error.access_denied');
        }

        // 组织校验与限制
        $orgCode = $dataIsolation->getCurrentOrganizationCode();
        $organization = $this->organizationRepository->getByCode($orgCode);
        if (! $organization) {
            $this->logger->warning('找不到组织代码', ['organizationCode' => $orgCode]);
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_NOT_EXISTS);
        }
        // 个人组织的管理员身份由 creator_id 派生，不写入管理员记录。
        if ($organization->isPersonal()) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.personal_organization_cannot_grant_admin');
        }

        $isOrganizationCreator = $organization->isOwnedBy($userId);
        $existingAdmin = $this->organizationAdminRepository->getByUserId($dataIsolation, $userId);
        // 创建人可能只有组织表记录而没有历史管理员记录，此时仍需补建管理员镜像。
        if ($existingAdmin !== null || (! $isOrganizationCreator && $this->isOrganizationAdmin($dataIsolation, $userId))) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.user_already_organization_admin', ['userId' => $userId]);
        }
        // 检查用户是否有效
        $user = $this->userRepository->getUserById($userId);
        if (! $user) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST, 'user.not_exist', ['userId' => $userId]);
        }

        $organizationAdmin = Db::transaction(function () use ($dataIsolation, $userId, $grantorUserId, $remarks, $isOrganizationCreator): OrganizationAdminEntity {
            // 创建人标记只能由 magic_organizations.creator_id 派生。
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
        });

        $this->syncTeamshareAdmin($dataIsolation, $userId, 'grant');
        return $organizationAdmin;
    }

    /**
     * 同步组织表创建人与管理员/RBAC 的兼容关系。
     *
     * magic_organizations.creator_id 是唯一事实来源，管理员表中的
     * is_organization_creator 仅作为历史镜像维护。
     */
    public function synchronizeOrganizationCreator(DataIsolation $dataIsolation, ?string $previousCreatorUserId = null, ?string $operatorUserId = null): void
    {
        $organization = $this->organizationRepository->getByCode($dataIsolation->getCurrentOrganizationCode());
        $creatorUserId = $organization?->getCreatorId();
        if (! $organization || $creatorUserId === null || $creatorUserId === '') {
            return;
        }

        $operatorUserId ??= $creatorUserId;

        Db::transaction(function () use ($dataIsolation, $organization, $creatorUserId, $previousCreatorUserId, $operatorUserId): void {
            if ($organization->isPersonal()) {
                // 个人组织没有管理员记录，但创建人仍必须拥有组织管理员角色。
                $permissionIsolation = PermissionDataIsolation::create(
                    $dataIsolation->getCurrentOrganizationCode(),
                    $operatorUserId
                );
                $this->roleDomainService->addOrganizationAdmin($permissionIsolation, [$creatorUserId]);
                if ($previousCreatorUserId !== null && $previousCreatorUserId !== '' && $previousCreatorUserId !== $creatorUserId) {
                    $this->roleDomainService->removeOrganizationAdmin($permissionIsolation, $previousCreatorUserId);
                }
                return;
            }

            $creatorAdmin = $this->getByUserId($dataIsolation, $creatorUserId);
            if ($creatorAdmin === null) {
                $creatorAdmin = $this->grant(
                    $dataIsolation,
                    $creatorUserId,
                    $operatorUserId,
                    '组织创建人自动获得管理员权限'
                );
            } else {
                $creatorAdmin->enable();
                $creatorAdmin->markAsOrganizationCreator();
                $creatorAdmin->prepareForModification();
                $this->organizationAdminRepository->save($dataIsolation, $creatorAdmin);
                $permissionIsolation = PermissionDataIsolation::create(
                    $dataIsolation->getCurrentOrganizationCode(),
                    $operatorUserId
                );
                $this->roleDomainService->addOrganizationAdmin($permissionIsolation, [$creatorUserId]);
            }

            if ($previousCreatorUserId !== null && $previousCreatorUserId !== '' && $previousCreatorUserId !== $creatorUserId) {
                $previousCreator = $this->getByUserId($dataIsolation, $previousCreatorUserId);
                if ($previousCreator !== null && $previousCreator->isOrganizationCreator()) {
                    $previousCreator->unmarkAsOrganizationCreator();
                    $previousCreator->prepareForModification();
                    $this->organizationAdminRepository->save($dataIsolation, $previousCreator);
                }
            }
        });
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
        if ($this->isOrganizationCreator($dataIsolation, $userId)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.organization_creator_cannot_be_revoked', ['userId' => $userId]);
        }

        Db::transaction(function () use ($dataIsolation, $userId): void {
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
        });

        $this->syncTeamshareAdmin($dataIsolation, $userId, 'revoke');
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
        $organization = $this->organizationRepository->getByCode($dataIsolation->getCurrentOrganizationCode());
        $result = $this->organizationAdminRepository->batchCheckOrganizationAdmin($dataIsolation, $userIds);
        foreach ($userIds as $userId) {
            if ($organization?->isOwnedBy((string) $userId)) {
                $result[$userId] = true;
            }
        }
        return $result;
    }

    /**
     * 转让组织创建人身份.
     */
    public function transferOrganizationCreator(DataIsolation $dataIsolation, string $currentCreatorUserId, string $newCreatorUserId, string $operatorUserId): void
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $organization = $this->organizationRepository->getByCode($organizationCode);
        if (! $organization) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_NOT_EXISTS);
        }

        if ($organization->isPersonal()) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.personal_organization_cannot_transfer_owner');
        }

        Db::transaction(function () use (
            $dataIsolation,
            $currentCreatorUserId,
            $newCreatorUserId,
            $operatorUserId,
            $organization
        ): void {
            // 创建人以 magic_organizations.creator_id 为准，不依赖历史管理员标记。
            if ($organization->getCreatorId() !== $currentCreatorUserId) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.current_user_not_organization_creator', ['userId' => $currentCreatorUserId]);
            }

            $organizationUsers = $this->userRepository->getUserByIdsAndOrganizations(
                [$newCreatorUserId],
                [$dataIsolation->getCurrentOrganizationCode()]
            );
            if ($organizationUsers === []) {
                ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST, 'user.not_exist', ['userId' => $newCreatorUserId]);
            }

            // 查询旧管理员记录，仅用于维护历史 is_organization_creator 镜像。
            $currentCreator = $this->getByUserId($dataIsolation, $currentCreatorUserId);

            // 检查新创建人是否已经是组织管理员
            $newCreator = $this->getByUserId($dataIsolation, $newCreatorUserId);
            if (! $newCreator) {
                // 如果新创建人还不是管理员，先授予管理员权限
                $newCreator = $this->grant($dataIsolation, $newCreatorUserId, $operatorUserId, '转让组织创建人身份时自动授予管理员权限');
            }
            if (! $newCreator->isEnabled()) {
                // 创建人必须保持启用状态，避免转让后出现“创建人存在但没有管理员权限”。
                $newCreator->setStatus(1);
            }

            // 取消旧管理员记录上的历史创建人镜像
            if ($currentCreator !== null) {
                $currentCreator->unmarkAsOrganizationCreator();
                $currentCreator->prepareForModification();
                $this->organizationAdminRepository->save($dataIsolation, $currentCreator);
            }

            // 授予新创建人的创建人身份
            $newCreator->markAsOrganizationCreator();
            $newCreator->prepareForModification();
            $this->organizationAdminRepository->save($dataIsolation, $newCreator);

            // TODO: magic_organizations 由 keewood-service 同步而来；后续应先在
            // keewood-service 完成创建人转让，再同步回本服务，不能由这里直接改组织表。
            // 当前暂保留本地写入，待跨服务转让流程落地后移除。
            $organization->setCreatorId($newCreatorUserId);
            $organization->prepareForModification();
            $this->organizationRepository->save($organization);
        });
    }

    /**
     * 获取组织创建人.
     */
    public function getOrganizationCreator(DataIsolation $dataIsolation): ?OrganizationAdminEntity
    {
        $organization = $this->organizationRepository->getByCode($dataIsolation->getCurrentOrganizationCode());
        $creatorUserId = $organization?->getCreatorId();
        if ($creatorUserId === null || $creatorUserId === '') {
            return null;
        }

        // 创建人统一由 magic_organizations.creator_id 派生；返回实体仅用于兼容既有调用方。
        $organizationCreator = new OrganizationAdminEntity();
        $organizationCreator->setUserId($creatorUserId);
        $organizationCreator->setOrganizationCode($organization->getMagicOrganizationCode());
        $organizationCreator->setIsOrganizationCreator(true);
        return $organizationCreator;
    }

    /**
     * 检查用户是否为组织创建人.
     */
    public function isOrganizationCreator(DataIsolation $dataIsolation, string $userId): bool
    {
        $organization = $this->organizationRepository->getByCode($dataIsolation->getCurrentOrganizationCode());
        return $organization?->isOwnedBy($userId) ?? false;
    }

    /**
     * 获取组织信息.
     */
    public function getOrganizationInfo(DataIsolationInterface $dataIsolation): ?OrganizationEntity
    {
        return $this->organizationRepository->getByCode($dataIsolation->getCurrentOrganizationCode());
    }

    private function syncTeamshareAdmin(DataIsolation $dataIsolation, string $userId, string $operation): void
    {
        // A nested domain operation may still be inside its caller's transaction.
        // Let the outer operation finish and rely on reconciliation for that rare path.
        if (Db::connection()->transactionLevel() > 0) {
            return;
        }

        $organization = $this->organizationRepository->getByCode($dataIsolation->getCurrentOrganizationCode());
        if ($organization === null || $organization->isPersonal()) {
            return;
        }

        try {
            $this->organizationAdminSync->sync(
                $dataIsolation->getCurrentOrganizationCode(),
                $userId,
                $operation
            );
        } catch (Throwable $e) {
            $this->logger->warning('Failed to sync organization admin to Teamshare', [
                'organizationCode' => $dataIsolation->getCurrentOrganizationCode(),
                'userId' => $userId,
                'operation' => $operation,
                'exception' => $e,
            ]);
        }
    }
}
