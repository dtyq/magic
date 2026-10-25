<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\FileScope;

use App\Application\SuperMagic\File\Service\FileMemoryAccessService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\ErrorCode\MagicFSErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\Utils\FileTreeBuilder;
use App\Infrastructure\SuperMagic\Utils\RelativeFilePathUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsV2RequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\TaskFileItemDTO;

/**
 * 已授权文件子树的附件遍历。作用域处理器负责根目录与续页目录鉴权。
 */
final class FileScopeTreeService
{
    private const int MAX_V2_PARENT_QUERIES = 1000;

    public function __construct(
        private readonly FileMemoryAccessService $fileMemoryAccessService,
        private readonly MagicFSFileDomainService $magicFSFileDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileTreeBuilder $fileTreeBuilder,
    ) {
    }

    /**
     * 按项目附件 V1 协议返回已授权目录及完整子树。
     */
    public function listProjectAttachments(
        MagicUserAuthorization $authorization,
        GetProjectAttachmentsRequestDTO $requestDTO,
        TaskFileEntity $root,
    ): array {
        $entities = $this->getTreeEntities($authorization, $root);
        $entities = array_values(array_filter(
            $entities,
            fn (TaskFileEntity $entity): bool => $this->matchesFileType(
                $entity,
                $requestDTO->getFileType(),
                $root->getFileId(),
            ),
        ));

        $fileMap = RelativeFilePathUtil::indexByFileId($entities);
        $relativePathMap = RelativeFilePathUtil::buildPathMapByParentChain($entities, $fileMap);
        $list = array_map(
            static fn (TaskFileEntity $entity): array => TaskFileItemDTO::fromEntity(
                $entity,
                '',
                $relativePathMap[$entity->getFileId()] ?? '',
            )->toArray(),
            $entities,
        );

        return [
            'total' => count($list),
            'list' => $list,
            'tree' => $this->fileTreeBuilder->buildTree($list, null, 'zh_CN'),
        ];
    }

    /**
     * 按项目附件 V2 协议分页遍历已授权目录。
     */
    public function listProjectAttachmentsV2(
        MagicUserAuthorization $authorization,
        GetProjectAttachmentsV2RequestDTO $requestDTO,
        TaskFileEntity $root,
        array $rootItem,
    ): array {
        $queue = $requestDTO->getNextParentIds();
        $list = [];
        $remaining = $requestDTO->getPageSize();
        $parentQueryCount = 0;

        if ($queue === []) {
            $list[] = $rootItem;
            --$remaining;
            $queue[] = $this->makeParentState((string) $root->getFileId());
        }

        while ($remaining > 0 && $queue !== [] && $parentQueryCount < self::MAX_V2_PARENT_QUERIES) {
            $state = array_shift($queue);
            $parentId = (int) ($state['parent_id'] ?? 0);
            if ($parentId <= 0) {
                continue;
            }

            ++$parentQueryCount;
            $rows = $this->taskFileDomainService->getProjectFileChildrenByParentCursor(
                0,
                $parentId,
                '', // 不做 storage_type 预过滤：过渡期 user 空间文件可能为 'workspace' 或 'user'，
                // 交由下方 belongsToCurrentUserSpaceRow 按 space_type='user' 统一判定。
                $state['after_sort'] ?? null,
                isset($state['after_file_id']) ? (int) $state['after_file_id'] : null,
                $remaining + 1,
                $requestDTO->getFileType(),
            );
            $rows = array_map(static fn (mixed $row): array => (array) $row, $rows);
            $rows = array_values(array_filter(
                $rows,
                fn (array $row): bool => $this->belongsToCurrentUserSpaceRow($row, $authorization),
            ));

            $rowsToEmit = array_slice($rows, 0, $remaining);
            $lastEmittedRow = null;
            foreach ($rowsToEmit as $row) {
                $lastEmittedRow = $row;
                $list[] = $this->formatAttachmentRowV2($row);
                --$remaining;

                if ((bool) ($row['is_directory'] ?? false)) {
                    $childParentId = (string) ($row['file_id'] ?? '');
                    if ($childParentId !== '' && $childParentId !== (string) $parentId) {
                        $queue[] = $this->makeParentState($childParentId);
                    }
                }
            }

            if (count($rows) > count($rowsToEmit) && $lastEmittedRow !== null) {
                array_unshift(
                    $queue,
                    $this->makeParentState(
                        (string) $parentId,
                        (int) ($lastEmittedRow['sort'] ?? 0),
                        (string) ($lastEmittedRow['file_id'] ?? ''),
                    ),
                );
                break;
            }
        }

        return [
            'list' => $list,
            'next_parent_ids' => array_values($queue),
            'has_more' => $queue !== [],
        ];
    }

