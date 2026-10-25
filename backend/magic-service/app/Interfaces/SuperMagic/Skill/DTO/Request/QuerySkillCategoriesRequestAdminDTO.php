<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class QuerySkillCategoriesRequestAdminDTO extends AbstractRequestDTO
{
    public ?int $status = null;

    public ?string $keyword = null;

    public function setStatus(null|int|string $status): void
    {
        $this->status = $status === null || $status === '' ? null : (int) $status;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function getKeyword(): ?string
    {
        $keyword = trim((string) $this->keyword);
        return $keyword === '' ? null : $keyword;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'status' => 'sometimes|nullable|integer|in:0,1',
            'keyword' => 'sometimes|nullable|string|max:255',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
