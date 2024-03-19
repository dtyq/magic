<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Packer;

use Dtyq\PhpMcp\Shared\Kernel\Packer\PackerInterface;

class SerializePacker implements PackerInterface
{
    public function pack(array $data): string
    {
        return serialize($data);
    }

    public function unpack(string $data): array
    {
        return unserialize($data);
    }
}
