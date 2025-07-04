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
    public function getMentionTextStruct(): string;
}
