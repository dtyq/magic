<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\Entity\ProviderModelConfigVersionEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Provider\Assembler\ProviderModelAssembler;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;

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
     * 通过ID或ModelID查询模型
     * 基于可用模型列表进行匹配，同时匹配id和model_id字段.
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
            $this->providerModelRepository->getById($dataIsolation, $providerModelDTO->getId());
        } else {
            // 创建模型时默认启用
            $providerModelDTO->setStatus(Status::Enabled);
        }
        // 验证 service_provider_config_id 是否存在
        if ($providerModelDTO->getServiceProviderConfigId()) {
            $providerConfigEntity = $this->providerConfigRepository->getById($dataIsolation, (int) $providerModelDTO->getServiceProviderConfigId());
            if ($providerConfigEntity === null) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
            }
        }

        // 目前保存模型的接口只有大模型使用，因此强制类型是 llm
        $providerModelDTO->setCategory(Category::LLM);
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
}
