<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

use Dtyq\SuperMagic\Domain\RecycleBin\Enum\RecycleBinResourceType;
use Hyperf\HttpServer\Contract\RequestInterface;
use InvalidArgumentException;
use ValueError;

/**
 * 检查父级请求 DTO.
 *
 * 使用 resource_ids（资源ID），与恢复接口保持一致.
 */
class CheckParentRequestDTO
{
    private array $resourceIds = [];

    private RecycleBinResourceType $resourceType;

    public function __construct(array $data)
    {
        if (! isset($data['resource_ids']) || ! is_array($data['resource_ids'])) {
            throw new InvalidArgumentException('参数 resource_ids 必须是数组');
        }

        $this->resourceIds = array_map(fn ($id) => (string) $id, $data['resource_ids']);

        if (empty($this->resourceIds)) {
            throw new InvalidArgumentException('参数 resource_ids 不能为空');
        }

        if (! isset($data['resource_type'])) {
            throw new InvalidArgumentException('参数 resource_type 不能为空');
        }

        try {
            $this->resourceType = RecycleBinResourceType::from((int) $data['resource_type']);
        } catch (ValueError $e) {
            throw new InvalidArgumentException('参数 resource_type 必须是有效的资源类型枚举值');
        }
    }

    public static function fromRequest(RequestInterface $request): self
    {
        return new self($request->all());
    }

    public function getResourceIds(): array
    {
        return $this->resourceIds;
    }

    public function getResourceType(): RecycleBinResourceType
    {
        return $this->resourceType;
    }

    public function toArray(): array
    {
        return [
            'resource_ids' => $this->resourceIds,
            'resource_type' => $this->resourceType->value,
        ];
    }
}
