<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\DTO\Extra;

use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Entity\ValueObject\Extra\AbstractSettingExtra;
use App\Domain\Admin\Entity\ValueObject\Extra\AssistantCreateExtra;
use App\Domain\Admin\Entity\ValueObject\Extra\DefaultFriendExtra;
use App\Domain\Admin\Entity\ValueObject\Extra\ThirdPartyPublishExtra;
use App\Infrastructure\Core\AbstractDTO;
use JsonSerializable;

abstract class AbstractSettingExtraDTO extends AbstractDTO implements JsonSerializable, SettingExtraDTOInterface
{
    public static function fromExtra(AbstractSettingExtra $extra): AbstractSettingExtraDTO
    {
        $extraDTO = null;
        switch ($extra) {
            case $extra instanceof DefaultFriendExtra:
                $extraDTO = new DefaultFriendExtraDTO($extra->toArray());
                break;
            case $extra instanceof AssistantCreateExtra:
                $extraDTO = new AssistantCreateExtraDTO($extra->toArray());
                break;
            case $extra instanceof ThirdPartyPublishExtra:
                $extraDTO = new ThirdPartyPublishExtraDTO($extra->toArray());
                break;
        }
        return $extraDTO;
    }

    public static function fromArrayAndType(?array $data, AdminGlobalSettingsType $type): ?AbstractSettingExtraDTO
    {
        if ($data === null) {
            return null;
        }
        return match ($type) {
            AdminGlobalSettingsType::DEFAULT_FRIEND => new DefaultFriendExtraDTO($data),
            AdminGlobalSettingsType::ASSISTANT_CREATE => new AssistantCreateExtraDTO($data),
            AdminGlobalSettingsType::THIRD_PARTY_PUBLISH => new ThirdPartyPublishExtraDTO($data),
            default => null,
        };
    }
}
