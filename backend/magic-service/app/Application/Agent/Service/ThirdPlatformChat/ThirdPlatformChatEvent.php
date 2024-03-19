<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat;

enum ThirdPlatformChatEvent
{
    case None;
    case ChatMessage;
    case CheckServer;
}
