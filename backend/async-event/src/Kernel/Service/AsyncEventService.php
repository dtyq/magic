<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Service;

use Dtyq\AsyncEvent\Kernel\Constants\Status;
use Dtyq\AsyncEvent\Kernel\Persistence\AsyncEventRepository;
use Dtyq\AsyncEvent\Kernel\Persistence\Model\AsyncEventModel;
use Hyperf\Snowflake\IdGeneratorInterface;

class AsyncEventService
{
    private AsyncEventRepository $asyncEventRepository;

    private IdGeneratorInterface $generator;

    public function __construct(AsyncEventRepository $asyncEventRepository, IdGeneratorInterface $generator)
    {
        $this->asyncEventRepository = $asyncEventRepository;
        $this->generator = $generator;
    }

    public function create(array $data): AsyncEventModel
    {
        return $this->asyncEventRepository->create($data);
    }

    public function buildAsyncEventData(string $eventClassName, string $listenerClassName, object $event): array
    {
        $now = date('Y-m-d H:i:s');
        return [
            'id' => $this->generator->generate(),
            'event' => $eventClassName,
            'listener' => $listenerClassName,
            'status' => Status::STATE_WAIT,
            'args' => serialize($event),
            'retry_times' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    public function exists(int $recordId): bool
    {
        return $this->asyncEventRepository->exists($recordId);
    }

    public function getById(int $recordId): ?AsyncEventModel
    {
        return $this->asyncEventRepository->getById($recordId);
    }

    public function complete(int $recordId)
    {
        $this->asyncEventRepository->updateById($recordId, [
            'status' => Status::STATE_COMPLETE,
        ]);
    }

    public function retry(int $recordId)
    {
        $this->asyncEventRepository->retryById($recordId);
    }

    public function fail(int $recordId)
    {
        $this->asyncEventRepository->updateById($recordId, [
            'status' => Status::STATE_EXCEEDED,
        ]);
    }

    public function delete(int $recordId): int
    {
        return $this->asyncEventRepository->deleteById($recordId);
    }

    public function clearHistory(): void
    {
        // 清除1天前, 消费成功的message以及流水数据
        $this->clearSuccessHistoryRecord();
        // 清除30天前, message以及流水数据(无论是否消费成功)
        $this->clearAllHistoryRecord();
    }

    public function getTimeoutRecordIds(string $datetime): array
    {
        return $this->asyncEventRepository->getTimeoutRecordIds($datetime);
    }

    private function clearSuccessHistoryRecord(): void
    {
        $time = time() - 86400;
        $date = date('Y-m-d H:i:s', $time);
        $this->asyncEventRepository->deleteHistory([
            ['updated_at', '<=', $date],
            ['status', '=', Status::STATE_COMPLETE],
        ]);
    }

    private function clearAllHistoryRecord()
    {
        $time = time() - (86400 * 30);
        $date = date('Y-m-d H:i:s', $time);
        $this->asyncEventRepository->deleteHistory([
            ['updated_at', '<=', $date],
        ]);
    }
}
