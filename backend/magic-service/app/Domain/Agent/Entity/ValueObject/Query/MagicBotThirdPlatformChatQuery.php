<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Entity\ValueObject\Query;

use App\Infrastructure\Core\ValueObject\Query;

class MagicBotThirdPlatformChatQuery extends Query
{
    private ?string $botId = null;

    public function getBotId(): ?string
    {
        return $this->botId;
    }

    public function setBotId(?string $botId): void
    {
        $this->botId = $botId;
    }
}
