<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Driver;

use Dtyq\AsyncEvent\Kernel\Persistence\Model\AsyncEventModel;

interface ListenerAsyncDriverInterface
{
    /**
     * @param bool $immediate true 时立即派生新协程并发执行（对应 waitForSync:false），false 时延迟到当前协程结束后执行
     */
    public function publish(AsyncEventModel $asyncEventModel, object $event, callable $listener, bool $immediate = false): void;
}
