<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Event;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;

class SkillImportedEvent
{
    public function __construct(
        private readonly MagicUserAuthorization $userAuthorization,
        private readonly string $skillCode,
    ) {
    }

    public function getUserAuthorization(): MagicUserAuthorization
    {
        return $this->userAuthorization;
    }

    public function getSkillCode(): string
    {
        return $this->skillCode;
    }
}
