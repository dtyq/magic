<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\ErrorCode\PermissionErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Throwable;

/**
 * 组织领域服务.
 */
readonly class OrganizationDomainService
{
    public function __construct(
        private OrganizationRepositoryInterface $organizationRepository,
        private MagicUserDomainService $userDomainService,
        private OrganizationAdminDomainService $organizationAdminDomainService
    ) {
    }

    /**
     * 创建组织.
     */
    public function create(OrganizationEntity $organizationEntity): OrganizationEntity
    {
        // 检查编码是否已存在
        if ($this->organizationRepository->existsByCode($organizationEntity->getMagicOrganizationCode())) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_CODE_EXISTS);
        }

        // 检查创建者是否存在
        $creatorId = $organizationEntity->getCreatorId();
        if ($creatorId !== null) {
            $creator = $this->userDomainService->getUserById((string) $creatorId);
            if ($creator === null) {
                ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
            }
        }

        $organizationEntity->prepareForCreation();

        $savedOrganization = $this->organizationRepository->save($organizationEntity);

        if ($creatorId !== null && $savedOrganization->getType() !== 1) {
            // 个人组织不添加组织管理员
            // 为创建者添加组织管理员权限并标记为组织创建人
            try {
                $dataIsolation = DataIsolation::simpleMake($savedOrganization->getMagicOrganizationCode(), (string) $creatorId);
                $this->organizationAdminDomainService->grant(
                    $dataIsolation,
                    (string) $creatorId,
                    (string) $creatorId, // 授予者也是创建者自己
                    '组织创建者自动获得管理员权限',
                    true // 标记为组织创建人
                );
            } catch (Throwable $e) {
                // 如果授予管理员权限失败，记录日志但不影响组织创建
                error_log("Failed to grant organization admin permission for creator {$creatorId}: " . $e->getMessage());
            }
        }

        return $savedOrganization;
    }

    /**
     * 更新组织.
     */
    public function update(OrganizationEntity $organizationEntity): OrganizationEntity
    {
        if ($organizationEntity->shouldCreate()) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_NOT_EXISTS);
        }

        // 检查编码是否已存在（排除当前组织）
        if ($this->organizationRepository->existsByCode($organizationEntity->getMagicOrganizationCode(), $organizationEntity->getId())) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_CODE_EXISTS);
        }

        $organizationEntity->prepareForModification();

        return $this->organizationRepository->save($organizationEntity);
    }

    /**
     * 根据ID获取组织.
     */
    public function getById(int $id): ?OrganizationEntity
    {
        return $this->organizationRepository->getById($id);
    }

    /**
     * 根据编码获取组织.
     */
    public function getByCode(string $magicOrganizationCode): ?OrganizationEntity
    {
        return $this->organizationRepository->getByCode($magicOrganizationCode);
    }

    /**
     * 根据名称获取组织.
     */
    public function getByName(string $name): ?OrganizationEntity
    {
        return $this->organizationRepository->getByName($name);
    }

    /**
     * 查询组织列表.
     * @return array{total: int, list: OrganizationEntity[]}
     */
    public function queries(Page $page, ?array $filters = null): array
    {
        return $this->organizationRepository->queries($page, $filters);
    }

    /**
     * 删除组织.
     */
    public function delete(int $id): void
    {
        $organization = $this->getById($id);
        if (! $organization) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_NOT_EXISTS);
        }

        $this->organizationRepository->delete($organization);
    }

    /**
     * 启用组织.
     */
    public function enable(int $id): OrganizationEntity
    {
        $organization = $this->getById($id);
        if (! $organization) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_NOT_EXISTS);
        }

        $organization->enable();
        $organization->prepareForModification();

        return $this->organizationRepository->save($organization);
    }

    /**
     * 禁用组织.
     */
    public function disable(int $id): OrganizationEntity
    {
        $organization = $this->getById($id);
        if (! $organization) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_NOT_EXISTS);
        }

        $organization->disable();
        $organization->prepareForModification();

        return $this->organizationRepository->save($organization);
    }

    /**
     * 检查组织编码是否可用.
     */
    public function isCodeAvailable(string $code, ?int $excludeId = null): bool
    {
        return ! $this->organizationRepository->existsByCode($code, $excludeId);
    }

    public function isPersonOrganization(string $code): bool
    {
        $organizationEntity = $this->organizationRepository->getByCode($code);
        return $organizationEntity->getType() == 1;
    }
}
