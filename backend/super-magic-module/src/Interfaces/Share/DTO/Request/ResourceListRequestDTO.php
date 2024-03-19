<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareFilterType;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\ValidationException;

use function di;

/**
 * 资源列表请求DTO.
 */
class ResourceListRequestDTO extends AbstractDTO
{
    /**
     * 当前页码.
     */
    public int $page = 1;

    /**
     * 每页条数.
     */
    public int $pageSize = 10;

    /**
     * 搜索关键词.
     */
    public string $keyword = '';

    /**
     * 资源类型（支持单个整数或整数数组）.
     * @var array<int>|int
     */
    public array|int $resourceType;

    /**
     * Project ID for filtering.
     */
    public ?int $projectId = null;

    /**
     * 是否分享整个项目（前端传递的字段）.
     *
     * 注意：后端处理逻辑：
     * - 如果传 resource_type=[13] + share_project=true，后端会自动转换为 resource_type=[12]
     * - 转换后，后续查询使用 resource_type=12 来筛选项目类型资源
     * - 转换逻辑在 fromRequest 方法中实现
     */
    public ?bool $shareProject = null;

    /**
     * 过滤类型（all=全部, active=分享中, expired=已失效, cancelled=已取消）.
     */
    public string $filterType;

    /**
     * 从请求中创建DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();

        // 在验证前统一处理 resource_type：如果是单个整数，转换为数组
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

        $dto->page = (int) ($validated['page'] ?? 1);
        $dto->pageSize = (int) ($validated['page_size'] ?? 10);
        $dto->keyword = (string) ($validated['keyword'] ?? '');

        // 处理 resource_type：由于验证前已统一转换为数组，这里直接处理数组
        $resourceType = $validated['resource_type'];
        // 转换数组中的所有值为整数
        $resourceType = array_map('intval', $resourceType);
        // 验证规则已确保数组不为空，这里直接赋值
        $dto->resourceType = $resourceType;

        // 处理 project_id：空字符串或不传时为 null，有值时转为 int
        $dto->projectId = (isset($validated['project_id']) && $validated['project_id'] !== '')
            ? (int) $validated['project_id']
            : null;

        // 处理 share_project：空字符串或不传时为 null（查询全部），有值时转为 bool
        if (isset($validated['share_project']) && $validated['share_project'] !== '') {
            $shareProjectValue = $validated['share_project'];
            // 正确处理字符串 "true"/"false" 和布尔值
            if (is_string($shareProjectValue)) {
                // 字符串 "true" -> true, "false" -> false, "1" -> true, "0" -> false
                $dto->shareProject = filter_var($shareProjectValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            } elseif (is_bool($shareProjectValue)) {
                // 布尔值直接使用
                $dto->shareProject = $shareProjectValue;
            } else {
                // 其他类型转为布尔
                $dto->shareProject = (bool) $shareProjectValue;
            }
        } else {
            $dto->shareProject = null;
        }

        // 转换逻辑：将 resource_type=[13] + share_project=true 转换为 resource_type=[12]
        // 目的：后端统一使用 resource_type=12 来表示项目类型，简化查询逻辑
        // 注意：保留 shareProject 字段不变，用于日志记录和调试，Repository 层已忽略该字段
        if ($dto->shareProject === true) {
            // 检查 resourceType 数组中是否包含 13 (FileCollection)
            $resourceTypes = is_array($dto->resourceType) ? $dto->resourceType : [$dto->resourceType];

            // 如果包含 13，将其替换为 12
            if (in_array(13, $resourceTypes, true)) {
                // 移除 13，添加 12
                $resourceTypes = array_diff($resourceTypes, [13]);
                $resourceTypes[] = 12;

                // 去重并重新索引
                $resourceTypes = array_values(array_unique($resourceTypes));

                // 更新 resourceType
                $dto->resourceType = $resourceTypes;

                // 保留 shareProject=true，不设为 null
                // 原因：
                // 1. 保留原始请求信息，便于日志记录和问题排查
                // 2. Repository 层已删除 share_project 查询条件，不会影响查询结果
                // 3. DTO 层职责是接收参数，保留完整信息更合理
            }
        }

        // 处理 filter_type：默认为 ShareFilterType::All
        $dto->filterType = $validated['filter_type'] ?? ShareFilterType::All->value;

        return $dto;
    }

    /**
     * 设置页码.
     */
    public function setPage(int $page): self
    {
        $this->page = $page;
        return $this;
    }

