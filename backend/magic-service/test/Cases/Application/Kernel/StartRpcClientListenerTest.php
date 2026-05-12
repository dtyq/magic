<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Infrastructure\Rpc\Lifecycle\GoEngineBootstrapService;
use App\Infrastructure\Rpc\Listener\StartRpcClientListener;
use Hyperf\Framework\Event\OnWorkerStop;
use Hyperf\Server\Event\MainCoroutineServerStart;
use Mockery;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;
use Swoole\Server;

/**
 * @internal
 */
class StartRpcClientListenerTest extends TestCase
{
    protected function tearDown(): void
    {
        $started = new ReflectionProperty(StartRpcClientListener::class, 'started');
        $started->setAccessible(true);
        $started->setValue(null, false);

        Mockery::close();
    }

    public function testProcessBootsBootstrapServiceOnMainServerStart(): void
    {
        $bootstrapService = Mockery::mock(GoEngineBootstrapService::class);
        $bootstrapService->shouldReceive('boot')->once();

        $listener = new StartRpcClientListener($bootstrapService);
        $listener->process(new MainCoroutineServerStart('http', null, []));
        $this->addToAssertionCount(1);
    }

    public function testProcessShutsDownBootstrapServiceOnWorkerZeroStop(): void
    {
        $bootstrapService = Mockery::mock(GoEngineBootstrapService::class);
        $bootstrapService->shouldReceive('shutdown')->once();

        $listener = new StartRpcClientListener($bootstrapService);
        $workerStop = new OnWorkerStop(Mockery::mock(Server::class), 0);
        $listener->process($workerStop);
        $this->addToAssertionCount(1);
    }

    public function testProcessIgnoresNonZeroWorkerStop(): void
    {
        $bootstrapService = Mockery::mock(GoEngineBootstrapService::class);
        $bootstrapService->shouldNotReceive('shutdown');

        $listener = new StartRpcClientListener($bootstrapService);
        $listener->process(new OnWorkerStop(Mockery::mock(Server::class), 1));
        $this->addToAssertionCount(1);
    }
}