    /**
     * 获取已授权目录树中属于当前用户空间的节点。
     *
     * @return array<TaskFileEntity>
     */
    public function getTreeEntities(
        MagicUserAuthorization $authorization,
        TaskFileEntity $root,
    ): array {
        $fileTree = $this->magicFSFileDomainService->getFileTree(
            (string) $root->getFileId(),
            -1,
            0,
            $root->getSpaceType(),
        );

        return array_values(array_filter(
            array_merge([$root], $fileTree['children'] ?? []),
            fn (TaskFileEntity $entity): bool => $this->fileMemoryAccessService
                ->belongsToCurrentUserSpace($entity, $authorization),
        ));
    }

    /**
     * 批量读取 V2 游标目录并校验存在性；具体空间权限由调用方校验。
     *
     * @param array<int, array{parent_id: string, after_sort: null|int, after_file_id: null|string}> $queue
     */
    public function getTraversalDirectories(
        array $queue,
    ): array {
        $parentIds = [];
        foreach ($queue as $state) {
            $parentId = (string) ($state['parent_id'] ?? '');
            $this->assertValidParentId($parentId);
            $parentIds[(int) $parentId] = (int) $parentId;
        }

        $directories = $this->taskFileDomainService->getFilesByIds(array_values($parentIds));
        $directoryMap = [];
        foreach ($directories as $directory) {
            $directoryMap[$directory->getFileId()] = $directory;
        }

        foreach ($parentIds as $parentId) {
            $directory = $directoryMap[$parentId] ?? null;
            if ($directory === null || ! $directory->getIsDirectory()) {
                ExceptionBuilder::throw(
                    MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                    'magicfs.parent_directory_not_found',
                    ['parent_id' => (string) $parentId],
                );
            }
        }

        return array_values($directoryMap);
    }

    /**
     * 将文件实体或查询行转换为项目附件 V2 响应格式。
     */
    public function formatAttachmentRowV2(array $row): array
    {
        $item = TaskFileItemDTO::fromArray($row)->toArray();
        $item['file_url'] = '';
        unset($item['relative_file_path']);

        return $item;
    }

    /**
     * 校验目录编号格式。
     */
    public function assertValidParentId(string $parentId): void
    {
        if (preg_match('/^[1-9][0-9]*$/', $parentId) === 1) {
            return;
        }

        ExceptionBuilder::throw(
            MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
            'magicfs.parent_directory_not_found',
            ['parent_id' => $parentId],
        );
    }

    /**
     * 判断文件是否满足附件类型过滤条件，目录节点始终保留以维持树结构。
     *
     * @param string[] $fileTypes
     */
    private function matchesFileType(TaskFileEntity $entity, array $fileTypes, int $rootId): bool
    {
        return $entity->getFileId() === $rootId
            || $entity->getIsDirectory()
            || $fileTypes === []
            || in_array($entity->getFileType(), $fileTypes, true);
    }

    /**
     * 判断原始查询行是否属于当前用户文件空间。
     */
    private function belongsToCurrentUserSpaceRow(
        array $row,
        MagicUserAuthorization $authorization,
    ): bool {
        return (int) ($row['project_id'] ?? -1) === 0
            && (string) ($row['space_type'] ?? '') === 'user'
            && (string) ($row['user_id'] ?? '') === $authorization->getId()
            && (string) ($row['organization_code'] ?? '') === $authorization->getOrganizationCode();
    }

    /**
     * 创建 V2 广度优先遍历游标。
     *
     * @return array{parent_id: string, after_sort: null|int, after_file_id: null|string}
     */
    private function makeParentState(
        string $parentId,
        ?int $afterSort = null,
        ?string $afterFileId = null,
    ): array {
        return [
            'parent_id' => $parentId,
            'after_sort' => $afterSort,
            'after_file_id' => $afterFileId === '' ? null : $afterFileId,
        ];
    }
}
