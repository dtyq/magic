<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Facade;

use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\Query\ModelConfigQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface ModelConfigRepositoryInterface
{
    public function save(LLMDataIsolation $dataIsolation, ModelConfigEntity $modelConfigEntity): ModelConfigEntity;

    public function getByModel(LLMDataIsolation $dataIsolation, string $model): ?ModelConfigEntity;

    /**
     * 根据ID获取模型配置.
     */
    public function getById(LLMDataIsolation $dataIsolation, string $id): ?ModelConfigEntity;

    /**
     * 根据endpoint或type获取模型配置.
     */
    public function getByEndpointOrType(LLMDataIsolation $dataIsolation, string $endpointOrType): ?ModelConfigEntity;

    /**
     * @return array{total: int, list: ModelConfigEntity[]}
     */
    public function queries(LLMDataIsolation $dataIsolation, Page $page, ModelConfigQuery $modelConfigQuery): array;

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, ModelConfigEntity $modelConfigEntity, float $amount): void;

    /**
     * @return ModelConfigEntity[]
     */
    public function getByModels(LLMDataIsolation $dataIsolation, array $models): array;
}
