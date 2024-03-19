<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\StreamMessage;

enum StreamMessageStatus: int
{
    /**
     * 开始.
     */
    case Start = 0;

    /**
     * 进行中.
     */
    case Processing = 1;

    /**
     * 已完成.
     */
    case Completed = 2;
}
