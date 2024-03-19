<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowExecuteLogEntity;
use App\Domain\Flow\Entity\ValueObject\ExecuteLogStatus;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Factory\MagicFlowExecuteLogFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowExecuteLogRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowExecuteLogModel;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowExecuteLogRepository extends MagicFlowAbstractRepository implements MagicFlowExecuteLogRepositoryInterface
{
    public function create(FlowDataIsolation $dataIsolation, MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): MagicFlowExecuteLogEntity
    {
        $model = new MagicFlowExecuteLogModel();
        $model->fill($this->getAttributes($magicFlowExecuteLogEntity));
        $model->save();
        $magicFlowExecuteLogEntity->setId($model->id);
        return $magicFlowExecuteLogEntity;
    }

    public function updateStatus(FlowDataIsolation $dataIsolation, MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): void
    {
        $update = [
            'status' => $magicFlowExecuteLogEntity->getStatus()->value,
        ];
        // 如果是完成状态，记录结果
        if ($magicFlowExecuteLogEntity->getStatus()->isFinished()) {
            $update['result'] = json_encode($magicFlowExecuteLogEntity->getResult(), JSON_UNESCAPED_UNICODE);
        }
        $builder = $this->createBuilder($dataIsolation, MagicFlowExecuteLogModel::query());
        $builder->where('id', $magicFlowExecuteLogEntity->getId())
            ->update($update);
    }

    /**
     * @return MagicFlowExecuteLogEntity[]
     */
    public function getRunningTimeoutList(FlowDataIsolation $dataIsolation, int $timeout, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowExecuteLogModel::query());
        $builder = $builder
            ->whereIn('status', [ExecuteLogStatus::Running, ExecuteLogStatus::Pending])
            // 只重试顶层
            ->where('level', 0)
            // 重试次数小于 3 次
            ->where('retry_count', '<', 1)
            // 只获取最近 2 小时内的数据，超过 2 小时的数据不再处理
            ->where('created_at', '>', date('Y-m-d H:i:s', time() - 7200))
            ->where('created_at', '<', date('Y-m-d H:i:s', time() - $timeout))
            ->forPage($page->getPage(), $page->getPageNum());
        $models = $builder->get();
        $result = [];
        foreach ($models as $model) {
            $result[] = MagicFlowExecuteLogFactory::modelToEntity($model);
        }
        return $result;
    }

    public function getByExecuteId(FlowDataIsolation $dataIsolation, string $executeId): ?MagicFlowExecuteLogEntity
    {
        if (empty($executeId)) {
            return null;
        }
        $builder = $this->createBuilder($dataIsolation, MagicFlowExecuteLogModel::query());
        if (strlen($executeId) === 18 && is_numeric($executeId)) {
            // 主键查询
            $model = $builder->where('id', $executeId)->first();
        } else {
            $model = $builder->where('execute_data_id', $executeId)->first();
        }
        /** @var null|MagicFlowExecuteLogModel $model */
        if ($model === null) {
            return null;
        }
        return MagicFlowExecuteLogFactory::modelToEntity($model);
    }

    public function incrementRetryCount(FlowDataIsolation $dataIsolation, MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): void
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowExecuteLogModel::query());
        $builder->where('id', $magicFlowExecuteLogEntity->getId())
            ->increment('retry_count');
        $magicFlowExecuteLogEntity->setRetryCount($magicFlowExecuteLogEntity->getRetryCount() + 1);
    }
}
