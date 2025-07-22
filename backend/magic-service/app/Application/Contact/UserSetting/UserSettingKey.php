<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\UserSetting;

enum UserSettingKey: string
{
    case None = 'none';

    // 全局 mcp 用户配置
    case SuperMagicMCPServers = 'super_magic_mcp_servers';

    // 项目 mcp 用户配置
    case SuperMagicProjectMCPServers = 'SuperMagicProjectMCPServers';

    public static function genSuperMagicProjectMCPServers(string $projectId): string
    {
        return self::SuperMagicProjectMCPServers->value . '_' . $projectId;
    }

    public function getValueHandler(): ?UserSettingHandlerInterface
    {
        return match ($this) {
            self::SuperMagicMCPServers,self::SuperMagicProjectMCPServers => di(SuperMagicMCPServerHandler::class),
            default => null,
        };
    }

    public static function make(string $key): UserSettingKey
    {
        $userSettingKey = self::tryFrom($key);
        if ($userSettingKey) {
            return $userSettingKey;
        }

        if (str_starts_with($key, self::SuperMagicProjectMCPServers->value)) {
            return self::SuperMagicProjectMCPServers;
        }

        return self::None;
    }

    public function isValid(): bool
    {
        return $this !== self::None;
    }
}
