<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\Engine;

use Hyperf\Engine\Http\Server as HttpServer;
use Swow\Socket;

/**
 * 兼容 Swow alpha.3 的协程服务类型判断。
 *
 * 基于 hyperf/engine-swow 2.15.2，保留 Socket 判断并识别组合 Socket 的 HTTP 服务。
 * 上游支持新服务类型后应移除此覆盖。
 */
class Constant
{
    public const ENGINE = 'Swow';

    /**
     * 判断是否为 Swow 协程服务，兼容 HTTP、WebSocket 和 TCP 服务。
     * @param mixed $server
     */
    public static function isCoroutineServer($server): bool
    {
        return $server instanceof Socket || $server instanceof HttpServer;
    }
}
