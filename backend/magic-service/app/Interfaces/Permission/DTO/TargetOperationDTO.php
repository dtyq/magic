<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Permission\Assembler\OperationPermissionAssembler;

class TargetOperationDTO extends AbstractDTO
{
    public int $targetType = 0;

    public string $targetId = '';

    public int $operation = 0;

    public ?TargetInfoDTO $targetInfo = null;

    public function getTargetType(): int
    {
        return $this->targetType;
    }

    public function setTargetType(int $targetType): void
    {
        $this->targetType = $targetType;
    }

    public function getTargetId(): string
    {
        return $this->targetId;
    }

    public function setTargetId(string $targetId): void
    {
        $this->targetId = $targetId;
    }

    public function getOperation(): int
    {
        return $this->operation;
    }

    public function setOperation(int $operation): void
    {
        $this->operation = $operation;
    }

    public function getTargetInfo(): ?TargetInfoDTO
    {
        return $this->targetInfo;
    }

    public function setTargetInfo(mixed $targetInfo): void
    {
        $this->targetInfo = OperationPermissionAssembler::createTargetInfoDTOByMixed($targetInfo);
    }
}
