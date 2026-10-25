<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Facade;

use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderConfigSearchField;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderConfigQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface ProviderConfigRepositoryInterface
{
    public function getById(ProviderDataIsolation $dataIsolation, int $id): ?ProviderConfigEntity;

    /**
     * @param array<int> $ids
     * @return array<int, ProviderConfigEntity>
     */
    public function getByIds(ProviderDataIsolation $dataIsolation, array $ids): array;

    /**
     * @return array{total: int, list: array<ProviderConfigEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderConfigQuery $query, Page $page): array;

    /**
     * 按指定字段搜索服务商配置。
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离上下文
     * @return array{total: int, list: array<int, array<string, mixed>>}
     */
    public function searchProviderConfigs(
        ProviderDataIsolation $dataIsolation,
        Page $page,
        ProviderConfigSearchField $searchField,
        string $keyword
    ): array;

    /**
     * 获取服务商配置的身份元数据，不读取配置密钥内容。
     *
     * @param array<int> $ids
     * @return array<int, array{service_provider_config_id: string, organization_code: string, provider_name: string, provider_alias: string}>
     */
    public function getProviderConfigIdentityMetadataByIds(array $ids): array;

    /** @return array<int> */
    public function getOfficialOrganizationConfigIds(): array;

    public function save(ProviderDataIsolation $dataIsolation, ProviderConfigEntity $providerConfigEntity): ProviderConfigEntity;

    public function updateProviderCode(ProviderDataIsolation $dataIsolation, string $id, string $providerCode): void;

    public function delete(ProviderDataIsolation $dataIsolation, string $id): void;

    /**
     * 通过配置ID和组织编码获取服务商配置实体.
     *
     * @param string $serviceProviderConfigId 服务商配置ID
     * @param string $organizationCode 组织编码
     * @return null|ProviderConfigEntity 服务商配置实体
     */
    public function getProviderConfigEntityById(string $serviceProviderConfigId, string $organizationCode): ?ProviderConfigEntity;

    /**
     * 根据服务商ID查找配置（按ID升序取第一个）.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param int $serviceProviderId 服务商ID
     * @return null|ProviderConfigEntity 配置实体
     */
    public function findFirstByServiceProviderId(ProviderDataIsolation $dataIsolation, int $serviceProviderId): ?ProviderConfigEntity;

    /**
     * 根据ID获取配置实体（不按组织过滤，全局查询）.
     *
     * @param int $id 配置ID
     * @return null|ProviderConfigEntity 配置实体
     */
    public function getByIdWithoutOrganizationFilter(int $id): ?ProviderConfigEntity;

    /**
     * 根据ID数组获取配置实体列表（不按组织过滤，全局查询）.
     *
     * @param array<int> $ids 配置ID数组
     * @return array<int, ProviderConfigEntity> 返回以id为key的配置实体数组
     */
    public function getByIdsWithoutOrganizationFilter(array $ids): array;

    /**
     * 获取组织下所有启用的服务商配置.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @return array<ProviderConfigEntity> 服务商配置实体数组
     */
    public function getAllByOrganization(ProviderDataIsolation $dataIsolation): array;

    /**
     * 获取启用状态的配置ID列表.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @return array<int> 启用的配置ID数组
     */
    public function getEnabledConfigIds(ProviderDataIsolation $dataIsolation): array;
}
