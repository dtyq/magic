<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\Lifecycle;

use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use App\Infrastructure\Rpc\Lifecycle\GoEngineProcessSpec;
use App\Infrastructure\Rpc\Lifecycle\GoEngineProcessStarter;
use App\Infrastructure\Rpc\Lifecycle\GoEngineStartHandle;
use App\Infrastructure\Rpc\Lifecycle\GoEngineStartRequest;
use App\Infrastructure\Rpc\Lifecycle\GoEngineSupervisor;
use App\Infrastructure\Rpc\Lifecycle\GoEngineSupervisorReason;
use App\Infrastructure\Rpc\Lifecycle\IpcBootstrapConfig;
use Mockery;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * @internal
 */
class GoEngineSupervisorTest extends TestCase
{
    /** @var string[] */
    private array $pathsToDelete = [];

    protected function tearDown(): void
    {
        foreach ($this->pathsToDelete as $path) {
            @unlink($path);
        }
        $this->pathsToDelete = [];

        Mockery::close();
    }

    public function testStartIsIdempotent(): void
    {
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('isConnected')->once()->andReturn(true);
        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldNotReceive('start');
        $supervisor = $this->createSupervisor($manager, $starter);

        $config = $this->createConfig();

        $supervisor->start($config);
        $supervisor->start($config);

        $this->assertSame(1, $supervisor->loopStartCount);
        $this->assertTrue($supervisor->snapshot()->running);
    }

    public function testExitedHandleTriggersRestart(): void
    {
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('isConnected')->andReturn(false);
        $manager->shouldReceive('stop')->once();
        $manager->shouldReceive('start')->once()->with(true);
        $manager->shouldReceive('waitUntilConnected')->once()->with(1, 10)->andReturn(true);
        $manager->shouldNotReceive('probeConnection');

        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldReceive('start')->once()->andReturn(new FakeGoEngineStartHandle(true, -1, 456));

        $oldHandle = new FakeGoEngineStartHandle(false, 127, 123);
        $supervisor = $this->createSupervisor($manager, $starter);
        $supervisor->start($this->createConfig(), $oldHandle);
        $supervisor->inspectAndRecover();

        $snapshot = $supervisor->snapshot();
        $this->assertSame(1, $snapshot->restartCount);
        $this->assertSame(GoEngineSupervisorReason::ProcessExited, $snapshot->lastRestartReason);
        $this->assertSame(127, $snapshot->lastExitCode);
        $this->assertSame(0, $snapshot->currentBackoffMs);
    }

    public function testShortRpcDisconnectDoesNotRestartBeforeThreshold(): void
    {
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('isConnected')->andReturn(false);
        $manager->shouldNotReceive('probeConnection');
        $manager->shouldNotReceive('stop');

        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldNotReceive('start');

        $handle = new FakeGoEngineStartHandle(true);
        $supervisor = $this->createSupervisor($manager, $starter, 100.0);
        $supervisor->start($this->createConfig(['engine_supervisor_rpc_unhealthy_seconds' => 30]), $handle);
        $supervisor->now = 110.0;
        $supervisor->inspectAndRecover();

        $this->assertSame(0, $supervisor->snapshot()->restartCount);
        $this->assertFalse($handle->terminated);
    }

    public function testRpcUnhealthyTimeoutRestartsRunningHandle(): void
    {
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('isConnected')->andReturn(false);
        $manager->shouldReceive('probeConnection')->once()->andReturn(false);
        $manager->shouldReceive('stop')->once();
        $manager->shouldReceive('start')->once()->with(true);
        $manager->shouldReceive('waitUntilConnected')->once()->with(1, 10)->andReturn(true);

        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldReceive('start')->once()->andReturn(new FakeGoEngineStartHandle(true));

        $handle = new FakeGoEngineStartHandle(true);
        $supervisor = $this->createSupervisor($manager, $starter, 100.0);
        $supervisor->start($this->createConfig(['engine_supervisor_rpc_unhealthy_seconds' => 30]), $handle);
        $supervisor->now = 131.0;
        $supervisor->inspectAndRecover();

        $this->assertTrue($handle->terminated);
        $this->assertSame(
            GoEngineSupervisorReason::RpcUnhealthyTimeout,
            $supervisor->snapshot()->lastRestartReason
        );
    }

    public function testStaleSocketIsRemovedBeforeRestart(): void
    {
        $socketPath = sys_get_temp_dir() . '/magic-supervisor-stale-' . uniqid('', true) . '.sock';
        file_put_contents($socketPath, 'stale');
        $this->pathsToDelete[] = $socketPath;

        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('isConnected')->andReturn(false);
        $manager->shouldReceive('probeConnection')->once()->andReturn(false);
        $manager->shouldReceive('stop')->once();
        $manager->shouldReceive('start')->once()->with(true);
        $manager->shouldReceive('waitUntilConnected')->once()->with(1, 10)->andReturn(true);

        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldReceive('start')->once()->andReturn(new FakeGoEngineStartHandle(true));

        $supervisor = $this->createSupervisor($manager, $starter);
        $supervisor->start($this->createConfig(['socket_path' => $socketPath]));
        $supervisor->inspectAndRecover();

        $this->assertFileDoesNotExist($socketPath);
        $this->assertSame(
            GoEngineSupervisorReason::NoHealthyRpcConnection,
            $supervisor->snapshot()->lastRestartReason
        );
    }

