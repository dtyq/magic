<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;

/**
 * 批量文件已删除事件.
 *
 * 用于批量删除文件场景，一次性携带多个被删除的文件信息。
 * 相比逐个发布单个文件删除事件，批量事件可以提升性能并简化事件处理逻辑。
 */
class FilesBatchDeletedEvent extends AbstractEvent
{
    /**
     * @param TaskFileEntity[] $fileEntities 被删除的文件实体数组
     * @param TaskFileEntity[] $directoryEntities 被删除的目录实体数组
     * @param string $userId 执行删除操作的用户ID
     * @param string $organizationCode 组织代码
     * @param int $projectId 项目ID
     * @param MagicUserAuthorization $userAuthorization 用户授权对象
     */
    public function __construct(
        private readonly array $fileEntities,
        private readonly array $directoryEntities,
        private readonly string $userId,
        private readonly string $organizationCode,
        private readonly int $projectId,
        private readonly MagicUserAuthorization $userAuthorization,
    ) {
        parent::__construct();
    }

    /**
     * 获取被删除的文件实体数组.
     *
     * @return TaskFileEntity[]
     */
    public function getFileEntities(): array
    {
        return $this->fileEntities;
    }

    /**
     * 获取被删除的目录实体数组.
     *
     * @return TaskFileEntity[]
     */
    public function getDirectoryEntities(): array
    {
        return $this->directoryEntities;
    }

    /**
     * 获取所有被删除的实体（文件+目录）.
     *
     * @return TaskFileEntity[]
     */
    public function getAllEntities(): array
    {
        return array_merge($this->fileEntities, $this->directoryEntities);
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function getUserAuthorization(): MagicUserAuthorization
    {
        return $this->userAuthorization;
    }

    /**
     * Get all file IDs (both files and directories).
     *
     * @return int[]
     */
    public function getFileIds(): array
    {
        $fileIds = [];
        foreach ($this->fileEntities as $fileEntity) {
            $fileIds[] = $fileEntity->getFileId();
        }
        foreach ($this->directoryEntities as $directoryEntity) {
            $fileIds[] = $directoryEntity->getFileId();
        }
        return $fileIds;
    }

    /**
     * 获取被删除的文件总数（文件+目录）.
     */
    public function getTotalCount(): int
    {
        return count($this->fileEntities) + count($this->directoryEntities);
    }
}
