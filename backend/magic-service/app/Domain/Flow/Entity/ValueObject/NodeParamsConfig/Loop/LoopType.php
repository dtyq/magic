<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Loop;

enum LoopType: string
{
    // 计数
    case Count = 'count';

    // 遍历数组
    case Array = 'array';

    // 条件比较
    case Condition = 'condition';
}
