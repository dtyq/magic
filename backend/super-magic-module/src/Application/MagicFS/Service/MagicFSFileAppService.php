<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\MagicFS\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AbstractAppService;
use Dtyq\SuperMagic\Domain\MagicFS\Service\MagicFSFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\DirectoryDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileContentSavedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use Dtyq\SuperMagic\ErrorCode\MagicFSErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\FileTreeBuilder;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request\CreateFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request\GetFileTreeRequestDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request\GetFileVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request\ListFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request\UpdateFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Response\FileInfoResponseDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Response\FileVersionResponseDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Response\FileVersionsResponseDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Response\ListFilesResponseDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Response\MagicFSFileDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;

class MagicFSFileAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected MagicFSFileDomainService $magicFSFileDomainService,
        protected FileTreeBuilder $fileTreeBuilder,
        protected EventDispatcherInterface $eventDispatcher,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 列出目录内容.
     */
    public function listFiles(MagicUserAuthorization $authorization, ListFilesRequestDTO $requestDTO): ListFilesResponseDTO
    {
        // 校验当前用户对父目录所属项目至少具备 VIEWER 角色
        $this->resolveAndAuthorizeParentProject($requestDTO->parent_id, $authorization, MemberRole::VIEWER);

        // Only return workspace-type files to avoid exposing snapshot/other internal files
        $fileEntities = $this->magicFSFileDomainService->listFilesByParentId(
            $requestDTO->parent_id,
            StorageType::WORKSPACE->value
        );

        // 转换为 DTO
        $responseDTO = new ListFilesResponseDTO();
        $responseDTO->files = array_map(
            fn ($entity) => MagicFSFileDTO::fromTaskFileEntity($entity),
            $fileEntities
        );

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
        // 校验当前用户对父目录所属项目至少具备 EDITOR 角色
        $this->resolveAndAuthorizeParentProject($requestDTO->parent_id, $authorization, MemberRole::EDITOR);

        // 获取 per-request 上下文（user/trace/authorization/...）
        $messageMetadata = $requestDTO->getMessageMetadataValueObject();

        // project_id、user_id 和 organization_code 将从父文件或认证信息中自动获取
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
            (int) $messageMetadata->getTopicId()     // 直接透传 topic_id，作为 task 查不到时的 fallback
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
        $this->assertFileAccessible($fileId, $authorization, MemberRole::EDITOR);

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
        $fileEntity = $this->magicFSFileDomainService->updateFile($fileId, $updates);

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
        $this->assertFileAccessible($fileId, $authorization, MemberRole::VIEWER);

        // 1. 调用领域服务获取文件树数据
        $treeData = $this->magicFSFileDomainService->getFileTree($fileId, $requestDTO->depth);

        // 2. 获取根文件和子节点列表
        $rootFile = $treeData['root'];
        $children = $treeData['children'];

        // 3. 规范化子节点列表，构建树结构
        $entityMap = [];
        $treeFiles = [];
        foreach ($children as $child) {
            $fileId = (string) $child->getFileId();
            $entityMap[$fileId] = $child;
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

        // 6. 记录日志
        $this->logger->info('[TREE] File tree generated', [
            'file_id' => $fileId,
            'depth' => $requestDTO->depth,
            'root_name' => $rootFile->getFileName(),
            'total_children' => $this->countTotalChildren($childrenTree),
        ]);

        return $responseDTO;
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
     * Count total children for logging.
     */
    protected function countTotalChildren(array $tree): int
    {
        $count = 0;
        foreach ($tree as $node) {
            ++$count;
            if (! empty($node['children'])) {
                $count += $this->countTotalChildren($node['children']);
            }
        }

        return $count;
    }

    /**
     * 校验当前用户对指定 file 所属项目的角色权限，并返回 file 实体（若不存在则按 file_not_found 抛错）。
     */
    protected function assertFileAccessible(string $fileId, MagicUserAuthorization $authorization, MemberRole $requiredRole): TaskFileEntity
    {
        $fileEntity = $this->magicFSFileDomainService->getFileById($fileId);
        $this->assertProjectAccessible($fileEntity->getProjectId(), $authorization, $requiredRole);
        return $fileEntity;
    }

    /**
     * 批量校验：按 project_id 去重后逐项目校验，避免重复 ProjectMember 查询。
     *
     * @param array<int|string> $fileIds
     */
    protected function assertFilesAccessible(array $fileIds, MagicUserAuthorization $authorization, MemberRole $requiredRole): void
    {
        if (empty($fileIds)) {
            return;
        }

        $checkedProjects = [];
        foreach (array_unique($fileIds) as $fileId) {
            $fileEntity = $this->magicFSFileDomainService->getFileById((string) $fileId);
            $projectId = $fileEntity->getProjectId();
            if (isset($checkedProjects[$projectId])) {
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
     */
    protected function resolveAndAuthorizeParentProject(string $parentId, MagicUserAuthorization $authorization, MemberRole $requiredRole): int
    {
        if ($parentId === '' || $parentId === '0') {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        $parentEntity = $this->magicFSFileDomainService->getFileById($parentId);
        $this->assertProjectAccessible($parentEntity->getProjectId(), $authorization, $requiredRole);
        return $parentEntity->getProjectId();
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
}
