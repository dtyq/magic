<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\DTO\Message\Trait\EditMessageOptionsTrait;

abstract class AbstractChatMessageStruct extends MagicMessageStruct
{
    use EditMessageOptionsTrait;
}
