<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 批量取消分享请求DTO.
 */
class BatchCancelShareRequestDTO extends AbstractDTO
{
    /**
     * 资源ID数组.
     */
    public array $resourceIds = [];

    /**
     * 从请求中创建DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->resourceIds = $request->input('resource_ids', []);

        return $dto;
    }

    /**
     * 获取资源ID数组.
     */
    public function getResourceIds(): array
    {
        return $this->resourceIds;
    }

    /**
     * 构建验证规则.
     */
    public function rules(): array
    {
        return [
            'resource_ids' => 'required|array|min:1|max:100',
            'resource_ids.*' => 'required|string|max:64',
        ];
    }

    /**
     * 获取验证错误消息.
     */
    public function messages(): array
    {
        return [
            'resource_ids.required' => '资源ID列表不能为空',
            'resource_ids.array' => '资源ID列表必须是数组',
            'resource_ids.min' => '至少需要提供一个资源ID',
            'resource_ids.max' => '最多只能批量取消100个分享',
            'resource_ids.*.required' => '资源ID不能为空',
            'resource_ids.*.string' => '资源ID必须是字符串',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'resource_ids' => '资源ID列表',
        ];
    }
}
