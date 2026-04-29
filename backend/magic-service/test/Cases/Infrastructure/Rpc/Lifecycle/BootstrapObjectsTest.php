<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\Lifecycle;

use App\Infrastructure\Rpc\Lifecycle\BootstrapDecision;
use App\Infrastructure\Rpc\Lifecycle\BootstrapResult;
use App\Infrastructure\Rpc\Lifecycle\GoEngineProcessSpec;
use App\Infrastructure\Rpc\Lifecycle\GoEngineProcessStatus;
use App\Infrastructure\Rpc\Lifecycle\GoEngineStartHandle;
use App\Infrastructure\Rpc\Lifecycle\GoEngineStartRequest;
use App\Infrastructure\Rpc\Lifecycle\IpcBootstrapConfig;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class BootstrapObjectsTest extends TestCase
{
    public function testIpcBootstrapConfigMapsValuesAndDefaults(): void
    {
        $config = IpcBootstrapConfig::fromArray([
            'rpc_client_enabled' => true,
            'engine_auto_start' => false,
            'socket_path' => '/tmp/magic.sock',
            'engine_workdir' => '/tmp/workdir',
            'engine_executable' => 'run-go',
            'engine_start_wait_timeout_seconds' => 9,
            'engine_start_wait_interval_ms' => 25,
            'engine_supervisor_enabled' => true,
            'engine_supervisor_interval_seconds' => 3,
            'engine_supervisor_rpc_unhealthy_seconds' => 12,
            'engine_supervisor_restart_backoff_ms' => 50,
            'engine_supervisor_restart_max_backoff_ms' => 500,
            'engine_supervisor_terminate_grace_seconds' => 2,
        ]);

        $this->assertTrue($config->rpcClientEnabled);
        $this->assertFalse($config->autoStart);
        $this->assertSame('/tmp/magic.sock', $config->socketPath);
        $this->assertSame('/tmp/workdir', $config->workDir);
        $this->assertSame('CONFIG_FILE=./magic-go-engine-config.yaml run-go', $config->command);
        $this->assertSame('run-go', $config->processSpec->executable);
        $this->assertSame(9, $config->waitTimeoutSeconds);
        $this->assertSame(25, $config->waitIntervalMs);
        $this->assertTrue($config->supervisorEnabled);
        $this->assertSame(3, $config->supervisorIntervalSeconds);
        $this->assertSame(12, $config->supervisorRpcUnhealthySeconds);
        $this->assertSame(50, $config->supervisorRestartBackoffMs);
        $this->assertSame(500, $config->supervisorRestartMaxBackoffMs);
        $this->assertSame(2, $config->supervisorTerminateGraceSeconds);
        $this->assertFalse($config->shouldRunSupervisor());
    }

    public function testIpcBootstrapConfigDefaultsToStructuredProcessSpec(): void
    {
        $config = IpcBootstrapConfig::fromArray([
            'rpc_client_enabled' => true,
            'engine_auto_start' => true,
            'socket_path' => '/tmp/magic.sock',
            'engine_workdir' => '/tmp/workdir',
        ]);

        $this->assertSame('./bin/magic-go-engine', $config->processSpec->executable);
        $this->assertSame([], $config->processSpec->arguments);
        $this->assertSame('./magic-go-engine-config.yaml', $config->processSpec->environment['CONFIG_FILE']);
        $this->assertSame('CONFIG_FILE=./magic-go-engine-config.yaml ./bin/magic-go-engine', $config->command);
        $this->assertTrue($config->canStartProcess());
        $this->assertTrue($config->shouldRunSupervisor());
    }

    public function testBootstrapDecisionSemantics(): void
    {
        $request = new GoEngineStartRequest(GoEngineProcessSpec::structured(
            workDir: '/tmp/workdir',
            executable: 'run-go',
            arguments: [],
            environment: [],
            socketPath: '/tmp/magic.sock',
        ));

        $reuse = BootstrapDecision::reuseConnection();
        $this->assertFalse($reuse->shouldWaitForReady());
        $this->assertFalse($reuse->shouldStartProcess());

        $wait = BootstrapDecision::waitForExistingSocket();
        $this->assertTrue($wait->shouldWaitForReady());
        $this->assertFalse($wait->shouldStartProcess());

        $start = BootstrapDecision::startProcess($request);
        $this->assertTrue($start->shouldWaitForReady());
        $this->assertTrue($start->shouldStartProcess());
        $this->assertSame($request, $start->startRequest());
    }

    public function testBootstrapResultSemantics(): void
    {
        $ready = BootstrapResult::ready('rpc_ready');
        $this->assertTrue($ready->isReady());
        $this->assertFalse($ready->isDegraded());

        $degraded = BootstrapResult::degraded('rpc_not_ready', null, 127);
        $this->assertFalse($degraded->isReady());
        $this->assertTrue($degraded->isDegraded());
        $this->assertSame(127, $degraded->exitCode());

        $skipped = BootstrapResult::skipped('auto_start_disabled');
        $this->assertSame('skipped', $skipped->status());
    }

    public function testGoEngineStartHandleGracefullyHandlesInvalidProcess(): void
    {
        $handle = new GoEngineStartHandle(null, new GoEngineStartRequest(GoEngineProcessSpec::structured(
            workDir: '/tmp/workdir',
            executable: 'run-go',
            arguments: [],
            environment: [],
            socketPath: '/tmp/magic.sock',
        )));

        $this->assertFalse($handle->isRunning());
        $this->assertSame(-1, $handle->exitCode());
        $this->assertSame('/tmp/workdir', $handle->workDir());
        $this->assertSame('run-go', $handle->command());
        $this->assertSame('/tmp/magic.sock', $handle->socketPath());
        $this->assertNull($handle->pid());
        $this->assertSame('go', $handle->pidType());
        $this->assertSame(-1, $handle->diagnostics()->exitCode);
        $this->assertFalse($handle->diagnostics()->signaled);
        $this->assertNull($handle->diagnostics()->termSignal);
        $handle->terminate(0);
        $handle->close();
        $this->assertFalse($handle->isRunning());
    }

    public function testGoEngineProcessStatusMapsSignalFields(): void
    {
        $status = GoEngineProcessStatus::fromProcStatus([
            'running' => false,
            'pid' => 123,
            'exitcode' => -1,
            'signaled' => true,
            'termsig' => 9,
            'stopped' => true,
            'stopsig' => 19,
        ]);

        $this->assertFalse($status->running);
        $this->assertSame(123, $status->pid);
        $this->assertSame(-1, $status->exitCode);
        $this->assertTrue($status->signaled);
        $this->assertSame(9, $status->termSignal);
        $this->assertTrue($status->stopped);
        $this->assertSame(19, $status->stopSignal);
    }
}
