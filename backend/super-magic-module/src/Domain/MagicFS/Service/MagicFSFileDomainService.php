<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\MagicFS\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\MagicFSErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkFileUtil;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

class MagicFSFileDomainService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected TaskRepositoryInterface $taskRepository,
        protected CloudFileRepositoryInterface $cloudFileRepository,
        protected ProjectRepositoryInterface $projectRepository,
        protected LockerInterface $locker,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 根据 parent_id 查询文件列表.
     *
     * @param string $parentId Parent directory ID
     * @param null|string $storageType Optional storage type filter (e.g. 'workspace'). Null means no filter.
     */
    public function listFilesByParentId(string $parentId, ?string $storageType = null): array
    {
        // 1. 获取 project_id
        $projectId = $this->getProjectIdByParentId($parentId);

        // 2. 转换 parent_id：空字符串表示根目录，对应数据库中的 NULL 或 0
        $parentIdInt = $parentId === '' ? 0 : (int) $parentId;

        // 3. 查询该父目录下的所有子文件（不限制数量，因为这是文件系统API）
        return $this->taskFileRepository->getChildrenByParentAndProject(
            $projectId,
            $parentIdInt,
            10000  // 设置一个较大的限制值，避免意外的无限查询
        );
    }

    /**
     * 查找或创建项目根目录.
     *
     * 当 parent_id 为空时，需要获取项目的根目录作为父目录。
     * 如果根目录不存在，则自动创建。
     *
     * @param int $projectId 项目ID
     * @param string $workDir 项目工作目录
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @param string $projectOrganizationCode 项目所属组织代码（用于云存储）
     * @return int 根目录的 file_id
     */
    public function findOrCreateRootDirectory(
        int $projectId,
        string $workDir,
        string $userId,
        string $organizationCode,
        string $projectOrganizationCode
    ): int {
        // 1. 查找现有根目录 (parent_id IS NULL and is_directory = true)
        $rootDir = $this->taskFileRepository->findRootDirectoryByProjectId($projectId);

        if ($rootDir !== null) {
            return $rootDir->getFileId();
        }

        // 2. 在云存储创建根目录文件夹
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($projectOrganizationCode);
        $fullWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
        $fileKey = rtrim($fullWorkDir, '/') . '/';

        $metadata = WorkDirectoryUtil::generateDefaultWorkDirMetadata();
        $this->cloudFileRepository->createFolderByCredential(
            WorkDirectoryUtil::getPrefix($workDir),
            $projectOrganizationCode,
            $fileKey,
            StorageBucketType::SandBox,
            ['metadata' => $metadata]
        );

        // 3. 在数据库创建根目录记录
        $rootDirEntity = new TaskFileEntity();
        $rootDirEntity->setFileId(IdGenerator::getSnowId());
        $rootDirEntity->setUserId($userId);
        $rootDirEntity->setOrganizationCode($organizationCode);
        $rootDirEntity->setProjectId($projectId);
        $rootDirEntity->setFileName('/');
        $rootDirEntity->setFileKey($fileKey);
        $rootDirEntity->setFileSize(0);
        $rootDirEntity->setFileType(FileType::DIRECTORY->value);
        $rootDirEntity->setIsDirectory(true);
        $rootDirEntity->setParentId(null);
        $rootDirEntity->setSource(TaskFileSource::PROJECT_DIRECTORY);
        $rootDirEntity->setStorageType(StorageType::WORKSPACE);
        $rootDirEntity->setIsHidden(true);
        $rootDirEntity->setSort(0);
        $rootDirEntity->setLatestVersion(1);
        $rootDirEntity->setMetadataVersion(1);

        $now = date('Y-m-d H:i:s');
        $rootDirEntity->setCreatedAt($now);
        $rootDirEntity->setUpdatedAt($now);

        // 4. 保存到数据库
        $rootDirEntity = $this->taskFileRepository->insert($rootDirEntity);

        return $rootDirEntity->getFileId();
    }

    /**
     * 根据 file_id 获取文件信息.
     */
    public function getFileById(string $fileId): TaskFileEntity
    {
        // 将字符串 ID 转换为整数
        $fileIdInt = (int) $fileId;

        // 查询文件
        $file = $this->taskFileRepository->getById($fileIdInt);

        // 如果文件不存在，抛出异常
        if ($file === null) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_NOT_FOUND,
                'magicfs.file_not_found',
                ['file_id' => $fileId]
            );
        }

        return $file;
    }

    /**
     * 创建文件或目录.
     *
     * @param string $name 文件名
     * @param string $parentId 父目录ID
     * @param bool $isDirectory 是否为目录
     * @param null|string $superMagicTaskId 超级麦吉任务ID（可选）
     * @param null|int $sortValue 排序值（可选，不传则不设置排序）
     * @param null|FileType $fileType 文件类型（可选，不传则根据 isDirectory 自动推断）
     * @param null|TaskFileSource $source 文件来源（可选，不传则默认 AGENT）
     * @return TaskFileEntity 创建的文件实体
     */
    public function createFile(string $name, string $parentId, bool $isDirectory, ?string $superMagicTaskId = null, ?int $sortValue = null, ?FileType $fileType = null, ?TaskFileSource $source = null): TaskFileEntity
    {
        // 1. 获取 project_id、user_id 和 organization_code（从父文件或认证信息）
        $parentInfo = $this->getParentFileInfo($parentId);
        $projectId = $parentInfo['project_id'];
        $userId = $parentInfo['user_id'];
        $organizationCode = $parentInfo['organization_code'];

        // 转换 parent_id
        $parentIdInt = $parentId === '' ? null : (int) $parentId;

        // 2. 检查父目录是否存在并且是目录（如果指定了 parent_id）
        if ($parentId !== '' && $parentId !== '0') {
            $parentFile = $this->taskFileRepository->getById((int) $parentId);
            if ($parentFile === null) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                    'magicfs.parent_directory_not_found',
                    ['parent_id' => $parentId]
                );
            }

            // 确保父级是目录
            if (! $parentFile->getIsDirectory()) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::PARENT_NOT_DIRECTORY,
                    'magicfs.parent_not_directory',
                    ['parent_id' => $parentId]
                );
            }
        }

        // 3. 检查是否已存在同名文件（使用数据库查询）
        if ($this->fileExistsByName($projectId, $parentIdInt, $name)) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_ALREADY_EXISTS,
                'magicfs.file_already_exists',
                ['name' => $name]
            );
        }

        // 4. 生成文件 ID
        $fileId = IdGenerator::getSnowId();

        // 5. 获取项目信息（用于生成 S3 key 和对象存储操作）
        $project = $this->projectRepository->findById($projectId);
        if ($project === null) {
            // 如果项目不存在，抛出异常
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_NOT_FOUND,
                'magicfs.project_not_found',
                ['project_id' => $projectId]
            );
        }
        $workDir = $project->getWorkDir();

        // 6. 为文件生成 S3 key (完整路径)
        // 注意：目录也需要唯一的 file_key，避免唯一索引冲突
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($organizationCode);
        $s3Key = WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, (string) $fileId);

        // 7. 创建实体
        $entity = new TaskFileEntity();
        $entity->setFileId($fileId);
        $entity->setUserId($userId);
        $entity->setOrganizationCode($organizationCode);
        $entity->setProjectId($projectId);
        $entity->setFileName($name);
        $entity->setFileKey($s3Key);

        // 设置文件扩展名（目录为空字符串，文件从文件名提取）
        $fileExtension = $isDirectory ? '' : pathinfo($name, PATHINFO_EXTENSION);
        $entity->setFileExtension($fileExtension);

        $entity->setFileSize(0);
        $entity->setIsDirectory($isDirectory);
        $entity->setParentId($parentIdInt);
        $entity->setStorageType(StorageType::WORKSPACE);
        $entity->setSource($source ?? TaskFileSource::AGENT);
        $entity->setLatestVersion(1);
        $entity->setMetadataVersion(1);

        // 设置排序值（如果提供了 sortValue）
        if ($sortValue !== null) {
            $entity->setSort($sortValue);
        }

        // 8. 设置 task_id 和 topic_id（如果提供了 superMagicTaskId）
        if (! empty($superMagicTaskId)) {
            $taskEntity = $this->taskRepository->getTaskById((int) $superMagicTaskId);
            if ($taskEntity) {
                $entity->setTaskId($taskEntity->getId());
                $entity->setTopicId($taskEntity->getTopicId());
            }
        }

        // 9. 设置文件类型（如果调用方指定了 fileType 则使用，否则根据 isDirectory 自动推断）
        if ($fileType !== null) {
            $entity->setFileType($fileType->value);
        } elseif ($isDirectory) {
            $entity->setFileType(FileType::DIRECTORY->value);
        } else {
            $entity->setFileType(FileType::SYSTEM_AUTO_UPLOAD->value);
        }

        // 10. 设置 metadata（包含 mode 字段）
        $mode = $isDirectory ? 0755 : 0644;
        $metadataJson = json_encode(['mode' => $mode]);
        $entity->setMetadata($metadataJson);

        // 10.1. 设置 is_hidden（根据文件名和父目录判断）
        $entity->setIsHidden($this->determineIsHidden($name, $parentIdInt, $projectId));

        // 11. 设置时间戳
        $now = date('Y-m-d H:i:s');
        $entity->setCreatedAt($now);
        $entity->setUpdatedAt($now);

        // 11.1. 如果是文件（非目录），在对象存储上创建空文件
        if (! $isDirectory) {
            try {
                // 使用 workDir 作为 prefix（用于 STS 临时凭证的权限范围）
                $prefix = WorkDirectoryUtil::getPrefix($workDir);

                // 在对象存储上创建空文件
                $this->cloudFileRepository->createFileByCredential(
                    $prefix,
                    $organizationCode,
                    $s3Key,
                    '',  // 空内容
                    StorageBucketType::SandBox
                );
            } catch (Throwable $e) {
                // 对象存储创建失败，抛出异常，阻止数据库保存
                throw new RuntimeException(
                    sprintf('Failed to create file in object storage: %s', $e->getMessage()),
                    $e->getCode(),
                    $e
                );
            }
        }

        // 12. 保存到数据库
        $entity = $this->taskFileRepository->insert($entity);

        // 13. 更新父节点链的版本号（创建新节点影响父目录）
        if ($parentId !== '' && $parentId !== '0') {
            $this->incrementVersionChain($parentId);
        }

        // Event dispatching is handled by the application layer after this method returns.
        return $entity;
    }

    /**
     * Determine if a file should be hidden based on its relative path from project root.
     * Builds relative path by querying parent chain in one query, then checks each segment
     * against known hidden directory names.
     */
    public function determineIsHidden(string $fileName, ?int $parentId, int $projectId = 0): bool
    {
        // Quick check: if file name itself is a hidden directory
        if (WorkFileUtil::isHiddenFileName($fileName)) {
            return true;
        }

        if ($parentId === null || $parentId <= 0) {
            return false;
        }

        // Get all ancestor entities in one query
        $ancestorEntities = $this->taskFileRepository->getFilesWithParentsByIds([$parentId], $projectId);

        // Check if any ancestor's name matches hidden directory
        foreach ($ancestorEntities as $ancestor) {
            if (WorkFileUtil::isHiddenFileName($ancestor->getFileName())) {
                return true;
            }
        }

        return false;
    }

    /**
     * Upsert project file node for attachment/client-upload fallback scenarios.
     * Centralizes conflict resolution and tree consistency maintenance.
     */
    public function upsertProjectFileNode(UpsertProjectFileNodeDTO $dto): TaskFileEntity
    {
        $taskFileEntity = $dto->getTaskFileEntity();
        $fileKey = trim($taskFileEntity->getFileKey());

        if ($fileKey === '') {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_NOT_FOUND,
                'magicfs.file_not_found'
            );
        }

        $fileName = trim($taskFileEntity->getFileName());
        if ($fileName === '') {
            $fileName = basename(rtrim($fileKey, '/'));
            if ($fileName === '') {
                $fileName = '/';
            }
        }

        $parentId = $this->resolveUpsertParentId($dto);
        $lockKey = $this->getProjectNodeUpsertLockKey($dto->getProjectId(), $parentId, $fileName);
        $lockOwner = IdGenerator::getUniqueId32();

        if (! $this->locker->spinLock($lockKey, $lockOwner, 30)) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::OPERATION_FAILED,
                'magicfs.operation_failed'
            );
        }

        try {
            $existingByName = $this->taskFileRepository->getByProjectParentAndName(
                $dto->getProjectId(),
                $parentId,
                $fileName,
                $dto->isWithTrash()
            );
            $existingByFileKey = $this->taskFileRepository->getByFileKey($fileKey, withTrash: $dto->isWithTrash());

            if ($existingByName !== null
                && $existingByFileKey !== null
                && $existingByName->getFileId() !== $existingByFileKey->getFileId()) {
                $this->logger->error('Conflicting records found while upserting project file node', [
                    'project_id' => $dto->getProjectId(),
                    'parent_id' => $parentId,
                    'file_name' => $fileName,
                    'file_key' => $fileKey,
                    'name_file_id' => $existingByName->getFileId(),
                    'key_file_id' => $existingByFileKey->getFileId(),
                ]);
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_EXIST,
                    'file.file_exist'
                );
            }

            $fileEntity = $existingByName ?? $existingByFileKey;

            if ($dto->isWithTrash() && $fileEntity?->getDeletedAt() !== null) {
                $this->taskFileRepository->restoreFile($fileEntity->getFileId());
                $fileEntity->setDeletedAt(null);
            }

            if ($fileEntity !== null && ! $dto->isUpdated()) {
                return $fileEntity;
            }

            $currentTime = date('Y-m-d H:i:s');
            $isNewFile = $fileEntity === null;
            $oldParentId = $fileEntity?->getParentId();
            $source = $this->resolveTaskFileSource($taskFileEntity);

            if ($isNewFile) {
                $fileEntity = new TaskFileEntity();
                $fileEntity->setFileId(IdGenerator::getSnowId());
                $fileEntity->setCreatedAt($currentTime);
                $fileEntity->setTopicId($taskFileEntity->getTopicId());
                $fileEntity->setTaskId($taskFileEntity->getTaskId());
                $fileEntity->setSource($source);
                $fileEntity->setLatestVersion(1);
                $fileEntity->setMetadataVersion(1);
            } else {
                // Preserve AI image source priority for generated images.
                if ($source === TaskFileSource::AI_IMAGE_GENERATION) {
                    $fileEntity->setSource($source);
                } elseif ($fileEntity->getSource() === TaskFileSource::AI_IMAGE_GENERATION) {
                    $fileEntity->setSource($fileEntity->getSource());
                }
            }

            $fileEntity->setProjectId($dto->getProjectId());
            $fileEntity->setUserId($dto->getOperatorUserId());
            $fileEntity->setOrganizationCode($dto->getOperatorOrganizationCode());
            $fileEntity->setFileKey($fileKey);
            $fileEntity->setFileName($fileName);

            if ($taskFileEntity->getTopicId() > 0 && $taskFileEntity->getTopicId() !== $fileEntity->getLatestModifiedTopicId()) {
                $fileEntity->setLatestModifiedTopicId($taskFileEntity->getTopicId());
            }
            if ($taskFileEntity->getTaskId() > 0 && $taskFileEntity->getTaskId() !== $fileEntity->getLatestModifiedTaskId()) {
                $fileEntity->setLatestModifiedTaskId($taskFileEntity->getTaskId());
            }

            $fileEntity->setFileType(! empty($taskFileEntity->getFileType()) ? $taskFileEntity->getFileType() : FileType::PROCESS->value);
            $fileEntity->setFileExtension(
                ! empty($taskFileEntity->getFileExtension())
                    ? $taskFileEntity->getFileExtension()
                    : pathinfo($fileName, PATHINFO_EXTENSION)
            );
            $fileEntity->setFileSize(! empty($taskFileEntity->getFileSize()) ? $taskFileEntity->getFileSize() : 0);

            if ($dto->getStorageTypeOverride() === '') {
                $incomingStorageType = $taskFileEntity->getStorageType();
                if ($incomingStorageType->value === StorageType::WORKSPACE->value && WorkFileUtil::isSnapshotFile($fileKey)) {
                    $fileEntity->setStorageType(StorageType::SNAPSHOT);
                } else {
                    $fileEntity->setStorageType($incomingStorageType);
                }
            } else {
                $fileEntity->setStorageType($dto->getStorageTypeOverride());
            }

            $fileEntity->setIsHidden($this->determineIsHidden($fileName, $parentId, $dto->getProjectId()));
            $fileEntity->setIsDirectory($taskFileEntity->getIsDirectory());
            $fileEntity->setSort(! empty($taskFileEntity->getSort()) ? $taskFileEntity->getSort() : 0);
            $fileEntity->setParentId($parentId);
            $fileEntity->setMetadata(! empty($taskFileEntity->getMetadata()) ? $taskFileEntity->getMetadata() : '');
            $fileEntity->setDisplayConfig(! empty($taskFileEntity->getDisplayConfig()) ? $taskFileEntity->getDisplayConfig() : '');
            $fileEntity->setUpdatedAt($currentTime);

            $savedEntity = $isNewFile
                ? $this->taskFileRepository->insertOrUpdate($fileEntity)
                : $this->taskFileRepository->updateById($fileEntity);

            if ($isNewFile) {
                $this->incrementVersionChain((string) $parentId);
            } else {
                $parentChanged = $oldParentId !== $parentId;
                if ($parentChanged) {
                    if ($oldParentId !== null) {
                        $this->incrementVersionChain((string) $oldParentId);
                    }
                    $this->incrementVersionChain((string) $parentId);
                } else {
                    $this->incrementVersionChain((string) $savedEntity->getFileId());
                }
            }

            // AttachmentsProcessedEvent dispatching is handled by the application layer caller.
            return $savedEntity;
        } finally {
            if (! $this->locker->release($lockKey, $lockOwner)) {
                $this->logger->warning('Failed to release project file node upsert lock', [
                    'lock_key' => $lockKey,
                    'lock_owner' => $lockOwner,
                ]);
            }
        }
    }

    /**
     * 更新文件元数据.
     *
     * @param string $fileId 文件ID
     * @param array $updates 更新数据
     * @param null|string $superMagicTaskId 超级麦吉任务ID（可选）
     * @return TaskFileEntity 更新后的文件实体
     */
    public function updateFile(string $fileId, array $updates, ?string $superMagicTaskId = null): TaskFileEntity
    {
        // 1. 获取文件实体 (getFileById throws exception if file not found)
        $file = $this->getFileById($fileId);

        // 记录原父目录 ID（用于版本更新）
        $oldParentId = $file->getParentId();
        $newParentIdInt = null;
        $parentChanged = false;

        // 2. 构建更新数组
        $updateData = [];

        // 处理重命名
        if (isset($updates['name'])) {
            $newName = trim($updates['name']);
            if (empty($newName)) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::INVALID_FILE_NAME,
                    'magicfs.name_is_required'
                );
            }

            // 如果名字发生变化，检查同目录下是否已存在同名文件（使用数据库查询）
            if ($newName !== $file->getFileName()) {
                // TODO: 需要在 Repository 中添加 existsByParentAndNameExcludeId() 方法
                // 临时实现：查询所有子文件进行检查
                $parentIdForQuery = $file->getParentId() ?? 0;
                $siblings = $this->taskFileRepository->getChildrenByParentAndProject(
                    $file->getProjectId(),
                    $parentIdForQuery,
                    500
                );
                foreach ($siblings as $sibling) {
                    if ($sibling->getFileId() !== $file->getFileId()
                        && $sibling->getFileName() === $newName) {
                        ExceptionBuilder::throw(
                            MagicFSErrorCode::FILE_ALREADY_EXISTS,
                            'magicfs.file_already_exists',
                            ['name' => $newName]
                        );
                    }
                }
            }

            $updateData['file_name'] = $newName;
        }

        // 处理移动（修改 parent_id）
        if (isset($updates['parent_id'])) {
            $newParentId = $updates['parent_id'];
            $newParentIdInt = $newParentId === '' || $newParentId === '0' ? null : (int) $newParentId;

            // 如果 parent_id 发生变化
            if ($newParentIdInt !== $file->getParentId()) {
                // 验证新父目录存在并且是目录
                if ($newParentIdInt !== null) {
                    $newParentFile = $this->taskFileRepository->getById($newParentIdInt);
                    if ($newParentFile === null) {
                        ExceptionBuilder::throw(
                            MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                            'magicfs.parent_directory_not_found',
                            ['parent_id' => $newParentId]
                        );
                    }

                    if (! $newParentFile->getIsDirectory()) {
                        ExceptionBuilder::throw(
                            MagicFSErrorCode::PARENT_NOT_DIRECTORY,
                            'magicfs.parent_not_directory',
                            ['parent_id' => $newParentId]
                        );
                    }
                }

                // 检查目标目录下是否已存在同名文件（使用数据库查询）
                $targetParentIdForQuery = $newParentIdInt ?? 0;
                $targetSiblings = $this->taskFileRepository->getChildrenByParentAndProject(
                    $file->getProjectId(),
                    $targetParentIdForQuery,
                    500
                );
                foreach ($targetSiblings as $sibling) {
                    if ($sibling->getFileName() === $file->getFileName()) {
                        ExceptionBuilder::throw(
                            MagicFSErrorCode::FILE_ALREADY_EXISTS_IN_TARGET,
                            'magicfs.file_already_exists_in_target',
                            ['name' => $file->getFileName()]
                        );
                    }
                }

                $updateData['parent_id'] = $newParentIdInt;
                $parentChanged = true;
            }
        }

        // 处理 mode 更新
        if (isset($updates['mode'])) {
            $newMode = (int) $updates['mode'];

            // 更新 metadata 中的 mode 字段
            $existingMetadata = $file->getMetadata();
            $metadataArray = $existingMetadata ? json_decode($existingMetadata, true) : [];
            $metadataArray['mode'] = $newMode;
            $updateData['metadata'] = json_encode($metadataArray);
        }

        // 处理 size 更新
        if (isset($updates['size'])) {
            $updateData['file_size'] = (int) $updates['size'];
        }

        // 3. 更新 task_id 和 topic_id（如果提供了 superMagicTaskId）
        if (! empty($superMagicTaskId)) {
            $taskEntity = $this->taskRepository->getTaskById((int) $superMagicTaskId);
            if ($taskEntity) {
                $file->setTaskId($taskEntity->getId());
                $file->setTopicId($taskEntity->getTopicId());
            }
        }

        // 4. 如果没有任何更新，直接返回原实体
        if (empty($updateData)) {
            return $file;
        }

        // 4. 应用更新到实体
        if (isset($updateData['file_name'])) {
            $file->setFileName($updateData['file_name']);
        }

        if (isset($updateData['parent_id'])) {
            $file->setParentId($updateData['parent_id']);
        }

        if (isset($updateData['metadata'])) {
            $file->setMetadata($updateData['metadata']);
        }

        if (isset($updateData['file_size'])) {
            $file->setFileSize($updateData['file_size']);
        }

        // 5. 更新 updated_at
        $file->setUpdatedAt(date('Y-m-d H:i:s'));

        // 5.1. Recalculate is_hidden when file_name or parent_id changed
        $nameChanged = isset($updateData['file_name']);
        $hiddenChanged = false;
        if ($nameChanged || $parentChanged) {
            $newIsHidden = $this->determineIsHidden(
                $file->getFileName(),
                $file->getParentId(),
                $file->getProjectId()
            );
            if ($newIsHidden !== $file->getIsHidden()) {
                $file->setIsHidden($newIsHidden);
                $hiddenChanged = true;
            }
        }

        // 6. 执行更新
        $updatedFile = $this->taskFileRepository->updateById($file);

        // 7. 版本更新逻辑
        if ($parentChanged) {
            // 移动文件：更新原父目录和新父目录的版本链
            if ($oldParentId !== null) {
                $this->incrementVersionChain((string) $oldParentId);
            }
            if ($newParentIdInt !== null) {
                $this->incrementVersionChain((string) $newParentIdInt);
            }
        } else {
            // 普通更新：更新当前节点到根的版本链
            $this->incrementVersionChain($fileId);
        }

        // 8. If is_hidden changed and the node is a directory, batch update all descendants
        if ($hiddenChanged && $file->getIsDirectory()) {
            $descendantIds = $this->taskFileRepository->getAllDescendantIds(
                (int) $fileId,
                $file->getProjectId()
            );
            if (! empty($descendantIds)) {
                $this->taskFileRepository->batchUpdateIsHidden(
                    $descendantIds,
                    $file->getIsHidden()
                );
            }
        }

        return $updatedFile;
    }

    /**
     * 删除文件或目录（软删除）.
     *
     * @param string $fileId 文件ID
     * @param bool $recursive 是否递归删除目录子孙节点，默认 true
     * @return int 本次删除的文件数量（包含根节点）
     */
    public function deleteFile(string $fileId, bool $recursive = true): int
    {
        // 1. 获取文件实体
        $file = $this->getFileById($fileId);

        // 记录父目录 ID（用于版本更新）以及需要用于事件发布的信息
        $rootFileId = (int) $file->getFileId();
        $parentId = $file->getParentId();
        $isDirectory = $file->getIsDirectory();
        $userId = $file->getUserId();
        $organizationCode = $file->getOrganizationCode();

        // 2. 构建删除集合（目录默认递归删除所有未软删除子孙）
        $deleteIds = [$rootFileId];
        if ($isDirectory && $recursive) {
            $descendantIds = $this->taskFileRepository->getAllDescendantIds(
                $rootFileId,
                $file->getProjectId()
            );
            if (! empty($descendantIds)) {
                $deleteIds = array_values(array_unique(array_merge($deleteIds, $descendantIds)));
            }
        }

        $deletedCount = count($deleteIds);

        // 3. 批量软删除
        $this->taskFileRepository->deleteByIds($deleteIds, false);

        // 4. 更新父节点链的版本号（删除节点影响父目录）
        if ($parentId !== null) {
            $this->incrementVersionChain((string) $parentId);
        }

        // Event dispatching is handled by the application layer after this method returns.

        return $deletedCount;
    }

    /**
     * 批量删除文件（软删除）.
     *
     * 性能优化：
     * - 批量查询文件信息（1次SQL）
     * - 批量软删除文件（1次SQL）
     * - 批量更新父节点版本号（2次SQL：批量查询祖先 + 批量更新版本号）
     *
     * @param array $fileIds 文件ID数组（字符串）
     */
    public function deleteFiles(array $fileIds): void
    {
        // 0. 参数校验
        if (empty($fileIds)) {
            return;
        }

        // 转换为整数ID数组
        $fileIdInts = array_map('intval', $fileIds);

        // 1. 批量获取文件实体（1次SQL查询）
        $files = $this->taskFileRepository->getFilesByIds($fileIdInts);

        // 如果没有找到任何文件，直接返回
        if (empty($files)) {
            return;
        }

        // 2. 提取关键信息（内存操作）
        $parentIds = [];  // 需要更新版本号的父节点ID（使用数组键去重）

        foreach ($files as $file) {
            // 收集父节点ID（用于版本更新）
            $parentId = $file->getParentId();
            if ($parentId !== null) {
                $parentIds[$parentId] = true;  // 使用数组键自动去重
            }
        }

        // 3. 批量软删除文件（1次SQL）
        $this->taskFileRepository->deleteByIds($fileIdInts, false);

        // 4. 批量更新父节点链的版本号（通过 parent_id 遍历父链）
        if (! empty($parentIds)) {
            $parentIdArray = array_keys($parentIds);
            $ancestorEntities = $this->taskFileRepository->getFilesWithParentsByIds($parentIdArray);
            $allAncestorIds = array_map(
                fn ($entity) => $entity->getFileId(),
                $ancestorEntities
            );

            if (! empty($allAncestorIds)) {
                $this->taskFileRepository->incrementMetadataVersionByIds($allAncestorIds);
            }
        }
    }

    /**
     * 批量获取文件元数据版本号.
     *
     * @param array $fileIds 文件ID数组（字符串）
     * @return array<string, int> file_id => metadata_version 的映射
     */
    public function getFileVersionsByIds(array $fileIds): array
    {
        // 转换为整数ID数组
        $fileIdInts = array_map('intval', $fileIds);

        return $this->taskFileRepository->getMetadataVersionsByIds($fileIdInts);
    }

    /**
     * 更新从指定节点到根的所有元数据版本号（版本链更新）.
     *
     * 当一个节点发生变化时，需要更新整条路径上所有祖先节点的版本号。
     * 这样客户端只需要检查根节点的版本号，就能知道树中是否有任何变化。
     *
     * @param string $fileId 起始文件ID
     */
    public function incrementVersionChain(string $fileId): void
    {
        // 通过 parent_id 链遍历所有祖先节点（包括自己）
        $ancestorEntities = $this->taskFileRepository->getFilesWithParentsByIds([(int) $fileId]);
        if (empty($ancestorEntities)) {
            return;
        }

        $ancestorIds = array_map(
            fn ($entity) => $entity->getFileId(),
            $ancestorEntities
        );

        $this->taskFileRepository->incrementMetadataVersionByIds($ancestorIds);
    }

    /**
     * 获取文件树（递归获取所有子文件和目录）.
     *
     * @param string $fileId 文件ID
     * @param int $depth 递归深度，-1 表示无限深度
     * @param int $currentDepth 当前深度（内部使用）
     * @param null|string $storageType Optional storage type filter (e.g. 'workspace'). Null means no filter.
     * @return array 文件树数据 [rootFile, childrenMap]
     */
    public function getFileTree(string $fileId, int $depth = -1, int $currentDepth = 0, ?string $storageType = null): array
    {
        // 1. 获取根文件/目录
        $rootFile = $this->getFileById($fileId);

        // 2. 获取 project_id
        $projectId = $rootFile->getProjectId();

        // 3. 检查是否需要继续递归
        if ($depth !== -1 && $currentDepth >= $depth) {
            // 已达到最大深度，不再递归
            return [
                'root' => $rootFile,
                'children' => [],
            ];
        }

        // 4. 一次性查询所有子文件（批量查询，避免 N+1）
        $allChildren = $this->getAllChildrenByProjectIdAndParentId($projectId, $fileId, $depth, $currentDepth, $storageType);

        return [
            'root' => $rootFile,
            'children' => $allChildren,
        ];
    }

    /**
     * 重命名文件或目录.
     *
     * 这是对 updateFile 的语义化封装，专门用于文件重命名场景。
     * 按照 DDD 原则，领域事件由领域层发布。
     *
     * @param string $fileId 文件ID
     * @param string $newName 新文件名
     * @param null|string $superMagicTaskId 超级麦吉任务ID（可选）
     * @return TaskFileEntity 更新后的文件实体
     */
    public function renameFile(string $fileId, string $newName, ?string $superMagicTaskId = null): TaskFileEntity
    {
        // 1. 调用 updateFile 执行重命名逻辑
        return $this->updateFile($fileId, ['name' => $newName], $superMagicTaskId);
        // Event dispatching is handled by the application layer after this method returns.
    }

    /**
     * 移动文件或目录到新的父目录.
     *
     * 这是对 updateFile 的语义化封装，专门用于文件移动场景。
     * 按照 DDD 原则，领域事件由领域层发布。
     *
     * 注意：
     * - 此方法只支持同项目内移动（project_id 不会改变）
     * - 如果需要跨项目移动，应用层需要特殊处理
     * - file_key 不会改变，因为它是基于 fileId 生成的
     * - 只更新数据库中的 parent_id，不操作 S3
     *
     * @param string $fileId 文件ID
     * @param string $targetParentId 目标父目录ID（空字符串或"0"表示根目录）
     * @param null|string $superMagicTaskId 超级麦吉任务ID（可选）
     * @param bool $overwrite 是否覆盖目标目录同名文件（仅文件，目录冲突仍报错）
     * @return TaskFileEntity 更新后的文件实体
     * @throws BusinessException 如果目标父目录不存在、不是目录、或存在同名文件冲突
     */
    public function moveFile(
        string $fileId,
        string $targetParentId,
        ?string $superMagicTaskId = null,
        bool $overwrite = false
    ): TaskFileEntity {
        $sourceFile = $this->getFileById($fileId);

        if ($overwrite) {
            $targetParentIdInt = $targetParentId === '' || $targetParentId === '0' ? null : (int) $targetParentId;
            $existingTarget = $this->taskFileRepository->getByProjectParentAndName(
                $sourceFile->getProjectId(),
                $targetParentIdInt,
                $sourceFile->getFileName()
            );

            if ($existingTarget !== null && $existingTarget->getFileId() !== $sourceFile->getFileId()) {
                if ($existingTarget->getIsDirectory()) {
                    ExceptionBuilder::throw(
                        MagicFSErrorCode::FILE_ALREADY_EXISTS_IN_TARGET,
                        'magicfs.file_already_exists_in_target',
                        ['name' => $sourceFile->getFileName()]
                    );
                }

                $this->deleteFile((string) $existingTarget->getFileId());
            }
        }

        // Record old parent before the move so subscribers can clean up the old location
        $oldParentId = $sourceFile->getParentId();

        // 1. 调用 updateFile 执行移动逻辑
        // updateFile 会自动处理：
        // - 验证目标父目录是否存在并且是目录（第330-348行）
        // - 检查目标目录下是否已存在同名文件（第350-365行）
        // - 更新数据库中的 parent_id（第402-404行）
        // - 更新闭包表索引（第416-424行）
        // - 更新父节点链的版本号（第427-434行）
        return $this->updateFile(
            $fileId,
            ['parent_id' => $targetParentId],
            $superMagicTaskId
        );

        // Event dispatching (FileMovedEvent with oldParentId) is handled by the application layer.
    }

    /**
     * 复制文件到目标父目录.
     *
     * 这是对文件复制操作的语义化封装。
     * 与 moveFile 不同，copyFile 会在目标位置创建新文件，源文件保持不变。
     *
     * 注意：
     * - 此方法只支持复制单个文件（不支持目录递归复制）
     * - 支持同项目与跨项目复制（目标项目由 targetParentId 所属目录决定）
     * - 如果目标位置已存在同名文件，会自动生成唯一文件名（如：文件名(1).扩展名）
     * - file_key 会根据新文件ID重新生成
     *
     * @param string $fileId 源文件ID
     * @param string $targetParentId 目标父目录ID（空字符串或"0"表示根目录）
     * @param null|string $newFileName 新文件名（可选，不传则使用源文件名）
     * @param null|string $superMagicTaskId 超级麦吉任务ID（可选）
     * @param bool $overwrite 是否覆盖同名文件（仅文件；同名目录不覆盖，自动走重命名）
     * @return TaskFileEntity 新创建的文件实体
     * @throws BusinessException 如果源文件不存在、是目录、目标父目录不存在或不是目录
     */
    public function copyFile(
        string $fileId,
        string $targetParentId,
        ?string $newFileName = null,
        ?string $superMagicTaskId = null,
        bool $overwrite = false
    ): TaskFileEntity {
        // 1. 获取源文件实体
        $sourceFile = $this->getFileById($fileId);

        // 2. 检查是否为目录（不支持目录复制）
        if ($sourceFile->getIsDirectory()) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::OPERATION_FAILED,
                'magicfs.cannot_copy_directory',
                ['file_id' => $fileId]
            );
        }

        // 3. 确定目标文件名
        $targetFileName = $newFileName ?? $sourceFile->getFileName();

        // 4. 转换 target_parent_id
        $targetParentIdInt = $targetParentId === '' || $targetParentId === '0' ? null : (int) $targetParentId;

        $targetParentFile = null;

        // 5. 验证目标父目录（如果指定了）
        if ($targetParentIdInt !== null) {
            $targetParentFile = $this->taskFileRepository->getById($targetParentIdInt);
            if ($targetParentFile === null) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                    'magicfs.parent_directory_not_found',
                    ['parent_id' => $targetParentId]
                );
            }

            // 确保目标父级是目录
            if (! $targetParentFile->getIsDirectory()) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::PARENT_NOT_DIRECTORY,
                    'magicfs.parent_not_directory',
                    ['parent_id' => $targetParentId]
                );
            }
        }

        // 目标项目/组织由目标父目录决定（兼容跨项目复制）
        $targetProjectId = $targetParentFile?->getProjectId() ?? $sourceFile->getProjectId();
        $targetOrganizationCode = $targetParentFile?->getOrganizationCode() ?? $sourceFile->getOrganizationCode();
        $targetUserId = $targetParentFile?->getUserId() ?? $sourceFile->getUserId();

        // 5.1 冲突处理：覆盖模式优先删除目标同名文件；保留模式自动改名
        $existingTarget = $this->taskFileRepository->getByProjectParentAndName(
            $targetProjectId,
            $targetParentIdInt,
            $targetFileName
        );

        if ($overwrite) {
            if ($existingTarget !== null && $existingTarget->getFileId() !== $sourceFile->getFileId()) {
                // 仅覆盖同名文件；同名目录不做删除，避免目录级数据被误清理
                if (! $existingTarget->getIsDirectory()) {
                    $this->deleteFile((string) $existingTarget->getFileId());
                } else {
                    $targetFileName = $this->generateUniqueFileNameIfNeeded(
                        $targetProjectId,
                        $targetParentIdInt,
                        $targetFileName
                    );
                }
            } elseif ($existingTarget !== null) {
                // 同目录复制自己时，不执行覆盖，退化为保留双方
                $targetFileName = $this->generateUniqueFileNameIfNeeded(
                    $targetProjectId,
                    $targetParentIdInt,
                    $targetFileName
                );
            }
        } else {
            $targetFileName = $this->generateUniqueFileNameIfNeeded(
                $targetProjectId,
                $targetParentIdInt,
                $targetFileName
            );
        }

        // 6. 获取项目信息（用于生成 S3 key 和对象存储操作）
        $project = $this->projectRepository->findById($targetProjectId);
        if ($project === null) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_NOT_FOUND,
                'magicfs.project_not_found',
                ['project_id' => $targetProjectId]
            );
        }
        $workDir = $project->getWorkDir();
        $organizationCode = $targetOrganizationCode;

        // 7. 生成新的文件ID和file_key
        $newFileId = IdGenerator::getSnowId();
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($organizationCode);
        $newFileKey = WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, (string) $newFileId);

        // 8. 在云存储中复制文件
        try {
            $prefix = WorkDirectoryUtil::getPrefix($workDir);
            $this->cloudFileRepository->copyObjectByCredential(
                $prefix,
                $organizationCode,
                $sourceFile->getFileKey(),
                $newFileKey,
                StorageBucketType::SandBox
            );
        } catch (Throwable $e) {
            throw new RuntimeException(
                sprintf('Failed to copy file in object storage: %s', $e->getMessage()),
                $e->getCode(),
                $e
            );
        }

        // 9. 创建新的文件实体
        $newFileEntity = new TaskFileEntity();
        $newFileEntity->setFileId($newFileId);
        $newFileEntity->setUserId($targetUserId);
        $newFileEntity->setOrganizationCode($targetOrganizationCode);
        $newFileEntity->setProjectId($targetProjectId);
        $newFileEntity->setFileName($targetFileName);
        $newFileEntity->setFileKey($newFileKey);

        // 设置文件扩展名
        $fileExtension = pathinfo($targetFileName, PATHINFO_EXTENSION);
        $newFileEntity->setFileExtension($fileExtension);

        $newFileEntity->setFileSize($sourceFile->getFileSize());
        $newFileEntity->setIsDirectory(false);
        $newFileEntity->setParentId($targetParentIdInt);
        $newFileEntity->setIsHidden($this->determineIsHidden($targetFileName, $targetParentIdInt, $targetProjectId));
        $newFileEntity->setStorageType($sourceFile->getStorageType());
        $newFileEntity->setSource(TaskFileSource::COPY);
        $newFileEntity->setLatestVersion(1);
        $newFileEntity->setMetadataVersion(1);

        // 复制文件类型
        $newFileEntity->setFileType($sourceFile->getFileType());

        // 复制 metadata 和 display_config
        $newFileEntity->setMetadata($sourceFile->getMetadata());
        $newFileEntity->setDisplayConfig($sourceFile->getDisplayConfig());

        // 10. 设置 task_id 和 topic_id（如果提供了 superMagicTaskId）
        if (! empty($superMagicTaskId)) {
            $taskEntity = $this->taskRepository->getTaskById((int) $superMagicTaskId);
            if ($taskEntity) {
                $newFileEntity->setTaskId($taskEntity->getId());
                $newFileEntity->setTopicId($taskEntity->getTopicId());
            }
        }

        // 11. 设置时间戳
        $now = date('Y-m-d H:i:s');
        $newFileEntity->setCreatedAt($now);
        $newFileEntity->setUpdatedAt($now);

        // 12. 保存到数据库
        $newFileEntity = $this->taskFileRepository->insert($newFileEntity);

        // 13. 更新目标父节点链的版本号（新增文件影响父目录）
        if ($targetParentIdInt !== null) {
            $this->incrementVersionChain((string) $targetParentIdInt);
        }

        // Event dispatching is handled by the application layer after this method returns.
        return $newFileEntity;
    }

    /**
     * Replace file with new file content.
     *
     * @param string $fileId Target file ID to replace
     * @param string $sourceFileKey New file key in cloud storage (source file to replace with)
     * @param null|string $newFileName New file name (optional, if not provided will use original filename)
     * @return TaskFileEntity Updated file entity
     * @throws RuntimeException When cloud storage operation fails
     */
    public function replaceFile(
        string $fileId,
        string $sourceFileKey,
        ?string $newFileName = null
    ): TaskFileEntity {
        // 1. Get original file entity
        $originalFile = $this->getFileById($fileId);

        // 2. Check if it's a directory (cannot replace directory)
        if ($originalFile->getIsDirectory()) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::OPERATION_FAILED,
                'magicfs.cannot_replace_directory',
                ['file_id' => $fileId]
            );
        }

        // 3. Get project info
        $project = $this->projectRepository->findById($originalFile->getProjectId());
        if ($project === null) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_NOT_FOUND,
                'magicfs.project_not_found',
                ['project_id' => $originalFile->getProjectId()]
            );
        }

        $workDir = $project->getWorkDir();
        $organizationCode = $originalFile->getOrganizationCode();
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($organizationCode);

        // 4. Verify source file exists in cloud storage
        if (! $this->checkFileExistsInStorage($sourceFileKey, $organizationCode)) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_NOT_FOUND,
                'magicfs.source_file_not_found_in_storage',
                ['source_file_key' => $sourceFileKey]
            );
        }

        // 5. Determine final file name
        $finalFileName = $newFileName ?? $originalFile->getFileName();

        // 6. Build target file_key (key difference from copyFile)
        // Strategy: based on original file's parent directory path + new file name
        $originalFileKey = $originalFile->getFileKey();
        if ($finalFileName === $originalFile->getFileName()) {
            // File name unchanged, keep original file_key
            $targetFileKey = $originalFileKey;
        } else {
            // File name changed, build new file_key: original directory + new file name
            $targetFileKey = dirname($originalFileKey) . '/' . $finalFileName;

            // Check if target location already has another file (name conflict)
            $existingFile = $this->taskFileRepository->getByFileKey($targetFileKey);
            if ($existingFile !== null && $existingFile->getFileId() !== $originalFile->getFileId()) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::FILE_ALREADY_EXISTS,
                    'magicfs.target_file_already_exists',
                    ['target_file_key' => $targetFileKey]
                );
            }
        }

        // 7. Work directory security check (prevent path traversal)
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $targetFileKey)) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::INVALID_FILE_KEY,
                'magicfs.illegal_file_key',
                ['target_file_key' => $targetFileKey]
            );
        }

        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $sourceFileKey)) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::INVALID_FILE_KEY,
                'magicfs.source_file_key_illegal',
                ['source_file_key' => $sourceFileKey]
            );
        }

        // 8. Cloud storage operations (optimized to avoid unnecessary deletions)
        try {
            $prefix = WorkDirectoryUtil::getPrefix($workDir);

            // Optimization: if source file is already at target location, skip cloud operations
            if ($sourceFileKey !== $targetFileKey) {
                // If target location has old file, delete it first
                if ($originalFileKey === $targetFileKey) {
                    $this->cloudFileRepository->deleteObjectByCredential(
                        $prefix,
                        $organizationCode,
                        $originalFileKey,
                        StorageBucketType::SandBox
                    );
                }

                // Move new file to target location
                $this->cloudFileRepository->renameObjectByCredential(
                    $prefix,
                    $organizationCode,
                    $sourceFileKey,
                    $targetFileKey,
                    StorageBucketType::SandBox
                );
            }
            // else: Source file already at target location, no operation needed

            // Cleanup: if original file location differs from target location, delete original file
            if ($originalFileKey !== $targetFileKey
                && $originalFileKey !== $sourceFileKey
                && $this->checkFileExistsInStorage($originalFileKey, $organizationCode)) {
                $this->cloudFileRepository->deleteObjectByCredential(
                    $prefix,
                    $organizationCode,
                    $originalFileKey,
                    StorageBucketType::SandBox
                );
            }
        } catch (Throwable $e) {
            throw new RuntimeException(
                sprintf('Failed to replace file in object storage: %s', $e->getMessage()),
                $e->getCode(),
                $e
            );
        }

        // 9. Get new file metadata (size, etc.)
        $newFileInfo = $this->getFileInfoFromStorage($targetFileKey, $organizationCode);

        // 10. Update file entity
        $originalFile->setFileName($finalFileName);
        $originalFile->setFileKey($targetFileKey);

        // Update file extension
        $fileExtension = pathinfo($finalFileName, PATHINFO_EXTENSION);
        $originalFile->setFileExtension($fileExtension);

        // Update file size
        $originalFile->setFileSize($newFileInfo['size'] ?? 0);

        // Update modification time
        $originalFile->setUpdatedAt(date('Y-m-d H:i:s'));

        // Increment version number
        $originalFile->setLatestVersion($originalFile->getLatestVersion() + 1);

        // 11. Save to database
        $updatedFile = $this->taskFileRepository->updateById($originalFile);

        // 12. Update parent node chain version (file content change affects parent directory)
        $parentId = $originalFile->getParentId();
        if ($parentId !== null) {
            $this->incrementVersionChain((string) $parentId);
        }

        return $updatedFile;
    }

    public function getFileByName(int $projectId, ?int $parentId, string $fileName, bool $withTrash = false): ?TaskFileEntity
    {
        return $this->taskFileRepository->getByProjectParentAndName($projectId, $parentId, $fileName, $withTrash);
    }

    /**
     * 根据 parent_id 获取 project_id.
     */
    protected function getProjectIdByParentId(string $parentId): int
    {
        // 如果 parent_id 为空（根目录），需要其他方式获取 project_id
        // 这里暂时返回 0，实际使用时可能需要从认证信息或其他地方获取
        if ($parentId === '' || $parentId === '0') {
            // TODO: 从认证信息或上下文获取 project_id
            // 或者要求根目录查询必须先创建一个项目根节点
            return 0;
        }

        // 从父文件获取 project_id
        $parentFile = $this->taskFileRepository->getById((int) $parentId);
        if ($parentFile === null) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                'magicfs.parent_directory_not_found',
                ['parent_id' => $parentId]
            );
        }

        return $parentFile->getProjectId();
    }

    /**
     * 检查同名文件是否存在（使用数据库查询，不在内存中操作）.
     *
     * 注意：此方法需要在 TaskFileRepository 中添加 existsByParentAndName() 方法
     */
    protected function fileExistsByName(int $projectId, ?int $parentId, string $fileName): bool
    {
        $fileEntity = $this->taskFileRepository->getByProjectParentAndName($projectId, $parentId, $fileName);
        return $fileEntity !== null;
    }

    /**
     * 根据 parent_id 获取 project_id、user_id 和 organization_code.
     */
    protected function getParentFileInfo(string $parentId): array
    {
        if ($parentId === '' || $parentId === '0') {
            // 根目录，返回默认值
            // TODO: 从认证信息或上下文获取这些值
            return [
                'project_id' => 0,
                'user_id' => '',
                'organization_code' => '',
            ];
        }

        // 从父文件获取
        $parentFile = $this->taskFileRepository->getById((int) $parentId);
        if ($parentFile === null) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                'magicfs.parent_directory_not_found',
                ['parent_id' => $parentId]
            );
        }

        return [
            'project_id' => $parentFile->getProjectId(),
            'user_id' => $parentFile->getUserId(),
            'organization_code' => $parentFile->getOrganizationCode(),
        ];
    }

    /**
     * 检查目录是否不为空（使用数据库查询，不在内存中操作）.
     *
     * 注意：此方法需要在 TaskFileRepository 中添加 hasChildren() 方法
     */
    protected function isDirectoryNotEmpty(int $projectId, int $parentId): bool
    {
        // TODO: 需要在 Repository 中添加此方法
        // return $this->taskFileRepository->hasChildren($projectId, $parentId);

        // 临时实现：查询子文件（上线前需要优化为数据库查询）
        $children = $this->taskFileRepository->getChildrenByParentAndProject($projectId, $parentId, 1);
        return count($children) > 0;
    }

    /**
     * 获取所有子文件（通过 parent_id BFS 遍历）.
     *
     * @param int $projectId 项目ID
     * @param string $parentId 父文件ID
     * @param int $maxDepth 最大深度
     * @param int $currentDepth 当前深度
     * @param null|string $storageType Optional storage type filter (e.g. 'workspace'). Null means no filter.
     * @return array<TaskFileEntity> 所有子文件数组
     */
    protected function getAllChildrenByProjectIdAndParentId(
        int $projectId,
        string $parentId,
        int $maxDepth = -1,
        int $currentDepth = 0,
        ?string $storageType = null
    ): array {
        $maxDepthParam = $maxDepth !== -1 ? $maxDepth : 100;
        $descendantIds = $this->taskFileRepository->getAllDescendantIds(
            (int) $parentId,
            $projectId,
            $maxDepthParam
        );

        if (empty($descendantIds)) {
            return [];
        }

        return $this->taskFileRepository->getFilesByIds(
            $descendantIds,
            $projectId,
            $storageType
        );
    }

    /**
     * 构建父子关系映射.
     *
     * @param array<TaskFileEntity> $files 文件数组
     * @return array<string, array<TaskFileEntity>> 父ID => 子文件数组的映射
     */
    protected function buildChildrenMap(array $files): array
    {
        $childrenMap = [];

        foreach ($files as $file) {
            $parentId = (string) ($file->getParentId() ?? '');
            if (! isset($childrenMap[$parentId])) {
                $childrenMap[$parentId] = [];
            }
            $childrenMap[$parentId][] = $file;
        }

        return $childrenMap;
    }

    /**
     * 检查文件名是否冲突，如果冲突则生成唯一文件名.
     *
     * 当目标目录下已存在同名文件时，自动生成格式为 "文件名(1).扩展名" 的唯一文件名。
     * 支持双扩展名（如 .tar.gz）。
     * 优先尝试 (1) 到 (10) 的后缀，如果都被占用则使用时间戳。
     *
     * @param int $projectId 项目ID
     * @param null|int $parentId 父目录ID
     * @param string $fileName 原始文件名
     * @return string 唯一的文件名（如果不冲突则返回原文件名）
     */
    protected function generateUniqueFileNameIfNeeded(
        int $projectId,
        ?int $parentId,
        string $fileName
    ): string {
        // 1. 查询同一父目录下的所有文件
        $parentIdForQuery = $parentId ?? 0;
        $siblings = $this->taskFileRepository->getChildrenByParentAndProject(
            $projectId,
            $parentIdForQuery,
            500
        );

        // 2. 构建已存在的文件名集合（用于快速查找）
        $existingFileNames = [];
        foreach ($siblings as $sibling) {
            $existingFileNames[$sibling->getFileName()] = true;
        }

        // 3. 如果文件名不冲突，直接返回
        if (! isset($existingFileNames[$fileName])) {
            return $fileName;
        }

        // 4. 解析文件名和扩展名
        $pathInfo = pathinfo($fileName);
        $baseName = $pathInfo['filename'];
        $extension = isset($pathInfo['extension']) ? '.' . $pathInfo['extension'] : '';

        // 5. 处理双扩展名（如 .tar.gz）
        if (preg_match('/^(.+?)(\.[a-z0-9]+\.[a-z0-9]+)$/i', $fileName, $matches)) {
            $baseName = $matches[1];
            $extension = $matches[2];
        }

        // 6. 尝试生成 (1) 到 (10) 的候选文件名
        for ($i = 1; $i <= 10; ++$i) {
            $candidateName = $baseName . '(' . $i . ')' . $extension;
            if (! isset($existingFileNames[$candidateName])) {
                return $candidateName;
            }
        }

        // 7. 后备方案：所有候选都被占用，使用时间戳
        $timestamp = time();
        $microtime = substr((string) microtime(true), -6);  // 取最后6位数字保证唯一性
        return $baseName . '_' . $timestamp . $microtime . $extension;
    }

    private function resolveUpsertParentId(UpsertProjectFileNodeDTO $dto): int
    {
        $taskFileEntity = $dto->getTaskFileEntity();
        $parentId = $taskFileEntity->getParentId();

        if ($parentId !== null && $parentId > 0) {
            $parentFile = $this->taskFileRepository->getById($parentId);
            if ($parentFile === null) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                    'magicfs.parent_directory_not_found',
                    ['parent_id' => $parentId]
                );
            }

            if (! $parentFile->getIsDirectory()) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::PARENT_NOT_DIRECTORY,
                    'magicfs.parent_not_directory',
                    ['parent_id' => $parentId]
                );
            }

            if ($parentFile->getProjectId() !== $dto->getProjectId()) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::FILE_NOT_FOUND,
                    'magicfs.file_not_found'
                );
            }

            return $parentId;
        }

        return $this->findOrCreateRootDirectory(
            $dto->getProjectId(),
            $dto->getProjectWorkDir(),
            $dto->getOperatorUserId(),
            $dto->getOperatorOrganizationCode(),
            $dto->getProjectOrganizationCode()
        );
    }

    private function resolveTaskFileSource(TaskFileEntity $taskFileEntity): TaskFileSource
    {
        try {
            return $taskFileEntity->getSource();
        } catch (Throwable) {
            return TaskFileSource::DEFAULT;
        }
    }

    private function getProjectNodeUpsertLockKey(int $projectId, ?int $parentId, string $fileName): string
    {
        return sprintf(
            'magicfs:file_node_upsert:%d:%d:%s',
            $projectId,
            (int) ($parentId ?? 0),
            md5($fileName)
        );
    }

    /**
     * Check if file exists in cloud storage.
     */
    private function checkFileExistsInStorage(string $fileKey, string $organizationCode): bool
    {
        try {
            $this->cloudFileRepository->getHeadObjectByCredential(
                $organizationCode,
                $fileKey,
                StorageBucketType::SandBox
            );
            return true;
        } catch (Throwable $e) {
            return false;
        }
    }

    /**
     * Get file info from cloud storage.
     */
    private function getFileInfoFromStorage(string $fileKey, string $organizationCode): array
    {
        try {
            $headObjectResult = $this->cloudFileRepository->getHeadObjectByCredential(
                $organizationCode,
                $fileKey,
                StorageBucketType::SandBox
            );
            return [
                'size' => $headObjectResult['content_length'] ?? 0,
                'last_modified' => date('Y-m-d H:i:s'),
            ];
        } catch (Throwable $e) {
            return [
                'size' => 0,
                'last_modified' => date('Y-m-d H:i:s'),
            ];
        }
    }
}
