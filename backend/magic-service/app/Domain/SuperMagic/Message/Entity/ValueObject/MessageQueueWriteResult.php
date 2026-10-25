<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Message\Entity\ValueObject;

use App\Domain\SuperMagic\Message\Entity\MessageQueueEntity;

// 重试返回已受理记录，但不能再次通知创建或触发下一条消费。
final readonly class MessageQueueWriteResult
{
    public function __construct(public MessageQueueEntity $message, public bool $changed)
    {
    }
}
