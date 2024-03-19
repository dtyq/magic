<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\ClassMap\SocketIoServer\Enum;

/**
 * SocketIO 连接生命周期事件枚举。
 *
 * 外部方法签名保持 string，内部统一从枚举取值，减少魔法字符串散落。
 */
enum SocketIOLifecycleEvent: string
{
    case Connect = 'connect';
    case Disconnect = 'disconnect';
}
