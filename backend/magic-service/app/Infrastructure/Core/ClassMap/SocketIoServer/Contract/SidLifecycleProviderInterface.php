<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\ClassMap\SocketIoServer\Contract;

/**
 * 连接生命周期相关的 sid 分配与回收能力。
 *
 * 与 SidProviderInterface 的“sid 查询能力”分离，避免把查询与创建耦合在一起。
 */
interface SidLifecycleProviderInterface
{
    /**
     * 连接建立时分配 sid。
     */
    public function registerConnection(int $fd): string;

    /**
     * 连接关闭时回收 sid。
     */
    public function unregisterConnection(int $fd): void;
}
