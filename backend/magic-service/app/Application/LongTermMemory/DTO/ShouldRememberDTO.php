<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\LongTermMemory\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ShouldRememberDTO extends AbstractDTO
{
    public bool $remember = false;

    public ?string $explanation = null;

    public ?string $memory = null;

    public array $tags = [];
}
