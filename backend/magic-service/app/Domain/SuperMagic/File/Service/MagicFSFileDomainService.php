<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\ErrorCode\MagicFSErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\Utils\ContentTypeUtil;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Infrastructure\SuperMagic\Utils\WorkFileUtil;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

class MagicFSFileDomainService
{
    /**
     * Collision policy: reject the rename when the destination exists.
     */
    public const RENAME_ON_EXISTS_FAIL = 'fail';

    /**
     * Collision policy: the destination absorbs the source and survives.
     */
    public const RENAME_ON_EXISTS_REPLACE = 'replace';

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
     */
    public function listFilesByParentId(string $parentId, ?string $spaceType = null): array
    {
        // 空字符串表示根目录。 MagicFS mounts always pass a concrete root
        // file ID; the legacy empty-parent form is retained for compatibility.
        $parentIdInt = $parentId === '' ? 0 : (int) $parentId;
        $rows = $this->taskFileRepository->getFileTreeChildrenByParentCursor(
            $parentIdInt,
            '',
            null,
            null,
            10000,
            [],
            ''
        );

        return array_map(
            static fn (array|object $row): TaskFileEntity => TaskFileEntity::fromRow((array) $row),
            $rows
        );
    }

    /**
     * Read one bounded page of direct children using a stable (sort,file_id)
     * keyset.  The method deliberately returns entities only for this page;
     * callers must never use it as a recursive tree loader.
     *
     * @return array{items: TaskFileEntity[], has_more: bool}
     */
    public function listFilesPageByParentId(
        string $parentId,
        ?int $afterSort,
        ?int $afterFileId,
        int $limit,
        string $fileName = ''
    ): array {
        $parentIdInt = (int) $parentId;
        // space_type is the file-tree boundary. Do not rely solely on the
        // legacy storage_type column: historical user rows can contain the
        // workspace value while still belonging to the user file tree.
        $storageType = '';

        // Fetch one look-ahead row so the response can expose has_more without
        // issuing a COUNT(*) over a potentially enormous directory.
        $rows = $this->taskFileRepository->getFileTreeChildrenByParentCursor(
            $parentIdInt,
            $storageType,
            $afterSort,
            $afterFileId,
            $limit + 1,
            [],
            $fileName
        );

        $hasMore = count($rows) > $limit;
        if ($hasMore) {
            array_pop($rows);
        }

        $items = [];
        foreach ($rows as $row) {
            $items[] = TaskFileEntity::fromRow((array) $row);
        }

        return [
            'items' => $items,
            'has_more' => $hasMore,
        ];
    }

