<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Contract;

use Qbhy\HyperfAuth\Authenticatable;

/**
 * 不参与商业明水印策略，恒不叠水印、不视为生效去水印.
 */
final class DefaultUserAiWatermarkPolicy implements UserAiWatermarkPolicyInterface
{
    public function shouldApplyVisibleAiWatermark(Authenticatable $authorization): bool
    {
        return false;
    }

    public function canRemoveVisibleAiWatermark(Authenticatable $authorization): bool
    {
        return false;
    }
}
