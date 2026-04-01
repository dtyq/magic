<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Repository\QueueCoreRepositoryInterface;
use App\Domain\ModelGateway\Repository\VideoQueueOperationRepositoryInterface;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Throwable;

readonly class QueueCoreDomainService
{
    public function __construct(
        private QueueCoreRepositoryInterface $queueCoreRepository,
        private VideoQueueOperationRepositoryInterface $videoQueueOperationRepository,
        private LockerInterface $locker,
    ) {
    }

    /**
     * @throws Throwable
     */
    public function enqueue(
        VideoQueueOperationEntity $operation,
        int $maxPendingPerUser,
        int $maxWaiting,
        int $ttlSeconds,
        int $lockExpireSeconds
    ): array {
        $lockOwner = $this->createLockOwner();
        $lockKey = $this->lockKey($operation->getEndpoint());

        if (! $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds)) {
            ExceptionBuilder::throw(MagicApiErrorCode::RATE_LIMIT, 'queue lock busy');
        }

        try {
            $enqueueState = $this->queueCoreRepository->getEnqueueState($operation->getEndpoint(), $operation->getUserId());
            $userPending = (int) ($enqueueState['user_pending'] ?? 0);
            $waitingCount = (int) ($enqueueState['waiting_count'] ?? 0);
            $runningCount = (int) ($enqueueState['running_count'] ?? 0);
            $userHeadId = $enqueueState['user_head_id'] ?? null;

            if ($userPending >= $maxPendingPerUser) {
                return $this->buildRejectedEnqueueResult('user_pending_limit', $userPending, $waitingCount, $runningCount);
            }

            if ($waitingCount >= $maxWaiting) {
                return $this->buildRejectedEnqueueResult('endpoint_waiting_limit', $userPending, $waitingCount, $runningCount);
            }

            $seq = $this->queueCoreRepository->nextSeq();
            $operation->setSeq($seq);

            $this->videoQueueOperationRepository->saveOperation($operation, $ttlSeconds);
            $this->videoQueueOperationRepository->addActiveOperation($operation);

            try {
                $this->queueCoreRepository->enqueue(
                    $operation->getEndpoint(),
                    $operation->getUserId(),
                    $operation->getId(),
                    $seq,
                    $userHeadId === null,
                );
            } catch (Throwable $throwable) {
                $this->videoQueueOperationRepository->removeActiveOperation($operation);
                $this->videoQueueOperationRepository->deleteOperation($operation->getId());
                throw $throwable;
            }
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }

        return [
            'accepted' => true,
            'same_user_ahead_count' => $userPending,
            'endpoint_total_ahead_count' => $waitingCount,
            'queue_position' => $waitingCount + 1,
            'running_count' => $runningCount,
            'user_pending' => $userPending + 1,
        ];
    }

    public function cancelQueued(VideoQueueOperationEntity $operation, int $ttlSeconds, int $lockExpireSeconds): void
    {
        $lockOwner = $this->createLockOwner();
        $lockKey = $this->lockKey($operation->getEndpoint());

        if (! $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds)) {
            ExceptionBuilder::throw(MagicApiErrorCode::RATE_LIMIT, 'queue lock busy');
        }

        try {
            $nextHeadId = $this->queueCoreRepository->cancelQueued(
                $operation->getEndpoint(),
                $operation->getUserId(),
                $operation->getId(),
            );

            $now = date(DATE_ATOM);
            $operation->setStatus(VideoOperationStatus::CANCELED);
            $operation->setCanceledAt($now);
            $operation->setFinishedAt($now);

            $this->videoQueueOperationRepository->saveOperation($operation, $ttlSeconds);
            $this->videoQueueOperationRepository->removeActiveOperation($operation);

            $this->promoteNextHead($operation->getEndpoint(), $nextHeadId);
            $this->queueCoreRepository->pushSignal($operation->getEndpoint());
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    public function dispatchEndpoint(string $endpoint, int $maxConcurrency, int $ttlSeconds, int $lockExpireSeconds): array
    {
        $lockOwner = $this->createLockOwner();
        $lockKey = $this->lockKey($endpoint);

        if (! $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds)) {
            return [];
        }

        try {
            $operationIds = $this->queueCoreRepository->getReadyOperationIds($endpoint, $maxConcurrency);
            if ($operationIds === []) {
                return [];
            }

            $operations = [];
            foreach ($this->videoQueueOperationRepository->getOperations($operationIds) as $operation) {
                $now = date(DATE_ATOM);
                $operation->setStatus(VideoOperationStatus::RUNNING);
                $operation->setStartedAt($now);
                $operation->setHeartbeatAt($now);
                $this->videoQueueOperationRepository->saveOperation($operation, $ttlSeconds);
                $operations[] = $operation;
            }

            if ($operations === []) {
                return [];
            }

            $this->queueCoreRepository->markOperationsRunning(
                $endpoint,
                array_map(static fn (VideoQueueOperationEntity $operation): string => $operation->getId(), $operations),
            );

            return $operations;
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    public function markProviderRunning(VideoQueueOperationEntity $operation, string $providerTaskId, int $ttlSeconds): void
    {
        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
        $operation->setProviderTaskId($providerTaskId);
        $operation->setHeartbeatAt(date(DATE_ATOM));
        $this->videoQueueOperationRepository->saveOperation($operation, $ttlSeconds);
    }

    public function touchHeartbeat(VideoQueueOperationEntity $operation, int $ttlSeconds): void
    {
        $operation->setHeartbeatAt(date(DATE_ATOM));
        $this->videoQueueOperationRepository->saveOperation($operation, $ttlSeconds);
    }

    public function finish(
        VideoQueueOperationEntity $operation,
        int $ttlSeconds,
        int $lockExpireSeconds
    ): void {
        $lockOwner = $this->createLockOwner();
        $lockKey = $this->lockKey($operation->getEndpoint());

        if (! $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds)) {
            ExceptionBuilder::throw(MagicApiErrorCode::RATE_LIMIT, 'queue lock busy');
        }

        try {
            $operation->setFinishedAt(date(DATE_ATOM));
            $operation->setHeartbeatAt(date(DATE_ATOM));

            $this->videoQueueOperationRepository->saveOperation($operation, $ttlSeconds);
            $nextHeadId = $this->queueCoreRepository->finishOperation(
                $operation->getEndpoint(),
                $operation->getUserId(),
                $operation->getId(),
            );
            $this->videoQueueOperationRepository->removeActiveOperation($operation);

            $this->promoteNextHead($operation->getEndpoint(), $nextHeadId);
            $this->queueCoreRepository->pushSignal($operation->getEndpoint());
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    public function blockPopSignal(int $timeoutSeconds): ?string
    {
        return $this->queueCoreRepository->blockPopSignal($timeoutSeconds);
    }

    public function buildQueueSnapshot(VideoQueueOperationEntity $operation): array
    {
        return $this->queueCoreRepository->buildQueueSnapshot(
            $operation->getEndpoint(),
            $operation->getUserId(),
            $operation->getSeq(),
            $operation->getStatus()->isDone(),
            $operation->getStatus()->isQueued(),
        );
    }

    private function buildRejectedEnqueueResult(string $reason, int $userPending, int $waitingCount, int $runningCount): array
    {
        return [
            'accepted' => false,
            'reason' => $reason,
            'user_pending' => $userPending,
            'waiting_count' => $waitingCount,
            'running_count' => $runningCount,
        ];
    }

    private function promoteNextHead(string $endpoint, ?string $nextHeadId): void
    {
        if ($nextHeadId === null) {
            return;
        }

        $nextOperation = $this->videoQueueOperationRepository->getOperation($nextHeadId);
        if ($nextOperation === null) {
            return;
        }

        $this->queueCoreRepository->addReadyOperation($endpoint, $nextHeadId, $nextOperation->getSeq());
    }

    private function lockKey(string $endpoint): string
    {
        return 'mg:queue:endpoint:' . $endpoint;
    }

    private function createLockOwner(): string
    {
        return 'queue-core-' . IdGenerator::getUuid();
    }
}
