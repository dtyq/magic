<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\DTO\Response;

final readonly class FileReferenceResultDTO
{
    public function __construct(
        public FileReferenceStatus $status,
        public ?FileReferenceDTO $reference = null,
    ) {
    }

    public function toArray(): array
    {
        $result = ['status' => $this->status->value];
        if ($this->status === FileReferenceStatus::Resolved && $this->reference !== null) {
            $result['reference'] = $this->reference->toArray();
        }
        return $result;
    }
}
