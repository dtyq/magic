<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

class SuperMagicAgentTool extends AbstractValueObject
{
    protected string $code;

    protected string $name;

    protected string $description;

    protected string $icon = '';

    protected SuperMagicAgentToolType $type;
}
