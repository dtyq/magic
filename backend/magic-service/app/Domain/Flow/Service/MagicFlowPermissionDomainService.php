<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowPermissionEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Permission\ResourceType;
use App\Domain\Flow\Entity\ValueObject\Permission\TargetType;
use App\Domain\Flow\Repository\Facade\MagicFlowPermissionRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowPermissionDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowPermissionRepositoryInterface $magicFlowPermissionRepository,
    ) {
    }

    public function save(FlowDataIsolation $dataIsolation, MagicFlowPermissionEntity $permissionEntity): MagicFlowPermissionEntity
    {
        $permissionEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $permissionEntity->setCreator($dataIsolation->getCurrentUserId());
        $permissionEntity->prepareForSave();
        return $this->magicFlowPermissionRepository->save($dataIsolation, $permissionEntity);
    }

    /**
     * @return array{total: int, list: array<MagicFlowPermissionEntity>}
     */
    public function getByResource(FlowDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, Page $page): array
    {
        /* @phpstan-ignore-next-line */
        return $this->magicFlowPermissionRepository->getByResource($dataIsolation, $resourceType, $resourceId, $page);
    }

    public function removeByIds(FlowDataIsolation $dataIsolation, array $ids): void
    {
        $this->magicFlowPermissionRepository->removeByIds($dataIsolation, $ids);
    }

    public function getByResourceAndTarget(FlowDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, TargetType $targetType, string $targetId): ?MagicFlowPermissionEntity
    {
        return $this->magicFlowPermissionRepository->getByResourceAndTarget($dataIsolation, $resourceType, $resourceId, $targetType, $targetId);
    }
}
