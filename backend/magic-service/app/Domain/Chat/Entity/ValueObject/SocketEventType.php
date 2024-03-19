<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

/**
 * 事件类型.
 */
enum SocketEventType: string
{
    // connect
    case Connect = 'connect';

    // login. 以后登录可以投一条控制消息,来实现上线通知等逻辑
    case Login = 'login';

    // 聊天消息
    case Chat = 'chat';

    // 控制消息
    case Control = 'control';

    // 流式消息
    case Stream = 'stream';

    /**
     * 实时性极高的过渡消息，没有 seq_id，不会被持久化，也不会被缓存。
     */
    case Intermediate = 'intermediate';
}
