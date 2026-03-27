<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class FollowUpSuggestionQueryResultDTO extends AbstractDTO
{
    public int $type = 0;

    public string $relationId = '';

    /** @var string[] */
    public array $suggestions = [];
}
