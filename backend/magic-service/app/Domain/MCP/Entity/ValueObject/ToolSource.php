<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject;

/**
 * 工具来源: 0:未知来源, 1:FlowTool.
 */
enum ToolSource: int
{
    // 未知来源
    case Unknown = 0;

    // FlowTool
    case FlowTool = 1;

    /**
     * 获取标签名称.
     */
    public function getLabel(): string
    {
        return match ($this) {
            self::Unknown => '未知来源',
            self::FlowTool => 'FlowTool',
        };
    }

    /**
     * 通过枚举值获取枚举对象.
     */
    public static function fromValue(int $value): ?ToolSource
    {
        foreach (self::cases() as $source) {
            if ($source->value === $value) {
                return $source;
            }
        }
        return null;
    }
}
