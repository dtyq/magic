<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareAccessType;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\ValidationException;

/**
 * 创建分享请求DTO.
 */
class CreateShareRequestDTO extends AbstractDTO
{
    /**
     * 允许的extra字段常量.
     */
    public const EXTRA_FIELD_ALLOW_COPY_PROJECT_FILES = 'allow_copy_project_files';

    public const EXTRA_FIELD_SHOW_ORIGINAL_INFO = 'show_original_info';

    public const EXTRA_FIELD_VIEW_FILE_LIST = 'view_file_list';

    public const EXTRA_FIELD_HIDE_CREATED_BY_SUPER_MAGIC = 'hide_created_by_super_magic';

    public const EXTRA_FIELD_ALLOW_DOWNLOAD_PROJECT_FILE = 'allow_download_project_file';

    /**
     * 资源ID.
     */
    public string $resourceId = '';

    /**
     * 资源类型.
     */
    public int $resourceType = 0;

    /**
     * 分享类型.
     */
    public int $shareType = 0;

    /**
     * 密码
     */
    public ?string $password = null;

    /**
     * 过期天数.
     */
    public ?int $expireDays = null;

    /**
     * 目标ID列表.
     * 当 hasField('target_ids') 为 false 时，表示未传递此字段，应保持原值
     */
    public ?array $targetIds = null;

    /**
     * 分享范围（share_type=2 时使用）。
     * all=全团队成员，designated=指定部门/成员.
     */
    public ?string $shareRange = null;

    /**
     * 文件ID数组（用于文件集分享）.
     */
    public ?array $fileIds = null;

    /**
     * extra配置map.
     */
    public ?array $extra = [];

    /**
     * 默认打开的文件ID.
     */
    public ?string $defaultOpenFileId = null;

    /**
     * 资源名称（用作分享标题）.
     */
    public string $resourceName = '';

    /**
     * 项目ID（可选）
     * 用于项目类型资源时提供明确的项目ID，避免从resource_id推断.
     */
    public ?string $projectId = null;

    /**
     * File paths (optional). Used to resolve file_ids when file_ids is empty.
     * e.g. ['a/a.txt', 'a/'].
     */
    public array $filePaths = [];

    /**
     * 是否分享整个项目.
     *
     * 注意：这是前端传递的字段，后端处理逻辑：
     * - 如果 resource_type=13 且 share_project=true，后端会自动将 resource_type 转换为 12（项目类型）
     * - 转换后，后续所有查询和业务逻辑都使用 resource_type=12 来判断项目类型
     */
    public bool $shareProject = false;

    /**
     * 是否在响应中返回 share_url.
     */
    public bool $showShareUrl = false;

    /**
     * 标记哪些可选字段在请求中存在（用于区分"不传"和"传null/空值"）
     * 用于实现统一的字段更新语义：
     * - 字段不在此数组中：不传 → 保持原值
     * - 字段在此数组中：传了值（可能是null/空值） → 更新或清空.
     */
    private array $presentFields = [];

    /**
     * 判断可选字段是否在请求中存在.
     *
     * @param string $fieldName 字段名称
     * @return bool true=字段存在（传了值，可能是null/空值），false=字段不存在（不传，保持原值）
     */
    public function hasField(string $fieldName): bool
    {
        return in_array($fieldName, $this->presentFields, true);
    }

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

        // 使用原始请求数据赋值（保持原有逻辑），验证器仅用于校验
        // 必填字段：直接赋值
        $dto->resourceId = (string) $request->input('resource_id', '');
        $dto->resourceType = (int) $request->input('resource_type', 0);
        $dto->shareType = (int) $request->input('share_type', 0);

        // resource_name：对于话题分享（resource_type=5）是可选的，其他类型必填
        // 如果不传或为空，业务逻辑会从资源获取名称
        $dto->resourceName = (string) $request->input('resource_name', '');

