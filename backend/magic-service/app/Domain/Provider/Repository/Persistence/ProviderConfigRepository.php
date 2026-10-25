<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\DTO\ProviderConfigDTO;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderConfigSearchField;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderType;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderConfigQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Aes\AesUtil;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Provider\Assembler\ProviderConfigAssembler;
use DateTime;
use Hyperf\Codec\Json;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;

use function Hyperf\Config\config;

class ProviderConfigRepository extends AbstractModelRepository implements ProviderConfigRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function __construct(
        protected ProviderConfigModel $configModel,
        protected ProviderModelModel $serviceProviderModelsModel,
        protected ProviderModel $serviceProviderModel
    ) {
        parent::__construct($configModel, $serviceProviderModelsModel, $serviceProviderModel);
    }

    public function getById(ProviderDataIsolation $dataIsolation, int $id): ?ProviderConfigEntity
    {
        $builder = $this->createBuilder($dataIsolation, ProviderConfigModel::query());

        $builder->where('id', $id);

        $result = Db::select($builder->toSql(), $builder->getBindings());

        if (empty($result)) {
            return null;
        }

        return ProviderConfigAssembler::toEntity($result[0]);
    }

    /**
     * @param array<int> $ids
     * @return array<int, ProviderConfigEntity>
     */
    public function getByIds(ProviderDataIsolation $dataIsolation, array $ids): array
    {
        if (empty($ids)) {
            return [];
        }
        $builder = $this->createBuilder($dataIsolation, ProviderConfigModel::query());

        $ids = array_values(array_unique($ids));
        $builder->whereIn('id', $ids);
        $result = Db::select($builder->toSql(), $builder->getBindings());

        $entities = [];
        foreach ($result as $model) {
            $entities[$model['id']] = ProviderConfigAssembler::toEntity($model);
        }

        return $entities;
    }

    /**
     * @return array{total: int, list: array<ProviderConfigEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderConfigQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, ProviderConfigModel::query());

        if (! is_null($query->getStatus())) {
            $builder->where('status', $query->getStatus()->value);
        }
        if (! is_null($query->getIds())) {
            $builder->whereIn('id', $query->getIds());
        }

        // 添加排序（数字越大越靠前）
        $builder->orderBy('sort', 'DESC')->orderBy('id', 'ASC');

        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        /** @var ProviderConfigModel $model */
        foreach ($result['list'] as $model) {
            $entity = ProviderConfigAssembler::toEntity($model->toArray());
            if ($query->getKeyBy() === 'id') {
                $list[$entity->getId()] = $entity;
            } else {
                $list[] = $entity;
            }
        }
        $result['list'] = $list;

        return $result;
    }

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
    ): array {
        $query = $this->createConfigQuery()
            ->join('service_provider as provider', 'provider.id', '=', 'service_provider_configs.service_provider_id')
            ->whereNull('provider.deleted_at');

        $isOfficialOrganization = $dataIsolation->isOfficialOrganization();
        $currentOrganizationCode = $dataIsolation->getCurrentOrganizationCode();
        if (! $isOfficialOrganization) {
            $query
                ->where('service_provider_configs.organization_code', $currentOrganizationCode)
                ->where('provider.provider_type', '!=', ProviderType::Official->value);
        }

        match ($searchField) {
            ProviderConfigSearchField::ConfigId => $query->where('service_provider_configs.id', (int) $keyword),
            ProviderConfigSearchField::ProviderName => $query->where('provider.name', 'like', '%' . $keyword . '%'),
            ProviderConfigSearchField::ProviderAlias => $query->where('service_provider_configs.alias', 'like', '%' . $keyword . '%'),
        };

        $total = (clone $query)->count('service_provider_configs.id');
        $listQuery = clone $query;
        $listQuery
            ->select([
                'service_provider_configs.id as service_provider_config_id',
                'service_provider_configs.service_provider_id',
                'provider.name as provider_name',
                'service_provider_configs.alias as provider_alias',
            ])
            ->orderBy('service_provider_configs.sort', 'desc')
            ->orderBy('service_provider_configs.id', 'asc')
            ->forPage($page->getPage(), $page->getPageNum());

        $rows = Db::select($listQuery->toSql(), $listQuery->getBindings());

        return [
            'total' => $total,
            'list' => $rows,
        ];
    }

    public function getOfficialOrganizationConfigIds(): array
    {
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if ($officialOrganizationCode === '') {
            return [];
        }

        // 审计查询要覆盖历史上用过的官方配置，不能用选择器那套未删除过滤
        return ProviderConfigModel::query()
            ->where('organization_code', $officialOrganizationCode)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->filter(static fn (int $id): bool => $id > 0)
            ->values()
            ->toArray();
    }

    public function getProviderConfigIdentityMetadataByIds(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            return [];
        }

        // 统计 breakdown 按历史配置 ID 补名称，已软删配置仍要能展示
        $rows = ProviderConfigModel::query()
            ->join('service_provider as provider', 'provider.id', '=', 'service_provider_configs.service_provider_id')
            ->whereIn('service_provider_configs.id', $ids)
            ->select([
                'service_provider_configs.id as service_provider_config_id',
                'service_provider_configs.organization_code',
                'service_provider_configs.alias as provider_alias',
                'provider.name as provider_name',
            ])
            ->get()
            ->toArray();

        $result = [];
        foreach ($rows as $row) {
            $row = (array) $row;
            $configId = (int) ($row['service_provider_config_id'] ?? 0);
            if ($configId <= 0) {
                continue;
            }
            $result[$configId] = [
                'service_provider_config_id' => (string) $configId,
                'organization_code' => (string) ($row['organization_code'] ?? ''),
                'provider_name' => (string) ($row['provider_name'] ?? ''),
                'provider_alias' => (string) ($row['provider_alias'] ?? ''),
            ];
        }

        return $result;
    }

    public function save(ProviderDataIsolation $dataIsolation, ProviderConfigEntity $providerConfigEntity): ProviderConfigEntity
    {
        $attributes = $this->getFieldAttributes($providerConfigEntity);

        // 判断是创建还是更新的标志
        $isNewRecord = ! $providerConfigEntity->getId();

        if ($isNewRecord) {
            // 创建新记录 - 先生成ID
            $this->initializeEntityForCreation($providerConfigEntity, $attributes);
        } else {
            // 更新现有记录
            $now = new DateTime();
            $providerConfigEntity->setUpdatedAt($now);
            $attributes['updated_at'] = $now->format('Y-m-d H:i:s');

            // 更新操作时，移除不应该被更新的字段
            unset($attributes['id'], $attributes['created_at']);
        }

        // 对配置数据进行加密（如果存在且未加密）
        if (! empty($attributes['config'])) {
            $configId = (string) $providerConfigEntity->getId();

            // 如果 config 是字符串且是有效的 JSON 格式（未加密的配置数据），则需要加密
            if (is_string($attributes['config']) && json_validate($attributes['config'])) {
                $decodedConfig = Json::decode($attributes['config']);
                $attributes['config'] = ProviderConfigAssembler::encodeConfig($decodedConfig, $configId);
            }
        }

        if ($isNewRecord) {
            // 创建新记录
            ProviderConfigModel::query()->insert($attributes);
        } else {
            // 更新现有记录
            ProviderConfigModel::query()
                ->where('id', $providerConfigEntity->getId())
                ->update($attributes);
        }

        return $providerConfigEntity;
    }

    public function delete(ProviderDataIsolation $dataIsolation, string $id): void
    {
        $builder = $this->createConfigQuery()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        $builder->where('id', $id)->delete();
    }

    public function updateProviderCode(ProviderDataIsolation $dataIsolation, string $id, string $providerCode): void
    {
        $builder = $this->createConfigQuery()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        $builder->where('id', $id)->update(['provider_code' => $providerCode]);
    }

    public function findFirstByServiceProviderId(ProviderDataIsolation $dataIsolation, int $serviceProviderId): ?ProviderConfigEntity
    {
        $query = $this->createConfigQuery()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        $query->where('service_provider_id', $serviceProviderId)
            ->orderBy('id')
            ->limit(1);

        $result = Db::select($query->toSql(), $query->getBindings());

        if (empty($result)) {
            return null;
        }

        return ProviderConfigAssembler::toEntity($result[0]);
    }

    /**
     * @return ProviderConfigEntity[]
     */
    public function getsByServiceProviderIdsAndOffice(array $serviceProviderIds): array
    {
        if (empty($serviceProviderIds)) {
            return [];
        }
        $query = $this->createConfigQuery()
            ->whereIn('service_provider_id', $serviceProviderIds)
            ->where('organization_code', OfficialOrganizationUtil::getOfficialOrganizationCode());
        $result = Db::select($query->toSql(), $query->getBindings());
        return ProviderConfigAssembler::toEntities($result);
    }

    public function deleteById(string $id): void
    {
        ProviderConfigModel::query()->where('id', $id)->delete();
    }

    /**
     * 根据组织和服务商类型获取服务商配置列表.
     * 只返回组织已配置的服务商，不包含模板数据
     * 支持多个相同 provider_code 的配置（组织管理员手动添加的）
     * 最终结果处理时，官方组织会过滤掉Magic服务商，普通组织会将Magic服务商置顶.
     * @param string $organizationCode 组织编码
     * @param Category $category 服务商类型
     * @return ProviderConfigDTO[]
     */
    public function getOrganizationProviders(string $organizationCode, Category $category, ?Status $status = null): array
    {
        // 获取组织下已配置的服务商
        $organizationProviders = $this->getOrganizationProvidersFromDatabase($organizationCode, $category, $status);

        // 如果没有配置，直接返回空数组
        if (empty($organizationProviders)) {
            return [];
        }

        // 结果处理：排序和过滤
        $magicProviders = [];
        $otherProviders = [];

        foreach ($organizationProviders as $provider) {
            if (! $provider->getProviderCode()) {
                continue;
            }

            if ($provider->getProviderCode() === ProviderCode::Official) {
                $magicProviders[] = $provider;
            } else {
                $otherProviders[] = $provider;
            }
        }

        // 如果找到 Magic 服务商，将其放在第一位（非官方组织才会有 Magic 服务商）
        if ($magicProviders) {
            $result = array_merge($magicProviders, $otherProviders);
        } else {
            $result = $otherProviders;
        }

        return $result;
    }

    public function encryptionConfig(array $config, string $salt): string
    {
        return AesUtil::encode($this->_getAesKey($salt), Json::encode($config));
    }

    public function insert(ProviderConfigEntity $serviceProviderConfigEntity): ProviderConfigEntity
    {
        $attributes = $serviceProviderConfigEntity->toArray();
        $this->initializeEntityForCreation($serviceProviderConfigEntity, $attributes);

        $attributes['config'] = $this->encryptionConfig($attributes['config'], (string) $attributes['id']);
        $attributes['translate'] = Json::encode($serviceProviderConfigEntity->getTranslate());
        ProviderConfigModel::query()->create($attributes);
        return $serviceProviderConfigEntity;
    }

    /**
     * 通过配置ID和组织编码获取服务商配置实体.
     */
    public function getProviderConfigEntityById(string $serviceProviderConfigId, string $organizationCode): ?ProviderConfigEntity
    {
        $configQuery = $this->createConfigQuery()
            ->where('id', $serviceProviderConfigId)
            ->where('organization_code', $organizationCode);

        $configResult = Db::select($configQuery->toSql(), $configQuery->getBindings());

        if (empty($configResult)) {
            return null;
        }

        return ProviderConfigAssembler::toEntity($configResult[0]);
    }

    public function getByIdWithoutOrganizationFilter(int $id): ?ProviderConfigEntity
    {
        $builder = $this->createConfigQuery();
        $builder->where('id', $id);

        $result = Db::select($builder->toSql(), $builder->getBindings());

        if (empty($result)) {
            return null;
        }

        return ProviderConfigAssembler::toEntity($result[0]);
    }

    public function getByIdsWithoutOrganizationFilter(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $builder = $this->createConfigQuery();
        $ids = array_values(array_unique($ids));
        $builder->whereIn('id', $ids);
        $result = Db::select($builder->toSql(), $builder->getBindings());

        $entities = [];
        foreach ($result as $model) {
            $entities[$model['id']] = ProviderConfigAssembler::toEntity($model);
        }

        return $entities;
    }

    public function getAllByOrganization(ProviderDataIsolation $dataIsolation): array
    {
        $builder = $this->createConfigQuery()
            ->where('organization_code', $dataIsolation->getCurrentOrganizationCode())
            ->where('status', 1);

        $result = Db::select($builder->toSql(), $builder->getBindings());

        $entities = [];
        foreach ($result as $model) {
            $entities[] = ProviderConfigAssembler::toEntity($model);
        }

        return $entities;
    }

    /**
     * 获取启用状态的配置ID列表.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @return array<int> 启用的配置ID数组
     */
    public function getEnabledConfigIds(ProviderDataIsolation $dataIsolation): array
    {
        $enabledConfigQuery = $this->createConfigQuery()
            ->whereIn('organization_code', [$dataIsolation->getOrganizationCodes(), OfficialOrganizationUtil::getOfficialOrganizationCode()])
            ->where('status', Status::Enabled->value)
            ->select('id');

        $enabledConfigIds = Db::select($enabledConfigQuery->toSql(), $enabledConfigQuery->getBindings());

        return array_column($enabledConfigIds, 'id');
    }

    /**
     * 准备移除软删相关功能，临时这样写。创建带有软删除过滤的 ProviderConfigModel 查询构建器.
     * 必须带表名：本仓储会 join service_provider，两边都有 deleted_at。
     */
    protected function createConfigQuery(): Builder
    {
        /* @phpstan-ignore-next-line */
        return ProviderConfigModel::query()->whereNull('service_provider_configs.deleted_at');
    }

    /**
     * 创建带有软删除过滤的 ProviderModel 查询构建器.
     */
    private function createProviderQuery(): Builder
    {
        /* @phpstan-ignore-next-line */
        return ProviderModel::query()->whereNull('deleted_at');
    }

    /**
     * 从数据库获取组织下已配置的服务商.
     * @return ProviderConfigDTO[]
     */
    private function getOrganizationProvidersFromDatabase(string $organizationCode, Category $category, ?Status $status = null): array
    {
        // 根据分类获取服务商ID列表
        $serviceProviderIds = $this->getServiceProviderIdsByCategory($category);

        if (empty($serviceProviderIds)) {
            return [];
        }

        // 根据组织编码和服务商ID列表获取配置
        $providerConfigQuery = $this->createConfigQuery()
            ->where('organization_code', $organizationCode)
            ->whereIn('service_provider_id', $serviceProviderIds)
            ->orderBy('sort', 'DESC')
            ->orderBy('updated_at', 'DESC');

        if ($status) {
            $providerConfigQuery->where('status', $status->value);
        }

        $providerConfigsResult = Db::select($providerConfigQuery->toSql(), $providerConfigQuery->getBindings());

        // 批量查询对应的 provider 信息
        $providerMap = $this->getProviderMapByConfigs($providerConfigsResult);

        return ProviderConfigAssembler::toDTOListWithProviders($providerConfigsResult, $providerMap);
    }

    /**
     * 根据配置数据批量查询对应的 provider 信息.
     * @param array $configsResult 配置查询结果
     * @return array provider ID 到 provider 数组的映射
     */
    private function getProviderMapByConfigs(array $configsResult): array
    {
        if (empty($configsResult)) {
            return [];
        }

        // 提取所有的 service_provider_id
        $providerIds = [];
        foreach ($configsResult as $config) {
            $providerIds[] = $config['service_provider_id'];
        }
        $providerIds = array_unique($providerIds);

        if (empty($providerIds)) {
            return [];
        }

        // 批量查询 provider 信息
        $providerQuery = $this->createProviderQuery()
            ->whereIn('id', $providerIds);
        $providersResult = Db::select($providerQuery->toSql(), $providerQuery->getBindings());

        // 创建 provider ID 到 provider 数据的映射
        $providerMap = [];
        foreach ($providersResult as $provider) {
            $providerMap[$provider['id']] = $provider;
        }

        return $providerMap;
    }

    /**
     * 根据分类获取服务商ID列表.
     *
     * @param Category $category 服务商分类
     * @return array 服务商ID数组
     */
    private function getServiceProviderIdsByCategory(Category $category): array
    {
        return $this->createProviderQuery()
            ->where('category', $category->value)
            ->pluck('id')
            ->toArray();
    }

    /**
     * aes key加盐.
     */
    private function _getAesKey(string $salt): string
    {
        return config('service_provider.model_aes_key') . $salt;
    }
}