    /**
     * 根据 file_id 获取文件信息.
     */
    public function getFileById(string $fileId): TaskFileEntity
    {
        // 将字符串 ID 转换为整数
        $fileIdInt = (int) $fileId;

        // 查询文件
        $file = $this->taskFileRepository->getFileTreeFileById($fileIdInt);

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
     * 根据项目 ID 获取项目根目录的 file_id.
     *
     * 用于 agfs-server 动态挂载 referenced-project 时解析 root_file_id：
     * agent 仅通过挂载路径提供 project_id，agfs-server 调本端点拿到根目录 ID。
     */
    public function getProjectRootFileId(int $projectId): int
    {
        $rootDir = $this->taskFileRepository->findRootDirectoryByProjectId($projectId);
        if ($rootDir === null) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_NOT_FOUND,
                'magicfs.project_not_found',
                ['project_id' => $projectId]
            );
        }
        if ($rootDir->getSpaceType() !== FileSpaceType::PROJECT->value) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_NOT_FOUND,
                'magicfs.project_not_found',
                ['project_id' => $projectId]
            );
        }

        return $rootDir->getFileId();
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
     *                                 agfs magicfs 插件在 checkpoint 回滚重放时置为 true，
     *                                 以保证外链引用的 file_id 在撤回/取消撤回前后保持稳定
     * @return TaskFileEntity 创建的文件实体
     */
    public function createFile(string $name, string $parentId, bool $isDirectory, ?string $superMagicTaskId = null, ?int $sortValue = null, ?FileType $fileType = null, ?TaskFileSource $source = null, ?array $fileMetadata = null, bool $reuseDeletedFileId = false, int $topicId = 0, ?string $requestedSpaceType = null, ?TaskFileEntity $knownParentFile = null): TaskFileEntity
    {
        // 1. Resolve the parent once. The application service may provide the
        // already-authorized entity so this hot path does not read it again.
        $parentInfo = $this->getParentFileInfo($parentId, $knownParentFile);
        $projectId = $parentInfo['project_id'];
        $userId = $parentInfo['user_id'];
        $organizationCode = $parentInfo['organization_code'];
        $parentFile = $parentInfo['parent_file'];

        // 转换 parent_id
        $parentIdInt = $parentId === '' ? null : (int) $parentId;

        // 2. 检查父目录是否存在并且是目录（如果指定了 parent_id）
        if ($parentFile !== null) {
            // 确保父级是目录
            if (! $parentFile->getIsDirectory()) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::PARENT_NOT_DIRECTORY,
                    'magicfs.parent_not_directory',
                    ['parent_id' => $parentId]
                );
            }
        }

        $parentSpaceType = isset($parentFile) ? $parentFile->getSpaceType() : null;
        $parentTopicId = isset($parentFile)
            ? $parentFile->getTopicId()
            : ($topicId > 0 ? $topicId : 0);
        if ($requestedSpaceType !== null && FileSpaceType::tryFrom($requestedSpaceType) === null) {
            ExceptionBuilder::throw(MagicFSErrorCode::INVALID_SPACE_TYPE, 'magicfs.unsupported_space_type', ['space_type' => $requestedSpaceType]);
        }
        if ($requestedSpaceType !== null && $parentSpaceType !== null && $requestedSpaceType !== $parentSpaceType) {
            ExceptionBuilder::throw(MagicFSErrorCode::INVALID_SPACE_TYPE, 'magicfs.unsupported_space_type', ['space_type' => $requestedSpaceType]);
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
        $existing = $parentIdInt !== null
            ? $this->getExistingChildInParent($parentIdInt, $name, $parentFile, $userId, $organizationCode, true)
            : $this->taskFileRepository->getBySpaceParentAndName(
                $parentSpaceType ?? ($requestedSpaceType ?? FileSpaceType::PROJECT->value),
                $projectId,
                $parentIdInt,
                $name,
                $userId,
                $organizationCode,
                true,
                $parentTopicId > 0 ? $parentTopicId : null
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

        // 4.1. 统一解析空间上下文（space_type / workDir / topic_id）：
        //      - 空间类型以父目录 space_type 为准（与挂载位置一致，批量复制/
        //        移动进话题空间时自动落话题 key），无法识别时快速失败；
        //      - topic_id 直接取父目录（话题根目录恒带 topic_id），父目录
        //        缺失时快速失败，不做祖先链兜底。
        $spaceContext = $this->resolveSpaceContext(
            isset($parentFile) ? $parentFile : null,
            $projectId,
            $userId,
            $parentId
        );
        $spaceType = $spaceContext['space_type'];
        $workDir = $spaceContext['work_dir'];
        $resolvedTopicId = $spaceContext['topic_id'];

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

        // 空间类型：优先取调用方传入的 space_type，缺省为 project。
        // storage_type 是历史遗留字段（逐步废除），过渡期由 space_type 推导，保证两字段一致。
        $effectiveSpaceType = $spaceType !== '' ? $spaceType : FileSpaceType::PROJECT->value;
        $entity->setSpaceType($effectiveSpaceType);
        $entity->setStorageType(FileSpaceType::resolveStorageType($effectiveSpaceType));
        $entity->setSource($source ?? TaskFileSource::AGENT);
        $entity->setLatestVersion(1);
        $entity->setMetadataVersion(1);

        // 设置空间类型（与 workDir 文件树边界一致，由 resolveSpaceContext 统一解析）
        $entity->setSpaceType($spaceType);

        // 设置排序值（如果提供了 sortValue）
        if ($sortValue !== null) {
            $entity->setSort($sortValue);
        }

        // 8. 归属：树身份由空间决定，会话来源只写 provenance 列。
        //
        // topic_id 是**树身份**，不是"谁写的"：
        //   - project / user 空间的树按 topic_id = 0 定义（列目录的按父游标查询、
        //     按 (space, parent, name) 的精确查找、durable journal 的准入判定
        //     shouldJournalFileTree() 都以此为前提），所以这里恒为 0；
        //   - topic 空间的树按 topic_id = <话题> 定义，取 resolveSpaceContext
        //     校验过的 $resolvedTopicId（它本身来自父目录，且已确认 > 0），
        //     与 file_key 的 runtime/topic_{topicId}/ 边界同源。
        //
        // 刻意不写成「取父目录的 topic_id」：历史上被污染的行（沙箱建的目录带着
        // 会话 topic）会把污染继续传给子孙，而 project/user 空间的答案与父目录无关。
        //
        // 曾经的写法把请求信封里的会话 topic 直接落到新行上：AGFS 会把沙箱
        // /app/.credentials/metadata.json 的 topic_id 塞进每次建目录/建文件请求，
        // 于是沙箱建出来的目录带着话题 id 落进 project 空间 —— 既不属于 project 树
        // （topic_id = 0 的查询看不见），也不属于 topic 树（space_type 不是 topic），
        // 还会被 journal 准入整行丢弃。后果是远端挂载永远不知道这个目录存在，
        // 目录下新建的文件因父节点无从而解析不出路径（见
        // TaskFileRepository::shouldJournalFileTree 的说明）。
        $entity->setTopicId($spaceType === FileSpaceType::TOPIC->value ? $resolvedTopicId : 0);

        // 会话/任务来源写进专门为此存在的列（"最新版本 topic/task"），信息不丢，
        // 也不再与树身份混用；与 TaskFileDomainService 建版本时的写法一致。
        if (! empty($superMagicTaskId)) {
            $taskEntity = $this->taskRepository->getTaskById((int) $superMagicTaskId);
            if ($taskEntity) {
                $entity->setTaskId($taskEntity->getId());
                $entity->setLatestModifiedTaskId($taskEntity->getId());
                if ($taskEntity->getTopicId() > 0) {
                    $entity->setLatestModifiedTopicId($taskEntity->getTopicId());
                }
            }
        }

        // Fallback：任务查不到时，调用方显式传入的会话 id 仍是不该丢的来源信息。
        if ($topicId > 0 && $entity->getLatestModifiedTopicId() === null) {
            $entity->setLatestModifiedTopicId($topicId);
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

                $options = [];
                $contentType = ContentTypeUtil::getMappedContentType($name);
                if ($contentType !== null) {
                    $options['content_type'] = $contentType;
                }

                // 在对象存储上创建空文件
                $this->cloudFileRepository->createFileByCredential(
                    $prefix,
                    $organizationCode,
                    $s3Key,
                    '',  // 空内容
                    StorageBucketType::SandBox,
                    $options
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

        /*
         * The task row, every affected directory revision, and the durable
         * change event form one commit unit.  A reader that advances its
         * cursor can therefore always resolve the corresponding file snapshot.
         * Object-storage creation intentionally remains before this block: it
         * is an external side effect and is handled by the existing retry/GC
         * path, while database visibility is still atomic.
         */
        return Db::transaction(function () use ($entity, $parentId): TaskFileEntity {
            $entity = $this->taskFileRepository->insert($entity);

            // The new node announced itself with the row insert() just
            // appended; the containing directory only needs its version moved
            // so a reader caching the listing sees it as stale.
            if ($parentId !== '' && $parentId !== '0') {
                $this->bumpFileTreeVersions([$parentId]);
            }

            return $entity;
        });

        // Event dispatching is handled by the application layer after this method returns.
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
        // Parent links are authoritative after a cross-root move.  Passing a
        // project filter here would hide descendants whose denormalized
        // project_id intentionally still reflects their historical row.
        $ancestorEntities = $this->taskFileRepository->getFilesWithParentsByIds([$parentId]);

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
    public function updateFile(string $fileId, array $updates, ?TaskFileEntity $knownFile = null): TaskFileEntity
    {
        $file = $knownFile ?? $this->getFileById($fileId);
        $originalName = $file->getFileName();
        $originalExtension = strtolower($file->getFileExtension());

        $oldParentId = $file->getParentId();
        $newParentIdInt = null;
        $parentChanged = false;
        $existingTargetToDelete = null;
        $updateData = [];

        // 计算最终目标 name 和 parent_id
        $targetName = isset($updates['name']) ? trim((string) $updates['name']) : $file->getFileName();
        $targetParentIdInt = isset($updates['parent_id'])
            ? (($updates['parent_id'] === '' || $updates['parent_id'] === '0') ? null : (int) $updates['parent_id'])
            : $file->getParentId();

        $targetParentFile = null;
        if ($targetParentIdInt !== null && $targetParentIdInt !== $file->getParentId()) {
            $targetParentFile = $this->taskFileRepository->getFileTreeFileById($targetParentIdInt);
            if ($targetParentFile === null) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                    'magicfs.parent_directory_not_found',
                    ['parent_id' => (string) $targetParentIdInt]
                );
            }
            if (! $targetParentFile->getIsDirectory()) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::PARENT_NOT_DIRECTORY,
                    'magicfs.parent_not_directory',
                    ['parent_id' => (string) $targetParentIdInt]
                );
            }
        } elseif ($targetParentIdInt === null && $file->getParentId() !== null) {
            // A mounted tree has one immutable root.  Detaching a descendant
            // would create a second root with no durable head identity.
            ExceptionBuilder::throw(
                MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                'magicfs.parent_directory_not_found',
                ['parent_id' => '']
            );
        }

        $targetContext = $targetParentFile ?? $file;

        // 文件系统语义：name 或 parent 变化时，覆盖目标位置的同名文件
        if ($targetName !== '' && ($targetName !== $file->getFileName() || $targetParentIdInt !== $file->getParentId())) {
            $existingTarget = $targetParentIdInt !== null
                ? $this->getExistingChildInParent(
                    $targetParentIdInt,
                    $targetName,
                    $targetContext,
                    $targetContext->getUserId(),
                    $targetContext->getOrganizationCode()
                )
                : $this->taskFileRepository->getBySpaceParentAndName(
                    $targetContext->getSpaceType(),
                    $targetContext->getProjectId(),
                    $targetParentIdInt,
                    $targetName,
                    $targetContext->getUserId(),
                    $targetContext->getOrganizationCode(),
                    false,
                    $targetContext->getTopicId()
                );

            if ($existingTarget !== null && $existingTarget->getFileId() !== $file->getFileId()) {
                if ($existingTarget->getIsDirectory()) {
                    ExceptionBuilder::throw(
                        MagicFSErrorCode::FILE_ALREADY_EXISTS,
                        'magicfs.file_already_exists',
                        ['name' => $targetName]
                    );
                }
                // Defer the overwrite delete into the mutation transaction so
                // the target's delete event and the source move/update either
                // commit together or are both rolled back.
                $existingTargetToDelete = $existingTarget;
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
            $updateData['file_extension'] = $file->getIsDirectory() ? '' : pathinfo($newName, PATHINFO_EXTENSION);
        }

        // 处理移动（修改 parent_id）
        if (isset($updates['parent_id'])) {
            $newParentId = $updates['parent_id'];
            $newParentIdInt = $newParentId === '' || $newParentId === '0' ? null : (int) $newParentId;

            if ($newParentIdInt !== $file->getParentId()) {
                $updateData['parent_id'] = $newParentIdInt;
                if ($targetParentFile !== null) {
                    // Only the moved node receives the new denormalized
                    // context. Descendants resolve their effective context by
                    // following parent_id, so no subtree rewrite is needed.
                    $updateData['project_id'] = $targetParentFile->getProjectId();
                    $updateData['user_id'] = $targetParentFile->getUserId();
                    $updateData['organization_code'] = $targetParentFile->getOrganizationCode();
                    $updateData['space_type'] = $targetParentFile->getSpaceType();
                    $updateData['topic_id'] = $targetParentFile->getTopicId();
                }
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
        if (isset($updateData['file_extension'])) {
            $file->setFileExtension($updateData['file_extension']);
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
        if (isset($updateData['project_id'])) {
            $file->setProjectId($updateData['project_id']);
        }
        if (isset($updateData['user_id'])) {
            $file->setUserId($updateData['user_id']);
        }
        if (isset($updateData['organization_code'])) {
            $file->setOrganizationCode($updateData['organization_code']);
        }
        if (isset($updateData['space_type'])) {
            $file->setSpaceType($updateData['space_type']);
        }
        if (isset($updateData['topic_id'])) {
            $file->setTopicId($updateData['topic_id']);
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

        $updatedFile = Db::transaction(function () use (
            $existingTargetToDelete,
            $file,
            $fileId,
            $parentChanged,
            $oldParentId,
            $newParentIdInt,
            $hiddenChanged,
        ): TaskFileEntity {
            if ($existingTargetToDelete !== null) {
                $this->deleteFiles(
                    [(string) $existingTargetToDelete->getFileId()],
                    false
                );
            }

            // Suppress the repository's automatic event until all related
            // metadata-version bumps have completed. Otherwise the snapshot
            // would contain the pre-bump metadata_version and clients could
            // not use it as a coherent cache validator.
            $beforeFile = $this->taskFileRepository->getById($file->getFileId());
            $this->taskFileRepository->updateById($file, null, false);

            // Version-chain bumps and the event share the same commit.  A
            // move changes the target row as well as both directory listings;
            // merge all three chains so shared ancestors are bumped once and
            // the target receives a fresh metadata_version before its single
            // final move snapshot is appended below.
            $this->bumpFileTreeVersions(
                $parentChanged
                    ? [$fileId, $oldParentId, $newParentIdInt]
                    : [$fileId]
            );

            if ($hiddenChanged && $file->getIsDirectory()) {
                $descendantIds = $this->taskFileRepository->getAllDescendantIds(
                    (int) $fileId,
                    0
                );
                if (! empty($descendantIds)) {
                    $this->taskFileRepository->batchUpdateIsHidden(
                        $descendantIds,
                        $file->getIsHidden()
                    );
                }
            }

            // Re-read after the atomic version-chain update so the response
            // and journal snapshot carry the server's post-commit metadata
            // version rather than the pre-increment entity value.
            $updatedFile = $this->getFileById($fileId);
            $this->taskFileRepository->appendFileTreeMutation($beforeFile, $updatedFile);

            return $updatedFile;
        });

        $extensionChanged = isset($updateData['file_extension'])
            && $originalExtension !== strtolower($updatedFile->getFileExtension());
        if ($extensionChanged) {
            $contentType = ContentTypeUtil::getMappedContentType($updatedFile->getFileName());
            if ($contentType !== null) {
                $this->tryUpdateObjectMetadata($updatedFile, [
                    'content_type' => $contentType,
                ]);
            }
        }

        return $updatedFile;
    }

    /**
     * Rename one file onto a destination, with an explicit collision policy.
     *
     * This is a separate operation from updateFile on purpose. A rename carries
     * an identity decision that a partial update cannot express — "the
     * destination is occupied, whose row survives?" — and expressing it as one
     * forced the answer to be inferred from which fields happened to be set.
     *
     * Replacement semantics ({@see self::RENAME_ON_EXISTS_REPLACE}):
     *
     *   - the DESTINATION keeps its row: same file_id, same file_key, same
     *     version chain. Only its content pointer and size move to the source's
     *     bytes.
     *   - the SOURCE row is soft-deleted.
     *
     * The alternative — delete the destination, then move the source onto its
     * name — is what updateFile used to do implicitly, and it swaps which
     * file_id owns the path. Everything that references a file by id
     * (checkpoint snapshots, mentions, cross-project links) would then point at
     * a deleted row, and the destination's version chain would be orphaned
     * after a single save.
     *
     * @param string $sourceFileId source file id
     * @param string $newName destination name
     * @param null|int $newParentId destination parent; null keeps the current one
     * @param string $onExists replace|fail
     * @return TaskFileEntity the surviving destination entity
     */
    public function renameFile(
        string $sourceFileId,
        string $newName,
        ?int $newParentId = null,
        string $onExists = self::RENAME_ON_EXISTS_REPLACE
    ): TaskFileEntity {
        $source = $this->getFileById($sourceFileId);

        $newName = trim($newName);
        if ($newName === '') {
            ExceptionBuilder::throw(MagicFSErrorCode::NAME_IS_REQUIRED, 'magicfs.name_is_required');
        }
        if (! in_array($onExists, [self::RENAME_ON_EXISTS_REPLACE, self::RENAME_ON_EXISTS_FAIL], true)) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::OPERATION_FAILED,
                'magicfs.invalid_on_exists',
                ['on_exists' => $onExists]
            );
        }

        $targetParentId = $newParentId ?? $source->getParentId();
        if ($targetParentId === null) {
            // A mounted tree has exactly one immutable root; detaching it would
            // create a second root with no durable head identity.
            ExceptionBuilder::throw(
                MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                'magicfs.parent_directory_not_found',
                ['parent_id' => '']
            );
        }

        // Resolve the destination directory by id. A pure rename keeps the
        // source's parent, but that directory's row still has to be fetched:
        // reusing the source entity here made the source file stand in for its
        // own parent, which then failed the "parent must be a directory" check.
        $targetParent = $this->taskFileRepository->getFileTreeFileById($targetParentId);
        if ($targetParent === null) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                'magicfs.parent_directory_not_found',
                ['parent_id' => (string) $targetParentId]
            );
        }
        if (! $targetParent->getIsDirectory()) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::PARENT_NOT_DIRECTORY,
                'magicfs.parent_not_directory',
                ['parent_id' => (string) $targetParentId]
            );
        }

        $existing = $this->getExistingChildInParent(
            $targetParentId,
            $newName,
            $targetParent,
            $targetParent->getUserId(),
            $targetParent->getOrganizationCode()
        );
        if ($existing !== null && $existing->getFileId() === $source->getFileId()) {
            // Renaming onto itself is a no-op, not a collision.
            $existing = null;
        }

        if ($existing === null) {
            return $this->renameOntoVacantName($source, $newName, $targetParentId);
        }

        if ($existing->getIsDirectory()) {
            // POSIX: renaming a file onto a directory is EISDIR; replacing a
            // whole subtree is a different operation and never implicit.
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_ALREADY_EXISTS,
                'magicfs.file_already_exists',
                ['name' => $newName]
            );
        }
        if ($onExists === self::RENAME_ON_EXISTS_FAIL) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_ALREADY_EXISTS_IN_TARGET,
                'magicfs.file_already_exists_in_target',
                ['name' => $newName]
            );
        }

        return $this->renameOntoOccupiedFile($source, $existing);
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
     * @param null|int $projectId 项目作用域；传入时要求所有文件均属于该项目
     * @return TaskFileEntity[] 删除前的文件实体
     */
    public function deleteFiles(array $fileIds, bool $includeDescendants = false, ?int $projectId = null): array
    {
        if (empty($fileIds)) {
            return [];
        }

        return Db::transaction(function () use ($fileIds, $includeDescendants, $projectId): array {
            $fileIdInts = array_values(array_unique(array_map('intval', $fileIds)));
            $files = $this->getValidatedFilesForDeletion($fileIdInts, $projectId);

            if (empty($files)) {
                return [];
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
                        0
                    );
                    if (! empty($descendantIds)) {
                        $deleteIds = array_merge($deleteIds, $descendantIds);
                    }
                }
            }

            $deleteIds = array_values(array_unique($deleteIds));

            $this->taskFileRepository->deleteByIds($deleteIds, false, $projectId);

            // The deleted nodes announced themselves with their own `delete`
            // rows; the directories that contained them only need their
            // listing version moved.
            if ($parentIds !== []) {
                $this->bumpFileTreeVersions(array_keys($parentIds));
            }

            return $files;
        });
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
     * Return the durable root cursor used to make a paged directory listing a
     * stable snapshot. Any mutation in the root's file tree can affect a
     * later path lookup, while the head lookup is a single indexed row and
     * never enumerates files.
     */
    public function getFileTreeRevision(TaskFileEntity $rootFile): int
    {
        return $this->taskFileRepository->getFileTreeRevision($rootFile);
    }

    /**
     * Read the durable file-tree change journal after a cursor.
     * No descendant enumeration is performed.
     *
     * @return array{
     *     rows:array<int, array<string, mixed>>,
     *     head:int,
     *     oldest:int,
     *     revision:int,
     *     has_more:bool,
     *     cursor_expired:bool
     * }
     */
    public function getFileTreeChanges(string $rootFileId, int $sinceRevision, int $limit): array
    {
        $rootFile = $this->getFileById($rootFileId);
        if (! $rootFile->getIsDirectory()) {
            ExceptionBuilder::throw(MagicFSErrorCode::PARENT_NOT_DIRECTORY, 'magicfs.parent_not_directory');
        }

        $feed = $this->taskFileRepository->getFileTreeChangeFeed(
            $rootFile,
            $sinceRevision,
            $limit > 0 ? $limit + 1 : 0
        );
        $head = $feed['head'];
        if ($limit === 0) {
            return [
                'rows' => [],
                'head' => $head,
                // oldest is the first revision still replayable. The push
                // handshake needs it to tell a subscriber how far back its
                // cursor may be before the journal must be re-read wholesale.
                'oldest' => $feed['oldest'],
                'revision' => $head,
                'has_more' => false,
                // A head-only request still needs to tell a mounted client
                // that its durable cursor can no longer be replayed. The
                // previous implementation silently discarded this bit and
                // made the client believe it had a valid incremental state.
                'cursor_expired' => $feed['cursor_expired'],
            ];
        }
        $rows = $feed['rows'];
        $hasMore = count($rows) > $limit;
        if ($hasMore) {
            array_pop($rows);
        }

        return [
            'rows' => $rows,
            'head' => $head,
            'oldest' => $feed['oldest'],
            'revision' => $head,
            'has_more' => $hasMore,
            'cursor_expired' => $feed['cursor_expired'],
        ];
    }

    /**
     * Bump the file-tree version of each given node in one statement.
     *
     * Version bumps are cache invalidations, not change events: this advances
     * metadata_version without journalling a mutation, so readers that cache a
     * directory listing notice it is stale without subscribers being told a
     * file changed.
     *
     * @param array<int|string> $fileIds
     */
    public function bumpFileTreeVersions(array $fileIds): void
    {
        $ids = array_values(array_unique(array_filter(
            array_map(static fn ($id): int => (int) $id, $fileIds),
            static fn (int $id): bool => $id > 0
        )));
        if ($ids === []) {
            return;
        }

        $this->taskFileRepository->bumpMetadataVersions($ids);
    }

    /**
     * 获取文件树（legacy/export 语义，始终受节点数和字节预算约束）.
     *
     * @param string $fileId 文件ID
     * @param int $depth 递归深度，-1 表示无限深度
     * @param int $currentDepth 当前深度（内部使用）
     * @param null|string $spaceType Optional space type filter (e.g. 'project'). Null means no filter.
     * @param int $maxNodes maximum descendant nodes to materialise
     * @param int $maxBytes approximate serialized metadata budget
     * @return array{root:TaskFileEntity,children:TaskFileEntity[],truncated:bool,truncated_reason:?string,returned_nodes:int}
     */
    public function getFileTree(
        string $fileId,
        int $depth = -1,
        int $currentDepth = 0,
        ?string $spaceType = null,
        int $maxNodes = 10000,
        int $maxBytes = 8 * 1024 * 1024
    ): array {
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
                'truncated' => false,
                'truncated_reason' => null,
                'returned_nodes' => 0,
            ];
        }

        // 4. Legacy tree callers are explicitly bounded. Traversal is
        // breadth-first and uses the same direct-child keyset primitive as
        // the mount path, so one huge directory cannot create an unbounded
        // SQL result or PHP array.
        $bounded = $this->getBoundedChildrenForTree(
            (int) $rootFile->getFileId(),
            $projectId,
            $rootFile->getTopicId(),
            $rootFile->getUserId(),
            $rootFile->getOrganizationCode(),
            $depth,
            $currentDepth,
            // A tree rooted at a MagicFS node must never mix another
            // file tree merely because the legacy caller omitted the filter.
            $spaceType ?? $rootFile->getSpaceType(),
            $maxNodes,
            $maxBytes
        );

        return [
            'root' => $rootFile,
            'children' => $bounded['items'],
            'truncated' => $bounded['truncated'],
            'truncated_reason' => $bounded['truncated_reason'],
            'returned_nodes' => count($bounded['items']),
        ];
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

        return Db::transaction(function () use ($fileId, $fileIdInt): TaskFileEntity {
            // 1. 清除 deleted_at，把软删除记录变回活跃记录
            // The final entity update below carries the single restore event;
            // suppress the repository's intermediate event so a restore is
            // not observed as restore+update by mounted clients.
            $before = $this->taskFileRepository->getByIdWithTrash($fileIdInt);
            $this->taskFileRepository->restoreFile($fileIdInt, false);

            // 2. 读取恢复后的实体，仅重置 file_size
            $file = $this->taskFileRepository->getFileTreeFileById($fileIdInt);
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

            $this->taskFileRepository->updateById($file, 'restore', false);
            // The restored row is a metadata mutation too, so its version
            // moves before the final restore snapshot is appended below; the
            // containing directory only needs its listing version moved.
            $this->bumpFileTreeVersions([$fileIdInt, $file->getParentId()]);
            $restored = $this->getFileById($fileId);
            $this->taskFileRepository->appendFileTreeMutation($before, $restored, 'restore');
            return $restored;
        });
    }

    /**
     * Advance the metadata versions of the nodes a mutation just touched.
     *
     * The caller names the nodes whose cached representation became stale:
     *
     *   - the mutated node itself, when its journal row is appended after the
     *     bump so the row carries the post-bump version (a reader compares the
     *     version in the snapshot with the one it holds);
     *   - every directory whose *direct* listing changed, i.e. the parent of a
     *     created, removed or moved child, and both parents of a move.
     *
     * Ancestors above that set are deliberately absent. A child's change makes
     * its grandparent's *recursive* view stale, but POSIX moves only the
     * containing directory for a one-level change, and reporting the deeper
     * levels is what turned a feed of node changes into a feed of directory
     * bookkeeping: consumers derive "this listing changed" from the child row's
     * `parent_id`, which the mutation already publishes, so the ancestor rows
     * carried nothing they could not compute while multiplying the window by
     * tree depth (see TaskFileRepository::bumpMetadataVersions).
     *
     * Nothing here writes a journal row: a bump is cache invalidation, the row
     * belongs to the mutation.
     */
    /**
     * Bounded breadth-first traversal for the legacy tree endpoint.
     *
     * The method intentionally does not call getAllDescendantIds(): that
     * helper is useful for internal batch operations but would materialise
     * every descendant before the response budget could be enforced.
     *
     * @return array{items:TaskFileEntity[],truncated:bool,truncated_reason:?string}
     */
    protected function getBoundedChildrenForTree(
        int $rootId,
        int $projectId,
        int $topicId,
        string $userId,
        string $organizationCode,
        int $maxDepth,
        int $currentDepth,
        ?string $spaceType,
        int $maxNodes,
        int $maxBytes
    ): array {
        $maxNodes = max(1, min($maxNodes, 100000));
        $maxBytes = max(1024, min($maxBytes, 32 * 1024 * 1024));
        $items = [];
        $estimatedBytes = 0;
        $truncated = false;
        $reason = null;

        // queue entries are [parent_id, depth]. A depth of maxDepth means
        // that parent has reached the requested boundary and is not expanded.
        $queue = [[$rootId, $currentDepth]];
        $queueIndex = 0;
        while ($queueIndex < count($queue)) {
            [$parentId, $parentDepth] = $queue[$queueIndex++];
            if ($maxDepth !== -1 && $parentDepth >= $maxDepth) {
                continue;
            }

            $cursorSort = null;
            $cursorFileId = null;
            while (true) {
                $remaining = $maxNodes - count($items);
                if ($remaining <= 0) {
                    $truncated = true;
                    $reason = 'max_nodes';
                    break 2;
                }

                // One extra row is enough to detect that this parent still
                // has children after the global budget is exhausted.
                $rows = $this->taskFileRepository->getFileTreeChildrenByParentCursor(
                    $parentId,
                    '',
                    $cursorSort,
                    $cursorFileId,
                    min($remaining + 1, 1001),
                    [],
                    ''
                );
                if ($rows === []) {
                    break;
                }

                foreach ($rows as $row) {
                    $entity = TaskFileEntity::fromRow((array) $row);
                    // Account for the metadata that will be serialized in
                    // the tree response. The JSON estimate is deterministic
                    // and is itself bounded by maxBytes.
                    $estimate = strlen((string) json_encode($entity->toArray(), JSON_UNESCAPED_UNICODE));
                    if ($estimatedBytes + $estimate > $maxBytes) {
                        $truncated = true;
                        $reason = 'max_bytes';
                        break 3;
                    }
                    $items[] = $entity;
                    $estimatedBytes += $estimate;

                    if ($entity->getIsDirectory()) {
                        $queue[] = [$entity->getFileId(), $parentDepth + 1];
                    }
                    if (count($items) >= $maxNodes) {
                        $truncated = true;
                        $reason = 'max_nodes';
                        break 3;
                    }
                }

                $last = $rows[array_key_last($rows)];
                $cursorSort = (int) ($last['sort'] ?? 0);
                $cursorFileId = (int) ($last['file_id'] ?? 0);
                // A short page is the end of this parent. The repository
                // deliberately returns at most the requested page size.
                if (count($rows) < min($remaining + 1, 1001)) {
                    break;
                }
            }
        }

        return [
            'items' => $items,
            'truncated' => $truncated,
            'truncated_reason' => $reason,
        ];
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
        $parentFile = $this->taskFileRepository->getFileTreeFileById((int) $parentId);
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
     * Resolve the parent and the denormalized context needed for file creation.
     *
     * @return array{parent_file: ?TaskFileEntity, project_id: int, user_id: string, organization_code: string}
     */
    protected function getParentFileInfo(string $parentId, ?TaskFileEntity $knownParentFile = null): array
    {
        if ($parentId === '' || $parentId === '0') {
            // 根目录，返回默认值
            // TODO: 从认证信息或上下文获取这些值
            return [
                'parent_file' => null,
                'project_id' => 0,
                'user_id' => '',
                'organization_code' => '',
            ];
        }

        // Reuse the caller's authorized entity when available.
        $parentFile = $knownParentFile ?? $this->taskFileRepository->getFileTreeFileById((int) $parentId);
        if ($parentFile === null) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                'magicfs.parent_directory_not_found',
                ['parent_id' => $parentId]
            );
        }

        return [
            'parent_file' => $parentFile,
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
     * @param null|string $spaceType Optional space type filter (e.g. 'project'). Null means no filter.
     * @return array<TaskFileEntity> 所有子文件数组
     */
    protected function getAllChildrenByProjectIdAndParentId(
        int $projectId,
        string $parentId,
        int $maxDepth = -1,
        int $currentDepth = 0,
        ?string $spaceType = null
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
            $spaceType
        );
    }

    /**
     * Vacant destination: identity, bytes and version chain travel with the
     * source row, which simply changes name/parent.
     */
    private function renameOntoVacantName(TaskFileEntity $source, string $newName, int $targetParentId): TaskFileEntity
    {
        $oldParentId = $source->getParentId();
        $parentChanged = $oldParentId !== $targetParentId;

        return Db::transaction(function () use ($source, $newName, $targetParentId, $oldParentId, $parentChanged) {
            $before = $this->taskFileRepository->getById((int) $source->getFileId());

            $source->setFileName($newName);
            $source->setFileExtension(pathinfo($newName, PATHINFO_EXTENSION));
            $source->setParentId($targetParentId);
            $source->setUpdatedAt(date('Y-m-d H:i:s'));
            $source->setIsHidden($this->determineIsHidden($newName, $targetParentId, $source->getProjectId()));

            $this->taskFileRepository->updateById($source, null, false);
            $this->bumpFileTreeVersions(
                $parentChanged ? [$source->getFileId(), $oldParentId, $targetParentId] : [$source->getFileId()]
            );

            $updated = $this->getFileById((string) $source->getFileId());
            $this->taskFileRepository->appendFileTreeMutation($before, $updated);

            return $updated;
        });
    }

    /**
     * Occupied destination: the destination row survives and adopts the
     * source's content; the source row is retired.
     *
     * The content hand-off keeps the destination's file_key and copies the
     * source's bytes onto it, rather than pointing the destination at the
     * source's key. Two reasons:
     *
     *  1. file_key is UNIQUE across the table and soft-deleted rows still hold
     *     their value, so the destination cannot take the source's key until the
     *     source row is gone — which happens later, in the transaction.
     *  2. a soft-deleted row keeps a usable file_key so restoreFile() can bring
     *     it back. Re-pointing keys around would leave the retired row referring
     *     to an object nobody owns.
     *
     * The cost is one server-side object copy per replacement.
     */
    private function renameOntoOccupiedFile(TaskFileEntity $source, TaskFileEntity $destination): TaskFileEntity
    {
        $sourceKey = $source->getFileKey();
        $destinationKey = $destination->getFileKey();

        if ($sourceKey !== '' && $sourceKey !== $destinationKey) {
            // Signature: (prefix, organizationCode, sourceKey, destinationKey, ...).
            // The prefix scopes the temporary credential to this organization's
            // work dir; the keys themselves are already fully qualified.
            $this->cloudFileRepository->copyObjectByCredential(
                '',
                $destination->getOrganizationCode(),
                $sourceKey,
                $destinationKey,
                StorageBucketType::SandBox
            );
        }

        return Db::transaction(function () use ($source, $destination) {
            $beforeDst = $this->taskFileRepository->getById((int) $destination->getFileId());

            $destination->setFileSize($source->getFileSize());
            $destination->setUpdatedAt(date('Y-m-d H:i:s'));
            $this->taskFileRepository->updateById($destination, null, false);

            // Soft-delete the source inside the same transaction: a partial
            // commit would leave two live rows under different names but the
            // same bytes, and a retry would then copy onto itself.
            $this->taskFileRepository->deleteById((int) $source->getFileId(), false);

            $this->bumpFileTreeVersions([$destination->getFileId()]);
            $updated = $this->getFileById((string) $destination->getFileId());
            $this->taskFileRepository->appendFileTreeMutation($beforeDst, $updated);

            return $updated;
        });
    }

    private function getExistingChildInParent(
        int $parentId,
        string $fileName,
        ?TaskFileEntity $parentContext,
        string $userId,
        string $organizationCode,
        bool $withTrash = false
    ): ?TaskFileEntity {
        if ($parentContext?->getSpaceType() === FileSpaceType::USER->value) {
            return $this->taskFileRepository->getUserFileTreeChildByParentAndName(
                $parentId,
                $fileName,
                $userId,
                $organizationCode,
                $withTrash
            );
        }

        return $this->taskFileRepository->getFileTreeChildByParentAndName(
            $parentId,
            $fileName,
            $withTrash,
            $parentContext
        );
    }

    private function tryUpdateObjectMetadata(TaskFileEntity $file, array $metadata): void
    {
        try {
            $this->cloudFileRepository->setHeadObjectByCredential(
                $file->getOrganizationCode(),
                $file->getFileKey(),
                $metadata,
                StorageBucketType::SandBox
            );
        } catch (Throwable $throwable) {
            $this->logger->warning('magicfs_update_object_metadata_failed', [
                'file_id' => $file->getFileId(),
                'file_name' => $file->getFileName(),
                'metadata' => $metadata,
                'error' => $throwable->getMessage(),
            ]);
        }
    }

    /**
     * 统一解析文件所属空间的上下文（space_type / workDir / topic_id）.
     *
     * 空间类型以父目录 space_type 为准（与挂载位置一致，批量复制/移动进话题
     * 空间时自动落话题 key）；父目录缺失或 space_type 无法识别时快速失败。
     *
     * @param null|TaskFileEntity $parentFile 直接父目录
     * @param int $projectId 项目 ID（user 空间为 0）
     * @param string $userId 用户 ID
     * @param string $parentId 父目录 ID（用于错误信息）
     * @return array{space_type: string, work_dir: string, topic_id: int}
     */
    private function resolveSpaceContext(?TaskFileEntity $parentFile, int $projectId, string $userId, string $parentId): array
    {
        $spaceType = $parentFile !== null ? $parentFile->getSpaceType() : null;
        $resolvedTopicId = 0;

        switch ($spaceType) {
            case FileSpaceType::TOPIC->value:
                // 话题根目录恒带 topic_id；父目录缺失时快速失败，不做祖先链兜底
                if ($parentFile === null || $parentFile->getTopicId() <= 0) {
                    ExceptionBuilder::throw(
                        MagicFSErrorCode::TOPIC_ID_REQUIRED,
                        'magicfs.topic_id_required',
                        ['parent_id' => $parentId]
                    );
                }
                $resolvedTopicId = $parentFile->getTopicId();
                $workDir = WorkDirectoryUtil::getTopicRootDir($userId, $projectId, $resolvedTopicId);
                break;
            case FileSpaceType::USER->value:
                if ($userId === '') {
                    ExceptionBuilder::throw(
                        MagicFSErrorCode::FILE_NOT_FOUND,
                        'magicfs.project_not_found',
                        ['project_id' => $projectId]
                    );
                }
                $workDir = WorkDirectoryUtil::getUserWorkDir($userId);
                break;
            case FileSpaceType::PROJECT->value:
                $project = $this->projectRepository->findById($projectId);
                if ($project === null) {
                    ExceptionBuilder::throw(
                        MagicFSErrorCode::FILE_NOT_FOUND,
                        'magicfs.project_not_found',
                        ['project_id' => $projectId]
                    );
                }
                $workDir = $project->getWorkDir();
                break;
            default:
                ExceptionBuilder::throw(
                    MagicFSErrorCode::UNSUPPORTED_SPACE_TYPE,
                    'magicfs.unsupported_space_type',
                    ['parent_id' => $parentId, 'space_type' => (string) $spaceType]
                );
        }

        return [
            'space_type' => $spaceType,
            'work_dir' => $workDir,
            'topic_id' => $resolvedTopicId,
        ];
    }

    /**
     * @param int[] $fileIds
     * @return TaskFileEntity[]
     */
    private function getValidatedFilesForDeletion(array $fileIds, ?int $projectId): array
    {
        $files = $this->taskFileRepository->getFilesByIds($fileIds, $projectId ?? 0);

        // file_id 唯一且请求 ID 已去重，数量不一致即存在越权、不存在或已删除文件。
        if ($projectId !== null && count($files) !== count($fileIds)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_PERMISSION_DENIED,
                'file.permission_denied'
            );
        }

        return $files;
    }
}
