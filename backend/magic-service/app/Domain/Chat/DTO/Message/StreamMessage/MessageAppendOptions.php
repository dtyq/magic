<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\StreamMessage;

/**
 * 消息应用选项：0:覆盖 1：追加（字符串拼接，数组在末尾插入）.
 */
enum MessageAppendOptions: int
{
    case Overwrite = 0;
    case Append = 1;
}
