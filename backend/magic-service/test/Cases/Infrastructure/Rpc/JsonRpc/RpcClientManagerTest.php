<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\JsonRpc;

use App\Infrastructure\Rpc\JsonRpc\JsonRpcRuntimeClient;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use Hyperf\Contract\ConfigInterface;
use Mockery;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use ReflectionMethod;
use ReflectionProperty;

/**
 * @internal
 */
class RpcClientManagerTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
    }

    public function testProbeConnectionReusesClientAndStartDoesNotCreateSecondClient(): void
    {
        $client = Mockery::mock(JsonRpcRuntimeClient::class);
        $client->shouldReceive('isConnected')->once()->andReturn(false);
        $client->shouldReceive('connect')->once()->with(true)->andReturn(true);

        $manager = new TestRpcClientManager($this->createContainer(), $this->createConfig(), $client);

        $this->assertTrue($manager->probeConnection());
        $this->assertSame(1, $manager->createdClients);

        $manager->start();
        $this->assertSame(1, $manager->createdClients);
        $this->assertTrue($manager->keepAliveStarted);
    }

    public function testStartIsIdempotent(): void
    {
        $client = Mockery::mock(JsonRpcRuntimeClient::class);

        $manager = new TestRpcClientManager($this->createContainer(), $this->createConfig(), $client);

        $manager->start();
        $manager->start();

        $this->assertSame(1, $manager->createdClients);
        $this->assertSame(1, $manager->keepAliveStartCount);
    }

    public function testProbeConnectionFailureUpdatesFailureCounters(): void
    {
        $client = Mockery::mock(JsonRpcRuntimeClient::class);
        $client->shouldReceive('isConnected')->twice()->andReturn(false, false);
        $client->shouldReceive('connect')->once()->with(true)->andReturn(false);
        $client->shouldReceive('getLastError')->once()->andReturn(null);

        $manager = new TestRpcClientManager($this->createContainer(), $this->createConfig(), $client);

        $this->assertFalse($manager->probeConnection());

        $snapshot = $manager->healthSnapshot();
        $this->assertSame(1, $snapshot->consecutiveFailures);
        $this->assertGreaterThan(0.0, $snapshot->lastFailureAt);
    }

    public function testWaitUntilConnectedReturnsTrueAfterClientBecomesReady(): void
    {
        $client = Mockery::mock(JsonRpcRuntimeClient::class);
        $client->shouldReceive('isConnected')->times(3)->andReturn(false, false, true);

        $manager = new TestRpcClientManager($this->createContainer(), $this->createConfig(), $client);
        $this->seedClient($manager, $client);

        $this->assertTrue($manager->waitUntilConnected(1, 10));
    }

    public function testWaitUntilConnectedReturnsFalseWhenTimeoutExpires(): void
    {
        $client = Mockery::mock(JsonRpcRuntimeClient::class);
        $client->shouldReceive('isConnected')->atLeast()->times(1)->andReturn(false);

        $manager = new TestRpcClientManager($this->createContainer(), $this->createConfig(), $client);
        $this->seedClient($manager, $client);

        $this->assertFalse($manager->waitUntilConnected(1, 10));
    }

    public function testSilentInitialConnectSuppressesStartupWarning(): void
    {
        $client = Mockery::mock(JsonRpcRuntimeClient::class);
        $logger = Mockery::mock(LoggerInterface::class);
        $logger->shouldNotReceive('warning');

        $manager = new TestRpcClientManager($this->createContainer(), $this->createConfig(), $client);
        $manager->logger = $logger;
        $this->setPrivateProperty($manager, 'silentInitialConnect', true);
        $this->setPrivateProperty($manager, 'hasEverConnected', false);

        $logFailure = new ReflectionMethod(RpcClientManager::class, 'logConnectFailureIfNeeded');
        $logFailure->setAccessible(true);
        $logFailure->invoke($manager, 1.0, true);

        $suppressedRetryLogs = new ReflectionProperty(RpcClientManager::class, 'suppressedRetryLogs');
        $suppressedRetryLogs->setAccessible(true);
        $this->assertSame(1, $suppressedRetryLogs->getValue($manager));
    }

    private function seedClient(RpcClientManager $manager, JsonRpcRuntimeClient $client): void
    {
        $reflection = new ReflectionProperty(RpcClientManager::class, 'client');
        $reflection->setAccessible(true);
        $reflection->setValue($manager, $client);
    }

    private function setPrivateProperty(RpcClientManager $manager, string $property, mixed $value): void
    {
        $reflection = new ReflectionProperty(RpcClientManager::class, $property);
        $reflection->setAccessible(true);
        $reflection->setValue($manager, $value);
    }

    private function createContainer(): ContainerInterface
    {
        return Mockery::mock(ContainerInterface::class);
    }

    private function createConfig(): ConfigInterface
    {
        $config = Mockery::mock(ConfigInterface::class);
        $config->shouldReceive('get')
            ->once()
            ->with('ipc', [])
            ->andReturn([
                'rpc_client_enabled' => true,
                'socket_path' => BASE_PATH . '/runtime/magic_engine.sock',
                'rpc_connect_retries' => 5,
                'rpc_connect_backoff_ms' => 10,
            ]);

        return $config;
    }
}

final class TestRpcClientManager extends RpcClientManager
{
    public int $createdClients = 0;

    public bool $keepAliveStarted = false;

    public int $keepAliveStartCount = 0;

    public function __construct(
        ContainerInterface $container,
        ConfigInterface $config,
        private readonly JsonRpcRuntimeClient $clientDouble,
    ) {
        parent::__construct($container, $config);
    }

    protected function createClient(): JsonRpcRuntimeClient
    {
        ++$this->createdClients;
        return $this->clientDouble;
    }

    protected function registerHandlers(): void
    {
    }

    protected function startKeepAliveLoop(): void
    {
        $this->keepAliveStarted = true;
        ++$this->keepAliveStartCount;
    }
}
