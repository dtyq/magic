<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

class GetFileVersionsRequestDTO
{
    /**
     * @var string[]
     */
    public array $file_ids = [];

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $data = $request->all();

        $dto->file_ids = $data['file_ids'] ?? [];

        return $dto;
    }
}
