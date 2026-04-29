<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Listener;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Rpc\Lifecycle\GoEngineBootstrapService;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Framework\Event\OnWorkerStop;
use Hyperf\Server\Event\MainCoroutineServerStart;
use Throwable;

/**
 * RPC 客户端生命周期监听器.
 *
 * 仅负责接收框架事件并委托基础设施启动服务处理 Go Engine 生命周期。
 */
class StartRpcClientListener implements ListenerInterface
{
    use HasLogger;

    private static bool $started = false;

    public function __construct(
        private readonly GoEngineBootstrapService $bootstrapService,
    ) {
    }

    public function listen(): array
    {
        return [
            MainCoroutineServerStart::class,
            OnWorkerStop::class,
        ];
    }

    public function process(object $event): void
    {
        if ($event instanceof OnWorkerStop) {
            $this->handleStop($event);
            return;
        }

        if ($event instanceof MainCoroutineServerStart) {
            $this->handleStart();
        }
    }

    private function handleStart(): void
    {
        if (self::$started) {
            return;
        }

        self::$started = true;

        try {
            $this->bootstrapService->boot();
        } catch (Throwable $e) {
            $this->logger->error('goEngineException Failed to bootstrap Go engine RPC', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function handleStop(OnWorkerStop $event): void
    {
        if ($event->workerId !== 0) {
            return;
        }

        $this->bootstrapService->shutdown();
        self::$started = false;
    }
}
