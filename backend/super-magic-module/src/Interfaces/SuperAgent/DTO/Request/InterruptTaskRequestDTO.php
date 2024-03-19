<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Interrupt task request DTO.
 */
class InterruptTaskRequestDTO extends AbstractRequestDTO
{
    /**
     * Task ID to interrupt.
     */
    public string $id = '';

    public function getId(): string
    {
        return $this->id;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'id' => 'required|string',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'id.required' => 'Task ID is required',
        ];
    }
}
