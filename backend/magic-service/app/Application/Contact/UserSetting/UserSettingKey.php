<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\UserSetting;

enum UserSettingKey: string
{
    case None = 'none';
    case SuperMagicMCPServers = 'super_magic_mcp_servers';

    public function getValueHandler(): ?UserSettingHandlerInterface
    {
        return match ($this) {
            self::SuperMagicMCPServers => di(SuperMagicMCPServerHandler::class),
            default => null,
        };
    }
}
