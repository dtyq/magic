<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject;

enum AdminGlobalSettingsStatus: int
{
    case DISABLED = 0;
    case ENABLED = 1;
}