    public function testAutoStartDisabledDoesNotStartSupervisor(): void
    {
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldNotReceive('isConnected');
        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldNotReceive('start');
        $supervisor = $this->createSupervisor($manager, $starter);

        $supervisor->start($this->createConfig(['engine_auto_start' => false]));
        $supervisor->inspectAndRecover();

        $snapshot = $supervisor->snapshot();
        $this->assertFalse($snapshot->enabled);
        $this->assertFalse($snapshot->running);
        $this->assertSame(0, $supervisor->loopStartCount);
    }

    public function testStopTerminatesManagedProcessAndDoesNotRestart(): void
    {
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('isConnected')->once()->andReturn(false);
        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldNotReceive('start');

        $handle = new FakeGoEngineStartHandle(true);
        $supervisor = $this->createSupervisor($manager, $starter);
        $supervisor->start($this->createConfig(), $handle);
        $supervisor->stop();
        $supervisor->inspectAndRecover();

        $this->assertTrue($handle->terminated);
        $this->assertFalse($supervisor->snapshot()->running);
    }

    public function testRestartFailureAppliesBackoffUpToMax(): void
    {
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('isConnected')->andReturn(false);
        $manager->shouldReceive('probeConnection')->andReturn(false);
        $manager->shouldReceive('stop')->twice();
        $manager->shouldNotReceive('start');

        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldReceive('start')->twice()->andReturn(null);

        $supervisor = $this->createSupervisor($manager, $starter, 100.0);
        $supervisor->start($this->createConfig([
            'engine_supervisor_restart_backoff_ms' => 1000,
            'engine_supervisor_restart_max_backoff_ms' => 1500,
        ]));

        $supervisor->inspectAndRecover();
        $this->assertSame(1000, $supervisor->snapshot()->currentBackoffMs);

        $supervisor->now = 101.1;
        $supervisor->inspectAndRecover();
        $this->assertSame(1500, $supervisor->snapshot()->currentBackoffMs);
    }

    private function createSupervisor(
        RpcClientManager $manager,
        GoEngineProcessStarter $starter,
        float $now = 1000.0,
    ): TestGoEngineSupervisor {
        $supervisor = new TestGoEngineSupervisor($manager, $starter, $now);
        $supervisor->logger = new NullLogger();

        return $supervisor;
    }

    private function createConfig(array $overrides = []): IpcBootstrapConfig
    {
        return IpcBootstrapConfig::fromArray(array_merge([
            'rpc_client_enabled' => true,
            'engine_auto_start' => true,
            'socket_path' => '',
            'engine_workdir' => BASE_PATH,
            'engine_executable' => 'run-go',
            'engine_start_wait_timeout_seconds' => 1,
            'engine_start_wait_interval_ms' => 10,
            'engine_supervisor_enabled' => true,
            'engine_supervisor_interval_seconds' => 1,
            'engine_supervisor_rpc_unhealthy_seconds' => 30,
            'engine_supervisor_restart_backoff_ms' => 1000,
            'engine_supervisor_restart_max_backoff_ms' => 30000,
            'engine_supervisor_terminate_grace_seconds' => 0,
        ], $overrides));
    }
}

final class TestGoEngineSupervisor extends GoEngineSupervisor
{
    public int $loopStartCount = 0;

    public function __construct(
        RpcClientManager $rpcClientManager,
        GoEngineProcessStarter $processStarter,
        public float $now,
    ) {
        parent::__construct($rpcClientManager, $processStarter);
    }

    protected function startLoop(): void
    {
        ++$this->loopStartCount;
    }

    protected function now(): float
    {
        return $this->now;
    }
}

final class FakeGoEngineStartHandle extends GoEngineStartHandle
{
    public bool $terminated = false;

    public bool $closed = false;

    public function __construct(
        private bool $running = true,
        private int $exitCode = -1,
        private ?int $pid = 123,
    ) {
        parent::__construct(null, new GoEngineStartRequest(GoEngineProcessSpec::structured(
            workDir: BASE_PATH,
            executable: 'run-go',
            arguments: [],
            environment: [],
            socketPath: '',
        )));
    }

    public function pid(): ?int
    {
        return $this->pid;
    }

    public function isRunning(): bool
    {
        return $this->running;
    }

    public function exitCode(): int
    {
        return $this->exitCode;
    }

    public function terminate(int $graceSeconds): void
    {
        $this->terminated = true;
        $this->running = false;
        $this->closed = true;
    }

    public function close(): void
    {
        $this->closed = true;
    }
}
