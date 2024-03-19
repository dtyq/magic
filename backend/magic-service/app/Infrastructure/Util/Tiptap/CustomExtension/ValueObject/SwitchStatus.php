<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap\CustomExtension\ValueObject;

enum SwitchStatus: string
{
    case ON = 'on';
    case OFF = 'off';
}
