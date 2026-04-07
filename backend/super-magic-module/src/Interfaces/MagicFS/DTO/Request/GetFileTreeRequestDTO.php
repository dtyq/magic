<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

class GetFileTreeRequestDTO
{
    public int $depth = -1; // 默认无限深度

    /**
     * 从 HTTP 请求创建 DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $data = $request->all();

        // depth 参数，默认 -1 表示无限深度
        if (isset($data['depth'])) {
            $dto->depth = (int) $data['depth'];
        }

        return $dto;
    }
}
