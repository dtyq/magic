<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Response;

class S3InfoDTO
{
    public string $object_key = '';

    public function __construct(string $objectKey = '')
    {
        $this->object_key = $objectKey;
    }

    public function toArray(): array
    {
        return [
            'object_key' => $this->object_key,
        ];
    }
}
