<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\Engine\Http;

use Swow\Psr7\Server\ServerConnection;

/** 通过稳定的连接身份关联握手、消息及关闭事件。 */
class FdGetter
{
    /** 获取连接身份，避免依赖可失效或复用的系统文件描述符。 */
    public function get(ServerConnection $response): int
    {
        // Hyperf 用此编号关联握手、收发和关闭；系统 fd 会失效或复用，不能作为连接身份。
        return $response->getId();
    }
}
