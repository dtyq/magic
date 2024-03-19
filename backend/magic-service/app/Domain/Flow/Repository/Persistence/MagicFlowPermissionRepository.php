<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowPermissionEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Permission\ResourceType;
use App\Domain\Flow\Entity\ValueObject\Permission\TargetType;
use App\Domain\Flow\Factory\MagicFlowPermissionFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowPermissionRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowPermissionModel;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowPermissionRepository extends MagicFlowAbstractRepository implements MagicFlowPermissionRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowPermissionEntity $magicFlowPermissionEntity): MagicFlowPermissionEntity
    {
        $model = $this->createBuilder($dataIsolation, MagicFlowPermissionModel::query())
            ->where('resource_type', $magicFlowPermissionEntity->getResourceType()->value)
            ->where('resource_id', $magicFlowPermissionEntity->getResourceId())
            ->where('target_type', $magicFlowPermissionEntity->getTargetType()->value)
            ->where('target_id', $magicFlowPermissionEntity->getTargetId())
            ->first();
        if ($model) {
            $model->fill([
                'operation' => $magicFlowPermissionEntity->getOperation()->value,
                'updated_uid' => $magicFlowPermissionEntity->getCreator(),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        } else {
            $model = new MagicFlowPermissionModel();
            $model->fill($this->getAttributes($magicFlowPermissionEntity));
        }
        $model->save();

        $magicFlowPermissionEntity->setId($model->id);

        return $magicFlowPermissionEntity;
    }

    public function getByResourceAndTarget(FlowDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, TargetType $targetType, string $targetId): ?MagicFlowPermissionEntity
    {
        /** @var null|MagicFlowPermissionModel $model */
        $model = $this->createBuilder($dataIsolation, MagicFlowPermissionModel::query())
            ->where('resource_type', $resourceType->value)
            ->where('resource_id', $resourceId)
            ->where('target_type', $targetType->value)
            ->where('target_id', $targetId)
            ->first();
        if ($model === null) {
            return null;
        }
        return MagicFlowPermissionFactory::createEntity($model);
    }

    public function getByResource(FlowDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowPermissionModel::query());

        $builder->where('resource_type', $resourceType->value);
        $builder->where('resource_id', $resourceId);

        $data = $this->getByPage($builder, $page);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = MagicFlowPermissionFactory::createEntity($model);
            }
            $data['list'] = $list;
        }
        /* @phpstan-ignore-next-line */
        return $data;
    }

    public function removeByIds(FlowDataIsolation $dataIsolation, array $ids): void
    {
        $this->createBuilder($dataIsolation, MagicFlowPermissionModel::query())
            ->whereIn('id', $ids)
            ->delete();
    }
}
