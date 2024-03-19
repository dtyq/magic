<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 工作区归档状态值对象
 */
enum WorkspaceArchiveStatus: int
{
    /**
     * 未归档.
     */
    case NotArchived = 0;

    /**
     * 已归档.
     */
    case Archived = 1;

    /**
     * 获取归档状态描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::NotArchived => '未归档',
            self::Archived => '已归档',
        };
    }

    /**
     * 获取所有归档状态列表.
     *
     * @return array<int, string> 状态值与描述的映射
     */
    public static function getList(): array
    {
        return [
            self::NotArchived->value => self::NotArchived->getDescription(),
            self::Archived->value => self::Archived->getDescription(),
        ];
    }
}
