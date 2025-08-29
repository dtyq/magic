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

    // 项目话题模型配置
    case SuperMagicProjectTopicModel = 'SuperMagicProjectTopicModel';

    // 用户当前组织
    case CurrentOrganization = 'CurrentOrganization';

    // 全局配置
    case GlobalConfig = 'GlobalConfig';

    // 智能体排序配置
    case SuperMagicAgentSort = 'SuperMagicAgentSort';

    public static function genSuperMagicProjectMCPServers(string $projectId): string
    {
        return self::SuperMagicProjectMCPServers->value . '_' . $projectId;
    }

    public static function genSuperMagicProjectTopicModel(string $topicId): string
    {
        return self::SuperMagicProjectTopicModel->value . '_' . $topicId;
    }

    public function getValueHandler(): ?UserSettingHandlerInterface
    {
        return match ($this) {
            self::SuperMagicMCPServers,self::SuperMagicProjectMCPServers => di(SuperMagicMCPServerHandler::class),
            self::SuperMagicProjectTopicModel => di(SuperMagicModelConfigHandler::class),
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

        if (str_starts_with($key, self::SuperMagicProjectTopicModel->value)) {
            return self::SuperMagicProjectTopicModel;
        }

        return self::None;
    }

    public function isValid(): bool
    {
        return $this !== self::None;
    }
}
