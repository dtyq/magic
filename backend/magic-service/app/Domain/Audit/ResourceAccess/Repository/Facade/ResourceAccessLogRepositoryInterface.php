<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ResourceAccess\Repository\Facade;

use App\Domain\Audit\ResourceAccess\Entity\ResourceAccessLogEntity;
use App\Infrastructure\Core\ValueObject\Page;

interface ResourceAccessLogRepositoryInterface
{
    public function save(ResourceAccessLogEntity $entity): ResourceAccessLogEntity;

    /** @return array{list: array<int, array{resource_code: string, latest_used_at: null|string}>, total?: int} */
    public function queriesRecentlyUsedResources(
        string $organizationCode,
        string $userId,
        string $resourceType,
        string $operation,
        Page $page,
        bool $withTotal = false
    ): array;
}