    /**
     * 获取页码.
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * 设置每页条数.
     */
    public function setPageSize(int $pageSize): self
    {
        $this->pageSize = $pageSize;
        return $this;
    }

    /**
     * 获取每页条数.
     */
    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    /**
     * 设置搜索关键词.
     */
    public function setKeyword(string $keyword): self
    {
        $this->keyword = $keyword;
        return $this;
    }

    /**
     * 获取搜索关键词.
     */
    public function getKeyword(): string
    {
        return $this->keyword;
    }

    /**
     * 设置资源类型.
     * @param array<int>|int $resourceType
     */
    public function setResourceType(array|int $resourceType): self
    {
        $this->resourceType = $resourceType;
        return $this;
    }

    /**
     * 获取资源类型.
     * @return array<int>|int
     */
    public function getResourceType(): array|int
    {
        return $this->resourceType;
    }

    /**
     * 获取资源类型数组（统一返回数组格式）.
     * @return array<int>
     */
    public function getResourceTypes(): array
    {
        return is_array($this->resourceType) ? $this->resourceType : [$this->resourceType];
    }

    /**
     * Get project ID.
     */
    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    /**
     * 获取是否分享整个项目.
     */
    public function getShareProject(): ?bool
    {
        return $this->shareProject;
    }

    /**
     * 设置是否分享整个项目.
     */
    public function setShareProject(?bool $shareProject): self
    {
        $this->shareProject = $shareProject;
        return $this;
    }

    /**
     * 获取过滤类型.
     */
    public function getFilterType(): string
    {
        return $this->filterType;
    }

    /**
     * 设置过滤类型.
     */
    public function setFilterType(string $filterType): self
    {
        $this->filterType = $filterType;
        return $this;
    }

    /**
     * 构建验证规则.
     */
    public function rules(): array
    {
        return [
            'page' => 'integer|min:1',
            'page_size' => 'integer|min:1|max:100',
            'keyword' => 'nullable|string|max:255',
            'resource_type' => 'required|array', // 必须是数组
            'resource_type.*' => 'required|integer|min:1', // 数组元素必须是整数且 >= 1
            'project_id' => 'nullable', // 允许空字符串、null 或有效整数
            'share_project' => 'nullable|boolean', // 是否分享整个项目
            'filter_type' => 'nullable|string|in:all,active,expired,cancelled', // 过滤类型
        ];
    }

    /**
     * 获取验证错误消息.
     */
    public function messages(): array
    {
        return [
            'page.integer' => '页码必须是整数',
            'page.min' => '页码最小为1',
            'page_size.integer' => '每页条数必须是整数',
            'page_size.min' => '每页条数最小为1',
            'page_size.max' => '每页条数最大为100',
            'keyword.max' => '关键词最大长度为255个字符',
            'resource_type.required' => '资源类型是必填项',
            'resource_type.array' => '资源类型必须是数组',
            'resource_type.*.required' => '资源类型数组元素不能为空',
            'resource_type.*.integer' => '资源类型必须是整数',
            'resource_type.*.min' => '资源类型最小为1',
            'project_id.integer' => 'Project ID must be an integer',
            'project_id.min' => 'Project ID must be at least 1',
            'filter_type.in' => '过滤类型必须是 all、active、expired 或 cancelled 之一',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'page' => '页码',
            'page_size' => '每页条数',
            'keyword' => '搜索关键词',
            'resource_type' => '资源类型',
            'project_id' => 'Project ID',
            'share_project' => '是否分享整个项目',
            'filter_type' => '过滤类型',
        ];
    }
}
