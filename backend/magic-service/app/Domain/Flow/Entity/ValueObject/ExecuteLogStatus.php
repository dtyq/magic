<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject;

enum ExecuteLogStatus: int
{
    // 准备运行
    case Pending = 1;

    // 运行中
    case Running = 2;

    // 完成
    case Completed = 3;

    // 失败
    case Failed = 4;

    // 取消
    case Canceled = 5;

    public function isFinished(): bool
    {
        return in_array($this, [self::Completed, self::Failed]);
    }
}
