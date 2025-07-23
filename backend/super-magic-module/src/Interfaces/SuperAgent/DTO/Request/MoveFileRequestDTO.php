<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class MoveFileRequestDTO extends AbstractRequestDTO
{
    /**
     * The ID of the target parent directory.
     */
    public string $targetParentId = '';

    public function getTargetParentId(): string
    {
        return $this->targetParentId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'target_parent_id' => 'required|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'target_parent_id.required' => 'Target parent ID cannot be empty',
            'target_parent_id.string' => 'Target parent ID must be a string',
        ];
    }
}
