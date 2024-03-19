<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowWaitMessageEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Factory\MagicFlowWaitMessageFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowWaitMessageRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowWaitMessageModel;

class MagicFlowWaitMessageRepository extends MagicFlowAbstractRepository implements MagicFlowWaitMessageRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function save(MagicFlowWaitMessageEntity $waitMessageEntity): MagicFlowWaitMessageEntity
    {
        if (! $waitMessageEntity->getId()) {
            $model = new MagicFlowWaitMessageModel();
        } else {
            /** @var MagicFlowWaitMessageModel $model */
            $model = MagicFlowWaitMessageModel::find($waitMessageEntity->getId());
        }

        $model->fill($this->getAttributes($waitMessageEntity));
        $model->save();

        $waitMessageEntity->setId($model->id);

        return $waitMessageEntity;
    }

    public function find(FlowDataIsolation $dataIsolation, int $id): ?MagicFlowWaitMessageEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowWaitMessageModel::query());
        /** @var null|MagicFlowWaitMessageModel $model */
        $model = $builder->where('id', $id)->first();
        if (! $model) {
            return null;
        }
        return MagicFlowWaitMessageFactory::modelToEntity($model);
    }

    public function handled(FlowDataIsolation $dataIsolation, int $id): void
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowWaitMessageModel::query());
        $builder->where('id', $id)->update(['handled' => true]);
    }

    public function listByUnhandledConversationId(FlowDataIsolation $dataIsolation, string $conversationId): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowWaitMessageModel::query());
        $models = $builder
            // 这里不查询 persistent_data，因为这个字段可能会很大
            ->select(['id', 'organization_code', 'conversation_id', 'origin_conversation_id', 'message_id', 'wait_node_id', 'flow_code', 'flow_version', 'timeout', 'handled', 'created_uid', 'created_at', 'updated_uid', 'updated_at'])
            ->where('conversation_id', '=', $conversationId)
            ->where('handled', false)
            ->orderBy('id', 'asc')
            ->get();

        // 使用foreach循环代替map方法
        $result = [];
        foreach ($models as $model) {
            $result[] = MagicFlowWaitMessageFactory::modelToEntity($model);
        }
        return $result;
    }
}
