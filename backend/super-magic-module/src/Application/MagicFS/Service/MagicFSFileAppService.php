<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\MagicFS\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\MagicFS\Service\MagicFSFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\DirectoryDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileContentSavedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use Dtyq\SuperMagic\ErrorCode\MagicFSErrorCode;
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

class MagicFSFileAppService
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
    public function listFiles(ListFilesRequestDTO $requestDTO): ListFilesResponseDTO
    {
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
    public function getFileInfo(string $fileId): FileInfoResponseDTO
    {
        // 调用领域服务获取文件实体
        $fileEntity = $this->magicFSFileDomainService->getFileById($fileId);

        // 转换为 DTO
        $responseDTO = new FileInfoResponseDTO();
        $responseDTO->file = MagicFSFileDTO::fromTaskFileEntity($fileEntity);

        return $responseDTO;
    }

    /**
     * 获取单个文件元数据版本号.
     */
    public function getFileVersion(string $fileId): FileVersionResponseDTO
    {
        // 调用领域服务获取文件实体
        $fileEntity = $this->magicFSFileDomainService->getFileById($fileId);

        // 转换为 DTO，返回元数据版本号
        $responseDTO = new FileVersionResponseDTO();
        $responseDTO->version = $fileEntity->getMetadataVersion();

        return $responseDTO;
    }

    /**
     * 批量获取文件元数据版本号.
     */
    public function getFileVersions(GetFileVersionsRequestDTO $requestDTO): FileVersionsResponseDTO
    {
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
    public function createFile(CreateFileRequestDTO $requestDTO): FileInfoResponseDTO
    {
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
    public function updateFile(string $fileId, UpdateFileRequestDTO $requestDTO): FileInfoResponseDTO
    {
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
    public function deleteFile(string $fileId): void
    {
        // Fetch entity before deletion so we can build the event payload
        $fileEntity = $this->magicFSFileDomainService->getFileById($fileId);

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
    public function getFileTree(string $fileId, GetFileTreeRequestDTO $requestDTO): FileInfoResponseDTO
    {
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
}
