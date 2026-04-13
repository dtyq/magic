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
     * @param string $driver      指定驱动，支持 coroutine、queue_amqp，为空时使用全局配置
     * @param bool   $waitForSync 是否等待同步监听执行完毕后再投递，默认 true；设为 false 时优先于同步监听投递
     */
    public function __construct(
        public string $driver = '',
        public bool $waitForSync = true,
    ) {}
}
