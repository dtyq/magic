<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

class ListFilesRequestDTO
{
    public string $parent_id = '';

    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();

        $dto = new self();
        $dto->parent_id = $data['parent_id'] ?? '';

        return $dto;
    }
}