        // 条件必填字段：使用 hasField() 机制，用于区分"不传"和"传空数组"
        // target_ids：只在 share_type=2 + share_range=designated 时必填
        if ($request->has('target_ids')) {
            $dto->presentFields[] = 'target_ids';
            $dto->targetIds = $request->input('target_ids', []);
        } else {
            $dto->targetIds = null; // 未传递，标记为 null
        }

        // file_ids：只在 resource_type=13 或 15 时必填（创建时）
        if ($request->has('file_ids')) {
            $dto->presentFields[] = 'file_ids';
            $dto->fileIds = $request->input('file_ids', []);
        } else {
            $dto->fileIds = null; // 未传递，标记为 null
        }

        // 可选字段：记录字段存在性，用于区分"不传"和"传null/空值"
        // password：密码字段（条件必填）
        if ($request->has('password')) {
            $dto->presentFields[] = 'password';
            $dto->password = (string) $request->input('password');
        } else {
            $dto->password = null; // 未传递
        }

        // expire_days：过期天数（可选）
        if ($request->has('expire_days')) {
            $dto->presentFields[] = 'expire_days';
            $expireDaysValue = $request->input('expire_days');
            // 处理空字符串、null、0 等情况：空字符串和 null 都转换为 null（永久有效）
            if ($expireDaysValue === null || $expireDaysValue === '' || $expireDaysValue === '0') {
                $dto->expireDays = null;
            } else {
                $dto->expireDays = (int) $expireDaysValue;
            }
        } else {
            $dto->expireDays = null; // 未传递
        }

        // share_range：分享范围（条件必填）
        if ($request->has('share_range')) {
            $dto->presentFields[] = 'share_range';
            $dto->shareRange = (string) $request->input('share_range');
        } else {
            $dto->shareRange = null; // 未传递
        }

        // extra：扩展配置（可选）
        if ($request->has('extra')) {
            $dto->presentFields[] = 'extra';
            $dto->extra = $request->input('extra', []);
        } else {
            $dto->extra = null; // 未传递
        }

        // default_open_file_id：默认打开的文件ID（可选）
        if ($request->has('default_open_file_id')) {
            $dto->presentFields[] = 'default_open_file_id';
            $dto->defaultOpenFileId = (string) $request->input('default_open_file_id');
        } else {
            $dto->defaultOpenFileId = null; // 未传递
        }

        // project_id：项目ID（可选）
        if ($request->has('project_id')) {
            $dto->presentFields[] = 'project_id';
            $dto->projectId = (string) $request->input('project_id');
        } else {
            $dto->projectId = null; // 未传递
        }

        // file_paths：文件路径数组（可选），当 file_ids 为空时用于解析文件ID
        if ($request->has('file_paths')) {
            $dto->presentFields[] = 'file_paths';
            $dto->filePaths = $request->input('file_paths', []);
        } else {
            $dto->filePaths = []; // 未传递
        }

