<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\Query\ModelConfigQuery;
use App\Domain\ModelGateway\Repository\Facade\ModelConfigRepositoryInterface;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

class ModelConfigDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly ModelConfigRepositoryInterface $magicApiModelConfigRepository,
    ) {
    }

    public function save(LLMDataIsolation $dataIsolation, ModelConfigEntity $modelConfigEntity): ModelConfigEntity
    {
        $modelConfigEntity->prepareForSaving();
        return $this->magicApiModelConfigRepository->save($dataIsolation, $modelConfigEntity);
    }

    public function show(LLMDataIsolation $dataIsolation, string $model): ModelConfigEntity
    {
        $modelConfig = $this->magicApiModelConfigRepository->getByModel($dataIsolation, $model);
        if (! $modelConfig) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.not_found', ['label' => $model]);
        }
        return $modelConfig;
    }

    /**
     * @return array{total: int, list: ModelConfigEntity[]}
     */
    public function queries(LLMDataIsolation $dataIsolation, Page $page, ModelConfigQuery $modelConfigQuery): array
    {
        return $this->magicApiModelConfigRepository->queries($dataIsolation, $page, $modelConfigQuery);
    }

    public function getByModel(string $model): ?ModelConfigEntity
    {
        $dataIsolation = LLMDataIsolation::create();
        return $this->magicApiModelConfigRepository->getByModel($dataIsolation, $model);
    }

    /**
     * @return array<ModelConfigEntity>
     */
    public function getByModels(array $models): array
    {
        $dataIsolation = LLMDataIsolation::create();
        return $this->magicApiModelConfigRepository->getByModels($dataIsolation, $models);
    }

    /**
     * 根据ID获取模型配置.
     */
    public function getById(string $id): ?ModelConfigEntity
    {
        $dataIsolation = LLMDataIsolation::create();
        return $this->magicApiModelConfigRepository->getById($dataIsolation, $id);
    }

    /**
     * 根据ID获取模型配置, 不存在则抛出异常.
     */
    public function showById(string $id): ModelConfigEntity
    {
        $dataIsolation = LLMDataIsolation::create();
        $modelConfig = $this->magicApiModelConfigRepository->getById($dataIsolation, $id);
        if (! $modelConfig) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.not_found', ['label' => "ID: {$id}"]);
        }
        return $modelConfig;
    }

    /**
     * 根据endpoint或type获取模型配置.
     */
    public function getByEndpointOrType(string $endpointOrType): ?ModelConfigEntity
    {
        $dataIsolation = LLMDataIsolation::create();
        return $this->magicApiModelConfigRepository->getByEndpointOrType($dataIsolation, $endpointOrType);
    }

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, ModelConfigEntity $modelConfig, float $amount): void
    {
        $this->magicApiModelConfigRepository->incrementUseAmount($dataIsolation, $modelConfig, $amount);
    }
}
