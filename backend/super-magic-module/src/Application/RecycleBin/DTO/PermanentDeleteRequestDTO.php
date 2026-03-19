<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

use Hyperf\HttpServer\Contract\RequestInterface;
use InvalidArgumentException;

/**
 * 彻底删除请求 DTO.
 */
class PermanentDeleteRequestDTO
{
    private array $ids;

    /**
     * @param array $data 请求数据
     * @throws InvalidArgumentException 参数校验失败时抛出
     */
    public function __construct(array $data)
    {
        if (! isset($data['ids'])) {
            throw new InvalidArgumentException('参数 ids 必须提供');
        }

        if (! is_array($data['ids'])) {
            throw new InvalidArgumentException('参数 ids 必须是数组');
        }

        $this->ids = array_values(array_unique(array_map(fn ($id) => (string) $id, $data['ids'])));

        if (empty($this->ids)) {
            throw new InvalidArgumentException('参数 ids 不能为空');
        }
    }

    /**
     * 从请求创建 DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        return new self($request->all());
    }

    /**
     * 获取回收站记录 ID 列表.
     */
    public function getIds(): array
    {
        return $this->ids;
    }
}
