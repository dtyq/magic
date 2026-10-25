<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use App\Infrastructure\Util\VersionUtil;

class PrepareSkillPublishRequestDTO extends AbstractRequestDTO
{
    public string $requestId = '';

    public ?string $name = null;

    public ?string $description = null;

    public ?string $version = null;

    public ?string $publishTargetType = null;

    protected static function getHyperfValidationRules(): array
    {
        return [
            'request_id' => 'required|string|max:128',
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:1024',
            'version' => ['nullable', 'string', 'max:32', VersionUtil::getValidationRule()],
            'publish_target_type' => 'nullable|in:PRIVATE,ORGANIZATION,MARKET',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
