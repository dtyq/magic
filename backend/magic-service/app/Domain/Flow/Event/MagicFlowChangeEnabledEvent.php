<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Event;

use App\Domain\Flow\Entity\MagicFlowEntity;

class MagicFlowChangeEnabledEvent
{
    public function __construct(
        public MagicFlowEntity $magicFlowEntity,
    ) {
    }
}
