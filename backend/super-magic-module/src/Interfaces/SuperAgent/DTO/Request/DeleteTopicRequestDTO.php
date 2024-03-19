<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 删除话题请求DTO
 * 用于接收删除话题的请求参数.
 */
class DeleteTopicRequestDTO extends AbstractDTO
{
    /**
     * 任务状态ID(主键)
     * 字符串类型，对应任务状态表的主键.
     */
    public string $id = '';

    /**
     * 获取验证规则.
     */
    public function rules(): array
    {
        return [
            'id' => 'required|string',
        ];
    }

    /**
     * 获取验证失败的自定义错误信息.
     */
    public function messages(): array
    {
        return [
            'id.required' => '任务状态ID不能为空',
            'id.string' => '任务状态ID必须是字符串',
        ];
    }

    /**
     * 从请求中创建DTO实例.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $data = new self();
        $data->id = $request->input('id', '');
        return $data;
    }

    /**
     * 获取任务状态ID(主键).
     */
    public function getId(): string
    {
        return $this->id;
    }
}
