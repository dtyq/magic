<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowPermissionEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Permission\ResourceType;
use App\Domain\Flow\Entity\ValueObject\Permission\TargetType;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicFlowPermissionRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowPermissionEntity $magicFlowPermissionEntity): MagicFlowPermissionEntity;

    public function getByResourceAndTarget(FlowDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, TargetType $targetType, string $targetId): ?MagicFlowPermissionEntity;

    /**
     * @return MagicFlowPermissionEntity[]
     */
    public function getByResource(FlowDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, Page $page): array;

    public function removeByIds(FlowDataIsolation $dataIsolation, array $ids): void;
}
