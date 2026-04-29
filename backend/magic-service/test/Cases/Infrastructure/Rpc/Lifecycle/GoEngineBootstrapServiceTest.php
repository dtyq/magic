<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\Lifecycle;

use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use App\Infrastructure\Rpc\Lifecycle\GoEngineBootstrapService;
use App\Infrastructure\Rpc\Lifecycle\GoEngineProcessDiagnostics;
use App\Infrastructure\Rpc\Lifecycle\GoEngineProcessStarter;
use App\Infrastructure\Rpc\Lifecycle\GoEngineStartHandle;
use App\Infrastructure\Rpc\Lifecycle\GoEngineSupervisor;
use App\Infrastructure\Rpc\Lifecycle\IpcBootstrapConfig;
use Hyperf\Contract\ConfigInterface;
use Mockery;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class GoEngineBootstrapServiceTest extends TestCase
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

    public function testBootReusesExistingRpcConnectionWithoutStartingProcess(): void
    {
        $config = $this->createConfig([
            'engine_auto_start' => true,
            'socket_path' => BASE_PATH . '/runtime/magic_engine.sock',
        ]);
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('probeConnection')->once()->andReturn(true);
        $manager->shouldReceive('start')->once()->with(true);
        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldNotReceive('start');
        $supervisor = Mockery::mock(GoEngineSupervisor::class);
        $supervisor->shouldReceive('start')->once()->with(Mockery::type(IpcBootstrapConfig::class), null);

        $service = new GoEngineBootstrapService($config, $manager, $starter, $supervisor);
        $service->boot();
        $this->addToAssertionCount(1);
    }

    public function testBootStartsGoEngineAndWaitsForRpcReady(): void
    {
        $socketPath = sys_get_temp_dir() . '/magic-go-engine-bootstrap-start-' . uniqid('', true) . '.sock';
        @unlink($socketPath);

        $config = $this->createConfig([
            'engine_auto_start' => true,
            'socket_path' => $socketPath,
            'engine_workdir' => BASE_PATH,
            'engine_start_wait_timeout_seconds' => 1,
            'engine_start_wait_interval_ms' => 10,
        ]);
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('probeConnection')->once()->andReturn(false);
        $manager->shouldReceive('start')->once()->with(true);
        $manager->shouldReceive('isConnected')->times(2)->andReturn(false, true);

        $handle = Mockery::mock(GoEngineStartHandle::class);
        $handle->shouldReceive('command')->once()->andReturn('CONFIG_FILE=./magic-go-engine-config.yaml ./bin/magic-go-engine');
        $handle->shouldReceive('workDir')->once()->andReturn(BASE_PATH);
        $handle->shouldReceive('socketPath')->once()->andReturn($socketPath);
        $handle->shouldReceive('isRunning')->once()->andReturn(true);
        $handle->shouldReceive('diagnostics')->once()->andReturn($this->createDiagnostics($socketPath));

        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldReceive('start')->once()->andReturn($handle);
        $supervisor = Mockery::mock(GoEngineSupervisor::class);
        $supervisor->shouldReceive('start')->once()->with(Mockery::type(IpcBootstrapConfig::class), $handle);

        $service = new GoEngineBootstrapService($config, $manager, $starter, $supervisor);
        $service->boot();
        $this->addToAssertionCount(1);
    }

    public function testBootDoesNotStartSecondProcessWhenSocketAlreadyExists(): void
    {
        $socketPath = $this->createTempSocketPath();

        $config = $this->createConfig([
            'engine_auto_start' => true,
            'socket_path' => $socketPath,
            'engine_workdir' => BASE_PATH,
            'engine_start_wait_timeout_seconds' => 1,
            'engine_start_wait_interval_ms' => 10,
        ]);
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('probeConnection')->once()->andReturn(false);
        $manager->shouldReceive('start')->once()->with(true);
        $manager->shouldReceive('waitUntilConnected')->once()->with(1, 10)->andReturn(true);

        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldNotReceive('start');
        $supervisor = Mockery::mock(GoEngineSupervisor::class);
        $supervisor->shouldReceive('start')->once()->with(Mockery::type(IpcBootstrapConfig::class), null);

        $service = new GoEngineBootstrapService($config, $manager, $starter, $supervisor);
        $service->boot();
        $this->addToAssertionCount(1);
    }

    public function testBootStopsWaitingWhenProcessExitsEarly(): void
    {
        $socketPath = sys_get_temp_dir() . '/magic-go-engine-bootstrap-exit-' . uniqid('', true) . '.sock';
        @unlink($socketPath);

        $config = $this->createConfig([
            'engine_auto_start' => true,
            'socket_path' => $socketPath,
            'engine_workdir' => BASE_PATH,
            'engine_executable' => 'exit',
            'engine_arguments' => ['127'],
            'engine_start_wait_timeout_seconds' => 1,
            'engine_start_wait_interval_ms' => 10,
        ]);
        $manager = Mockery::mock(RpcClientManager::class);
        $manager->shouldReceive('probeConnection')->once()->andReturn(false);
        $manager->shouldReceive('start')->once()->with(true);
        $manager->shouldReceive('isConnected')->once()->andReturn(false);

        $handle = Mockery::mock(GoEngineStartHandle::class);
        $handle->shouldReceive('command')->times(2)->andReturn('exit 127');
        $handle->shouldReceive('workDir')->times(2)->andReturn(BASE_PATH);
        $handle->shouldReceive('socketPath')->once()->andReturn($socketPath);
        $handle->shouldReceive('isRunning')->once()->andReturn(false);
        $handle->shouldReceive('exitCode')->once()->andReturn(127);
        $handle->shouldReceive('diagnostics')->times(3)->andReturn($this->createDiagnostics($socketPath, 127));

        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $starter->shouldReceive('start')->once()->andReturn($handle);
        $supervisor = Mockery::mock(GoEngineSupervisor::class);
        $supervisor->shouldReceive('start')->once()->with(Mockery::type(IpcBootstrapConfig::class), $handle);

        $service = new GoEngineBootstrapService($config, $manager, $starter, $supervisor);
        $service->boot();
        $this->addToAssertionCount(1);
    }

    public function testShutdownStopsSupervisorBeforeRpcClient(): void
    {
        $config = Mockery::mock(ConfigInterface::class);
        $manager = Mockery::mock(RpcClientManager::class);
        $starter = Mockery::mock(GoEngineProcessStarter::class);
        $supervisor = Mockery::mock(GoEngineSupervisor::class);
        $supervisor->shouldReceive('stop')->once()->ordered();
        $manager->shouldReceive('stop')->once()->ordered();

        $service = new GoEngineBootstrapService($config, $manager, $starter, $supervisor);
        $service->shutdown();
        $this->addToAssertionCount(1);
    }

    private function createConfig(array $ipc): ConfigInterface
    {
        $config = Mockery::mock(ConfigInterface::class);
        $config->shouldReceive('get')
            ->once()
            ->with('ipc', [])
            ->andReturn($ipc);

        return $config;
    }

    private function createTempSocketPath(): string
    {
        $path = sys_get_temp_dir() . '/magic-go-engine-bootstrap-' . uniqid('', true) . '.sock';
        file_put_contents($path, '');
        $this->pathsToDelete[] = $path;

        return $path;
    }

    private function createDiagnostics(string $socketPath, int $exitCode = -1): GoEngineProcessDiagnostics
    {
        return new GoEngineProcessDiagnostics(
            pidType: 'go',
            pid: 123,
            childPids: [],
            running: $exitCode < 0,
            exitCode: $exitCode,
            signaled: false,
            termSignal: null,
            stopped: false,
            stopSignal: null,
            startedAt: 1000.0,
            uptimeSeconds: 1.0,
            command: './bin/magic-go-engine',
            workDir: BASE_PATH,
            socketPath: $socketPath,
        );
    }
}
