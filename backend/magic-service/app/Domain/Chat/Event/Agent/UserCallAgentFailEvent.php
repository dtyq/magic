<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Event\Agent;

use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Infrastructure\Core\AbstractEvent;

/**
 * agent抛出了异常.
 */
class UserCallAgentFailEvent extends AbstractEvent
{
    public function __construct(
        public MagicSeqEntity $seqEntity,
    ) {
    }
}
