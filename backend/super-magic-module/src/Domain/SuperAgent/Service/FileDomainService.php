<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Application\File\Service\FileAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Throwable;

class FileDomainService
{
    public function __construct(
        private readonly CloudFileRepositoryInterface $cloudFileRepository,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly FileAppService $fileAppService
    ) {
    }

    /**
     * 同步项目文件的核心逻辑.
     */
    public function syncProjectFiles(DataIsolation $dataIsolation, ProjectEntity $projectEntity): array
    {
        $projectId = $projectEntity->getId();
        $workDir = $projectEntity->getWorkDir();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 1. 通过workDir调用对象存储获取最新文件列表
        $objectStorageFiles = $this->getObjectStorageFiles($organizationCode, $workDir);

        // 2. 通过projectId调用TaskFile仓储获取现有file_key列表
        $existingFileKeys = $this->taskFileRepository->getFileKeysByProjectId($projectId);

        // 3. 计算差集：新增/删除/更新文件（高性能处理）
        $diffResult = $this->calculateFileDifferences($objectStorageFiles, $existingFileKeys);

        // 4. 执行同步操作
        $this->executeSyncOperations($dataIsolation, $projectId, $diffResult, $objectStorageFiles);

        // 5. 构建最终文件列表
        $finalFileList = $this->buildFinalFileList($objectStorageFiles, $organizationCode);

        return [
            'files' => $finalFileList,
            'stats' => [
                'total' => count($finalFileList),
                'new_files' => count($diffResult['new_files']),
                'deleted_files' => count($diffResult['deleted_files']),
                'updated_files' => count($diffResult['updated_files']),
            ],
        ];
    }

    /**
     * 获取对象存储文件列表.
     */
    public function getObjectStorageFiles(string $organizationCode, string $workDir): array
    {
        try {
            $md5Key = md5(StorageBucketType::Private->value);
            $fullWorkDir = "{$md5Key}" . '/' . trim($workDir, '/');
            $objectsList = $this->cloudFileRepository->listObjectsByCredential(
                $organizationCode,
                $fullWorkDir,
                StorageBucketType::Private,
                [
                    'max-keys' => 1000,
                    'delimiter' => '/',
                    'cache' => false,
                ]
            );
        } catch (Throwable $e) {
            // 如果对象存储查询失败，返回空列表
            return [];
        }

        $files = [];
        foreach ($objectsList['objects'] ?? [] as $object) {
            // 跳过目录对象
            if (str_ends_with($object['key'], '/')) {
                continue;
            }

            $files[$object['key']] = [
                'file_key' => $object['key'],
                'file_name' => basename($object['key']),
                'file_size' => $object['size'] ?? 0,
                'file_extension' => pathinfo($object['key'], PATHINFO_EXTENSION),
                'last_modified' => $object['last_modified'] ?? '',
                'etag' => $object['etag'] ?? '',
            ];
        }

        return $files;
    }

    /**
     * 构建最终文件列表（包含URL）.
     */
    public function buildFinalFileList(array $objectStorageFiles, string $organizationCode): array
    {
        if (empty($objectStorageFiles)) {
            return [];
        }

        $fileKeys = array_keys($objectStorageFiles);

        // 批量获取文件URL
        $fileUrls = $this->fileAppService->getBatchLinks($organizationCode, $fileKeys, StorageBucketType::Private);

        $finalList = [];
        foreach ($objectStorageFiles as $fileKey => $fileData) {
            $fileData['file_url'] = $fileUrls[$fileKey] ?? '';
            $finalList[] = $fileData;
        }

        return $finalList;
    }

    /**
     * 高性能计算文件差异
     */
    private function calculateFileDifferences(array $objectStorageFiles, array $existingFileKeys): array
    {
        // 使用PHP内置的数组函数进行高性能差集计算
        $ossFileKeys = array_keys($objectStorageFiles);

        // 新增文件：在对象存储中但不在数据库中
        $newFiles = array_diff($ossFileKeys, $existingFileKeys);

        // 删除文件：在数据库中但不在对象存储中
        $deletedFiles = array_diff($existingFileKeys, $ossFileKeys);

        // 更新文件：两边都存在，但需要检查是否有变化
        $commonFiles = array_intersect($ossFileKeys, $existingFileKeys);
        $updatedFiles = [];

        // 简化处理：暂时认为公共文件都是最新的，后续可根据etag或修改时间判断
        // foreach ($commonFiles as $fileKey) {
        //     if ($this->needsUpdate($objectStorageFiles[$fileKey], $existingFiles[$fileKey])) {
        //         $updatedFiles[] = $fileKey;
        //     }
        // }

        return [
            'new_files' => $newFiles,
            'deleted_files' => $deletedFiles,
            'updated_files' => $updatedFiles,
            'common_files' => $commonFiles,
        ];
    }

    /**
     * 执行同步操作.
     */
    private function executeSyncOperations(DataIsolation $dataIsolation, int $projectId, array $diffResult, array $objectStorageFiles): void
    {
        // 批量插入新文件
        if (! empty($diffResult['new_files'])) {
            $this->taskFileRepository->batchInsertFiles($dataIsolation, $projectId, $diffResult['new_files'], $objectStorageFiles);
        }

        // 批量标记删除的文件
        if (! empty($diffResult['deleted_files'])) {
            $this->taskFileRepository->batchMarkAsDeleted($diffResult['deleted_files']);
        }

        // 批量更新文件（如果需要）
        if (! empty($diffResult['updated_files'])) {
            $this->taskFileRepository->batchUpdateFiles($diffResult['updated_files']);
        }
    }

    /**
     * 构建最终文件列表（包含URL）
     */
    private function buildFinalFileList(array $objectStorageFiles, string $organizationCode): array
    {
        if (empty($objectStorageFiles)) {
            return [];
        }

        $fileKeys = array_keys($objectStorageFiles);

        // 批量获取文件URL
        $fileUrls = $this->fileAppService->getBatchLinks($organizationCode, $fileKeys, StorageBucketType::Private);

        $finalList = [];
        foreach ($objectStorageFiles as $fileKey => $fileData) {
            $fileData['file_url'] = $fileUrls[$fileKey] ?? '';
            $finalList[] = $fileData;
        }

        return $finalList;
    }
}
