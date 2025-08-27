<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\Constant;

use App\Domain\LongTermMemory\Entity\ValueObject\MemoryCategory;

/**
 * 记忆数量限制常量.
 * @deprecated 请使用 MemoryCategory 枚举替代
 */
class MemoryLimitConstants
{
    /**
     * 项目记忆最大启用数量.
     * @deprecated 请使用 MemoryCategory::PROJECT->getEnabledLimit()
     */
    public const PROJECT_MEMORY_ENABLED_LIMIT = 20;

    /**
     * 全局记忆（非项目记忆）最大启用数量.
     * @deprecated 请使用 MemoryCategory::GENERAL->getEnabledLimit()
     */
    public const GENERAL_MEMORY_ENABLED_LIMIT = 20;

    /**
     * 获取项目记忆启用限制.
     * @deprecated 请使用 MemoryCategory::PROJECT->getEnabledLimit()
     */
    public static function getProjectMemoryEnabledLimit(): int
    {
        return MemoryCategory::PROJECT->getEnabledLimit();
    }

    /**
     * 获取全局记忆启用限制.
     * @deprecated 请使用 MemoryCategory::GENERAL->getEnabledLimit()
     */
    public static function getGeneralMemoryEnabledLimit(): int
    {
        return MemoryCategory::GENERAL->getEnabledLimit();
    }

    /**
     * 判断是否为项目记忆.
     * @deprecated 请使用 MemoryCategory::fromProjectId()
     */
    public static function isProjectMemory(?string $projectId): bool
    {
        return MemoryCategory::fromProjectId($projectId) === MemoryCategory::PROJECT;
    }

    /**
     * 根据项目ID获取记忆分类.
     */
    public static function getCategoryByProjectId(?string $projectId): MemoryCategory
    {
        return MemoryCategory::fromProjectId($projectId);
    }

    /**
     * 根据分类获取启用限制.
     */
    public static function getEnabledLimitByCategory(MemoryCategory $category): int
    {
        return $category->getEnabledLimit();
    }
}
