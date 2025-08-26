<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Facade;

use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;

interface ProviderModelRepositoryInterface
{
    public function getById(ProviderDataIsolation $dataIsolation, string $id): ProviderModelEntity;

    /**
     * @return ProviderModelEntity[]
     */
    public function getByProviderConfigId(ProviderDataIsolation $dataIsolation, string $providerConfigId): array;

    public function deleteByProviderId(ProviderDataIsolation $dataIsolation, string $providerId): void;

    public function deleteById(ProviderDataIsolation $dataIsolation, string $id): void;

    public function saveModel(ProviderDataIsolation $dataIsolation, SaveProviderModelDTO $dto): ProviderModelEntity;

    public function updateStatus(ProviderDataIsolation $dataIsolation, string $id, Status $status): void;

    public function deleteByModelParentId(ProviderDataIsolation $dataIsolation, string $modelParentId): void;

    public function deleteByModelParentIds(ProviderDataIsolation $dataIsolation, array $modelParentIds): void;

    public function create(ProviderDataIsolation $dataIsolation, ProviderModelEntity $modelEntity): ProviderModelEntity;

    /**
     * 通过 service_provider_config_id 获取模型列表.
     * @return ProviderModelEntity[]
     */
    public function getProviderModelsByConfigId(ProviderDataIsolation $dataIsolation, string $configId, ProviderEntity $providerEntity): array;

    /**
     * 获取组织可用模型列表（包含组织自己的模型和Magic模型）.
     * @param ProviderDataIsolation $dataIsolation 数据隔离对象
     * @param null|Category $category 模型分类，为空时返回所有分类模型
     * @return ProviderModelEntity[] 按sort降序排序的模型列表，包含组织模型和Magic模型（不去重）
     */
    public function getAvailableModelsForOrganization(ProviderDataIsolation $dataIsolation, ?Category $category = null): array;

    public function getModelByIdWithoutOrgFilter(string $id): ?ProviderModelEntity;
}
