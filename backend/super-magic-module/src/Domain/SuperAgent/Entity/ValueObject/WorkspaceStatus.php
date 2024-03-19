<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 工作区状态值对象
 */
enum WorkspaceStatus: int
{
    /**
     * 正常状态
     */
    case Normal = 0;

    /**
     * 禁用状态
     */
    case Disabled = 1;

    /**
     * 删除状态
     */
    case Deleted = 2;

    /**
     * 获取状态描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::Normal => '正常',
            self::Disabled => '禁用',
            self::Deleted => '已删除',
        };
    }

    /**
     * 获取所有状态列表.
     *
     * @return array<int, string> 状态值与描述的映射
     */
    public static function getList(): array
    {
        return [
            self::Normal->value => self::Normal->getDescription(),
            self::Disabled->value => self::Disabled->getDescription(),
            self::Deleted->value => self::Deleted->getDescription(),
        ];
    }
}
