<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject;

enum AdminGlobalSettingsName: string
{
    // 全局默认好友
    case DEFAULT_FRIEND = 'default_friend';

    // 助理创建管理
    case ASSISTANT_CREATE = 'create_management';

    // 第三方发布管控
    case THIRD_PARTY_PUBLISH = 'third_platform_publish';

    // 获取助理全局设置类型
    public static function getByType(AdminGlobalSettingsType $type): string
    {
        return match ($type) {
            AdminGlobalSettingsType::ASSISTANT_CREATE => self::ASSISTANT_CREATE->value,
            AdminGlobalSettingsType::THIRD_PARTY_PUBLISH => self::THIRD_PARTY_PUBLISH->value,
            AdminGlobalSettingsType::DEFAULT_FRIEND => self::DEFAULT_FRIEND->value,
        };
    }
}
