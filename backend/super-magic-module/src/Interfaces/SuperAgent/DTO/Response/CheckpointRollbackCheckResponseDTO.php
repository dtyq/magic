<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

class CheckpointRollbackCheckResponseDTO
{
    protected bool $canRollback = false;

    /**
     * 构造函数.
     */
    public function __construct()
    {
    }

    public function getCanRollback(): bool
    {
        return $this->canRollback;
    }

    public function setCanRollback(bool $canRollback): void
    {
        $this->canRollback = $canRollback;
    }

    public function toArray(): array
    {
        return [
            'can_rollback' => $this->canRollback,
        ];
    }
}
