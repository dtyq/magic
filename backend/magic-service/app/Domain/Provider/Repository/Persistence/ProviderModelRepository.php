<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\MagicProviderAndModelsInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Provider\Assembler\ProviderModelAssembler;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;
use Hyperf\Codec\Json;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;

class ProviderModelRepository extends AbstractProviderModelRepository implements ProviderModelRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function __construct(
        private readonly MagicProviderAndModelsInterface $magicProviderAndModels,
    ) {
    }

    public function getById(ProviderDataIsolation $dataIsolation, string $id): ProviderModelEntity
    {
        $builder = $this->createProviderModelQuery()
            ->where('organization_code', $dataIsolation->getCurrentOrganizationCode())
            ->where('id', $id);

        $result = Db::select($builder->toSql(), $builder->getBindings());
        if (empty($result)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }
        return ProviderModelAssembler::toEntity($result[0]);
    }

    /**
     * @return ProviderModelEntity[]
     */
    public function getByProviderConfigId(ProviderDataIsolation $dataIsolation, string $providerConfigId): array
    {
        $builder = $this->createProviderModelQuery()
            ->where('organization_code', $dataIsolation->getCurrentOrganizationCode())
            ->where('service_provider_config_id', $providerConfigId);

        $result = Db::select($builder->toSql(), $builder->getBindings());

        return ProviderModelAssembler::toEntities($result);
    }

    public function deleteByProviderId(ProviderDataIsolation $dataIsolation, string $providerId): void
    {
        $builder = ProviderModelModel::query()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        $builder->where('service_provider_config_id', $providerId)->delete();
    }

    public function deleteById(ProviderDataIsolation $dataIsolation, string $id): void
    {
        $builder = ProviderModelModel::query()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        $builder->where('id', $id)->delete();
    }

    public function saveModel(ProviderDataIsolation $dataIsolation, SaveProviderModelDTO $dto): ProviderModelEntity
    {
        // 设置组织编码（优先使用DTO中的组织编码，否则使用当前数据隔离中的）
        $dto->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

        $data = $dto->toArray();
        $entity = new ProviderModelEntity($data);

        if ($dto->getId()) {
            // 准备更新数据，只包含有变化的字段
            $updateData = $this->serializeEntityToArray($entity);
            $updateData['updated_at'] = date('Y-m-d H:i:s');
            $success = ProviderModelModel::query()
                ->where('organization_code', $dataIsolation->getCurrentOrganizationCode())
                ->where('id', $dto->getId())
                ->update($updateData);
            if ($success === 0) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
            }
            // 先查询数据库现有的实体
            return $this->getById($dataIsolation, $dto->getId());
        }
        return $this->create($dataIsolation, $entity);
    }

    /**
     * 更新模型状态（支持写时复制逻辑）.
     */
    public function updateStatus(ProviderDataIsolation $dataIsolation, string $id, Status $status): void
    {
        // 1. 按 id 查询模型是否存在（不限制组织）
        $model = $this->getModelByIdWithoutOrgFilter($id);
        if (! $model) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }

        $currentOrganizationCode = $dataIsolation->getCurrentOrganizationCode();
        $modelOrganizationCode = $model->getOrganizationCode();

        // 2. 判断模型的所属组织是否与当前组织一致
        if ($modelOrganizationCode !== $currentOrganizationCode) {
            // 组织不一致：判断模型所属组织是否是官方组织
            if ($this->isOfficialOrganization($modelOrganizationCode)
                && ! $this->isOfficialOrganization($currentOrganizationCode)) {
                // 模型属于官方组织且当前组织不是官方组织：走写时复制逻辑
                $organizationModelId = $this->magicProviderAndModels->updateMagicModelStatus($dataIsolation, $model);
            } else {
                // 其他情况：无权限操作
                ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
            }
        } else {
            $organizationModelId = $id;
        }
        // 3. 更新组织模型状态
        $this->updateStatusDirect($dataIsolation, $organizationModelId, $status);
    }

    public function deleteByModelParentId(ProviderDataIsolation $dataIsolation, string $modelParentId): void
    {
        $builder = ProviderModelModel::query()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        $builder->where('model_parent_id', $modelParentId)->delete();
    }

    public function deleteByModelParentIds(ProviderDataIsolation $dataIsolation, array $modelParentIds): void
    {
        $modelParentIds = array_values(array_unique($modelParentIds));
        if (empty($modelParentIds)) {
            return;
        }
        $builder = ProviderModelModel::query()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        $builder->whereIn('model_parent_id', $modelParentIds)->delete();
    }

    /**
     * 通过 service_provider_config_id 获取模型列表.
     * @param string $configId 可能是模板 id，比如 ProviderConfigIdAssembler
     * @return ProviderModelEntity[]
     */
    public function getProviderModelsByConfigId(ProviderDataIsolation $dataIsolation, string $configId, ProviderEntity $providerEntity): array
    {
        // 如果是官方服务商，需要进行数据合并和状态判断
        if ($providerEntity->getProviderCode() === ProviderCode::Official && ! OfficialOrganizationUtil::isOfficialOrganization($dataIsolation->getCurrentOrganizationCode())) {
            return $this->magicProviderAndModels->getMagicEnableModels($dataIsolation->getCurrentOrganizationCode(), $providerEntity->getCategory());
        }

        // 非官方服务商，按原逻辑查询指定配置下的模型
        if (! is_numeric($configId)) {
            return [];
        }
        $modelsBuilder = $this->createProviderModelQuery()
            ->where('organization_code', $dataIsolation->getCurrentOrganizationCode())
            ->where('service_provider_config_id', $configId);

        $result = Db::select($modelsBuilder->toSql(), $modelsBuilder->getBindings());
        return ProviderModelAssembler::toEntities($result);
    }

    /**
     * 获取组织可用模型列表（包含组织自己的模型和Magic模型）.
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param null|Category $category 模型分类，为空时返回所有分类模型
     * @return ProviderModelEntity[] 按sort降序排序的模型列表，包含组织模型和Magic模型（不去重）
     */
    public function getModelsForOrganization(ProviderDataIsolation $dataIsolation, ?Category $category = null, ?Status $status = Status::Enabled): array
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 生成缓存键
        $cacheKey = sprintf('provider_models:available:%s:%s', $organizationCode, $category->value ?? 'all');

        // 尝试从缓存获取
        $redis = di(Redis::class);
        $cachedData = $redis->get($cacheKey);

        if ($cachedData !== false) {
            // 从缓存恢复实体对象
            $modelsArray = Json::decode($cachedData);
            $allModels = [];
            foreach ($modelsArray as $modelData) {
                $allModels[] = new ProviderModelEntity($modelData);
            }
            return $allModels;
        }

        // 缓存未命中，执行原逻辑
        // 1. 先查询组织下启用的服务商配置ID
        $builder = ProviderConfigModel::query();

        if ($status !== null) {
            $builder->where('status', $status->value);
        }

        $enabledConfigQuery = $builder
            ->where('organization_code', $organizationCode)
            ->whereNull('deleted_at')
            ->select('id');
        $enabledConfigIds = Db::select($enabledConfigQuery->toSql(), $enabledConfigQuery->getBindings());
        $enabledConfigIdArray = array_column($enabledConfigIds, 'id');

        // 2. 使用启用的配置ID查询组织自己的启用模型
        $organizationModels = [];
        if (! empty($enabledConfigIdArray)) {
            $organizationModelsBuilder = $this->createProviderModelQuery()
                ->where('organization_code', $organizationCode)
                ->whereIn('service_provider_config_id', $enabledConfigIdArray);
            if (! OfficialOrganizationUtil::isOfficialOrganization($organizationCode)) {
                // 查询普通组织自己的模型。 官方组织的模型现在 model_parent_id 等于它自己，需要洗数据。
                $organizationModelsBuilder->where('model_parent_id', 0);
            }
            // 如果指定了分类，添加分类过滤条件
            if ($category !== null) {
                $organizationModelsBuilder->where('category', $category->value);
            }

            if ($status !== null) {
                $builder->where('status', $status->value);
            }

            $organizationModelsResult = Db::select($organizationModelsBuilder->toSql(), $organizationModelsBuilder->getBindings());
            $organizationModels = ProviderModelAssembler::toEntities($organizationModelsResult);
        }

        // 3. 获取Magic模型（如果不是官方组织）
        $magicModels = [];
        if (! OfficialOrganizationUtil::isOfficialOrganization($organizationCode)) {
            $magicModels = $this->magicProviderAndModels->getMagicEnableModels($organizationCode, $category);
        }

        // 4. 直接合并模型列表，不去重
        $allModels = array_merge($organizationModels, $magicModels);

        // 5. 按sort降序排序
        usort($allModels, static function ($a, $b) {
            return $b->getSort() <=> $a->getSort();
        });
        // 6. 过滤状态
        if ($status !== null) {
            $allModels = array_filter($allModels, static function (ProviderModelEntity $model) use ($status) {
                return $model->getStatus() === $status;
            });
        }
        // 7. 转为数组并缓存结果，缓存10秒
        $modelsArray = [];
        foreach ($allModels as $model) {
            $modelsArray[] = $model->toArray();
        }
        $redis->setex($cacheKey, 10, Json::encode($modelsArray));

        return $allModels;
    }

    public function getByIds(ProviderDataIsolation $dataIsolation, array $ids): array
    {
        if (empty($ids)) {
            return [];
        }
        $builder = $this->createBuilder($dataIsolation, ProviderModelModel::query())
            ->whereIn('id', $ids);

        $result = Db::select($builder->toSql(), $builder->getBindings());

        $entities = ProviderModelAssembler::toEntities($result);

        // 转换为以ID为键的数组
        $modelsById = [];
        foreach ($entities as $entity) {
            $modelsById[(string) $entity->getId()] = $entity;
        }

        return $modelsById;
    }

    public function getByModelIds(ProviderDataIsolation $dataIsolation, array $modelIds): array
    {
        if (empty($modelIds)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, ProviderModelModel::query())
            ->whereIn('model_id', $modelIds)
            ->orderBy('status', 'desc') // 优先排序：启用状态在前
            ->orderBy('id'); // 其次按ID排序，保证结果一致性

        $result = Db::select($builder->toSql(), $builder->getBindings());
        $entities = ProviderModelAssembler::toEntities($result);

        // 转换为以model_id为键的数组，保留所有模型
        $modelsByModelId = [];
        foreach ($entities as $entity) {
            $modelId = $entity->getModelId();
            if (! isset($modelsByModelId[$modelId])) {
                $modelsByModelId[$modelId] = [];
            }
            $modelsByModelId[$modelId][] = $entity;
        }

        return $modelsByModelId;
    }

    /**
     * 根据ID查询模型（不限制组织）.
     */
    public function getModelByIdWithoutOrgFilter(string $id): ?ProviderModelEntity
    {
        $query = $this->createProviderModelQuery()
            ->where('id', $id);
        $result = Db::select($query->toSql(), $query->getBindings());

        if (empty($result)) {
            return null;
        }

        return ProviderModelAssembler::toEntity($result[0]);
    }

    /**
     * 直接更新模型状态.
     */
    private function updateStatusDirect(ProviderDataIsolation $dataIsolation, string $id, Status $status): void
    {
        $builder = ProviderModelModel::query()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        $builder->where('id', $id)->update(['status' => $status->value]);
    }

    /**
     * 准备移除软删相关功能，临时这样写。创建带有软删除过滤的 ProviderModelModel 查询构建器.
     */
    private function createProviderModelQuery(): Builder
    {
        /* @phpstan-ignore-next-line */
        return ProviderModelModel::query()->whereNull('deleted_at');
    }

    /**
     * 是否是官方组织.
     */
    private function isOfficialOrganization(string $organizationCode): bool
    {
        return OfficialOrganizationUtil::isOfficialOrganization($organizationCode);
    }
}
