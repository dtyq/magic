<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\File\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class BusinessUploadTokenRequestDTO extends AbstractRequestDTO
{
    protected string $businessCode = '';

    protected int $expires = 3600;

    public function getBusinessCode(): string
    {
        return $this->businessCode;
    }

    public function getExpires(): int
    {
        return $this->expires;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'business_code' => 'required|string|in:SKILL,skill,ASSET,asset',
            'expires' => 'sometimes|integer|min:900|max:3600',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'business_code.required' => 'business_code is required',
            'business_code.in' => 'business_code is invalid',
            'expires.integer' => 'expires must be an integer',
            'expires.min' => 'expires must be at least 900 seconds',
            'expires.max' => 'expires must not exceed 3600 seconds',
        ];
    }

    protected function setBusinessCode(mixed $value): void
    {
        $this->businessCode = strtoupper(trim((string) $value));
    }

    protected function setExpires(mixed $value): void
    {
        $this->expires = $value === null || $value === '' ? 3600 : (int) $value;
    }
}
