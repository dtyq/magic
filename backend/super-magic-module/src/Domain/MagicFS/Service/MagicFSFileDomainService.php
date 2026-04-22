<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\MagicFS\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\MagicFSErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkFileUtil;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

class MagicFSFileDomainService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected TaskRepositoryInterface $taskRepository,
        protected CloudFileRepositoryInterface $cloudFileRepository,
        protected ProjectRepositoryInterface $projectRepository,
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
     * @param null|array<string, string> $fileMetadata 文件级持久化 flag（例如 local_shadow=1），会与 mode 一同落到 task_files.metadata JSON 列
     * @param bool $reuseDeletedFileId 同名文件若已被软删除，是否复用其原 file_id；
     *                                  agfs magicfs 插件在 checkpoint 回滚重放时置为 true，
     *                                  以保证外链引用的 file_id 在撤回/取消撤回前后保持稳定
     * @return TaskFileEntity 创建的文件实体
     */
    public function createFile(string $name, string $parentId, bool $isDirectory, ?string $superMagicTaskId = null, ?int $sortValue = null, ?FileType $fileType = null, ?TaskFileSource $source = null, ?array $fileMetadata = null, bool $reuseDeletedFileId = false): TaskFileEntity
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

        // 3. 检查同目录下是否已存在同名记录（含已软删除的）
        //
        // Checkpoint 撤回/取消撤回场景需要 file_id 稳定：撤回时文件被软删除，
        // 取消撤回会再次调用本 createFile。如果此时分配新雪花 ID，所有引用
        // 旧 ID 的外部链接都会 404。对策是由调用方显式声明「复用已删除的 ID」：
        //   - 命中活跃记录 → 同名冲突，按既有语义抛错；
        //   - 命中已软删除且 $reuseDeletedFileId=true → 复用原记录的 file_id
        //     与 file_key，视同 checkpoint 取消撤回；
        //   - 命中已软删除但 $reuseDeletedFileId=false → 直接忽略，走下方
        //     「分配新雪花 ID」路径。(project_id, parent_id, file_name) 上
        //     没有 UNIQUE 约束，旧的软删除记录留着不会阻塞新 insert；
        //     S3 侧的清理由独立的 GC 通道负责，本接口不承担回收责任。
        $existing = $this->taskFileRepository->getByProjectParentAndName(
            $projectId,
            $parentIdInt,
            $name,
            true
        );
        if ($existing !== null) {
            if ($existing->getDeletedAt() === null) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::FILE_ALREADY_EXISTS,
                    'magicfs.file_already_exists',
                    ['name' => $name]
                );
            }

            if ($reuseDeletedFileId) {
                return $this->reuseDeletedFile($existing);
            }
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

        // 10. 设置 metadata（包含 mode + 调用方传入的 file_metadata flag）
        //     mode 是 POSIX 权限位；file_metadata 是插件级持久化 bag（如
        //     local_shadow=1）。两者共用同一 JSON 列，约定 "mode" 始终由
        //     本服务计算并覆盖，其它 key 来自 $fileMetadata。
        $metadataArray = [];
        if ($fileMetadata !== null) {
            foreach ($fileMetadata as $k => $v) {
                if ($k === 'mode' || ! is_string($k) || $k === '') {
                    continue; // 禁止客户端从 file_metadata 里绕过 mode 权限逻辑
                }
                $metadataArray[$k] = (string) $v;
            }
        }
        $metadataArray['mode'] = $isDirectory ? 0755 : 0644;
        $entity->setMetadata(json_encode($metadataArray));

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
     * 更新文件元数据（文件系统语义）.
     *
     * 遵循 POSIX rename() 语义：
     * - 目标已存在且是文件 → 原子覆盖
     * - 目标已存在且是目录 → 报错（EISDIR）
     * - 目标不存在 → 正常操作
     *
     * @param string $fileId 文件ID
     * @param array $updates 更新数据（支持 name, parent_id, mode, size）
     * @return TaskFileEntity 更新后的文件实体
     */
    public function updateFile(string $fileId, array $updates): TaskFileEntity
    {
        $file = $this->getFileById($fileId);

        $oldParentId = $file->getParentId();
        $newParentIdInt = null;
        $parentChanged = false;
        $updateData = [];

        // 计算最终目标 name 和 parent_id
        $targetName = isset($updates['name']) ? trim((string) $updates['name']) : $file->getFileName();
        $targetParentIdInt = isset($updates['parent_id'])
            ? (($updates['parent_id'] === '' || $updates['parent_id'] === '0') ? null : (int) $updates['parent_id'])
            : $file->getParentId();

        // 文件系统语义：name 或 parent 变化时，覆盖目标位置的同名文件
        if ($targetName !== '' && ($targetName !== $file->getFileName() || $targetParentIdInt !== $file->getParentId())) {
            $existingTarget = $this->taskFileRepository->getByProjectParentAndName(
                $file->getProjectId(),
                $targetParentIdInt,
                $targetName
            );

            if ($existingTarget !== null && $existingTarget->getFileId() !== $file->getFileId()) {
                if ($existingTarget->getIsDirectory()) {
                    ExceptionBuilder::throw(
                        MagicFSErrorCode::FILE_ALREADY_EXISTS,
                        'magicfs.file_already_exists',
                        ['name' => $targetName]
                    );
                }
                $this->deleteFile((string) $existingTarget->getFileId());
            }
        }

        // 处理重命名
        if (isset($updates['name'])) {
            $newName = trim($updates['name']);
            if (empty($newName)) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::INVALID_FILE_NAME,
                    'magicfs.name_is_required'
                );
            }
            $updateData['file_name'] = $newName;
        }

        // 处理移动（修改 parent_id）
        if (isset($updates['parent_id'])) {
            $newParentId = $updates['parent_id'];
            $newParentIdInt = $newParentId === '' || $newParentId === '0' ? null : (int) $newParentId;

            if ($newParentIdInt !== $file->getParentId()) {
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

                $updateData['parent_id'] = $newParentIdInt;
                $parentChanged = true;
            }
        }

        // 处理 mode / file_metadata 更新
        //
        // mode 和 file_metadata 共享 task_files.metadata JSON 列：
        //   - mode 由本服务的调用方以 POSIX 权限位语义维护。
        //   - file_metadata 是插件级 flag bag（local_shadow 等）；按 API
        //     合同，显式提供时做"整体替换"（与 Go 侧 UpdateFileRequest
        //     .FileMetadata 非 nil 即覆盖的语义一致）。
        // 两者都未提供时，这一列不做任何改动。
        if (isset($updates['mode']) || array_key_exists('file_metadata', $updates)) {
            $existingMetadata = $file->getMetadata();
            $existingArray = $existingMetadata ? (json_decode($existingMetadata, true) ?: []) : [];

            if (array_key_exists('file_metadata', $updates)) {
                $next = [];
                foreach ((array) $updates['file_metadata'] as $k => $v) {
                    if ($k === 'mode' || ! is_string($k) || $k === '') {
                        continue; // 禁止通过 file_metadata 修改 mode
                    }
                    $next[$k] = (string) $v;
                }
                // mode 单独受管
                if (isset($updates['mode'])) {
                    $next['mode'] = (int) $updates['mode'];
                } elseif (array_key_exists('mode', $existingArray)) {
                    $next['mode'] = $existingArray['mode'];
                }
                $updateData['metadata'] = json_encode($next);
            } else {
                // 只有 mode 更新：保留原有 file_metadata bag
                $existingArray['mode'] = (int) $updates['mode'];
                $updateData['metadata'] = json_encode($existingArray);
            }
        }

        // 处理 size 更新
        if (isset($updates['size'])) {
            $updateData['file_size'] = (int) $updates['size'];
        }

        if (empty($updateData)) {
            return $file;
        }

        // 应用更新到实体
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

        $file->setUpdatedAt(date('Y-m-d H:i:s'));

        // Recalculate is_hidden
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

        $updatedFile = $this->taskFileRepository->updateById($file);

        // 版本更新逻辑
        if ($parentChanged) {
            if ($oldParentId !== null) {
                $this->incrementVersionChain((string) $oldParentId);
            }
            if ($newParentIdInt !== null) {
                $this->incrementVersionChain((string) $newParentIdInt);
            }
        } else {
            $this->incrementVersionChain($fileId);
        }

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
     * 默认只删除节点自身（unlink/rmdir 语义）。
     * 需要连带删除子孙时由调用方显式传 $includeDescendants = true。
     *
     * @param string $fileId 文件ID
     * @param bool $includeDescendants 是否连带删除目录下的所有子孙节点，默认 false
     */
    public function deleteFile(string $fileId, bool $includeDescendants = false): void
    {
        $this->deleteFiles([$fileId], $includeDescendants);
    }

    /**
     * 批量删除文件（软删除）.
     *
     * 默认只删除指定的节点自身。
     * 需要连带删除子孙时由调用方显式传 $includeDescendants = true。
     *
     * @param array $fileIds 文件ID数组（字符串）
     * @param bool $includeDescendants 是否连带删除目录下的所有子孙节点，默认 false
     */
    public function deleteFiles(array $fileIds, bool $includeDescendants = false): void
    {
        if (empty($fileIds)) {
            return;
        }

        $fileIdInts = array_map('intval', $fileIds);

        $files = $this->taskFileRepository->getFilesByIds($fileIdInts);

        if (empty($files)) {
            return;
        }

        $deleteIds = $fileIdInts;
        $parentIds = [];

        foreach ($files as $file) {
            $parentId = $file->getParentId();
            if ($parentId !== null) {
                $parentIds[$parentId] = true;
            }

            if ($includeDescendants && $file->getIsDirectory()) {
                $descendantIds = $this->taskFileRepository->getAllDescendantIds(
                    (int) $file->getFileId(),
                    $file->getProjectId()
                );
                if (! empty($descendantIds)) {
                    $deleteIds = array_merge($deleteIds, $descendantIds);
                }
            }
        }

        $deleteIds = array_values(array_unique($deleteIds));

        $this->taskFileRepository->deleteByIds($deleteIds, false);

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
     * 重命名文件或目录（文件系统语义）.
     *
     * 等价于 rename(old, new)，目标已存在则覆盖。
     *
     * @param string $fileId 文件ID
     * @param string $newName 新文件名
     * @return TaskFileEntity 更新后的文件实体
     */
    public function renameFile(string $fileId, string $newName): TaskFileEntity
    {
        return $this->updateFile($fileId, ['name' => $newName]);
    }

    /**
     * 恢复软删除的文件：清除 deleted_at 并将 file_size 置 0，其他字段原样保留。
     *
     * 语义（checkpoint 撤回取消撤回 / 复用已删除 file_id 场景）：
     *   - file_id、file_key、project_id、user_id、organization_code、parent_id、
     *     file_name、metadata、task_id/topic_id、file_type、is_hidden、sort、
     *     version 等全部保持不变 —— 这是外链稳定、元数据可信的前提；
     *   - 仅 file_size 归零：恢复只还原"文件存在"这一事实，后续内容由调用方
     *     通过 updateFile + PUT S3 写回；
     *   - S3 对象不动：软删除时未清理对象，恢复后的 file_key 直接复用原对象，
     *     下一步业务层 PutObject（覆盖）会把 latest_content 写回，天然一致。
     */
    public function restoreFile(string $fileId): TaskFileEntity
    {
        $fileIdInt = (int) $fileId;

        // 1. 清除 deleted_at，把软删除记录变回活跃记录
        $this->taskFileRepository->restoreFile($fileIdInt);

        // 2. 读取恢复后的实体，仅重置 file_size
        $file = $this->taskFileRepository->getById($fileIdInt);
        if ($file === null) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_NOT_FOUND,
                'magicfs.file_not_found',
                ['file_id' => $fileId]
            );
        }

        $file->setDeletedAt(null);
        $file->setFileSize(0);
        $file->setUpdatedAt(date('Y-m-d H:i:s'));

        return $this->taskFileRepository->updateById($file);
    }

    /**
     * 复用已软删除的同名记录：保留原 file_id / file_key / 元数据不变，
     * 仅把 file_size 归零并清除 deleted_at（通过 restoreFile 完成），
     * 其它字段一律不改。
     *
     * 触发条件由调用方通过 createFile($reuseDeletedFileId=true) 显式声明，
     * 典型场景是 agfs magicfs 插件在 checkpoint 回滚重放（rollback_in_progress
     * 为 true）时请求按 (project_id, parent_id, name) 复用原 file_id，
     * 使引用该 file_id 的外链在撤回/取消撤回前后保持稳定。
     *
     * 父节点链的 metadata_version 递增与正常 create 保持一致，
     * 便于上游感知目录下的新增事件。
     */
    protected function reuseDeletedFile(TaskFileEntity $deletedFile): TaskFileEntity
    {
        $originalDeletedAt = $deletedFile->getDeletedAt();

        $restored = $this->restoreFile((string) $deletedFile->getFileId());

        $parentId = $restored->getParentId();
        if ($parentId !== null && $parentId > 0) {
            $this->incrementVersionChain((string) $parentId);
        }

        $this->logger->info('[magicfs.create] reuse deleted file id', [
            'file_id' => $restored->getFileId(),
            'file_name' => $restored->getFileName(),
            'parent_id' => $parentId,
            'project_id' => $restored->getProjectId(),
            'deleted_at' => $originalDeletedAt ?? '',
        ]);

        return $restored;
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
}
