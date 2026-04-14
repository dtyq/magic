<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class FollowUpSuggestionQueryResponseDTO extends AbstractDTO
{
    public int $type = 0;

    public string $relationId = '';

    public ?int $status = null;

    /** @var string[] */
    public array $suggestions = [];
}
