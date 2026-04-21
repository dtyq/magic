<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\Entity\ProviderModelConfigVersionEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\AggregateStrategy;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderModelType;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Provider\Assembler\ProviderModelAssembler;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;
use DateTime;

use function Hyperf\Translation\__;

readonly class ProviderModelDomainService
{
    public function __construct(
        private ProviderModelRepositoryInterface $providerModelRepository,
        private ProviderConfigRepositoryInterface $providerConfigRepository,
        private ProviderModelConfigVersionRepositoryInterface $providerModelConfigVersionRepository,
    ) {
    }

    public function getAvailableByModelIdOrId(ProviderDataIsolation $dataIsolation, string $modelId, bool $checkStatus = true): ?ProviderModelEntity
    {
        return $this->providerModelRepository->getAvailableByModelIdOrId($dataIsolation, $modelId, $checkStatus);
    }

    public function getById(ProviderDataIsolation $dataIsolation, string $id): ProviderModelEntity
    {
        return $this->providerModelRepository->getById($dataIsolation, $id);
    }

    public function getByModelId(ProviderDataIsolation $dataIsolation, string $modelId): ?ProviderModelEntity
    {
        return $this->providerModelRepository->getByModelId($dataIsolation, $modelId);
    }

    /**
     * @deprecated 该方法已经会获取失效了，获取模型请使用 getAvailableByModelIdOrId
     * 通过ID或ModelID查询模型
     * 基于可用模型列表进行匹配，同时匹配id和model_id字段
     */
    public function getByIdOrModelId(ProviderDataIsolation $dataIsolation, string $id): ?ProviderModelEntity
    {
        // 获取所有分类的可用模型
        $allModels = $this->providerModelRepository->getModelsForOrganization($dataIsolation);

        // 循环判断 id 等于 $id 或者 model_id 等于 $id
        foreach ($allModels as $model) {
            if ((string) $model->getId() === $id || $model->getModelId() === $id) {
                return $model;
            }
        }

        return null;
    }

    /**
     * @return ProviderModelEntity[]
     */
    public function getByProviderConfigId(ProviderDataIsolation $dataIsolation, string $providerConfigId): array
    {
        return $this->providerModelRepository->getByProviderConfigId($dataIsolation, $providerConfigId);
    }

    public function deleteByProviderId(ProviderDataIsolation $dataIsolation, string $providerId): void
    {
        $this->providerModelRepository->deleteByProviderId($dataIsolation, $providerId);
    }

    public function deleteById(ProviderDataIsolation $dataIsolation, string $id): void
    {
        $this->providerModelRepository->deleteById($dataIsolation, $id);
    }

    public function saveModel(ProviderDataIsolation $dataIsolation, SaveProviderModelDTO $providerModelDTO): SaveProviderModelDTO
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $providerModelDTO->setOrganizationCode($organizationCode);
        if ($providerModelDTO->getModelType() === ModelType::EMBEDDING) {
            $providerModelDTO->getConfig()?->setSupportEmbedding(true);
        }

        if ($providerModelDTO->getId()) {
            // 更新模型：验证模型是否存在（getById会在不存在时抛出异常）
            $oldModelEntity = $this->providerModelRepository->getById($dataIsolation, $providerModelDTO->getId());

            $this->prepareForModification($providerModelDTO, $oldModelEntity);
        } else {
            // 创建模型时默认启用
            $providerModelDTO->setStatus(Status::Enabled);

            if (! $providerModelDTO->getConfig()) {
                $modelConfigItem = new ModelConfigItem();
                $modelConfigItem->setSupportFunction(true);
                $modelConfigItem->setSupportMultiModal(true);
                $providerModelDTO->setConfig($modelConfigItem);
            }
        }
        // 验证 service_provider_config_id 是否存在
        if ($providerModelDTO->getServiceProviderConfigId()) {
            $providerConfigEntity = $this->providerConfigRepository->getById($dataIsolation, (int) $providerModelDTO->getServiceProviderConfigId());
            if ($providerConfigEntity === null) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
            }
        }

        // 如果仍然没有category，则默认使用LLM
        if ($providerModelDTO->getCategory() === null) {
            $providerModelDTO->setCategory(Category::LLM);
        }

        $modelEntity = $this->providerModelRepository->saveModel($dataIsolation, $providerModelDTO);

        // 创建配置版本记录
        $this->saveConfigVersion($dataIsolation, $modelEntity);

        return new SaveProviderModelDTO($modelEntity->toArray());
    }

    public function updateStatus(ProviderDataIsolation $dataIsolation, string $id, Status $status): void
    {
        $this->providerModelRepository->updateStatus($dataIsolation, $id, $status);
    }

    public function deleteByModelParentId(ProviderDataIsolation $dataIsolation, string $modelParentId): void
    {
        $this->providerModelRepository->deleteByModelParentId($dataIsolation, $modelParentId);
    }

    public function deleteByModelParentIds(ProviderDataIsolation $dataIsolation, array $modelParentIds): void
    {
        $this->providerModelRepository->deleteByModelParentIds($dataIsolation, $modelParentIds);
    }

    /**
     * 批量根据ID获取模型.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param string[] $ids 模型ID数组
     * @return ProviderModelEntity[] 模型实体数组，以ID为键
     */
    public function getModelsByIds(ProviderDataIsolation $dataIsolation, array $ids): array
    {
        return $this->providerModelRepository->getByIds($dataIsolation, $ids);
    }

    public function getModelById(string $id): ?ProviderModelEntity
    {
        return $this->providerModelRepository->getModelByIdWithoutOrgFilter($id);
    }

    /**
     * 根据 model_id 列查询模型（不限制组织）.
     * 入参为 service_provider_models.model_id，如 deepseek-v3.
     */
    public function getModelByModelId(string $modelId): ?ProviderModelEntity
    {
        return $this->providerModelRepository->getByModelIdWithoutOrgFilter($modelId);
    }

    /**
     * 批量根据ModelID获取模型.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param string[] $modelIds 模型标识数组
     * @return array<string, ProviderModelEntity[]> 模型实体数组，以model_id为键，值为对应的模型列表
     */
    public function getModelsByModelIds(ProviderDataIsolation $dataIsolation, array $modelIds): array
    {
        return $this->providerModelRepository->getByModelIds($dataIsolation, $modelIds);
    }

    /**
     * @return array{total: int, list: ProviderModelEntity[]}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderModelQuery $query, Page $page): array
    {
        return $this->providerModelRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * 根据查询条件获取按模型类型分组的模型ID列表.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param ProviderModelQuery $query 查询条件
     * @return array<string, array<string>> 按模型类型分组的模型ID数组，格式: [modelType => [model_id, model_id]]
     */
    public function getModelIdsGroupByType(ProviderDataIsolation $dataIsolation, ProviderModelQuery $query): array
    {
        return $this->providerModelRepository->getModelIdsGroupByType($dataIsolation, $query);
    }

    /**
     * 仅查询 type=DYNAMIC 的启用模型的 model_id 列表，不 SELECT 全字段.
     *
     * @param ModelType[] $modelTypes 模型类型过滤，空数组表示不限制
     * @return string[]
     */
    public function getDynamicModelIds(ProviderDataIsolation $dataIsolation, array $modelTypes = []): array
    {
        return $this->providerModelRepository->getDynamicModelIds($dataIsolation, $modelTypes);
    }

    /**
     * 获取指定模型的最新配置版本ID.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param int $serviceProviderModelId 模型ID
     * @return null|int 最新版本的ID，如果不存在则返回null
     */
    public function getLatestConfigVersionId(ProviderDataIsolation $dataIsolation, int $serviceProviderModelId): ?int
    {
        return $this->providerModelConfigVersionRepository->getLatestVersionId($dataIsolation, $serviceProviderModelId);
    }

    /**
     * 获取指定模型的最新配置版本实体.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param int $serviceProviderModelId 模型ID
     * @return null|ProviderModelConfigVersionEntity 最新版本的实体，如果不存在则返回null
     */
    public function getLatestConfigVersionEntity(ProviderDataIsolation $dataIsolation, int $serviceProviderModelId): ?ProviderModelConfigVersionEntity
    {
        return $this->providerModelConfigVersionRepository->getLatestVersionEntity($dataIsolation, $serviceProviderModelId);
    }

    /**
     * 根据数据隔离、分类和模型类型获取启用的模型.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param null|Category $category 模型分类
     * @param array $modelTypes 模型类型数组
     * @return ProviderModelEntity[] 模型实体数组
     */
    public function getEnableModels(ProviderDataIsolation $dataIsolation, ?Category $category = null, array $modelTypes = []): array
    {
        // 1. 先查询有效的配置ID
        $configIds = $this->providerConfigRepository->getEnabledConfigIds($dataIsolation);

        if (empty($configIds)) {
            return [];
        }

        // 2. 根据配置ID、category和modelTypes查询模型
        return $this->providerModelRepository->getEnableModelsByConfigIds($dataIsolation, $configIds, $category, $modelTypes);
    }

    /**
     * 获取组织可用模型列表（包含组织自己的模型和Magic模型）.
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param null|Category $category 模型分类，为空时返回所有分类模型
     * @return ProviderModelEntity[] 按sort降序排序的模型列表，包含组织模型和Magic模型（不去重）
     */
    public function getModelsForOrganization(ProviderDataIsolation $dataIsolation, ?Category $category = null, bool $isOffModelLoaded = true): array
    {
        return $this->providerModelRepository->getModelsForOrganization($dataIsolation, $category, isOffModelLoaded: $isOffModelLoaded);
    }

    /**
     * 同步动态模型（创建或更新）.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param string $modelId 模型ID（更新时使用，为空或0表示创建）
     * @param string $name 模型名称
     * @param array $subModels 子模型ID列表
     * @param AggregateStrategy $strategy 策略类型
     * @param array $strategyConfig 策略配置
     * @param string $icon 图标
     * @param string $description 描述
     * @param array $translate 多语言翻译
     * @return ProviderModelEntity 动态模型实体
     */
    public function syncAggregateModel(
        ProviderDataIsolation $dataIsolation,
        string $modelId,
        string $name,
        array $subModels,
        AggregateStrategy $strategy = AggregateStrategy::PERMISSION_FALLBACK,
        array $strategyConfig = ['order' => 'asc'],
        string $icon = '',
        string $description = '',
        array $translate = [],
        string $category = ''
    ): ProviderModelEntity {
        // 构造 aggregate_config JSON
        $aggregateConfig = [
            'models' => $subModels,
            'strategy' => $strategy->value,
            'strategy_config' => $strategyConfig,
        ];

        // 如果是更新操作，处理更新逻辑并提前返回
        if (! empty($modelId)) {
            $existingModel = $this->providerModelRepository->getByModelId($dataIsolation, $modelId);
            if ($existingModel !== null) {
                return $this->updateExistingAggregateModel(
                    $dataIsolation,
                    $existingModel,
                    $name,
                    $category,
                    $aggregateConfig,
                    $icon,
                    $description,
                    $translate
                );
            }
        }

        // 创建新动态模型
        $newModel = new ProviderModelEntity();
        $newModel->setId(IdGenerator::getSnowId());
        $newModel->setModelId($modelId ?: IdGenerator::getUniqueId32());
        $newModel->setName($name);
        $newModel->setType(ProviderModelType::DYNAMIC);
        $newModel->setServiceProviderConfigId(0); // 动态模型不依附具体服务商
        $categoryEnum = $category ? Category::tryFrom($category) : Category::LLM;
        $categoryEnum ??= Category::LLM;
        $newModel->setCategory($categoryEnum);
        $newModel->setModelType($this->resolveAggregateModelType($categoryEnum));
        $newModel->setAggregateConfig($aggregateConfig);
        $newModel->setConfig(new ModelConfigItem());
        $newModel->setIcon(FileAssembler::formatPath($icon));
        $newModel->setDescription($description);
        $newModel->setTranslate($translate);
        $newModel->setStatus(Status::Enabled);
        $newModel->setModelVersion('v1.0');
        $newModel->setSort(0);
        $newModel->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $newModel->setCreatedAt(new DateTime());
        $newModel->setUpdatedAt(new DateTime());

        return $this->providerModelRepository->create($dataIsolation, $newModel);
    }

    /**
     * 更新现有的聚合模型.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param ProviderModelEntity $existingModel 现有模型实体
     * @param string $name 模型名称
     * @param string $category 分类
     * @param array $aggregateConfig 聚合配置
     * @param string $icon 图标
     * @param string $description 描述
     * @param array $translate 多语言翻译
     * @return ProviderModelEntity 更新后的模型实体
     */
    private function updateExistingAggregateModel(
        ProviderDataIsolation $dataIsolation,
        ProviderModelEntity $existingModel,
        string $name,
        string $category,
        array $aggregateConfig,
        string $icon,
        string $description,
        array $translate
    ): ProviderModelEntity {
        // 如果模型存在但不是动态模型，则报错
        if (! $existingModel->isDynamicModel()) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidModelType, __('service_provider.invalid_model_type'));
        }

        // 更新模型属性
        $existingModel->setName($name);
        $existingModel->setAggregateConfig($aggregateConfig);
        $existingModel->setIcon(FileAssembler::formatPath($icon));
        $existingModel->setDescription($description);
        $existingModel->setTranslate($translate);
        $existingModel->setUpdatedAt(new DateTime());

        // 更新分类（如果提供了分类）
        if ($category !== '') {
            $categoryEnum = Category::tryFrom($category);
            if ($categoryEnum !== null) {
                $existingModel->setCategory($categoryEnum);
                $existingModel->setModelType($this->resolveAggregateModelType($categoryEnum));
            }
        }

        // 通过 Repository 的 saveModel 方法更新（需要转换为 DTO）
        $dto = new SaveProviderModelDTO($existingModel->toArray());
        return $this->providerModelRepository->saveModel($dataIsolation, $dto);
    }

    private function resolveAggregateModelType(Category $category): ModelType
    {
        return match ($category) {
            Category::VLM => ModelType::IMAGE_TO_IMAGE,
            Category::VGM => ModelType::TEXT_TO_VIDEO,
            Category::EMBEDDING => ModelType::EMBEDDING,
            default => ModelType::LLM,
        };
    }

    /**
     * 保存模型配置版本.
     */
    private function saveConfigVersion(ProviderDataIsolation $dataIsolation, ProviderModelEntity $modelEntity): void
    {
        // 如果配置为空，不创建版本记录
        if ($modelEntity->getConfig() === null) {
            return;
        }

        // 转换为配置版本实体并保存（事务、版本号递增、标记当前版本都在 Repository 内完成）
        $versionEntity = ProviderModelAssembler::toConfigVersionEntity($modelEntity);
        $this->providerModelConfigVersionRepository->saveVersionWithTransaction($dataIsolation, $versionEntity);
    }

    private function prepareForModification(SaveProviderModelDTO $providerModelDTO, ProviderModelEntity $oldModelEntity): void
    {
        empty($providerModelDTO->getModelId()) && $providerModelDTO->setModelId($oldModelEntity->getModelId());
        empty($providerModelDTO->getConfig()) && $providerModelDTO->setConfig($oldModelEntity->getConfig());
        empty($providerModelDTO->getCategory()) && $providerModelDTO->setCategory($oldModelEntity->getCategory());
        empty($providerModelDTO->getIcon()) && $providerModelDTO->setIcon($oldModelEntity->getIcon());
        empty($providerModelDTO->getDescription()) && $providerModelDTO->setDescription($oldModelEntity->getDescription());
        empty($providerModelDTO->getModelType()) && $providerModelDTO->setModelType($oldModelEntity->getModelType());
    }
}