        // share_project：是否分享整个项目（可选）
        if ($request->has('share_project')) {
            $dto->presentFields[] = 'share_project';
            $shareProjectValue = $request->input('share_project', false);
            if (is_string($shareProjectValue)) {
                // 字符串 "true" -> true, "false" -> false, "1" -> true, "0" -> false
                $dto->shareProject = filter_var($shareProjectValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
            } elseif (is_bool($shareProjectValue)) {
                // 布尔值直接使用
                $dto->shareProject = $shareProjectValue;
            } else {
                // 其他类型转为布尔
                $dto->shareProject = (bool) $shareProjectValue;
            }
        } else {
            $dto->shareProject = false; // 未传递，默认为 false
        }

        // show_share_url：是否在响应中返回 share_url（可选）
        if ($request->has('show_share_url')) {
            $showShareUrlValue = $request->input('show_share_url', false);
            if (is_string($showShareUrlValue)) {
                $dto->showShareUrl = filter_var($showShareUrlValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
            } elseif (is_bool($showShareUrlValue)) {
                $dto->showShareUrl = $showShareUrlValue;
            } else {
                $dto->showShareUrl = (bool) $showShareUrlValue;
            }
        } else {
            $dto->showShareUrl = false;
        }

        // 如果是文件集类型（resource_type=13）且开启了项目分享（share_project=true），将资源类型改为项目类型（resource_type=12）
        // 这样后端内部统一使用 resource_type=12 来表示项目类型，简化后续查询和业务逻辑
        if ($dto->resourceType === ResourceType::FileCollection->value && $dto->shareProject) {
            $dto->resourceType = ResourceType::Project->value;
        }

        // 校验extra字段
        $dto->validateExtra();

        return $dto;
    }

    /**
     * 获取资源ID.
     */
    public function getResourceId(): string
    {
        return $this->resourceId;
    }

    /**
     * 获取资源类型.
     */
    public function getResourceType(): ResourceType
    {
        return ResourceType::from($this->resourceType);
    }

    /**
     * 获取分享类型.
     */
    public function getShareType(): ShareAccessType
    {
        return ShareAccessType::from($this->shareType);
    }

    /**
     * 获取密码
     */
    public function getPassword(): ?string
    {
        return $this->password;
    }

    /**
     * 获取过期天数.
     */
    public function getExpireDays(): ?int
    {
        return $this->expireDays;
    }

    /**
     * 获取目标ID列表.
     */
    public function getTargetIds(): array
    {
        return $this->targetIds ?? [];
    }

    /**
     * 获取分享范围.
     */
    public function getShareRange(): ?string
    {
        return $this->shareRange;
    }

    /**
     * 获取文件ID数组.
     */
    public function getFileIds(): array
    {
        return $this->fileIds ?? [];
    }

    /**
     * 获取extra配置map.
     */
    public function getExtra(): ?array
    {
        return $this->extra;
    }

    /**
     * 获取默认打开的文件ID.
     */
    public function getDefaultOpenFileId(): ?string
    {
        return $this->defaultOpenFileId;
    }

    /**
     * 获取资源名称.
     */
    public function getResourceName(): string
    {
        return $this->resourceName;
    }

    /**
     * 是否分享整个项目.
     */
    public function isShareProject(): bool
    {
        return $this->shareProject;
    }

    /**
     * 是否在响应中返回 share_url.
     */
    public function isShowShareUrl(): bool
    {
        return $this->showShareUrl;
    }

    /**
     * 获取项目ID.
     */
    public function getProjectId(): ?string
    {
        return $this->projectId;
    }

    /**
     * Get file paths.
     *
     * @return string[]
     */
    public function getFilePaths(): array
    {
        return $this->filePaths;
    }

    /**
     * 判断是否是文件集分享.
     * 当 resource_type 是 File 且提供了 file_ids 时，认为是文件集分享.
     */
    public function isFileCollectionShare(): bool
    {
        return $this->resourceType === ResourceType::FileCollection->value && ! empty($this->getFileIds());
    }

    /**
     * 构建验证规则.
     */
    public function rules(): array
    {
        return [
            'resource_id' => 'required|string|max:64',
            'resource_type' => 'required|integer|min:1',
            'share_type' => 'required|integer|in:2,4,5', // 2=团队内分享，4=公开访问，5=密码保护
            'password' => 'required_if:share_type,5|nullable|string|min:4|max:32', // share_type=5 时密码必填
            'expire_days' => 'nullable|integer|min:0|max:365', // 0=清空过期时间（永久有效），1-365=设置过期天数
            'target_ids' => 'nullable|array',
            'target_ids.*.target_type' => 'required_with:target_ids|string|in:User,Department',
            'target_ids.*.target_id' => 'required_with:target_ids|string|max:64',
            'share_range' => 'required_if:share_type,2|nullable|string|in:all,designated',
            // 注意：target_ids 在 (share_type=2 + share_range=designated) 时应该有值
            // 由于 Laravel 验证器不支持复杂条件，在 AppService 中进行业务校验
            // file_ids：允许空数组（Topic 类型会静默忽略），具体校验在 AppService 中根据 resource_type 进行
            'file_ids' => 'nullable|array',
            'file_ids.*' => 'required_with:file_ids|string|max:64',
            'extra' => 'nullable|array',
            'default_open_file_id' => 'nullable|string|max:64',
            'project_id' => 'nullable|string|max:64',
            'file_paths' => 'nullable|array',
            'file_paths.*' => 'nullable|string',
            // resource_name：对于话题分享（resource_type=5）是可选的，因为话题名称是动态的；其他类型必填
            // 当 resource_type != 5 时，resource_name 必填且长度 1-255
            // 当 resource_type = 5 时，resource_name 可选，如果传了值则长度 1-255
            // 注意：如果 resource_name 为空，业务逻辑会从资源获取名称
            'resource_name' => 'required_unless:resource_type,5|nullable|string|max:255',
            'share_project' => 'nullable|boolean',
            'show_share_url' => 'nullable|boolean',
        ];
    }

    /**
     * 获取验证错误消息.
     */
    public function messages(): array
    {
        return [
            'resource_id.required' => '资源ID不能为空',
            'resource_type.required' => '资源类型不能为空',
            'share_type.required' => '分享类型不能为空',
            'password.min' => '密码长度至少为4位',
            'expire_days.min' => '有效期不能为负数',
            'expire_days.max' => '有效期最多为365天',
            // 注意：file_ids.min 错误消息已移除，因为允许空数组（Topic 类型会静默忽略）
            'file_ids.*.required_with' => '文件ID不能为空',
            'resource_name.required_unless' => '资源名称不能为空（话题分享除外）',
            'resource_name.max' => '资源名称最多255个字符',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'resource_id' => '资源ID',
            'resource_type' => '资源类型',
            'share_type' => '分享类型',
            'password' => '密码',
            'expire_days' => '过期天数',
            'target_ids' => '目标ID列表',
            'file_ids' => '文件ID列表',
            'extra' => '额外配置',
            'default_open_file_id' => '默认打开的文件ID',
            'resource_name' => '资源名称',
            'share_project' => '是否分享整个项目',
            'show_share_url' => '是否返回分享链接',
            'project_id' => '项目ID',
        ];
    }

    public function getRealResourceId(): string
    {
        // 如果是文件集并且开启了项目分享，则返回项目ID
        if ($this->getResourceType() === ResourceType::Project) {
            return $this->projectId;
        }

        return $this->resourceId;
    }

    /**
     * 校验extra字段，只允许指定的字段.
     */
    private function validateExtra(): void
    {
        if (empty($this->extra)) {
            return;
        }

        // 定义允许的extra字段列表
        $allowedExtraFields = [
            self::EXTRA_FIELD_ALLOW_COPY_PROJECT_FILES,   // 允许复制项目文件
            self::EXTRA_FIELD_SHOW_ORIGINAL_INFO,         // 显示原创信息
            self::EXTRA_FIELD_VIEW_FILE_LIST,             // 可查看文件列表
            self::EXTRA_FIELD_HIDE_CREATED_BY_SUPER_MAGIC, // 隐藏"由超级麦吉创造"字样
            self::EXTRA_FIELD_ALLOW_DOWNLOAD_PROJECT_FILE, // 允许下载项目文件
        ];

        // 检查是否包含不允许的字段
        $extraKeys = array_keys($this->extra);
        $invalidFields = array_diff($extraKeys, $allowedExtraFields);
        if (! empty($invalidFields)) {
            ExceptionBuilder::throw(ShareErrorCode::INVALID_EXTRA_FIELD, 'share.invalid_extra_field', [implode(', ', $invalidFields)]);
        }
    }
}
