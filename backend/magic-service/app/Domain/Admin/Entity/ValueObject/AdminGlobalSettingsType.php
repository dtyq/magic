<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject;

enum AdminGlobalSettingsType: int
{
    // 全局默认好友
    case DEFAULT_FRIEND = 1;

    // 助理创建管理
    case ASSISTANT_CREATE = 2;

    // 第三方发布管控
    case THIRD_PARTY_PUBLISH = 3;

    // 获取助理全局设置类型
    public static function getAssistantGlobalSettingsType(): array
    {
        return [
            self::DEFAULT_FRIEND,
            self::ASSISTANT_CREATE,
            self::THIRD_PARTY_PUBLISH,
        ];
    }
}
