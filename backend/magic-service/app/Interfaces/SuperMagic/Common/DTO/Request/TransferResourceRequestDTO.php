<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Common\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class TransferResourceRequestDTO extends AbstractRequestDTO
{
    public string $receiverId = '';

    public bool $shareToMe = false;

    public string $shareRole = 'manage';

    protected function initProperty(array $data): void
    {
        // Validation excludes this field, but the base DTO still hydrates raw input.
        if (empty($data['share_to_me'])) {
            unset($data['share_role']);
        }
        parent::initProperty($data);
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'receiver_id' => 'required|string|max:64',
            'share_to_me' => 'required|boolean',
            'share_role' => 'exclude_if:share_to_me,false|sometimes|string|in:manage,editor,viewer',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
