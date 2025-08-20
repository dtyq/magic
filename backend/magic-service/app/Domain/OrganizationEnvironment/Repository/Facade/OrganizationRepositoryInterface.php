<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Repository\Facade;

use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Infrastructure\Core\ValueObject\Page;

/**
 * 组织仓库接口.
 */
interface OrganizationRepositoryInterface
{
    /**
     * 保存组织.
     */
    public function save(OrganizationEntity $organizationEntity): OrganizationEntity;

    /**
     * 根据ID获取组织.
     */
    public function getById(int $id): ?OrganizationEntity;

    /**
     * 根据编码获取组织.
     */
    public function getByCode(string $code): ?OrganizationEntity;

    /**
     * 根据名称获取组织.
     */
    public function getByName(string $name): ?OrganizationEntity;

    /**
     * 查询组织列表.
     * @return array{total: int, list: OrganizationEntity[]}
     */
    public function queries(Page $page, ?array $filters = null): array;

    /**
     * 删除组织.
     */
    public function delete(OrganizationEntity $organizationEntity): void;

    /**
     * 检查编码是否已存在.
     */
    public function existsByCode(string $code, ?int $excludeId = null): bool;
}
