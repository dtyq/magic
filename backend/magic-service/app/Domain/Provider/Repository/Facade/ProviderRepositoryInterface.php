<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Facade;

use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface ProviderRepositoryInterface
{
    public function getById(int $id): ?ProviderEntity;

    /**
     * @param array<int> $ids
     * @return array<int, ProviderEntity> 返回以id为key的实体对象数组
     */
    public function getByIds(array $ids): array;

    /**
     * @return array{total: int, list: array<ProviderEntity>}
     */
    public function queries(ProviderQuery $query, Page $page): array;

    public function getAllNonOfficialProviders(Category $category): array;

    /**
     * 根据分类获取所有服务商.
     * @param Category $category 分类
     * @return ProviderEntity[] 服务商实体列表
     */
    public function getByCategory(Category $category): array;

    /**
     * 根据ProviderCode和Category获取服务商.
     * @param ProviderCode $providerCode 服务商编码
     * @param Category $category 分类
     * @return null|ProviderEntity 服务商实体
     */
    public function getByCodeAndCategory(ProviderCode $providerCode, Category $category): ?ProviderEntity;

    /**
     * 根据ID获取服务商实体（不按组织过滤，全局查询）.
     *
     * @param int $id 服务商ID
     * @return null|ProviderEntity 服务商实体
     */
    public function getByIdWithoutOrganizationFilter(int $id): ?ProviderEntity;

    /**
     * 根据ID数组获取服务商实体列表（不按组织过滤，全局查询）.
     *
     * @param array<int> $ids 服务商ID数组
     * @return array<int, ProviderEntity> 返回以id为key的服务商实体数组
     */
    public function getByIdsWithoutOrganizationFilter(array $ids): array;
}
