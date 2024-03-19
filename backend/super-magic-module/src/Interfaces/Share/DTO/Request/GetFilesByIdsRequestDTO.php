<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 批量获取文件详情请求DTO.
 */
class GetFilesByIdsRequestDTO extends AbstractDTO
{
    /**
     * 文件ID数组.
     */
    public array $fileIds = [];

    /**
     * 从请求中创建DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->fileIds = $request->input('file_ids', []);

        return $dto;
    }

    /**
     * 获取文件ID数组.
     */
    public function getFileIds(): array
    {
        return $this->fileIds;
    }

    /**
     * 构建验证规则.
     */
    public function rules(): array
    {
        return [
            'file_ids' => 'required|array|min:1|max:100',
            'file_ids.*' => 'required|string|max:64|regex:/^\d+$/',
        ];
    }

    /**
     * 获取验证错误消息.
     */
    public function messages(): array
    {
        return [
            'file_ids.required' => '文件ID列表不能为空',
            'file_ids.array' => '文件ID列表必须是数组',
            'file_ids.min' => '至少需要提供一个文件ID',
            'file_ids.max' => '文件ID列表最多支持100个文件',
            'file_ids.*.required' => '文件ID不能为空',
            'file_ids.*.string' => '文件ID必须是字符串',
            'file_ids.*.regex' => '文件ID格式不正确，必须是数字',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'file_ids' => '文件ID列表',
        ];
    }
}
