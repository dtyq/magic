<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine;

use Dtyq\SdkBase\SdkBase;
use Dtyq\SdkBase\SdkBaseContext;

class ComponentContext
{
    public static function register(SdkBase $sdkBase): void
    {
        SdkBaseContext::register(SdkInfo::NAME, $sdkBase);
    }

    public static function getSdkContainer(): SdkBase
    {
        return SdkBaseContext::get(SdkInfo::NAME);
    }

    public static function hasSdkContainer(): bool
    {
        return SdkBaseContext::has(SdkInfo::NAME);
    }
}
