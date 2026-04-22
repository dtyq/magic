<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Repository\QueueCoreRepositoryInterface;
use App\Domain\ModelGateway\Repository\VideoQueueOperationRepositoryInterface;
use App\Domain\ModelGateway\Service\QueueCoreDomainService;
use App\Infrastructure\Util\Locker\LockerInterface;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class QueueCoreDomainServiceTest extends TestCase
{
    public function testEnqueueAssignsSeqAndPersistsOperation(): void
    {
        $queueCoreRepository = new InMemoryQueueCoreRepository();
        $queueCoreRepository->nextSeq = 7;
        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $service = new QueueCoreDomainService($queueCoreRepository, $operationRepository, new FakeLocker());
        $operation = $this->createOperation('op-1');

        $result = $service->enqueue($operation, 2, 10, 300, 5);

        $this->assertTrue($result['accepted']);
        $this->assertSame(7, $operation->getSeq());
        $this->assertSame(['video:test', 'user-1', 'op-1', 7, true], $queueCoreRepository->enqueueCalls[0]);
        $this->assertCount(1, $operationRepository->savedOperations);
        $this->assertSame('op-1', $operationRepository->activeAdded[0]);
    }

    public function testEnqueueRejectsWhenUserPendingLimitReached(): void
    {
        $queueCoreRepository = new InMemoryQueueCoreRepository();
        $queueCoreRepository->enqueueState = [
            'user_pending' => 2,
            'waiting_count' => 4,
            'running_count' => 1,
            'user_head_id' => 'head-1',
        ];
        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $service = new QueueCoreDomainService($queueCoreRepository, $operationRepository, new FakeLocker());

        $result = $service->enqueue($this->createOperation('op-1'), 2, 10, 300, 5);

        $this->assertFalse($result['accepted']);
        $this->assertSame('user_pending_limit', $result['reason']);
        $this->assertSame([], $operationRepository->savedOperations);
        $this->assertSame([], $queueCoreRepository->enqueueCalls);
    }

    public function testCancelQueuedPromotesNextHead(): void
    {
        $queueCoreRepository = new InMemoryQueueCoreRepository();
        $queueCoreRepository->cancelQueuedResult = 'op-next';
        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations['op-next'] = $this->createOperation('op-next', seq: 11);
        $service = new QueueCoreDomainService($queueCoreRepository, $operationRepository, new FakeLocker());
        $operation = $this->createOperation('op-1', seq: 3);

        $service->cancelQueued($operation, 300, 5);

        $this->assertSame(VideoOperationStatus::CANCELED, $operation->getStatus());
        $this->assertNotNull($operation->getCanceledAt());
        $this->assertNotNull($operation->getFinishedAt());
        $this->assertSame('op-1', $operationRepository->activeRemoved[0]);
        $this->assertSame(['video:test', 'op-next', 11], $queueCoreRepository->addedReadyCalls[0]);
        $this->assertSame(['video:test'], $queueCoreRepository->signals);
    }

    public function testDispatchEndpointMarksOperationsRunning(): void
    {
        $queueCoreRepository = new InMemoryQueueCoreRepository();
        $queueCoreRepository->readyOperationIds = ['op-1'];
        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations['op-1'] = $this->createOperation('op-1', seq: 2);
        $service = new QueueCoreDomainService($queueCoreRepository, $operationRepository, new FakeLocker());

        $operations = $service->dispatchEndpoint('video:test', 1, 300, 5);

        $this->assertCount(1, $operations);
        $this->assertSame(VideoOperationStatus::RUNNING, $operations[0]->getStatus());
        $this->assertNotNull($operations[0]->getStartedAt());
        $this->assertSame([['video:test', ['op-1']]], $queueCoreRepository->markRunningCalls);
    }

    public function testFinishPersistsCurrentTerminalState(): void
    {
        $queueCoreRepository = new InMemoryQueueCoreRepository();
        $queueCoreRepository->finishOperationResult = 'op-next';
        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations['op-next'] = $this->createOperation('op-next', seq: 13);
        $service = new QueueCoreDomainService($queueCoreRepository, $operationRepository, new FakeLocker());
        $operation = $this->createOperation('op-1', seq: 3);
        $operation->setStatus(VideoOperationStatus::FAILED);
        $operation->setErrorCode('EXECUTION_FAILED');
        $operation->setErrorMessage('boom');
        $operation->setProviderResult(['raw' => 'detail']);

        $service->finish($operation, 300, 5);

        $savedOperation = $operationRepository->savedOperations[array_key_last($operationRepository->savedOperations)];
        $this->assertSame(VideoOperationStatus::FAILED, $savedOperation->getStatus());
        $this->assertSame('EXECUTION_FAILED', $savedOperation->getErrorCode());
        $this->assertSame(['raw' => 'detail'], $savedOperation->getProviderResult());
        $this->assertNotNull($savedOperation->getFinishedAt());
        $this->assertSame(['video:test', 'op-next', 13], $queueCoreRepository->addedReadyCalls[0]);
    }

    private function createOperation(string $id, int $seq = 0): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: $id,
            endpoint: 'video:test',
            model: 'veo-3.1-fast-generate-preview',
            modelVersion: 'veo3.1_fast',
            providerModelId: 'provider-model',
            providerCode: 'Google-Image',
            providerName: 'google',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: $seq,
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }
}

