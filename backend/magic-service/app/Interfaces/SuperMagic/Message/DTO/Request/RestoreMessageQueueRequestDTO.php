<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Message\DTO\Request;

class RestoreMessageQueueRequestDTO extends CreateMessageQueueRequestDTO
{
    public ?string $beforeId = null;

    public ?string $afterId = null;

    public int $originalIndex = 0;

    public string $expectedSyncId = '';

    protected static function getHyperfValidationRules(): array
    {
        return array_merge(parent::getHyperfValidationRules(), [
            'before_id' => 'present|nullable|string|regex:/^[1-9][0-9]*$/',
            'after_id' => 'present|nullable|string|regex:/^[1-9][0-9]*$/',
            'original_index' => 'required|integer|min:0',
            'expected_sync_id' => 'present|string',
            'message_content.extra.super_agent.client_queue_sync_id' => 'required|string|max:128',
        ]);
    }
}
