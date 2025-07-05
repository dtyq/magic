<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention;

use JsonSerializable;

/**
 * 通用 Mention 接口，所有提及对象均需实现。
 */
interface MentionInterface extends JsonSerializable
{
    /**
     * 在消息的 content 中 @了 文件/mcp/工具 等.
     */
    public function getMentionTextStruct(): string;

    /**
     * 获取 Mention 对象的 JSON 结构.
     */
    public function getMentionJsonStruct(): array;
}
