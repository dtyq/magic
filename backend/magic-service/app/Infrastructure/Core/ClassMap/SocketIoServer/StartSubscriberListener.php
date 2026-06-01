<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\SocketIOServer\Listener;

use Hyperf\Contract\ConfigInterface;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Framework\Event\AfterWorkerStart;
use Hyperf\Server\Event\MainCoroutineServerStart;
use Hyperf\Server\ServerInterface;
use Hyperf\SocketIOServer\Collector\SocketIORouter;
use Hyperf\SocketIOServer\Room\EphemeralInterface;
use Hyperf\SocketIOServer\Room\RedisAdapter;
use Psr\Container\ContainerInterface;

class StartSubscriberListener implements ListenerInterface
{
    public function __construct(
        private ContainerInterface $container,
        private ConfigInterface $config
    ) {
    }

    public function listen(): array
    {
        return [
            AfterWorkerStart::class,
            MainCoroutineServerStart::class,
        ];
    }

    public function process(object $event): void
    {
        if ($event instanceof AfterWorkerStart && $event->server->taskworker) {
            return;
        }
        if (! $this->hasWebSocketServer()) {
            return;
        }

        // v2 adapter 没有走高频 pub/sub 扇出，但每个 worker 仍要启动自己的
        // node queue consumer 与心跳/对账/清理协程，保证跨节点消息只落到本进程的本地索引。
        foreach (SocketIORouter::get('forward') ?? [] as $class) {
            $instance = $this->container->get($class);
            $adapter = $instance->getAdapter();
            if ($adapter instanceof RedisAdapter) {
                $adapter->subscribe();
            }
            if ($adapter instanceof EphemeralInterface) {
                $adapter->cleanUpExpired();
            }
        }
    }

    private function hasWebSocketServer(): bool
    {
        foreach ($this->config->get('server.servers', []) as $server) {
            if (($server['type'] ?? null) === ServerInterface::SERVER_WEBSOCKET) {
                return true;
            }
        }
        return false;
    }
}
