<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\Entity\ValueObject;

/**
 * 记忆分类枚举.
 */
enum MemoryCategory: string
{
    /**
     * 项目记忆 - 与特定项目相关的记忆.
     */
    case PROJECT = 'project';

    /**
     * 全局记忆 - 不特定于某个项目的记忆.
     */
    case GENERAL = 'general';

    /**
     * 获取分类的中文名称.
     */
    public function getDisplayName(): string
    {
        return match ($this) {
            self::PROJECT => '项目记忆',
            self::GENERAL => '全局记忆',
        };
    }

    /**
     * 根据项目ID判断记忆分类.
     */
    public static function fromProjectId(?string $projectId): self
    {
        return empty($projectId) ? self::GENERAL : self::PROJECT;
    }

    /**
     * 获取该分类的启用数量限制.
     */
    public function getEnabledLimit(): int
    {
        return match ($this) {
            self::PROJECT => 20,
            self::GENERAL => 20,
        };
    }
}
