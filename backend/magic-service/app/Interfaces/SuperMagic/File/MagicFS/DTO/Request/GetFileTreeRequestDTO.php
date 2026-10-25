<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\MagicFS\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

class GetFileTreeRequestDTO
{
    public int $depth = -1; // 默认无限深度

    /** Maximum number of descendant nodes returned by the legacy endpoint. */
    public int $max_nodes = 10000;

    /** Approximate serialized node budget for the legacy endpoint. */
    public int $max_bytes = 8 * 1024 * 1024;

    /**
     * 从 HTTP 请求创建 DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $data = $request->all();

        // depth 参数，默认 -1 表示无限深度。无限深度不再意味着无限
        // 资源：max_nodes/max_bytes 仍然是强制预算。
        if (isset($data['depth'])) {
            $dto->depth = (int) $data['depth'];
        }

        // Keep the legacy export endpoint bounded even when a caller omits
        // all options. The upper limits are deliberately server-side
        // contracts, not hints that can be bypassed by a large request.
        if (isset($data['max_nodes'])) {
            $dto->max_nodes = (int) $data['max_nodes'];
        }
        if (isset($data['max_bytes'])) {
            $dto->max_bytes = (int) $data['max_bytes'];
        }

        $dto->depth = max(-1, min($dto->depth, 100));
        $dto->max_nodes = max(1, min($dto->max_nodes, 100000));
        $dto->max_bytes = max(1024, min($dto->max_bytes, 32 * 1024 * 1024));

        return $dto;
    }
}
