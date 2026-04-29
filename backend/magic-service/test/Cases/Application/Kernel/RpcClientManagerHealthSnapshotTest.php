<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use Hyperf\Contract\ConfigInterface;
use Mockery;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionMethod;

/**
 * @internal
 */
class RpcClientManagerHealthSnapshotTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
    }

    public function testHealthSnapshotFailureAndRecoveryCounters(): void
    {
        $manager = $this->createManager();

        $markFailure = new ReflectionMethod(RpcClientManager::class, 'markConnectFailure');
        $markFailure->setAccessible(true);
        $markFailure->invoke($manager);
        $markFailure->invoke($manager);

        $snapshotAfterFailure = $manager->healthSnapshot();
        $this->assertSame(2, $snapshotAfterFailure->consecutiveFailures);
        $this->assertFalse($snapshotAfterFailure->hasEverConnected);
        $this->assertGreaterThan(0.0, $snapshotAfterFailure->lastFailureAt);

        $markConnected = new ReflectionMethod(RpcClientManager::class, 'markConnected');
        $markConnected->setAccessible(true);
        $markConnected->invoke($manager);

        $snapshotAfterRecover = $manager->healthSnapshot();
        $this->assertSame(0, $snapshotAfterRecover->consecutiveFailures);
        $this->assertTrue($snapshotAfterRecover->hasEverConnected);
        $this->assertGreaterThan(0.0, $snapshotAfterRecover->lastConnectedAt);
    }

    private function createManager(): RpcClientManager
    {
        $container = Mockery::mock(ContainerInterface::class);
        $config = Mockery::mock(ConfigInterface::class);
        $config->shouldReceive('get')
            ->once()
            ->with('ipc', [])
            ->andReturn([
                'rpc_client_enabled' => true,
                'socket_path' => BASE_PATH . '/runtime/magic_engine.sock',
                'rpc_connect_retries' => 5,
                'rpc_connect_backoff_ms' => 200,
            ]);

        return new RpcClientManager($container, $config);
    }
}
