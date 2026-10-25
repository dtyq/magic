<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ResourceAccess\Service;

use App\Domain\Audit\ResourceAccess\Entity\ResourceAccessLogEntity;
use App\Domain\Audit\ResourceAccess\Repository\Facade\ResourceAccessLogRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

readonly class ResourceAccessLogDomainService
{
    public function __construct(
        private ResourceAccessLogRepositoryInterface $repository
    ) {
    }

    public function save(ResourceAccessLogEntity $entity): ResourceAccessLogEntity
    {
        $entity->prepareForCreation();
        return $this->repository->save($entity);
    }

    /** @return array{list: array<int, array{resource_code: string, latest_used_at: null|string}>, total?: int} */
    public function queriesRecentlyUsedResources(
        string $organizationCode,
        string $userId,
        string $resourceType,
        string $operation,
        Page $page,
        bool $withTotal = false
    ): array {
        return $this->repository->queriesRecentlyUsedResources(
            $organizationCode,
            $userId,
            $resourceType,
            $operation,
            $page,
            $withTotal
        );
    }
}
