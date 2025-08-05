<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Service;

use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

/**
 * 组织领域服务.
 */
readonly class OrganizationDomainService
{
    public function __construct(
        private OrganizationRepositoryInterface $organizationRepository
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

        // 检查名称是否已存在
        if ($this->organizationRepository->existsByName($organizationEntity->getName())) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_NAME_EXISTS);
        }

        $organizationEntity->prepareForCreation();

        return $this->organizationRepository->save($organizationEntity);
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

        // 检查名称是否已存在（排除当前组织）
        if ($this->organizationRepository->existsByName($organizationEntity->getName(), $organizationEntity->getId())) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_NAME_EXISTS);
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

    /**
     * 检查组织名称是否可用.
     */
    public function isNameAvailable(string $name, ?int $excludeId = null): bool
    {
        return ! $this->organizationRepository->existsByName($name, $excludeId);
    }
}
