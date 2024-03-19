<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message;

/**
 * 从消息中获取文本内容,用于大模型历史消息记录等需要纯文本的场景.
 */
interface TextContentInterface extends MessageInterface
{
    public function getTextContent(): string;
}
