<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Response;

class FileInfoResponseDTO
{
    public ?MagicFSFileDTO $file = null;

    public function toArray(): array
    {
        return [
            'file' => $this->file ? $this->file->toArray() : null,
        ];
    }
}
