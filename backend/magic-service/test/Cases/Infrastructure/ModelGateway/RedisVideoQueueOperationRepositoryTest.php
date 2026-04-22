<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ModelGateway;

use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\ModelGateway\Queue\QueueCoreRedisKeys;
use App\Infrastructure\ModelGateway\Queue\RedisVideoQueueOperationRepository;
use Hyperf\Redis\Redis;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class RedisVideoQueueOperationRepositoryTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    public function testClaimUserActiveOperationUsesUserActiveOperationsKey(): void
    {
        $operation = $this->createOperation('op-user-1');
        $redis = Mockery::mock(Redis::class);
        $redis->shouldReceive('eval')
            ->once()
            ->withArgs(function (string $lua, array $arguments, int $keyCount) use ($operation): bool {
                $this->assertStringContainsString('zremrangebyscore', $lua);
                $this->assertStringContainsString('zcard', $lua);
                $this->assertSame(1, $keyCount);
                $this->assertSame(QueueCoreRedisKeys::userActiveOperations('org-test', 'user-test'), $arguments[0]);
                $this->assertSame($operation->getId(), $arguments[1]);
                $this->assertSame('2', $arguments[2]);
                $this->assertSame('600', $arguments[3]);
                $this->assertIsNumeric($arguments[4]);
                return true;
            })
            ->andReturn(1);

        $repository = new RedisVideoQueueOperationRepository($redis);

        $this->assertTrue($repository->claimUserActiveOperation($operation, 2, 600));
    }

    public function testClaimOrganizationActiveOperationUsesOrganizationActiveOperationsKey(): void
    {
        $operation = $this->createOperation('op-org-1');
        $redis = Mockery::mock(Redis::class);
        $redis->shouldReceive('eval')
            ->once()
            ->withArgs(function (string $lua, array $arguments, int $keyCount) use ($operation): bool {
                $this->assertStringContainsString('zadd', $lua);
                $this->assertSame(1, $keyCount);
                $this->assertSame(QueueCoreRedisKeys::organizationActiveOperations('org-test'), $arguments[0]);
                $this->assertSame($operation->getId(), $arguments[1]);
                $this->assertSame('3', $arguments[2]);
                $this->assertSame('900', $arguments[3]);
                $this->assertIsNumeric($arguments[4]);
                return true;
            })
            ->andReturn(0);

        $repository = new RedisVideoQueueOperationRepository($redis);

        $this->assertFalse($repository->claimOrganizationActiveOperation($operation, 3, 900));
    }

    public function testClaimActiveOperationSkipsRedisWhenLimitDisabled(): void
    {
        $operation = $this->createOperation('op-disabled-limit');
        $redis = Mockery::mock(Redis::class);
        $redis->shouldReceive('eval')->never();

        $repository = new RedisVideoQueueOperationRepository($redis);

        $this->assertTrue($repository->claimUserActiveOperation($operation, 0, 600));
        $this->assertTrue($repository->claimOrganizationActiveOperation($operation, 0, 600));
    }

    public function testReleaseUserActiveOperationRemovesOperationFromUserZset(): void
    {
        $operation = $this->createOperation('op-user-release');
        $redis = Mockery::mock(Redis::class);
        $redis->shouldReceive('zRem')
            ->once()
            ->with(
                QueueCoreRedisKeys::userActiveOperations('org-test', 'user-test'),
                $operation->getId()
            );

        $repository = new RedisVideoQueueOperationRepository($redis);

        $repository->releaseUserActiveOperation($operation);
    }

    public function testReleaseOrganizationActiveOperationRemovesOperationFromOrganizationZset(): void
    {
        $operation = $this->createOperation('op-org-release');
        $redis = Mockery::mock(Redis::class);
        $redis->shouldReceive('zRem')
            ->once()
            ->with(
                QueueCoreRedisKeys::organizationActiveOperations('org-test'),
                $operation->getId()
            );

        $repository = new RedisVideoQueueOperationRepository($redis);

        $repository->releaseOrganizationActiveOperation($operation);
    }

    public function testGetUserActiveOperationsReadsOperationEntitiesFromUserZset(): void
    {
        $firstOperation = $this->createOperation('op-user-active-1');
        $secondOperation = $this->createOperation('op-user-active-2');
        $redis = Mockery::mock(Redis::class);
        $pipeline = Mockery::mock();
        $redis->shouldReceive('zRange')
            ->once()
            ->with(QueueCoreRedisKeys::userActiveOperations('org-test', 'user-test'), 0, -1)
            ->andReturn([$firstOperation->getId(), 'op-missing', $secondOperation->getId()]);
        $redis->shouldReceive('pipeline')->once()->andReturn($pipeline);
        $pipeline->shouldReceive('hGetAll')->once()->with(QueueCoreRedisKeys::operation($firstOperation->getId()));
        $pipeline->shouldReceive('hGetAll')->once()->with(QueueCoreRedisKeys::operation('op-missing'));
        $pipeline->shouldReceive('hGetAll')->once()->with(QueueCoreRedisKeys::operation($secondOperation->getId()));
        $pipeline->shouldReceive('exec')
            ->once()
            ->andReturn([
                $firstOperation->toStorageArray(),
                [],
                $secondOperation->toStorageArray(),
            ]);

        $repository = new RedisVideoQueueOperationRepository($redis);
        $operations = $repository->getUserActiveOperations('org-test', 'user-test');

        $this->assertCount(2, $operations);
        $this->assertSame([$firstOperation->getId(), $secondOperation->getId()], array_map(
            static fn (VideoQueueOperationEntity $operation): string => $operation->getId(),
            $operations
        ));
    }

    public function testGetOrganizationActiveOperationsReadsOperationEntitiesFromOrganizationZset(): void
    {
        $operation = $this->createOperation('op-org-active');
        $redis = Mockery::mock(Redis::class);
        $pipeline = Mockery::mock();
        $redis->shouldReceive('zRange')
            ->once()
            ->with(QueueCoreRedisKeys::organizationActiveOperations('org-test'), 0, -1)
            ->andReturn([$operation->getId()]);
        $redis->shouldReceive('pipeline')->once()->andReturn($pipeline);
        $pipeline->shouldReceive('hGetAll')->once()->with(QueueCoreRedisKeys::operation($operation->getId()));
        $pipeline->shouldReceive('exec')->once()->andReturn([$operation->toStorageArray()]);

        $repository = new RedisVideoQueueOperationRepository($redis);
        $operations = $repository->getOrganizationActiveOperations('org-test');

        $this->assertCount(1, $operations);
        $this->assertSame($operation->getId(), $operations[0]->getId());
    }

    private function createOperation(string $id): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: $id,
            endpoint: 'video:test-model',
            model: 'test-model',
            modelVersion: 'test-version',
            providerModelId: 'provider-model',
            providerCode: ProviderCode::Cloudsway->value,
            providerName: 'cloudsway',
            organizationCode: 'org-test',
            userId: 'user-test',
            status: VideoOperationStatus::PROVIDER_RUNNING,
            seq: 1,
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }
}
