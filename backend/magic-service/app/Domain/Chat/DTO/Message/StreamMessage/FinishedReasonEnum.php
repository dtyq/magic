<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\StreamMessage;

/**
 * 结束原因：
 * 0:流程结束
 * 1.发生异常.
 */
enum FinishedReasonEnum: int
{
    case Finished = 0;
    case Exception = 1;
}
