<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Constants;

class Status
{
    /**
     * 待执行.
     */
    public const STATE_WAIT = 0;

    /**
     * 执行中.
     */
    public const STATE_IN_EXECUTION = 1;

    /**
     * 执行成功
     */
    public const STATE_COMPLETE = 2;

    /**
     * 超出重试次数.
     */
    public const STATE_EXCEEDED = 3;
}
