<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

use InvalidArgumentException;

/**
 * 存储类型枚举.
 */
enum StorageType: string
{
    /**
     * 工作空间存储.
     */
    case WORKSPACE = 'workspace';

    /**
     * 消息存储.
     */
    case MESSAGE = 'message';

    /**
     * 获取存储类型名称.
     */
    public function getName(): string
    {
        return match ($this) {
            self::WORKSPACE => '工作空间',
            self::MESSAGE => '消息',
        };
    }

    /**
     * 获取存储类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::WORKSPACE => '存储在工作空间中的文件',
            self::MESSAGE => '存储在消息中的文件',
        };
    }

    /**
     * 从字符串创建枚举实例.
     */
    public static function fromValue(string $value): self
    {
        return match ($value) {
            'workspace' => self::WORKSPACE,
            'message' => self::MESSAGE,
            // 兜底：未知值统一转为 WORKSPACE（处理脏数据）
            default => self::WORKSPACE,
        };
    }

    /**
     * 获取所有可用的存储类型选项.
     */
    public static function getAllOptions(): array
    {
        return [
            self::WORKSPACE->value => self::WORKSPACE->getName(),
            self::MESSAGE->value => self::MESSAGE->getName(),
        ];
    }

    /**
     * 判断是否为有效的存储类型值
     */
    public static function isValid(string $value): bool
    {
        try {
            self::fromValue($value);
            return true;
        } catch (InvalidArgumentException) {
            return false;
        }
    }
}
