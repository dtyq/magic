<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Message\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class MoveMessageQueueRequestDTO extends AbstractRequestDTO
{
    public ?string $beforeId = null;

    public ?string $afterId = null;

    protected static function getHyperfValidationRules(): array
    {
        return [
            'before_id' => 'present|nullable|string|regex:/^[1-9][0-9]*$/',
            'after_id' => 'present|nullable|string|regex:/^[1-9][0-9]*$/',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
