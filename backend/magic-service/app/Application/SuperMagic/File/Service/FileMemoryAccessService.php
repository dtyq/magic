<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Service;

use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\ErrorCode\MagicFSErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use RuntimeException;
use Throwable;

/**
 * 文件记忆用户空间与子树访问服务。
 */
class FileMemoryAccessService
{
    private const array MEMORY_PATH_SEGMENTS = ['.magic', 'memory'];

    private const int MAX_PARENT_DEPTH = 128;

    /**
     * 注入用户文件、MagicFS 与分布式锁依赖。
     */
    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly MagicFSFileDomainService $magicFSFileDomainService,
        private readonly LockerInterface $locker,
    ) {
    }

    /**
     * 幂等获取或创建当前用户的 .magic/memory 根目录。
     */
    public function getOrCreateMemoryRoot(MagicUserAuthorization $authorization): TaskFileEntity
    {
        $userRootId = $this->taskFileDomainService->findOrCreateUserRootDirectory(
            $authorization->getId(),
            $authorization->getOrganizationCode(),
        );
        $userRoot = $this->taskFileDomainService->getById($userRootId);
        if ($userRoot === null || ! $this->belongsToCurrentUserSpace($userRoot, $authorization)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
        }

        $memoryRoot = $this->resolveMemoryRoot($userRoot, $authorization, false);
        if ($memoryRoot !== null) {
            return $memoryRoot;
        }

        $lockKey = sprintf(
            'file_memory:root:%s',
            hash('sha256', $authorization->getOrganizationCode() . '|' . $authorization->getId()),
        );
        $lockOwner = IdGenerator::getUniqueId32();
        if (! $this->locker->spinLock($lockKey, $lockOwner, 30)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_CONCURRENT_MODIFICATION, 'file.concurrent_modification');
        }

        try {
            return $this->resolveMemoryRoot($userRoot, $authorization, true)
                ?? throw new RuntimeException('无法创建文件记忆根目录');
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    /**
     * 获取并校验记忆子树中的文件或目录。
     */
    public function getAccessibleNode(MagicUserAuthorization $authorization, string $fileId): TaskFileEntity
    {
        if (preg_match('/^[1-9][0-9]*$/', $fileId) !== 1) {
            ExceptionBuilder::throw(MagicFSErrorCode::FILE_NOT_FOUND, 'magicfs.file_not_found');
        }
        $file = $this->taskFileDomainService->getById((int) $fileId);
        if ($file === null) {
            ExceptionBuilder::throw(MagicFSErrorCode::FILE_NOT_FOUND, 'magicfs.file_not_found');
        }

        $this->assertAccessibleNodes($authorization, [$file]);
        return $file;
    }

    /**
     * 批量加载共享父链，并校验文件或目录均属于当前用户的 .magic/memory 子树。
     *
     * @param TaskFileEntity[] $files
     */
    public function assertAccessibleNodes(MagicUserAuthorization $authorization, array $files): void
    {
        if ($files === []) {
            return;
        }

        $memoryRoot = $this->getOrCreateMemoryRoot($authorization);
        $nodeMap = [$memoryRoot->getFileId() => $memoryRoot];
        foreach ($files as $file) {
            $nodeMap[$file->getFileId()] = $file;
        }

        $parentIds = [];
        foreach ($files as $file) {
            $parentId = $file->getParentId();
            if ($parentId !== null && $parentId > 0 && ! isset($nodeMap[$parentId])) {
                $parentIds[$parentId] = $parentId;
            }
        }
        if ($parentIds !== []) {
            $ancestorNodes = $this->taskFileDomainService->getFilesWithParentsByIds(
                array_values($parentIds),
                0,
            );
            foreach ($ancestorNodes as $ancestorNode) {
                $nodeMap[$ancestorNode->getFileId()] = $ancestorNode;
            }
        }

        foreach ($files as $file) {
            $this->assertNodeInMemoryTree($file, $memoryRoot, $authorization, $nodeMap);
        }
    }

    /**
     * 获取并校验记忆子树中的目录。
     */
    public function getAccessibleDirectory(MagicUserAuthorization $authorization, string $directoryId): TaskFileEntity
    {
        $directory = $this->getAccessibleNode($authorization, $directoryId);
        if (! $directory->getIsDirectory()) {
            ExceptionBuilder::throw(MagicFSErrorCode::PARENT_NOT_DIRECTORY, 'magicfs.parent_not_directory');
        }
        return $directory;
    }

    /**
     * 判断节点是否属于当前用户空间。
     */
    public function belongsToCurrentUserSpace(
        TaskFileEntity $file,
        MagicUserAuthorization $authorization,
    ): bool {
        return $file->getProjectId() === 0
            && $file->getSpaceType() === 'user'
            && $file->getUserId() === $authorization->getId()
            && $file->getOrganizationCode() === $authorization->getOrganizationCode();
    }

    /**
     * 解析记忆目录链，并按需创建缺失目录。
     */
    private function resolveMemoryRoot(
        TaskFileEntity $userRoot,
        MagicUserAuthorization $authorization,
        bool $createMissing,
    ): ?TaskFileEntity {
        $current = $userRoot;
        foreach (self::MEMORY_PATH_SEGMENTS as $segment) {
            $child = $this->taskFileDomainService->getByProjectParentAndName(
                0,
                $current->getFileId(),
                $segment,
            );
            if ($child === null && $createMissing) {
                $child = $this->createMemoryDirectory($current, $segment);
            }
            if ($child === null) {
                return null;
            }
            if (! $child->getIsDirectory()) {
                ExceptionBuilder::throw(MagicFSErrorCode::PARENT_NOT_DIRECTORY, 'magicfs.parent_not_directory');
            }
            if (! $this->belongsToCurrentUserSpace($child, $authorization)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
            }
            $current = $child;
        }
        return $current;
    }

    /**
     * 创建记忆目录；发生并发同名创建时重新读取已有节点。
     */
    private function createMemoryDirectory(TaskFileEntity $parent, string $name): TaskFileEntity
    {
        try {
            return $this->magicFSFileDomainService->createFile(
                name: $name,
                parentId: (string) $parent->getFileId(),
                isDirectory: true,
                source: TaskFileSource::AGENT,
            );
        } catch (Throwable $throwable) {
            $existing = $this->taskFileDomainService->getByProjectParentAndName(
                0,
                $parent->getFileId(),
                $name,
            );
            if ($existing !== null) {
                return $existing;
            }
            throw $throwable;
        }
    }

    /**
     * 校验目标节点的父链属于当前 .magic/memory 子树。
     *
     * @param array<int, TaskFileEntity> $nodeMap 当前批次一次性加载的节点索引
     */
    private function assertNodeInMemoryTree(
        TaskFileEntity $file,
        TaskFileEntity $memoryRoot,
        MagicUserAuthorization $authorization,
        array $nodeMap,
    ): void {
        $current = $file;
        $visited = [];
        for ($depth = 0; $depth < self::MAX_PARENT_DEPTH; ++$depth) {
            if (! $this->belongsToCurrentUserSpace($current, $authorization)) {
                break;
            }
            if ($current->getFileId() === $memoryRoot->getFileId()) {
                return;
            }
            if (isset($visited[$current->getFileId()])) {
                break;
            }
            $visited[$current->getFileId()] = true;
            $parentId = $current->getParentId();
            if ($parentId === null || $parentId <= 0) {
                break;
            }
            $parent = $nodeMap[$parentId] ?? null;
            if ($parent === null) {
                break;
            }
            $current = $parent;
        }

        ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
    }
}
