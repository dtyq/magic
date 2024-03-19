<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Admin\Agent\Service\Extra\Strategy;

use App\Interfaces\Admin\DTO\Extra\DefaultFriendExtraDTO;
use App\Interfaces\Admin\DTO\Extra\SettingExtraDTOInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use InvalidArgumentException;

class DefaultFriendExtraDetailAppenderStrategy implements ExtraDetailAppenderStrategyInterface
{
    public function appendExtraDetail(SettingExtraDTOInterface $extraDTO, MagicUserAuthorization $userAuthorization): SettingExtraDTOInterface
    {
        if (! $extraDTO instanceof DefaultFriendExtraDTO) {
            throw new InvalidArgumentException('Expected DefaultFriendExtraDTO');
        }

        return $extraDTO;
    }
}
