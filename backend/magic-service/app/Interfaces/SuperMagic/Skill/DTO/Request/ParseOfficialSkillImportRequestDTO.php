<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

class ParseOfficialSkillImportRequestDTO extends AbstractRequestDTO
{
    public string $fileKey = '';

    public function getFileKey(): string
    {
        return $this->fileKey;
    }

    protected static function getHyperfValidationRules(): array
    {
        return ['file_key' => 'required|string'];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'file_key.required' => __('skill.file_key_required'),
            'file_key.string' => __('skill.file_key_must_be_string'),
        ];
    }
}
