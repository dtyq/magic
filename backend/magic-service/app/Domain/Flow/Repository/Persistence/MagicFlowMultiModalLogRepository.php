<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowMultiModalLogEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Factory\MagicFlowMultiModalLogFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowMultiModalLogRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowMultiModalLogModel;

class MagicFlowMultiModalLogRepository extends MagicFlowAbstractRepository implements MagicFlowMultiModalLogRepositoryInterface
{
    public function create(FlowDataIsolation $dataIsolation, MagicFlowMultiModalLogEntity $entity): MagicFlowMultiModalLogEntity
    {
        $model = MagicFlowMultiModalLogFactory::entityToModel($entity);
        $model->save();
        return MagicFlowMultiModalLogFactory::modelToEntity($model);
    }

    public function getById(FlowDataIsolation $dataIsolation, int $id): ?MagicFlowMultiModalLogEntity
    {
        $query = $this->createBuilder($dataIsolation, MagicFlowMultiModalLogModel::query());
        /** @var null|MagicFlowMultiModalLogModel $model */
        $model = $query->where('id', $id)->first();

        if (empty($model)) {
            return null;
        }

        return MagicFlowMultiModalLogFactory::modelToEntity($model);
    }

    public function getByMessageId(FlowDataIsolation $dataIsolation, string $messageId): ?MagicFlowMultiModalLogEntity
    {
        $query = $this->createBuilder($dataIsolation, MagicFlowMultiModalLogModel::query());
        /** @var null|MagicFlowMultiModalLogModel $model */
        $model = $query->where('message_id', $messageId)->first();

        if (empty($model)) {
            return null;
        }

        return MagicFlowMultiModalLogFactory::modelToEntity($model);
    }

    /**
     * 批量获取多个消息ID对应的多模态日志记录.
     *
     * @param array<string> $messageIds
     * @return array<MagicFlowMultiModalLogEntity>
     */
    public function getByMessageIds(FlowDataIsolation $dataIsolation, array $messageIds, bool $keyByMessageId = false): array
    {
        $messageIds = array_filter($messageIds);
        if (empty($messageIds)) {
            return [];
        }

        $query = $this->createBuilder($dataIsolation, MagicFlowMultiModalLogModel::query());
        $models = $query->whereIn('message_id', $messageIds)->get();

        if ($models->isEmpty()) {
            return [];
        }

        $entities = [];
        foreach ($models as $model) {
            $entity = MagicFlowMultiModalLogFactory::modelToEntity($model);
            if ($keyByMessageId) {
                $entities[$entity->getMessageId()] = $entity;
            } else {
                $entities[] = $entity;
            }
        }

        return $entities;
    }
}
