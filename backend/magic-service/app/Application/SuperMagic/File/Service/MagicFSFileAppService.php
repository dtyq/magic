<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Service;

use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Event\DirectoryDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileContentSavedEvent;
use App\Domain\SuperMagic\File\Event\FileDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileUploadedEvent;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\MagicFSErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\Utils\FileTreeBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\CreateFileRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileTreeChangesBatchRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileTreeChangesRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileTreeRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileVersionsRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\ListChildrenPageRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\ListFilesRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\RenameFileRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\UpdateFileRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\FileInfoResponseDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\FileTreeChangeDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\FileVersionResponseDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\FileVersionsResponseDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\GetFileTreeChangesResponseDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\ListChildrenPageResponseDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\ListFilesResponseDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\MagicFSFileDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;

class MagicFSFileAppService extends AbstractAppService
{
    /**
     * 批量拉取变更的 root 上限。
     *
     * 单沙箱的挂载点上限是 12（project + user + 最多 10 个 referenced-project），
     * 64 留足余量；同时挡住把批量接口当扫描器用的调用方。
     */
    protected const int MAX_CHANGE_FEED_BATCH_ROOTS = 64;

    protected LoggerInterface $logger;

    public function __construct(
        protected MagicFSFileDomainService $magicFSFileDomainService,
        protected TaskDomainService $taskDomainService,
        protected TopicDomainService $topicDomainService,
        protected FileTreeBuilder $fileTreeBuilder,
        protected EventDispatcherInterface $eventDispatcher,
        LoggerFactory $loggerFactory,
        protected PublishedMicroAppFileAccessService $publishedMicroAppFileAccessService,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 列出目录内容.
     */
    public function listFiles(MagicUserAuthorization $authorization, ListFilesRequestDTO $requestDTO): ListFilesResponseDTO
    {
        // 校验当前用户对父目录所属项目至少具备 VIEWER 角色，并取回父目录实体
        $parentEntity = $this->resolveAndAuthorizeParentProject($requestDTO->parent_id, $authorization, MemberRole::VIEWER);

        // 只返回父目录所属空间（project/user/topic）的文件，避免暴露其他内部文件
        $fileEntities = $this->magicFSFileDomainService->listFilesByParentId(
            $requestDTO->parent_id,
            $parentEntity->getSpaceType()
        );
        $this->assertFileEntitiesAccessible($fileEntities, $authorization, MemberRole::VIEWER);

        // 转换为 DTO
        $responseDTO = new ListFilesResponseDTO();
        $responseDTO->files = array_map(
            fn ($entity) => MagicFSFileDTO::fromTaskFileEntity($entity),
            $fileEntities
        );

        return $responseDTO;
    }

    /**
     * Return a bounded page of direct children for a mounted directory.
     *
     * The cursor is opaque to callers and encodes the stable `(sort,file_id)`
     * position.  No recursive entity/tree builder is involved in this path.
     */
    public function listChildrenPage(
        MagicUserAuthorization $authorization,
        string $parentId,
        ListChildrenPageRequestDTO $requestDTO
    ): ListChildrenPageResponseDTO {
        $parentEntity = $this->assertFileAccessible($parentId, $authorization, MemberRole::VIEWER);
        if (! $parentEntity->getIsDirectory()) {
            ExceptionBuilder::throw(MagicFSErrorCode::PARENT_NOT_DIRECTORY, 'magicfs.parent_not_directory');
        }

        // The durable root head is the only revision that every writer
        // advances. Using the directory's metadata_version here made a page
        // cursor silently stale when a mutation path changed the child rows
        // without bumping that particular parent chain.
        $listingRevision = $this->magicFSFileDomainService->getFileTreeRevision($parentEntity);
        $responseDTO = new ListChildrenPageResponseDTO();
        $responseDTO->listing_revision = $listingRevision;

        // A caller that already has this directory revision can avoid both the
        // row query and all DTO/entity work.  A cursor always wins over this
        // optimisation because it represents a continuation position.
        if ($requestDTO->cursor === null
            && $requestDTO->if_revision !== null
            && $requestDTO->if_revision === $listingRevision) {
            $responseDTO->not_modified = true;
            return $responseDTO;
        }

        [$afterSort, $afterFileId] = $this->decodeChildrenCursor(
            $requestDTO->cursor,
            $parentId
        );
        $page = $this->magicFSFileDomainService->listFilesPageByParentId(
            $parentId,
            $afterSort,
            $afterFileId,
            $requestDTO->limit,
            $requestDTO->file_name,
        );

        /** @var TaskFileEntity[] $items */
        $items = $page['items'];
        // The parent authorization check above and the repository's scoped
        // file-tree predicates are the security boundary for this endpoint.
        // Re-running the published-grant/project-policy check once per child
        // turns a bounded page into N authorization queries, which defeats
        // the purpose of keyset pagination for very large directories.
        $responseDTO->files = array_map(
            static fn (TaskFileEntity $entity): MagicFSFileDTO => MagicFSFileDTO::fromTaskFileEntity($entity),
            $items
        );
        $responseDTO->has_more = $page['has_more'];

        if ($responseDTO->has_more && $items !== []) {
            $last = $items[array_key_last($items)];
            $responseDTO->next_cursor = $this->encodeChildrenCursor(
                $parentId,
                $listingRevision,
                $last->getSort(),
                $last->getFileId(),
            );
        }

        return $responseDTO;
    }

    /**
     * 获取文件信息.
     */
    public function getFileInfo(MagicUserAuthorization $authorization, string $fileId): FileInfoResponseDTO
    {
        $fileEntity = $this->assertFileAccessible($fileId, $authorization, MemberRole::VIEWER);

        // 转换为 DTO
        $responseDTO = new FileInfoResponseDTO();
        $responseDTO->file = MagicFSFileDTO::fromTaskFileEntity($fileEntity);

        return $responseDTO;
    }

    /**
     * 获取单个文件元数据版本号.
     */
    public function getFileVersion(MagicUserAuthorization $authorization, string $fileId): FileVersionResponseDTO
    {
        $fileEntity = $this->assertFileAccessible($fileId, $authorization, MemberRole::VIEWER);

        // 转换为 DTO，返回元数据版本号
        $responseDTO = new FileVersionResponseDTO();
        $responseDTO->version = $fileEntity->getMetadataVersion();

        return $responseDTO;
    }

    /**
     * Read precise file-tree changes after a durable cursor.
     */
    public function getFileTreeChanges(
        MagicUserAuthorization $authorization,
        string $rootFileId,
        GetFileTreeChangesRequestDTO $requestDTO
    ): GetFileTreeChangesResponseDTO {
        // Authorize the root once. Every journal row is keyed by this
        // root_file_id; the repository validates the file-tree identity.
        $this->assertFileAccessible($rootFileId, $authorization, MemberRole::VIEWER);
        $result = $this->magicFSFileDomainService->getFileTreeChanges(
            $rootFileId,
            $requestDTO->since_revision,
            $requestDTO->limit
        );

        $responseDTO = new GetFileTreeChangesResponseDTO();
        $responseDTO->revision = $result['revision'];
        $responseDTO->has_more = $result['has_more'];
        $responseDTO->cursor_expired = $result['cursor_expired'];
        foreach ($result['rows'] as $row) {
            $responseDTO->changes[] = FileTreeChangeDTO::fromRow((array) $row);
        }

        if ($responseDTO->changes !== []) {
            $last = $responseDTO->changes[array_key_last($responseDTO->changes)];
            $responseDTO->next_revision = $last->revision;
        } elseif ($responseDTO->cursor_expired) {
            // The server has compacted rows before the requested cursor. The
            // client must invalidate resident directories and resume at the
            // current head; replaying from the stale cursor is impossible.
            $responseDTO->next_revision = $responseDTO->revision;
        } else {
            $responseDTO->next_revision = $requestDTO->since_revision;
        }

        return $responseDTO;
    }

    /**
     * 读取订阅起点：head / oldest / cursor_expired，不加载任何变更行。
     *
     * 与 getFileTreeChanges 共用 domain 路径和同一条 VIEWER 鉴权，
     * 保证"推送订阅"和"HTTP 拉取"对同一个 root 给出同样的可见性判定。
     *
     * @return array{head_revision:int, oldest_revision:int, cursor_expired:bool}
     */
    public function getFileTreeChangeFeedHead(
        MagicUserAuthorization $authorization,
        string $rootFileId,
        int $sinceRevision
    ): array {
        $this->assertFileAccessible($rootFileId, $authorization, MemberRole::VIEWER);
        $result = $this->magicFSFileDomainService->getFileTreeChanges($rootFileId, $sinceRevision, 0);

        return [
            'head_revision' => $result['revision'],
            'oldest_revision' => $result['oldest'],
            'cursor_expired' => $result['cursor_expired'],
        ];
    }

    /**
     * 批量拉取变更：降级路径一次请求服务全部挂载点。
     *
     * 逐 root 复用单 root 的服务路径（含鉴权、has_more、next_revision 的推导），
     * 所以批量与单个接口不可能给出不同语义。
     *
     * 任一 root 鉴权失败就整体失败，不返回部分结果：调用方无法区分
     * "这个 root 没有变更"和"这个 root 被跳过了"，静默跳过只会让挂载点悄悄停止同步。
     *
     * @return array{results: array<int, array<string, mixed>>}
     */
    public function getFileTreeChangesBatch(
        MagicUserAuthorization $authorization,
        GetFileTreeChangesBatchRequestDTO $requestDTO
    ): array {
        if ($requestDTO->roots === [] || count($requestDTO->roots) > static::MAX_CHANGE_FEED_BATCH_ROOTS) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed);
        }

