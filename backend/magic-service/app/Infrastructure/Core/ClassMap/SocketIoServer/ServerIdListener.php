<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\SocketIOServer\Listener;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Framework\Event\BeforeMainServerStart;
use Hyperf\Server\Event\MainCoroutineServerStart;
use Hyperf\SocketIOServer\Atomic;
use Hyperf\SocketIOServer\SocketIO;

class ServerIdListener implements ListenerInterface
{
    public function listen(): array
    {
        return [
            BeforeMainServerStart::class,
            MainCoroutineServerStart::class,
        ];
    }

    public function process(object $event): void
    {
        // 进程级 serverId，用于生成连接级 sid 前缀。
        SocketIO::$serverId = (string) IdGenerator::getSnowId();
        // 保持回调消息序列可用（Future::channel 等场景）。
        SocketIO::$messageId = new Atomic();
    }
}
