<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Event;

use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;

class SuperMagicAgentSavedEvent
{
    public function __construct(public SuperMagicAgentEntity $superMagicAgentEntity, public bool $create)
    {
    }
}
