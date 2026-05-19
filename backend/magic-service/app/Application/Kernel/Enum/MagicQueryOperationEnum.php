<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Enum;

use function Hyperf\Translation\__;

enum MagicQueryOperationEnum: string
{
    case QUERY = 'query';

    public function label(): string
    {
        return __($this->translationKey());
    }

    public function translationKey(): string
    {
        return 'permission.operation.' . $this->value;
    }
}
