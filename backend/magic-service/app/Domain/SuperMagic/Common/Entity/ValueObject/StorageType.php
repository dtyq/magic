<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Common\Entity\ValueObject;

/**
 * 存储类型枚举.
 *
 * @deprecated 历史遗留的物理存储归类字段，与文件系统命名空间（FileSpaceType）并非一一对应，
 *             逐步废除，统一由 App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType 取代。
 *             过渡期通过 FileSpaceType::toStorageType()/resolveStorageType() 由 space_type 推导。
 */
enum StorageType: string
{
    /**
     * 工作空间存储.
     */
    case WORKSPACE = 'workspace';

    /**
     * 用户空间存储（过渡期映射值，由 space_type=user 推导）.
     */
    case USER = 'user';

    /**
     * 消息存储.
     */
    case TOPIC = 'topic';

    /**
     * @deprecated 仅用于兼容历史记录，新代码不得写入此类型
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
            self::USER => '用户',
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
            self::USER => '存储在用户空间中的文件',
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
            'user' => self::USER,
            'topic' => self::TOPIC,
            'snapshot' => self::SNAPSHOT,
            // 兜底：未知值统一转为 WORKSPACE（处理脏数据）
            default => self::WORKSPACE,
        };
    }
}
