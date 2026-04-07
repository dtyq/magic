<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject;

/**
 * Skill 来源类型枚举.
 */
enum SkillSourceType: string
{
    /**
     * 本地上传（自动跟随最新版本）.
     */
    case LOCAL_UPLOAD = 'LOCAL_UPLOAD';

    /**
     * 员工入口导入.
     */
    case CREW_IMPORT = 'CREW_IMPORT';

    case MARKET = 'MARKET';

    /**
     * 对话创建.
     */
    case DIALOGUE_CREATION = 'DIALOGUE_CREATION';

    /**
     * GitHub 导入.
     */
    case GITHUB = 'GITHUB';

    /**
     * Agent 创建.
     */
    case AGENT_CREATED = 'AGENT_CREATED';

    /**
     * Agent 第三方导入.
     */
    case AGENT_THIRD_PARTY_IMPORT = 'AGENT_THIRD_PARTY_IMPORT';

    /**
     * 系统内置.
     */
    case SYSTEM = 'SYSTEM';

    /**
     * 获取来源类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::LOCAL_UPLOAD => '本地上传',
            self::MARKET => '商店添加',
            self::GITHUB => 'GitHub 导入',
            self::AGENT_CREATED => 'Agent 创建',
            self::AGENT_THIRD_PARTY_IMPORT => 'Agent 第三方导入',
            self::DIALOGUE_CREATION => '对话创建',
            self::CREW_IMPORT => '员工入口导入',
            self::SYSTEM => '系统内置',
        };
    }

    /**
     * 是否为本地上传.
     */
    public function isLocalUpload(): bool
    {
        return $this === self::LOCAL_UPLOAD;
    }

    /**
     * 是否为商店添加.
     */
    public function isMarket(): bool
    {
        return $this === self::MARKET;
    }

    /**
     * 是否为 GitHub 导入.
     */
    public function isGithub(): bool
    {
        return $this === self::GITHUB;
    }

    /**
     * 是否为 Agent 创建.
     */
    public function isAgentCreated(): bool
    {
        return $this === self::AGENT_CREATED;
    }

    public function isDialogueCreation(): bool
    {
        return $this === self::DIALOGUE_CREATION;
    }

    /**
     * 是否为 Agent 第三方导入.
     */
    public function isAgentThirdPartyImport(): bool
    {
        return $this === self::AGENT_THIRD_PARTY_IMPORT;
    }

    /**
     * 是否为系统内置.
     */
    public function isSystem(): bool
    {
        return $this === self::SYSTEM;
    }

    /**
     * 从值创建枚举.
     */
    public static function fromValue(?string $value): ?self
    {
        if ($value === null) {
            return null;
        }

        return self::tryFrom($value);
    }

    /**
     * 获取所有来源类型值.
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
