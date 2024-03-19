<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Admin\Agent\Service\Extra\Factory;

use App\Application\Admin\Agent\Service\Extra\Strategy\AssistantCreateExtraDetailAppenderStrategy;
use App\Application\Admin\Agent\Service\Extra\Strategy\DefaultFriendExtraDetailAppenderStrategy;
use App\Application\Admin\Agent\Service\Extra\Strategy\ExtraDetailAppenderStrategyInterface;
use App\Application\Admin\Agent\Service\Extra\Strategy\ThirdPartyPublishExtraDetailAppenderStrategy;
use App\Interfaces\Admin\DTO\Extra\AssistantCreateExtraDTO;
use App\Interfaces\Admin\DTO\Extra\DefaultFriendExtraDTO;
use App\Interfaces\Admin\DTO\Extra\SettingExtraDTOInterface;
use App\Interfaces\Admin\DTO\Extra\ThirdPartyPublishExtraDTO;
use InvalidArgumentException;

class ExtraDetailAppenderFactory
{
    public static function createStrategy(SettingExtraDTOInterface $extraDTO): ExtraDetailAppenderStrategyInterface
    {
        return match (true) {
            $extraDTO instanceof DefaultFriendExtraDTO => new DefaultFriendExtraDetailAppenderStrategy(),
            $extraDTO instanceof AssistantCreateExtraDTO => new AssistantCreateExtraDetailAppenderStrategy(),
            $extraDTO instanceof ThirdPartyPublishExtraDTO => new ThirdPartyPublishExtraDetailAppenderStrategy(),
            default => throw new InvalidArgumentException('Unsupported extra DTO type'),
        };
    }
}
