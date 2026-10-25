<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class CreateSkillDraftRequestDTO extends AbstractRequestDTO
{
    public string $requestId = '';

    public string $name = '';

    public string $description = '';

    public ?string $existingSkillCode = null;

    protected static function getHyperfValidationRules(): array
    {
        return [
            'request_id' => 'required|string|max:128',
            'name' => 'required|string|max:255',
            'description' => 'required|string|max:1024',
            'existing_skill_code' => 'nullable|string|max:64',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
