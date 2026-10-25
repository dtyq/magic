<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Message\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class DeleteMessageQueueRequestDTO extends AbstractRequestDTO
{
    public ?string $expectedSyncId = null;

    protected static function getHyperfValidationRules(): array
    {
        return ['expected_sync_id' => 'nullable|string|max:128'];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
