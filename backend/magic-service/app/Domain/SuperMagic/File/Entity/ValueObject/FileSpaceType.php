<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Entity\ValueObject;

use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;

/**
 * TaskFile 所属空间类型。
 */
enum FileSpaceType: string
{
    case PROJECT = 'project';
    case USER = 'user';
    case TOPIC = 'topic';

    /**
     * 过渡期：由 space_type 推导 storage_type。
     *
     * storage_type 是历史遗留的物理存储归类字段，后续会废除，最终以 space_type 为唯一判据。
     * 在完全移除 storage_type 之前，用该映射保证两字段一致写入，兼容仍在按 storage_type 过滤的旧读取路径。
     */
    public function toStorageType(): StorageType
    {
        return match ($this) {
            self::PROJECT => StorageType::WORKSPACE,
            self::USER => StorageType::USER,
            self::TOPIC => StorageType::TOPIC,
        };
    }

    /**
     * 容忍空串/未知值，兜底为 project（对应 workspace）。
     */
    public static function resolveStorageType(string $spaceType): StorageType
    {
        return (self::tryFrom($spaceType) ?? self::PROJECT)->toStorageType();
    }
}
