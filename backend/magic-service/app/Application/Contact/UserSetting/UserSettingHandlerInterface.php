<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\UserSetting;

use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

interface UserSettingHandlerInterface
{
    public function populateValue(BaseDataIsolation $dataIsolation, MagicUserSettingEntity $setting): void;

    public function generateDefault(): ?MagicUserSettingEntity;
}
