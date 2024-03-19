<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Constant;

use function Hyperf\Translation\__;

class InstructCategory
{
    public const int FLOW = 1;

    public const int CHAT = 2;

    public static function getTypeOptions(): array
    {
        return [
            self::FLOW => __('agent.instruct_type_flow'),
            self::CHAT => __('agent.instruct_type_chat'),
        ];
    }
}
