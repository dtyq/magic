<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectForkEntity;

/**
 * Fork status response DTO.
 */
class ForkStatusResponseDTO
{
    public function __construct(
        public readonly string $status,
        public readonly string $progress,
        public readonly string $errMsg,
    ) {
    }

    public static function fromEntity(ProjectForkEntity $projectFork): self
    {
        return new self(
            status: $projectFork->getStatus()->value,
            progress: $projectFork->getProgressPercentage(),
            errMsg: $projectFork->getErrMsg() ?? '',
        );
    }

    public function toArray(): array
    {
        return [
            'status' => $this->status,
            'progress' => $this->progress,
            'err_msg' => $this->errMsg,
        ];
    }
}
