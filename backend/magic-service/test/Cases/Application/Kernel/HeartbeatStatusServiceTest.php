<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Infrastructure\Rpc\Health\HeartbeatStatusService;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use Hyperf\Contract\ConfigInterface;
use Mockery;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class HeartbeatStatusServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
    }

    public function testInspectReturnsUpWhenRpcClientDisabled(): void
    {
        $service = $this->createService(
            [
                'rpc_client_enabled' => false,
                'socket_path' => '/tmp/heartbeat-disabled.sock',
            ]
        );

        $result = $service->inspect();

        $this->assertSame('UP', $result['status']);
        $this->assertSame(200, $result['httpCode']);
        $this->assertTrue($result['checks']['php_up']);
        $this->assertFalse($result['checks']['rpc_client_enabled']);
    }

    public function testInspectReturnsStartingWithinStartupGraceWhenGoUnavailable(): void
    {
        $service = $this->createService(
            [
                'rpc_client_enabled' => true,
                'socket_path' => '/tmp/heartbeat-starting.sock',
                'heartbeat_startup_grace_seconds' => 45,
            ],
            [
                'running' => true,
                'is_connected' => false,
                'has_ever_connected' => false,
                'started_at_unix' => time() - 10,
            ]
        );

        $result = $service->inspect();

        $this->assertSame('UP', $result['status']);
        $this->assertSame(200, $result['httpCode']);
        $this->assertSame('starting', $result['meta']['mode']);
        $this->assertSame('rpc_connecting_during_grace_period', $result['meta']['reason']);
        $this->assertFalse($result['checks']['go_alive']);
        $this->assertFalse($result['checks']['socket_connectable']);
        $this->assertTrue($result['checks']['within_startup_grace']);
    }

    public function testInspectReturnsDownAfterStartupGraceWhenGoUnavailable(): void
    {
        $service = $this->createService(
            [
                'rpc_client_enabled' => true,
                'socket_path' => '/tmp/heartbeat-down.sock',
                'heartbeat_startup_grace_seconds' => 45,
            ],
            [
                'running' => true,
                'is_connected' => false,
                'has_ever_connected' => false,
                'started_at_unix' => time() - 120,
            ]
        );

        $result = $service->inspect();

        $this->assertSame('DOWN', $result['status']);
        $this->assertSame(503, $result['httpCode']);
        $this->assertSame('down', $result['meta']['mode']);
        $this->assertSame('rpc_not_ready', $result['meta']['reason']);
        $this->assertFalse($result['checks']['go_alive']);
        $this->assertFalse($result['checks']['socket_connectable']);
    }

    public function testInspectReturnsDownWhenRpcLoopNotRunning(): void
    {
        $service = $this->createService(
            [
                'rpc_client_enabled' => true,
                'socket_path' => '/tmp/heartbeat-loop-not-running.sock',
                'heartbeat_startup_grace_seconds' => 45,
            ],
            [
                'running' => false,
                'is_connected' => false,
                'has_ever_connected' => false,
                'started_at_unix' => time() - 10,
            ]
        );

        $result = $service->inspect();

        $this->assertSame('DOWN', $result['status']);
        $this->assertSame(503, $result['httpCode']);
        $this->assertSame('down', $result['meta']['mode']);
        $this->assertSame('rpc_not_ready', $result['meta']['reason']);
        $this->assertFalse($result['checks']['within_startup_grace']);
    }

    public function testInspectReturnsUpDegradedWhenRpcIsReconnecting(): void
    {
        $service = $this->createService(
            [
                'rpc_client_enabled' => true,
                'socket_path' => '/tmp/heartbeat-degraded.sock',
                'heartbeat_startup_grace_seconds' => 45,
            ],
            [
                'running' => true,
                'is_connected' => false,
                'has_ever_connected' => true,
                'started_at_unix' => time() - 120,
            ]
        );

        $result = $service->inspect();

        $this->assertSame('UP', $result['status']);
        $this->assertSame(200, $result['httpCode']);
        $this->assertSame('degraded', $result['meta']['mode']);
        $this->assertSame('rpc_reconnecting', $result['meta']['reason']);
        $this->assertFalse($result['checks']['socket_connectable']);
        $this->assertTrue($result['checks']['go_alive']);
        $this->assertFalse($result['checks']['rpc_connected']);
    }

    public function testInspectReturnsUpReadyWhenRpcConnected(): void
    {
        $service = $this->createService(
            [
                'rpc_client_enabled' => true,
                'socket_path' => '/tmp/heartbeat-ready.sock',
                'heartbeat_startup_grace_seconds' => 45,
            ],
            [
                'running' => true,
                'is_connected' => true,
                'has_ever_connected' => true,
                'started_at_unix' => time() - 120,
            ]
        );

        $result = $service->inspect();

        $this->assertSame('UP', $result['status']);
        $this->assertSame(200, $result['httpCode']);
        $this->assertSame('ready', $result['meta']['mode']);
        $this->assertSame('rpc_connected', $result['meta']['reason']);
        $this->assertTrue($result['checks']['rpc_connected']);
        $this->assertTrue($result['checks']['socket_connectable']);
        $this->assertTrue($result['checks']['go_alive']);
    }

    private function createService(array $ipcConfig, ?array $snapshot = null): HeartbeatStatusService
    {
        $config = Mockery::mock(ConfigInterface::class);
        $config->shouldReceive('get')
            ->once()
            ->with('ipc', [])
            ->andReturn($ipcConfig);

        $manager = Mockery::mock(RpcClientManager::class);
        if (! (bool) ($ipcConfig['rpc_client_enabled'] ?? false)) {
            $manager->shouldNotReceive('getHealthSnapshot');
        } else {
            $manager->shouldReceive('getHealthSnapshot')
                ->once()
                ->andReturn($snapshot ?? []);
        }

        return new HeartbeatStatusService($config, $manager);
    }
}