final class InMemoryQueueCoreRepository implements QueueCoreRepositoryInterface
{
    public array $enqueueState = [
        'user_pending' => 0,
        'waiting_count' => 0,
        'running_count' => 0,
        'user_head_id' => null,
    ];

    public int $nextSeq = 1;

    public array $enqueueCalls = [];

    public array $readyOperationIds = [];

    public array $markRunningCalls = [];

    public array $addedReadyCalls = [];

    public array $signals = [];

    public ?string $cancelQueuedResult = null;

    public ?string $finishOperationResult = null;

    public array $snapshot = [];

    public function getEnqueueState(string $endpoint, string $userId): array
    {
        return $this->enqueueState;
    }

    public function nextSeq(): int
    {
        return $this->nextSeq;
    }

    public function enqueue(string $endpoint, string $userId, string $operationId, int $seq, bool $addToReady): void
    {
        $this->enqueueCalls[] = [$endpoint, $userId, $operationId, $seq, $addToReady];
    }

    public function buildQueueSnapshot(string $endpoint, string $userId, int $seq, bool $isDone, bool $isQueued): array
    {
        return $this->snapshot;
    }

    public function cancelQueued(string $endpoint, string $userId, string $operationId): ?string
    {
        return $this->cancelQueuedResult;
    }

    public function getReadyOperationIds(string $endpoint, int $maxConcurrency): array
    {
        return $this->readyOperationIds;
    }

    public function markOperationsRunning(string $endpoint, array $operationIds): void
    {
        $this->markRunningCalls[] = [$endpoint, $operationIds];
    }

    public function finishOperation(string $endpoint, string $userId, string $operationId): ?string
    {
        return $this->finishOperationResult;
    }

    public function addReadyOperation(string $endpoint, string $operationId, int $seq): void
    {
        $this->addedReadyCalls[] = [$endpoint, $operationId, $seq];
    }

    public function blockPopSignal(int $timeoutSeconds): ?string
    {
        return null;
    }

    public function pushSignal(string $endpoint): void
    {
        $this->signals[] = $endpoint;
    }
}

final class InMemoryVideoQueueOperationRepository implements VideoQueueOperationRepositoryInterface
{
    /** @var array<string, VideoQueueOperationEntity> */
    public array $operations = [];

    /** @var list<VideoQueueOperationEntity> */
    public array $savedOperations = [];

    /** @var list<string> */
    public array $deletedOperations = [];

    /** @var list<string> */
    public array $activeAdded = [];

    /** @var list<string> */
    public array $activeRemoved = [];

    public function getOperation(string $operationId): ?VideoQueueOperationEntity
    {
        return $this->operations[$operationId] ?? null;
    }

    public function getOperations(array $operationIds): array
    {
        $operations = [];
        foreach ($operationIds as $operationId) {
            if (isset($this->operations[$operationId])) {
                $operations[] = $this->operations[$operationId];
            }
        }

        return $operations;
    }

    public function saveOperation(VideoQueueOperationEntity $operation, int $ttlSeconds): void
    {
        $this->operations[$operation->getId()] = $operation;
        $this->savedOperations[] = clone $operation;
    }

    public function deleteOperation(string $operationId): void
    {
        unset($this->operations[$operationId]);
        $this->deletedOperations[] = $operationId;
    }

    public function addActiveOperation(VideoQueueOperationEntity $operation): void
    {
        $this->activeAdded[] = $operation->getId();
    }

    public function removeActiveOperation(VideoQueueOperationEntity $operation): void
    {
        $this->activeRemoved[] = $operation->getId();
    }

    public function claimUserActiveOperation(VideoQueueOperationEntity $operation, int $limit, int $ttlSeconds): bool
    {
        return true;
    }

    public function getUserActiveOperations(string $organizationCode, string $userId): array
    {
        return [];
    }

    public function releaseUserActiveOperation(VideoQueueOperationEntity $operation): void
    {
    }

    public function claimOrganizationActiveOperation(VideoQueueOperationEntity $operation, int $limit, int $ttlSeconds): bool
    {
        return true;
    }

    public function getOrganizationActiveOperations(string $organizationCode): array
    {
        return [];
    }

    public function releaseOrganizationActiveOperation(VideoQueueOperationEntity $operation): void
    {
    }
}

final class FakeLocker implements LockerInterface
{
    public function mutexLock(string $name, string $owner, int $expire = 180): bool
    {
        return true;
    }

    public function spinLock(string $name, string $owner, int $expire = 10, ?int $waitTimeout = null): bool
    {
        return true;
    }

    public function release(string $name, string $owner): bool
    {
        return true;
    }
}
