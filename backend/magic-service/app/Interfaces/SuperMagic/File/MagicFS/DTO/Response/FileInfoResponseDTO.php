<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\MagicFS\DTO\Response;

class FileInfoResponseDTO
{
    public ?MagicFSFileDTO $file = null;

    /** Legacy tree/export metadata; omitted for ordinary file-info calls. */
    public bool $truncated = false;

    public ?string $truncated_reason = null;

    public int $returned_nodes = 0;

    public function toArray(): array
    {
        $result = [
            'file' => $this->file ? $this->file->toArray() : null,
        ];

        if ($this->truncated || $this->truncated_reason !== null || $this->returned_nodes > 0) {
            $result['truncated'] = $this->truncated;
            $result['truncated_reason'] = $this->truncated_reason;
            $result['returned_nodes'] = $this->returned_nodes;
        }

        return $result;
    }
}
