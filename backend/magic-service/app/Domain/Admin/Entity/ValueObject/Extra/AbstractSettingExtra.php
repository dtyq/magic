<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject\Extra;

use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Infrastructure\Core\AbstractValueObject;

class AbstractSettingExtra extends AbstractValueObject implements SettingExtraInterface
{
    public static function fromDataByType(?array $data, AdminGlobalSettingsType $type): ?AbstractSettingExtra
    {
        if ($data === null) {
            return null;
        }
        return match ($type) {
            AdminGlobalSettingsType::DEFAULT_FRIEND => new DefaultFriendExtra($data),
            AdminGlobalSettingsType::ASSISTANT_CREATE => new AssistantCreateExtra($data),
            AdminGlobalSettingsType::THIRD_PARTY_PUBLISH => new ThirdPartyPublishExtra($data),
            default => new AbstractSettingExtra($data),
        };
    }
}
