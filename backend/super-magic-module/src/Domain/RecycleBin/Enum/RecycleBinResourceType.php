<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\RecycleBin\Enum;

/**
 * 回收站资源类型枚举.
 */
enum RecycleBinResourceType: int
{
    case Workspace = 1;  // 工作区
    case Project = 2;    // 项目
    case Topic = 3;      // 话题
    case File = 4;       // 文件(预留，第二期启用)

    /**
     * 获取资源类型名称.
     */
    public function getName(): string
    {
        return match ($this) {
            self::Workspace => 'workspace',
            self::Project => 'project',
            self::Topic => 'topic',
            self::File => 'file',
        };
    }

    /**
     * 获取资源类型中文名称.
     */
    public function getLabel(): string
    {
        return match ($this) {
            self::Workspace => '工作区',
            self::Project => '项目',
            self::Topic => '话题',
            self::File => '文件',
        };
    }

    /**
     * 从整数值创建枚举.
     */
    public static function fromValue(int $value): ?self
    {
        return match ($value) {
            1 => self::Workspace,
            2 => self::Project,
            3 => self::Topic,
            4 => self::File,
            default => null,
        };
    }
}
