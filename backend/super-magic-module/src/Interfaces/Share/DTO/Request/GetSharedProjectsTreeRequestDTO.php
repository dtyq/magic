<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\ValidationException;

use function di;

/**
 * 获取分享项目树形结构请求DTO.
 */
class GetSharedProjectsTreeRequestDTO extends AbstractDTO
{
    /**
     * 资源类型数组.
     * @var array<int>
     */
    public array $resourceTypes = [];

    /**
     * 从请求中创建DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();

        // 确保 resource_type 是数组
        if (isset($data['resource_type']) && ! is_array($data['resource_type'])) {
            $data['resource_type'] = [$data['resource_type']];
        }

        // 参数验证
        $dto = new self();
        $rules = $dto->rules();
        $messages = $dto->messages();

        $validator = di(ValidatorFactoryInterface::class)->make($data, $rules, $messages);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $validated = $validator->validated();

        // 处理 resource_type：转换为整数数组
        $resourceTypes = $validated['resource_type'];
        $resourceTypes = array_map('intval', $resourceTypes);
        $dto->resourceTypes = $resourceTypes;

        return $dto;
    }

    /**
     * 获取资源类型数组.
     * @return array<int>
     */
    public function getResourceTypes(): array
    {
        return $this->resourceTypes;
    }

    /**
     * 设置资源类型数组.
     * @param array<int> $resourceTypes
     */
    public function setResourceTypes(array $resourceTypes): self
    {
        $this->resourceTypes = $resourceTypes;
        return $this;
    }

    /**
     * 构建验证规则.
     */
    public function rules(): array
    {
        return [
            'resource_type' => 'required|array|min:1', // 必须是数组且至少有一个元素
            'resource_type.*' => 'required|integer|min:1', // 数组元素必须是整数且 >= 1
        ];
    }

    /**
     * 获取验证错误消息.
     */
    public function messages(): array
    {
        return [
            'resource_type.required' => '资源类型是必填项',
            'resource_type.array' => '资源类型必须是数组',
            'resource_type.min' => '至少选择一个资源类型',
            'resource_type.*.required' => '资源类型数组元素不能为空',
            'resource_type.*.integer' => '资源类型必须是整数',
            'resource_type.*.min' => '资源类型最小为1',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'resource_type' => '资源类型',
        ];
    }
}
