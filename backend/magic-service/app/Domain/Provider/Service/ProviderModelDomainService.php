<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;

readonly class ProviderModelDomainService
{
    public function __construct(
        private ProviderModelRepositoryInterface $providerModelRepository,
        private ProviderConfigRepositoryInterface $providerConfigRepository,
    ) {
    }

    public function getById(ProviderDataIsolation $dataIsolation, string $id): ProviderModelEntity
    {
        return $this->providerModelRepository->getById($dataIsolation, $id);
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
}
