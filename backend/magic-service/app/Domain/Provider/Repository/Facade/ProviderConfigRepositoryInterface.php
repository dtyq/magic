<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Facade;

use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderConfigQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface ProviderConfigRepositoryInterface
{
    public function getById(ProviderDataIsolation $dataIsolation, int $id, bool $checkProviderEnabled = true): ?ProviderConfigEntity;

    /**
     * @param array<int> $ids
     * @return array<int, ProviderConfigEntity>
     */
    public function getByIds(ProviderDataIsolation $dataIsolation, array $ids): array;

    public function getByProviderId(ProviderDataIsolation $dataIsolation, int $providerId): ?ProviderConfigEntity;

    /**
     * @return array{total: int, list: array<ProviderConfigEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderConfigQuery $query, Page $page): array;
}
