<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderQuery;
use App\Domain\Provider\Repository\Facade\ProviderRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

readonly class ProviderDomainService
{
    public function __construct(
        private ProviderRepositoryInterface $providerRepository,
    ) {
    }

    /**
     * @return array{total: int, list: array<ProviderEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderQuery $providerQuery, Page $page): array
    {
        return $this->providerRepository->queries($dataIsolation, $providerQuery, $page);
    }
}
