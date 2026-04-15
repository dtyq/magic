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

        $snapshotAfterFailure = $manager->getHealthSnapshot();
        $this->assertSame(2, $snapshotAfterFailure['consecutive_failures']);
        $this->assertFalse($snapshotAfterFailure['has_ever_connected']);
        $this->assertNotNull($snapshotAfterFailure['last_failure_at']);

        $markConnected = new ReflectionMethod(RpcClientManager::class, 'markConnected');
        $markConnected->setAccessible(true);
        $markConnected->invoke($manager);

        $snapshotAfterRecover = $manager->getHealthSnapshot();
        $this->assertSame(0, $snapshotAfterRecover['consecutive_failures']);
        $this->assertTrue($snapshotAfterRecover['has_ever_connected']);
        $this->assertNotNull($snapshotAfterRecover['last_connected_at']);
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
