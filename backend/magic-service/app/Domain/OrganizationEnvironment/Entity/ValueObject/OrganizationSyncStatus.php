<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Entity\ValueObject;

/**
 * 组织同步状态.
 */
enum OrganizationSyncStatus: int
{
    /* 未同步 */
    case NotSynced = 0;

    /* 已同步 */
    case Synced = 1;

    /* 同步失败 */
    case SyncFailed = 2;

    /* 同步中 */
    case Syncing = 3;

    /**
     * 是否需要补偿。
     * 与知识库状态保持一致的补偿集合。
     */
    public static function needCompensate(): array
    {
        return [
            self::NotSynced,
            self::Syncing,
            self::SyncFailed,
        ];
    }
}