        $results = [];
        foreach ($requestDTO->roots as $root) {
            if ($root['root_file_id'] === '') {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed);
            }

            $single = new GetFileTreeChangesRequestDTO();
            $single->since_revision = $root['since_revision'];
            $single->limit = $root['limit'];

            $responseDTO = $this->getFileTreeChanges($authorization, $root['root_file_id'], $single);
            $results[] = ['root_file_id' => $root['root_file_id']] + $responseDTO->toArray();
        }

        return ['results' => $results];
    }

    /**
     * 根据项目 ID 获取项目根目录 file_id.
     *
     * agfs-server 在动态挂载 referenced-project 时调用：agent 仅通过挂载路径
     * 提供 project_id，本端点解析出对应的根目录 file_id 供 magicfs 挂载使用。
     * 要求当前用户对该项目至少具备 VIEWER 角色。
     */
    public function getProjectRootFileId(MagicUserAuthorization $authorization, string $projectId): array
    {
        $projectIdInt = (int) $projectId;
        if ($projectIdInt <= 0) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        if (! $this->publishedMicroAppFileAccessService->canAccessProject(
            $projectIdInt,
            $authorization->getId(),
            $authorization->getOrganizationCode()
        )) {
            $this->assertProjectAccessible($projectIdInt, $authorization, MemberRole::VIEWER);
        }

        $rootFileId = $this->magicFSFileDomainService->getProjectRootFileId($projectIdInt);
        $this->assertFileAccessible((string) $rootFileId, $authorization, MemberRole::VIEWER);

        return [
            'project_id' => (string) $projectIdInt,
            'root_file_id' => (string) $rootFileId,
        ];
    }

    /**
     * 批量获取文件元数据版本号.
     */
    public function getFileVersions(MagicUserAuthorization $authorization, GetFileVersionsRequestDTO $requestDTO): FileVersionsResponseDTO
    {
        // 逐文件校验涉及到的项目，按 project_id 缓存以避免重复鉴权
        $this->assertFilesAccessible($requestDTO->file_ids, $authorization, MemberRole::VIEWER);

        // 调用领域服务获取元数据版本号
        $versions = $this->magicFSFileDomainService->getFileVersionsByIds($requestDTO->file_ids);

        // 转换为 DTO
        $responseDTO = new FileVersionsResponseDTO();
        $responseDTO->versions = $versions;

        return $responseDTO;
    }

    /**
     * 创建文件或目录.
     */
    public function createFile(MagicUserAuthorization $authorization, CreateFileRequestDTO $requestDTO): FileInfoResponseDTO
    {
        // 校验当前用户对父目录所属项目至少具备 EDITOR 角色，并取回父目录实体用于后续归属一致性校验
        $parentEntity = $this->resolveAndAuthorizeParentProject($requestDTO->parent_id, $authorization, MemberRole::EDITOR);

        // 获取 per-request 上下文（user/trace/authorization/...）
        $messageMetadata = $requestDTO->getMessageMetadataValueObject();

        // 安全校验：请求透传的 super_magic_task_id / topic_id 必须与父目录已授权范围一致，
        // 防止在自有目录创建文件却挂接到他人任务/话题的越权附件注入
        $this->assertAttachTargetsAuthorized(
            $messageMetadata->getSuperMagicTaskId(),
            (int) $messageMetadata->getTopicId(),
            $parentEntity,
            $authorization
        );

        // project_id、user_id 和 organization_code 将从父文件或认证信息中自动获取；
        // 空间类型由领域层按父目录 space_type 统一解析
        $fileEntity = $this->magicFSFileDomainService->createFile(
            $requestDTO->name,
            $requestDTO->parent_id,
            $requestDTO->is_directory,
            $messageMetadata->getSuperMagicTaskId(), // 传递任务ID
            null,                                    // sortValue
            null,                                    // fileType
            null,                                    // source
            $requestDTO->getFileMetadata(),          // 持久化的插件 flag，如 local_shadow
            $requestDTO->getReuseDeletedFileId(),    // rollback 重放时请求复用已软删除同名的 file_id
            (int) $messageMetadata->getTopicId(),    // 直接透传 topic_id，作为 task 查不到时的 fallback
            $requestDTO->getSpaceType(),
            $parentEntity
        );

        // Dispatch file uploaded event so downstream subscribers are notified
        $this->eventDispatcher->dispatch(new FileUploadedEvent(
            $fileEntity,
            $fileEntity->getUserId(),
            $fileEntity->getOrganizationCode()
        ));

        // 记录日志
        $this->logger->info('[CREATE] ' . ($requestDTO->is_directory ? 'Directory' : 'File'), [
            'name' => $requestDTO->name,
            'file_id' => $fileEntity->getFileId(),
            'parent_id' => $requestDTO->parent_id,
            's3_key' => $fileEntity->getFileKey(),
            'task_id' => $fileEntity->getTaskId(),
            'topic_id' => $fileEntity->getTopicId(),
        ]);

        // 转换为 DTO
        $responseDTO = new FileInfoResponseDTO();
        $responseDTO->file = MagicFSFileDTO::fromTaskFileEntity($fileEntity);

        return $responseDTO;
    }

    /**
     * 更新文件元数据.
     */
    public function updateFile(MagicUserAuthorization $authorization, string $fileId, UpdateFileRequestDTO $requestDTO): FileInfoResponseDTO
    {
        $fileEntity = $this->assertFileAccessible($fileId, $authorization, MemberRole::EDITOR);

        // 转换为 updates 数组
        $updates = $requestDTO->toUpdates();

        // 校验：updates 不能为空
        if (empty($updates)) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::NO_UPDATES_PROVIDED,
                'magicfs.no_updates_provided',
                ['file_id' => $fileId]
            );
        }

        // 获取 per-request 上下文（预留给未来审计/trace 透传）
        $messageMetadata = $requestDTO->getMessageMetadataValueObject();
        unset($messageMetadata); // 当前 domain 层未使用；保留读取以便 DTO 校验

        // 调用领域服务更新文件（文件系统语义：同名自动覆盖）
        $fileEntity = $this->magicFSFileDomainService->updateFile($fileId, $updates, $fileEntity);

        // Dispatch file content saved event so downstream subscribers are notified of the metadata update
        $this->eventDispatcher->dispatch(new FileContentSavedEvent(
            $fileEntity,
            $fileEntity->getUserId(),
            $fileEntity->getOrganizationCode()
        ));

        // 记录日志
        $this->logger->info('[UPDATE] File updated', [
            'file_id' => $fileId,
            'updates' => $updates,
            'task_id' => $fileEntity->getTaskId(),
            'topic_id' => $fileEntity->getTopicId(),
        ]);

        // 转换为 DTO
        $responseDTO = new FileInfoResponseDTO();
        $responseDTO->file = MagicFSFileDTO::fromTaskFileEntity($fileEntity);

        return $responseDTO;
    }

    /**
     * Rename a file onto a destination, with an explicit collision policy.
     *
     * Authorization is the same EDITOR assertion updateFile performs, applied
     * to BOTH ends: being allowed to write the source is not enough if the
     * rename would replace a destination the caller cannot write.
     *
     * POST /api/v1/open-api/magicfs/files/{id}/rename.
     */
    public function renameFile(
        MagicUserAuthorization $authorization,
        string $fileId,
        RenameFileRequestDTO $requestDTO
    ): FileInfoResponseDTO {
        $source = $this->assertFileAccessible($fileId, $authorization, MemberRole::EDITOR);

        // DTO 使用字符串传输文件 ID，按领域层的整数类型比较，并保留未指定目录的语义。
        if ($requestDTO->new_parent_id !== null && (int) $requestDTO->new_parent_id !== $source->getParentId()) {
            // Replacing into a directory the caller cannot write would let a
            // rename mutate a tree outside their permission scope.
            $this->assertFileAccessible($requestDTO->new_parent_id, $authorization, MemberRole::EDITOR);
        }

        $fileEntity = $this->magicFSFileDomainService->renameFile(
            $fileId,
            $requestDTO->new_name,
            $requestDTO->new_parent_id === null ? null : (int) $requestDTO->new_parent_id,
            $requestDTO->on_exists ?? MagicFSFileDomainService::RENAME_ON_EXISTS_REPLACE,
        );

        $this->eventDispatcher->dispatch(new FileContentSavedEvent(
            $fileEntity,
            $fileEntity->getUserId(),
            $fileEntity->getOrganizationCode()
        ));

        $this->logger->info('[RENAME] File renamed', [
            'file_id' => $fileId,
            'new_name' => $requestDTO->new_name,
            'new_parent_id' => $requestDTO->new_parent_id,
            'on_exists' => $requestDTO->on_exists,
            'survivor_file_id' => $fileEntity->getFileId(),
        ]);

        $responseDTO = new FileInfoResponseDTO();
        $responseDTO->file = MagicFSFileDTO::fromTaskFileEntity($fileEntity);

        return $responseDTO;
    }

    /**
     * 写权限预检（无副作用）.
     *
     * 与 updateFile 复用同一套 assertFileAccessible(fileId, EDITOR) 鉴权逻辑，
     * 仅校验、不写状态。供 magicfs 客户端在写 S3 / 本地缓存之前确认当前用户
     * 具备写权限，避免"先写 S3 再被元数据服务拒绝"导致的数据不一致。
     *
     * 用户空间文件（project_id<=0）同样要求文件 owner 本人（assertUserSpaceFileAccessible），
     * 与 updateFile 完全一致。
     */
    public function checkFileWriteAccess(MagicUserAuthorization $authorization, string $fileId): void
    {
        $this->assertFileAccessible($fileId, $authorization, MemberRole::EDITOR);
    }

    /**
     * 删除文件或目录.
     */
    public function deleteFile(MagicUserAuthorization $authorization, string $fileId): void
    {
        // 删除属于写操作，要求 EDITOR 角色；同时复用查到的实体用于后续事件
        $fileEntity = $this->assertFileAccessible($fileId, $authorization, MemberRole::EDITOR);

        $this->magicFSFileDomainService->deleteFile($fileId);

        // Dispatch appropriate event based on entity type
        if ($fileEntity->getIsDirectory()) {
            $userAuthorization = new MagicUserAuthorization();
            $userAuthorization->setId($fileEntity->getUserId());
            $userAuthorization->setOrganizationCode($fileEntity->getOrganizationCode());
            $this->eventDispatcher->dispatch(new DirectoryDeletedEvent($fileEntity, $userAuthorization));
        } else {
            $this->eventDispatcher->dispatch(new FileDeletedEvent(
                $fileEntity,
                $fileEntity->getUserId(),
                $fileEntity->getOrganizationCode()
            ));
        }

        // 记录日志
        $this->logger->info('[DELETE] File deleted', [
            'file_id' => $fileId,
        ]);
    }

    /**
     * 获取文件树.
     */
    public function getFileTree(MagicUserAuthorization $authorization, string $fileId, GetFileTreeRequestDTO $requestDTO): FileInfoResponseDTO
    {
        $fileEntity = $this->assertFileAccessible($fileId, $authorization, MemberRole::VIEWER);

        // 1. 调用领域服务获取文件树数据（按 root 所属空间过滤：project/user/topic）
        $treeData = $this->magicFSFileDomainService->getFileTree(
            $fileId,
            $requestDTO->depth,
            0,
            $fileEntity->getSpaceType(),
            $requestDTO->max_nodes,
            $requestDTO->max_bytes
        );

        // 2. 获取根文件和子节点列表
        $rootFile = $treeData['root'];
        $children = $treeData['children'];
        $this->assertFileEntitiesAccessible([$rootFile, ...$children], $authorization, MemberRole::VIEWER);

        // 3. 规范化子节点列表，构建树结构
        $entityMap = [];
        $treeFiles = [];
        foreach ($children as $child) {
            $childFileId = (string) $child->getFileId();
            $entityMap[$childFileId] = $child;
            $treeFiles[] = $this->normalizeFileForTree($child);
        }

        $childrenTree = $this->fileTreeBuilder->buildTree(
            $treeFiles,
            (int) $rootFile->getFileId(),
            'zh_CN'
        );

        // 4. 构建树形 DTO
        $rootDTO = MagicFSFileDTO::fromTaskFileEntity($rootFile);
        $rootDTO->children = $this->buildMagicFsTreeDtos($childrenTree, $entityMap);

        // 5. 创建响应 DTO（复用 FileInfoResponseDTO）
        $responseDTO = new FileInfoResponseDTO();
        $responseDTO->file = $rootDTO;
        $responseDTO->truncated = (bool) ($treeData['truncated'] ?? false);
        $responseDTO->truncated_reason = $treeData['truncated_reason'] ?? null;
        $responseDTO->returned_nodes = (int) ($treeData['returned_nodes'] ?? count($children));

        // 6. 记录日志
        $this->logger->info('[TREE] File tree generated', [
            'file_id' => $fileId,
            'depth' => $requestDTO->depth,
            'root_name' => $rootFile->getFileName(),
            'total_children' => count($children),
            'truncated' => $responseDTO->truncated,
            'truncated_reason' => $responseDTO->truncated_reason,
            'max_nodes' => $requestDTO->max_nodes,
            'max_bytes' => $requestDTO->max_bytes,
        ]);

        return $responseDTO;
    }

    /** @return array{0: ?int, 1: ?int} */
    protected function decodeChildrenCursor(?string $cursor, string $parentId): array
    {
        if ($cursor === null || $cursor === '') {
            return [null, null];
        }

        $padding = strlen($cursor) % 4;
        if ($padding > 0) {
            $cursor .= str_repeat('=', 4 - $padding);
        }
        $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
        $payload = $decoded === false ? null : json_decode($decoded, true);
        if (! is_array($payload)
            || ! isset($payload['sort'], $payload['file_id'])
            || ! is_numeric($payload['sort'])
            || ! is_numeric($payload['file_id'])
            || (int) $payload['file_id'] <= 0) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::INVALID_CURSOR,
                'magicfs.invalid_cursor'
            );
        }
        // Cursors are opaque, but binding them to the parent prevents a
        // continuation token copied from one directory from silently skipping
        // rows in another. The parent binding is part of the final protocol.
        if (! isset($payload['parent_id']) || (string) $payload['parent_id'] !== $parentId) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::INVALID_CURSOR,
                'magicfs.invalid_cursor'
            );
        }

        return [(int) $payload['sort'], (int) $payload['file_id']];
    }

    protected function encodeChildrenCursor(string $parentId, int $revision, int $sort, int $fileId): string
    {
        $raw = json_encode([
            'parent_id' => $parentId,
            'revision' => $revision,
            'sort' => $sort,
            'file_id' => $fileId,
        ], JSON_THROW_ON_ERROR);
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    /**
     * Normalize file entity to tree node array.
     */
    protected function normalizeFileForTree(TaskFileEntity $entity): array
    {
        return [
            'file_id' => (string) $entity->getFileId(),
            'parent_id' => (string) ($entity->getParentId() ?? ''),
            'file_name' => $entity->getFileName(),
            'is_directory' => $entity->getIsDirectory(),
        ];
    }

    /**
     * Build MagicFS DTO tree from nodes.
     */
    protected function buildMagicFsTreeDtos(array $nodes, array $entityMap): array
    {
        $result = [];
        foreach ($nodes as $node) {
            $fileId = (string) ($node['file_id'] ?? '');
            if ($fileId === '' || ! isset($entityMap[$fileId])) {
                continue;
            }

            $dto = MagicFSFileDTO::fromTaskFileEntity($entityMap[$fileId]);
            if (! empty($node['children'])) {
                $dto->children = $this->buildMagicFsTreeDtos($node['children'], $entityMap);
            }
            $result[] = $dto;
        }

        return $result;
    }

    /**
     * 校验当前用户对指定 file 所属项目的角色权限，并返回 file 实体（若不存在则按 file_not_found 抛错）。
     *
     * user-space 文件没有项目锚点（project_id<=0），改走 user 维度校验：
     * 仅 file 所属用户本人在同组织内可访问。
     */
    protected function assertFileAccessible(string $fileId, MagicUserAuthorization $authorization, MemberRole $requiredRole): TaskFileEntity
    {
        $fileEntity = $this->magicFSFileDomainService->getFileById($fileId);
        $this->assertFileEntitiesAccessible([$fileEntity], $authorization, $requiredRole);
        return $fileEntity;
    }

    /**
     * 批量校验：按 project_id 去重后逐项目校验，避免重复 ProjectMember 查询。
     *
     * project_id<=0 的 user-space 文件按 (user_id, organization_code) 去重并逐用户校验。
     *
     * @param array<int|string> $fileIds
     */
    protected function assertFilesAccessible(array $fileIds, MagicUserAuthorization $authorization, MemberRole $requiredRole): void
    {
        if (empty($fileIds)) {
            return;
        }

        $files = [];
        foreach (array_unique($fileIds) as $fileId) {
            $files[] = $this->magicFSFileDomainService->getFileById((string) $fileId);
        }
        $this->assertFileEntitiesAccessible($files, $authorization, $requiredRole);
    }

    /** @param TaskFileEntity[] $files */
    protected function assertFileEntitiesAccessible(array $files, MagicUserAuthorization $authorization, MemberRole $requiredRole): void
    {
        $checkedProjects = [];
        $checkedUserAccessKeys = [];
        $publishedContext = ['files' => []];
        foreach ($files as $file) {
            $publishedContext['files'][$file->getFileId()] = $file;
        }
        foreach ($files as $fileEntity) {
            $this->assertMountableSpaceFile($fileEntity);
            $projectId = $fileEntity->getProjectId();
            if ($projectId <= 0) {
                $userAccessKey = $fileEntity->getOrganizationCode() . '|' . $fileEntity->getUserId();
                if (isset($checkedUserAccessKeys[$userAccessKey])) {
                    continue;
                }
                $this->assertUserSpaceFileAccessible($fileEntity, $authorization);
                $checkedUserAccessKeys[$userAccessKey] = true;
                continue;
            }
            if (isset($checkedProjects[$projectId])) {
                continue;
            }
            // A published grant applies to this project-space file only; never
            // cache it as collaboration access to topic/internal sibling files.
            if ($requiredRole === MemberRole::VIEWER
                && $this->publishedMicroAppFileAccessService->canAccessFile(
                    $fileEntity,
                    $authorization->getId(),
                    $authorization->getOrganizationCode(),
                    $publishedContext
                )) {
                continue;
            }
            $this->assertProjectAccessible($projectId, $authorization, $requiredRole);
            $checkedProjects[$projectId] = true;
        }
    }

    /**
     * 校验 parent 所属项目的角色权限，并返回 project_id；不允许根目录场景（parent_id 为空）。
     *
     * 根目录目前没有项目锚点（domain 层 getParentFileInfo 在该场景返回 project_id=0、user_id 空），
     * 没有上下文可以做权限校验，必须由调用方显式提供 parent_id。
     *
     * user-space 父目录（project_id<=0 但有 user_id）按 user 维度校验，返回的 project_id 为 0。
     */
    protected function resolveAndAuthorizeParentProject(string $parentId, MagicUserAuthorization $authorization, MemberRole $requiredRole): TaskFileEntity
    {
        if ($parentId === '' || $parentId === '0') {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        return $this->assertFileAccessible($parentId, $authorization, $requiredRole);
    }

    /**
     * MagicFS 只承载文件树（project/user/topic）的文件；
     * 消息内容、快照等内部资源不属于文件树。
     *
     * 判据使用 space_type：storage_type 是历史遗留的物理存储归类字段（已标记废弃，
     * 后续废除），与文件树并非一一对应，不再作为文件树校验依据。
     * 过渡期由 FileSpaceType::toStorageType() 建立映射：user→user、topic→topic、
     * 其余（project）→workspace，保证新写入两字段一致，但鉴权仍以 space_type 为准。
     */
    protected function assertMountableSpaceFile(TaskFileEntity $fileEntity): void
    {
        $spaceType = $fileEntity->getSpaceType();
        if (! in_array(
            $spaceType,
            [FileSpaceType::PROJECT->value, FileSpaceType::USER->value, FileSpaceType::TOPIC->value],
            true
        )) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::FILE_NOT_FOUND,
                'magicfs.file_not_found',
                ['file_id' => (string) $fileEntity->getFileId()]
            );
        }
    }

    /**
     * 调用项目级访问校验（owner / 协作成员且角色满足 required role）。
     *
     * project_id 非法（<=0）一律拒绝，避免 magicfs 端漏传/默认值导致跨项目越权。
     */
    protected function assertProjectAccessible(int $projectId, MagicUserAuthorization $authorization, MemberRole $requiredRole): void
    {
        if ($projectId <= 0) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        $this->getAccessibleProject(
            $projectId,
            $authorization->getId(),
            $authorization->getOrganizationCode(),
            $requiredRole
        );
    }

    /**
     * user-space 文件鉴权：要求 file 所属 user 与当前授权 user 完全一致（含组织）。
     *
     * user-space 没有协作角色概念，要么是文件 owner，要么拒绝；不区分 VIEWER/EDITOR/MANAGE。
     */
    protected function assertUserSpaceFileAccessible(TaskFileEntity $fileEntity, MagicUserAuthorization $authorization): void
    {
        $fileUserId = $fileEntity->getUserId();
        $fileOrgCode = $fileEntity->getOrganizationCode();
        if ($fileUserId === '' || $fileOrgCode === ''
            || $fileUserId !== $authorization->getId()
            || $fileOrgCode !== $authorization->getOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }
    }

    /**
     * 校验请求透传的 super_magic_task_id / topic_id 与父目录已授权范围一致.
     *
     * 防止调用方在自己有权的目录创建文件，却通过 message_metadata 把文件挂接到
     * 他人任务/话题，从而在受害者附件视图中注入文件。
     *
     * 校验规则：
     *   - task 非空 → task 必须与父目录同文件树（user 空间比对 userId，
     *     project 空间比对 projectId）；若请求同时携带 topic_id 且与 task.topicId
     *     不一致则拒绝；task 命中即覆盖 topic，结束。
     *   - task 未命中但 topic_id 非空 → topic 必须与父目录同文件树。
     *   - task 未命中但 task.topicId 为 0 且请求 topic_id 非空 → 落入 Domain
     *     的 fallback 路径，因此仍需独立校验请求 topic_id 的归属。
     */
    protected function assertAttachTargetsAuthorized(
        string $superMagicTaskId,
        int $topicId,
        TaskFileEntity $parentEntity,
        MagicUserAuthorization $authorization
    ): void {
        $isUserSpace = $parentEntity->getProjectId() <= 0;
        $taskIdInt = (int) $superMagicTaskId;

        if ($taskIdInt > 0) {
            $task = $this->taskDomainService->getTaskById($taskIdInt);
            if ($task === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
            }

            if ($isUserSpace) {
                if ($task->getUserId() !== $authorization->getId()) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
                }
            } else {
                // 跨项目挂接：调用者只需对目标任务所在项目具备可写权限即可，
                // 不要求与父目录同项目。父目录写权限已由 resolveAndAuthorizeParentProject 校验。
                $this->assertProjectAccessible(
                    $task->getProjectId(),
                    $authorization,
                    MemberRole::EDITOR
                );
            }

            $taskTopicId = $task->getTopicId();
            if ($taskTopicId > 0) {
                if ($topicId > 0 && $topicId !== $taskTopicId) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
                }
                return;
            }
            // task 无 topic，请求 topic_id 会被 Domain 用作 fallback，需独立校验
        }

        if ($topicId > 0) {
            $topic = $this->topicDomainService->getTopicById($topicId);
            if ($isUserSpace) {
                if ($topic === null
                    || $topic->getUserId() !== $authorization->getId()
                    || $topic->getUserOrganizationCode() !== $authorization->getOrganizationCode()) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
                }
            } else {
                if ($topic === null) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
                }
                // 跨项目挂接：调用者只需对目标话题所在项目具备可写权限即可。
                $this->assertProjectAccessible(
                    $topic->getProjectId(),
                    $authorization,
                    MemberRole::EDITOR
                );
            }
        }
    }
}
