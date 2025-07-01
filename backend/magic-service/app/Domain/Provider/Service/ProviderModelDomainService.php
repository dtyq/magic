<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

readonly class ProviderModelDomainService
{
    public function __construct(
        private ProviderModelRepositoryInterface $providerModelRepository
    ) {
    }

    public function getById(ProviderDataIsolation $dataIsolation, int $id, bool $checkModelEnabled = true): ?ProviderModelEntity
    {
        return $this->providerModelRepository->getById($dataIsolation, $id, $checkModelEnabled);
    }

    /**
     * @param array<int> $ids
     * @return array<ProviderModelEntity>
     */
    public function getByIds(ProviderDataIsolation $dataIsolation, array $ids): array
    {
        return $this->providerModelRepository->getByIds($dataIsolation, $ids);
    }

    /**
     * 通过ID或ModelID查询模型
     * 基于数据库的 where or 条件查询，同时匹配id和model_id字段.
     */
    public function getByIdOrModelId(ProviderDataIsolation $dataIsolation, string $id, bool $checkModelEnabled = true): ?ProviderModelEntity
    {
        return $this->providerModelRepository->getByIdOrModelId($dataIsolation, $id, $checkModelEnabled);
    }

    /**
     * @return array{total: int, list: array<ProviderModelEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderModelQuery $query, Page $page): array
    {
        return $this->providerModelRepository->queries($dataIsolation, $query, $page);
    }
}
