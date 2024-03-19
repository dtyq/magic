<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowMemoryHistoryEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowMemoryHistoryQuery;
use App\Domain\Flow\Factory\MagicFlowMemoryHistoryFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowMemoryHistoryRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowMemoryHistoryModel;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowMemoryHistoryRepository extends MagicFlowAbstractRepository implements MagicFlowMemoryHistoryRepositoryInterface
{
    public function create(FlowDataIsolation $dataIsolation, MagicFlowMemoryHistoryEntity $magicFlowMemoryHistoryEntity): MagicFlowMemoryHistoryEntity
    {
        $model = new MagicFlowMemoryHistoryModel();
        $model->fill($this->getAttributes($magicFlowMemoryHistoryEntity));
        $model->save();
        $magicFlowMemoryHistoryEntity->setId($model->id);
        return $magicFlowMemoryHistoryEntity;
    }

    public function queries(FlowDataIsolation $dataIsolation, MagicFlowMemoryHistoryQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowMemoryHistoryModel::query());

        if ($query->getConversationId()) {
            $builder->where('conversation_id', $query->getConversationId());
        }
        if (! is_null($query->getTopicId())) {
            $builder->where('topic_id', $query->getTopicId());
        }

        if ($query->getType()) {
            $builder->where('type', $query->getType());
        }

        if ($query->getMountId()) {
            $builder->where('mount_id', $query->getMountId());
        }

        if (! empty($query->getMountIds())) {
            $builder->whereIn('mount_id', $query->getMountIds());
        }

        if (! empty($query->getIgnoreRequestIds())) {
            $builder->whereNotIn('request_id', $query->getIgnoreRequestIds());
        }

        if ($query->getStartTime()) {
            $builder->where('created_at', '>=', $query->getStartTime()->format('Y-m-d H:i:s'));
        }

        $data = $this->getByPage($builder, $page, $query);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = MagicFlowMemoryHistoryFactory::modelToEntity($model);
            }
            $data['list'] = $list;
        }

        return $data;
    }

    public function removeByConversationId(FlowDataIsolation $dataIsolation, string $conversationId): void
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowMemoryHistoryModel::query());
        $builder->where('conversation_id', $conversationId)->update(['conversation_id' => $conversationId . '-d' . time()]);
    }
}
