<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class SlidesTemplateProjectDTO extends AbstractDTO
{
    public string $id = '';

    public ?string $directoryId = null;

    public function __construct(int|string $id, null|int|string $directoryId)
    {
        $this->id = (string) $id;
        $this->directoryId = $directoryId === null || $directoryId === '' ? null : (string) $directoryId;
        parent::__construct();
    }
}
