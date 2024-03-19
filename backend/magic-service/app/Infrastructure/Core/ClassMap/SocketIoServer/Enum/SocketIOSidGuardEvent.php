<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\ClassMap\SocketIoServer\Enum;

/**
 * SocketIO sidGuard 日志事件枚举。
 *
 * 用于统一 sid 生命周期相关异常日志事件名，避免字符串散落。
 */
enum SocketIOSidGuardEvent: string
{
    case ConnSeqOverflow = 'connSeqOverflow';
    case SidAssignFailed = 'sidAssignFailed';
    case SidOpenRollbackFailed = 'sidOpenRollbackFailed';
}
