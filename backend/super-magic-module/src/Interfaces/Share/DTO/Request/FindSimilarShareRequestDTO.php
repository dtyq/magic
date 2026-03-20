<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\ValidationException;

/**
 * 根据文件ID列表或项目ID查找分享请求DTO.
 *
 * 支持两种查找模式：
 * 1. 文件查找模式：通过 file_ids 查找文件集（FileCollection）或单文件（File）类型的分享记录
 * 2. 项目查找模式：通过 project_id 和 share_project=true 查找项目（Project）类型的分享记录
 */
class FindSimilarShareRequestDTO extends AbstractDTO
{
    /**
     * 文件ID数组（用于文件集分享）.
     */
    public array $fileIds = [];

    /**
     * 项目ID（用于项目分享）.
     */
    public string $projectId = '';

    /**
     * 是否查找项目分享（前端传入）.
     */
    public bool $shareProject = false;

    /**
     * 资源类型.
     * 12 = Project（项目分享）
     * null = 文件查找模式.
     */
    public ?int $resourceType = null;

    /**
     * 从请求中创建DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();

        // 参数验证
        $dto = new self();
        $rules = $dto->rules();
        $messages = $dto->messages();

        $validator = di(ValidatorFactoryInterface::class)->make($data, $rules, $messages);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        // 使用原始请求数据赋值
        $dto->fileIds = $request->input('file_ids', []);

        // 新增字段赋值
        $dto->projectId = (string) $request->input('project_id', '');
        $dto->shareProject = (bool) $request->input('share_project', false);

        // 根据 share_project 转换为资源类型
        if ($dto->shareProject) {
            $dto->resourceType = ResourceType::Project->value; // 12
        }

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
     * 获取项目ID.
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }

    /**
     * 是否查找项目分享.
     */
    public function isShareProject(): bool
    {
        return $this->shareProject;
    }

    /**
     * 获取资源类型.
     * 12 = Project（项目分享）
     * null = 文件查找模式.
     */
    public function getResourceType(): ?int
    {
        return $this->resourceType;
    }

    /**
     * 构建验证规则.
     */
    public function rules(): array
    {
        return [
            // 文件查找模式：file_ids（可选，但如果传了必须符合格式）
            'file_ids' => 'array|min:1', // 移除最大数量限制
            'file_ids.*' => 'required_with:file_ids|string|max:64|regex:/^\d+$/', // 验证文件ID必须是数字字符串

            // 项目查找模式：project_id 和 share_project=true
            'project_id' => 'string|max:64|regex:/^\d+$/',
            'share_project' => 'boolean',
        ];
    }

    /**
     * 获取验证错误消息.
     */
    public function messages(): array
    {
        return [
            // 文件查找相关
            'file_ids.array' => '文件ID列表必须是数组',
            'file_ids.min' => '至少选择一个文件',
            'file_ids.*.required_with' => '文件ID不能为空',
            'file_ids.*.regex' => '文件ID格式不正确，必须是数字',

            // 项目查找相关
            'project_id.regex' => '项目ID格式不正确，必须是数字',
            'share_project.boolean' => 'share_project必须是布尔值',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'file_ids' => '文件ID列表',
            'project_id' => '项目ID',
            'share_project' => '是否查找项目分享',
        ];
    }
}
