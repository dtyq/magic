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
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
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
        private readonly ProviderTemplateRepository $providerTemplateRepository,
        protected ProviderConfigModel $configModel,
        protected ProviderModelModel $serviceProviderModelsModel,
        protected ProviderModel $serviceProviderModel
    ) {
        parent::__construct($configModel, $serviceProviderModelsModel, $serviceProviderModel);
    }

    public function getById(ProviderDataIsolation $dataIsolation, int $id): ?ProviderConfigEntity
    {
        $builder = $this->createConfigQuery()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());

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
        $builder = $this->createConfigQuery()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
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
        $builder = $this->createConfigQuery()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());

        if ($query->getStatus()) {
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
            $modelArray = $model->toArray();
            $list[] = ProviderConfigAssembler::toEntity($modelArray);
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
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
     * 新逻辑：以数据库中的实际配置为准，对于数据库中没有的服务商类型，使用模板补充
     * 支持多个相同 provider_code 的配置（组织管理员手动添加的）
     * 最终结果处理时，官方组织会过滤掉Magic服务商，普通组织会将Magic服务商置顶.
     * @param string $organizationCode 组织编码
     * @param Category $category 服务商类型
     * @return ProviderConfigDTO[]
     */
    public function getOrganizationProviders(string $organizationCode, Category $category, ?Status $status = null): array
    {
        // 1. 获取全量的服务商模板列表
        $templateProviders = $this->providerTemplateRepository->getAllProviderTemplates($category);

        // 2. 获取组织下已配置的服务商
        $organizationProviders = $this->getOrganizationProvidersFromDatabase($organizationCode, $category, $status);

        // 3. 首先添加数据库中的所有实际配置（保留多个相同 provider_code 的配置）
        $result = $organizationProviders;

        // 4. 检查哪些服务商类型在数据库中没有配置，为这些添加模板
        $existingProviderCodes = [];
        foreach ($organizationProviders as $config) {
            if ($config->getProviderCode()) {
                $existingProviderCodes[] = $config->getProviderCode();
            }
        }

        // 为数据库中不存在的服务商类型添加模板配置
        foreach ($templateProviders as $template) {
            if (! $template->getProviderCode() || ! in_array($template->getProviderCode(), $existingProviderCodes, true)) {
                $result[] = $template;
            }
        }
        // 5. 最终结果处理：排序和过滤
        $isOfficialOrganization = OfficialOrganizationUtil::isOfficialOrganization($organizationCode);
        $magicProvider = null;
        $otherProviders = [];

        foreach ($result as $provider) {
            if (! $provider->getProviderCode()) {
                continue;
            }

            // 如果是官方组织，过滤掉 Magic 服务商（Official），因为 magic 服务商就是官方组织配置的模型总和
            if ($isOfficialOrganization && $provider->getProviderCode() === ProviderCode::Official) {
                continue;
            }

            if ($provider->getProviderCode() === ProviderCode::Official) {
                $magicProvider = $provider;
            } else {
                $otherProviders[] = $provider;
            }
        }

        // 对其他服务商按 sort 字段排序（数字越大越靠前）
        usort($otherProviders, function ($a, $b) {
            if ($a->getSort() === $b->getSort()) {
                return strcmp($a->getId(), $b->getId()); // 相同 sort 值时按 ID 排序
            }
            return $b->getSort() <=> $a->getSort(); // 降序排列，数字大的在前
        });

        // 如果找到 Magic 服务商，将其放在第一位（非官方组织才会有 Magic 服务商）
        if ($magicProvider !== null) {
            $result = array_merge([$magicProvider], $otherProviders);
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

    /**
     * 准备移除软删相关功能，临时这样写。创建带有软删除过滤的 ProviderConfigModel 查询构建器.
     */
    protected function createConfigQuery(): Builder
    {
        /* @phpstan-ignore-next-line */
        return ProviderConfigModel::query()->whereNull('deleted_at');
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
            ->orderBy('id', 'ASC');

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
