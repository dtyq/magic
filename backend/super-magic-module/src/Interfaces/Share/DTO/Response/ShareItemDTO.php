<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Response;

use Dtyq\SuperMagic\Infrastructure\Utils\DateFormatUtil;

/**
 * 分享项目DTO.
 */
class ShareItemDTO
{
    /**
     * @var string 分享ID
     */
    public string $id = '';

    /**
     * @var string 资源ID
     */
    public string $resourceId = '';

    /**
     * @var int 资源类型
     */
    public int $resourceType = 0;

    /**
     * @var string 资源类型名称
     */
    public string $resourceTypeName = '';

    /**
     * @var string 分享代码
     */
    public string $shareCode = '';

    /**
     * @var bool 是否已设置密码
     */
    public bool $hasPassword = false;

    /**
     * @var int 分享类型
     */
    public int $shareType = 0;

    /**
     * @var array extra配置map
     */
    public array $extra = [];

    /**
     * @var null|string 默认打开的文件ID
     */
    public ?string $defaultOpenFileId = null;

    /**
     * @var null|string 项目ID
     */
    public ?string $projectId = null;

    /**
     * @var string 资源名称（用作分享标题）
     */
    public string $resourceName = '';

    /**
     * @var bool 是否分享整个项目
     */
    public bool $shareProject = false;

    /**
     * @var null|string 分享范围（仅 share_type=2 时有效：'all' 或 'designated'）
     */
    public ?string $shareRange = null;

    /**
     * @var array 指定成员列表（仅 share_type=2 且 share_range='designated' 时有效）
     */
    public array $targetIds = [];

    /**
     * @var null|string 过期时间（格式：Y-m-d H:i:s，null 表示永久有效）
     */
    public ?string $expireAt = null;

    /**
     * @var null|int 过期天数（1-365天，null 表示永久有效）
     */
    public ?int $expireDays = null;

    /**
     * @var null|string 主文件名（通过 default_open_file_id 或第一个非隐藏文件获取）
     */
    public ?string $mainFileName = null;

    /**
     * @var null|string 分享链接（仅当请求中 show_share_url=true 且环境配置了 MAGIC_FRONTEND_DOMAIN 时返回）
     */
    public ?string $shareUrl = null;

    /**
     * 从数组创建DTO实例.
     *
     * @param array $data 数组数据
     * @return self DTO实例
     */
    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->id = (string) ($data['id'] ?? '');
        $dto->resourceId = (string) ($data['resource_id'] ?? '');
        $dto->resourceType = (int) ($data['resource_type'] ?? 0);
        $dto->resourceTypeName = (string) ($data['resource_type_name'] ?? '');
        $dto->shareCode = (string) ($data['share_code'] ?? '');
        $dto->hasPassword = (bool) ($data['has_password'] ?? false);
        $dto->shareType = (int) ($data['share_type'] ?? 0);
        $dto->extra = (array) ($data['extra'] ?? []);
        $dto->defaultOpenFileId = isset($data['default_open_file_id']) ? (string) $data['default_open_file_id'] : null;
        $dto->projectId = isset($data['project_id']) ? (string) $data['project_id'] : null;
        $dto->resourceName = (string) ($data['resource_name'] ?? '');
        $dto->shareProject = (bool) ($data['share_project'] ?? false);
        $dto->shareRange = isset($data['share_range']) ? (string) $data['share_range'] : null;
        $dto->targetIds = (array) ($data['target_ids'] ?? []);
        $dto->expireAt = isset($data['expire_at']) ? (string) $data['expire_at'] : null;
        $dto->expireDays = isset($data['expire_days']) ? (int) $data['expire_days'] : null;
        $dto->mainFileName = isset($data['main_file_name']) ? (string) $data['main_file_name'] : null;
        $dto->shareUrl = isset($data['share_url']) ? (string) $data['share_url'] : null;

        return $dto;
    }

    /**
     * 将DTO转换为数组.
     *
     * @return array 关联数组
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'resource_id' => $this->resourceId,
            'resource_type' => $this->resourceType,
            'resource_type_name' => $this->resourceTypeName,
            'share_code' => $this->shareCode,
            'has_password' => $this->hasPassword,
            'share_type' => $this->shareType,
            'extra' => $this->extra,
            'default_open_file_id' => $this->defaultOpenFileId,
            'project_id' => $this->projectId,
            'resource_name' => $this->resourceName,
            'share_project' => $this->shareProject,
            'share_range' => $this->shareRange,
            'target_ids' => $this->targetIds,
            'expire_at' => DateFormatUtil::formatExpireAt($this->expireAt),
            'expire_days' => $this->expireDays,
            'main_file_name' => $this->mainFileName,
        ];

        if ($this->shareUrl !== null) {
            $result['share_url'] = $this->shareUrl;
        }

        return $result;
    }
}
