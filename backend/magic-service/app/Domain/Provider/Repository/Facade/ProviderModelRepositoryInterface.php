<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Facade;

use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface ProviderModelRepositoryInterface
{
    public function getById(ProviderDataIsolation $dataIsolation, int $id, bool $checkModelEnabled = true): ?ProviderModelEntity;

    public function getOfficeModelById(int $id, bool $checkModelEnabled = true): ?ProviderModelEntity;

    /**
     * @param array<int> $ids
     * @return array<int, ProviderModelEntity> 返回以id为key的实体对象数组
     */
    public function getByIds(ProviderDataIsolation $dataIsolation, array $ids): array;

    /**
     * 通过ID或ModelID查询模型，在id和model_id字段上使用OR条件.
     */
    public function getByIdOrModelId(ProviderDataIsolation $dataIsolation, string $id, bool $checkModelEnabled = true): ?ProviderModelEntity;

    /**
     * @return array{total: int, list: array<ProviderModelEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderModelQuery $query, Page $page): array;
}
