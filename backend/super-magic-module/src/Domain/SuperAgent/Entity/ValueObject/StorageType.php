<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

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
    case TOPIC = 'topic';

    /**
     * 快照存储.
     */
    case SNAPSHOT = 'snapshot';

    case OBJECT_STORAGE = 'object_storage';
    case OTHERS = '';

    /**
     * 获取存储类型名称.
     */
    public function getName(): string
    {
        return match ($this) {
            self::WORKSPACE => '工作空间',
            self::TOPIC => '话题',
            self::SNAPSHOT => '快照',
            self::OBJECT_STORAGE => '对象存储',
            self::OTHERS => '其他',
        };
    }

    /**
     * 获取存储类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::WORKSPACE => '存储在工作空间中的文件',
            self::TOPIC => '存储在消息中的文件',
            self::SNAPSHOT => '存储在快照中的文件',
            self::OBJECT_STORAGE => '存储在对象存储中的文件',
            self::OTHERS => '其他存储方式',
        };
    }

    /**
     * 从字符串创建枚举实例.
     */
    public static function fromValue(string $value): self
    {
        return match ($value) {
            'workspace' => self::WORKSPACE,
            'topic' => self::TOPIC,
            'snapshot' => self::SNAPSHOT,
            // 兜底：未知值统一转为 WORKSPACE（处理脏数据）
            default => self::OTHERS,
        };
    }
}
