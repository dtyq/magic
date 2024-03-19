<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Response;

/**
 * 带密码的分享项目DTO.
 * 该DTO仅用于需要返回密码的特定接口.
 */
class ShareItemWithPasswordDTO extends ShareItemDTO
{
    /**
     * @var string 分享密码（明文）
     */
    public string $password = '';

    /**
     * @var array<string> 文件ID列表，当资源类型是文件时使用
     */
    public array $file_ids = [];

    /**
     * @var string 项目ID，当资源类型是文件时使用
     */
    public string $project_id = '';

    /**
     * 从基础DTO创建带密码的DTO.
     *
     * @param ShareItemDTO $baseDto 基础DTO
     * @param string $password 解密后的密码
     */
    public static function fromBaseDto(ShareItemDTO $baseDto, string $password): self
    {
        $dto = new self();
        $dto->id = $baseDto->id;
        $dto->resourceId = $baseDto->resourceId;
        $dto->resourceType = $baseDto->resourceType;
        $dto->resourceTypeName = $baseDto->resourceTypeName;
        $dto->shareCode = $baseDto->shareCode;
        $dto->hasPassword = $baseDto->hasPassword;
        $dto->password = $password;
        $dto->shareType = $baseDto->shareType;
        $dto->extra = $baseDto->extra;
        $dto->defaultOpenFileId = $baseDto->defaultOpenFileId;
        $dto->projectId = $baseDto->projectId;
        if ($baseDto->projectId !== null && $baseDto->projectId !== '') {
            $dto->setProjectId($baseDto->projectId);
        }
        $dto->resourceName = $baseDto->resourceName;
        $dto->shareProject = $baseDto->shareProject;
        $dto->shareRange = $baseDto->shareRange;
        $dto->targetIds = $baseDto->targetIds;
        $dto->expireAt = $baseDto->expireAt;
        $dto->expireDays = $baseDto->expireDays;
        $dto->mainFileName = $baseDto->mainFileName;

        return $dto;
    }

    /**
     * 设置文件ID列表.
     *
     * @param array<string> $fileIds 文件ID列表
     * @return $this
     */
    public function setFileIds(array $fileIds): self
    {
        $this->file_ids = $fileIds;

        return $this;
    }

    /**
     * 设置项目ID.
     *
     * @param string $projectId 项目ID
     * @return $this
     */
    public function setProjectId(string $projectId): self
    {
        $this->project_id = $projectId;

        return $this;
    }

    /**
     * 将DTO转换为数组.
     *
     * @return array 关联数组
     */
    public function toArray(): array
    {
        $data = parent::toArray();
        $data['password'] = $this->password;
        $data['file_ids'] = $this->file_ids;
        $data['project_id'] = $this->project_id;

        return $data;
    }
}
