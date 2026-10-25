<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class SlidesTemplateCodeAvailabilityDTO extends AbstractDTO
{
    public function __construct(public string $status)
    {
        parent::__construct();
    }
}
