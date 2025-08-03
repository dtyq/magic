<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderConfigQuery;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

readonly class ProviderConfigDomainService
{
    public function __construct(
        private ProviderConfigRepositoryInterface $serviceProviderConfigRepository
    ) {
    }

    public function getById(ProviderDataIsolation $dataIsolation, int $id, bool $checkProviderEnabled = true): ?ProviderConfigEntity
    {
        return $this->serviceProviderConfigRepository->getById($dataIsolation, $id, $checkProviderEnabled);
    }

    /**
     * @param array<int> $ids
     * @return array<ProviderConfigEntity>
     */
    public function getByIds(ProviderDataIsolation $dataIsolation, array $ids): array
    {
        return $this->serviceProviderConfigRepository->getByIds($dataIsolation, $ids);
    }

    /**
     * @return array{total: int, list: array<ProviderConfigEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderConfigQuery $query, Page $page): array
    {
        return $this->serviceProviderConfigRepository->queries($dataIsolation, $query, $page);
    }

    public function getEnabledProviderConfigIds(ProviderDataIsolation $dataIsolation): array
    {
        return $this->serviceProviderConfigRepository->getEnabledProviderConfigIds($dataIsolation);
    }
}
