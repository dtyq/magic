<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Annotation;

use Attribute;
use Hyperf\Di\Annotation\AbstractAnnotation;

#[Attribute(Attribute::TARGET_CLASS)]
class AsyncListener extends AbstractAnnotation
{
    /**
     * 指定该 listener 使用的驱动，支持 coroutine、queue_amqp。
     * 为空时使用全局配置 async_event.listener_exec_driver。
     */
    public function __construct(
        public string $driver = '',
    ) {}
}
