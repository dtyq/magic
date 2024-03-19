<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\ExecutionData;

enum FlowStreamStatus: string
{
    // 未开始
    case Pending = 'Pending';

    // 进行中
    case Processing = 'Processing';

    // 结束
    case Finished = 'Finished';

    public function isPending(): bool
    {
        return $this == self::Pending;
    }
}
