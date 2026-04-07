<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ConvertStatusEnum;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\BatchDownloadPackRepositoryInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Request\FileConverterRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Response\FileConverterResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Response\FileItemDTO;
use Dtyq\SuperMagic\Infrastructure\Utils\RelativeFilePathUtil;

class BatchDownloadPackDomainService
{
    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly BatchDownloadPackRepositoryInterface $batchDownloadPackRepository,
    ) {
    }

    /**
     * @param TaskFileEntity[] $selectedEntities
     * @param TaskFileEntity[] $authorizedEntities
     * @return array{
     *   base_path:string,
     *   relative_base_path:string,
     *   pack_entries:array<int,string>,
     *   leaf_files:array<int,TaskFileEntity>,
     *   unique_leaf_file_ids:array<int,int>
     * }
     */
    public function buildPackManifest(
        array $selectedEntities,
        array $authorizedEntities,
        int $projectId,
        string $projectWorkDir,
        string $fullProjectWorkDir = ''
    ): array {
        $authorizedContext = $this->buildAuthorizedSelectionContext(
            $selectedEntities,
            $authorizedEntities,
            $projectId,
            $fullProjectWorkDir
        );

        $relativeBasePath = $this->buildRelativeBasePath(
            $authorizedContext['selected_visible_entities'],
            $authorizedContext['selected_relative_path_map']
        );
        $basePath = $relativeBasePath === ''
            ? rtrim($projectWorkDir, '/')
            : rtrim($projectWorkDir, '/') . '/' . $relativeBasePath;

        $leafFiles = $this->collectLeafFilesForPack(
            $authorizedContext['authorized_entities'],
            $authorizedContext['authorized_relative_path_map'],
            $authorizedContext['selected_file_ids'],
            $authorizedContext['selected_directory_paths']
        );
        $leafFiles = $this->deduplicateFilesById($leafFiles);

        $packFileKeys = $this->buildPackFileKeys(
            $leafFiles,
            $authorizedContext['authorized_relative_path_map'],
            $relativeBasePath,
            $fullProjectWorkDir
        );

        $explicitDirectories = $this->collectExplicitDirectoriesForPack(
            $authorizedContext['selected_directory_paths'],
            $packFileKeys,
            $relativeBasePath
        );
        $implicitDirectories = $this->collectAncestorDirectoriesForLeafFiles($packFileKeys);
        $packEntries = $this->buildPackEntries($explicitDirectories, $implicitDirectories, $packFileKeys);

        return [
            'base_path' => $basePath,
            'relative_base_path' => $relativeBasePath,
            'pack_entries' => $packEntries,
            'leaf_files' => $leafFiles,
            'unique_leaf_file_ids' => array_values(array_map(
                static fn (TaskFileEntity $file): int => $file->getFileId(),
                $leafFiles
            )),
        ];
    }

    public function submitPackTask(
        string $userId,
        string $organizationCode,
        string $sandboxId,
        string $projectId,
        FileConverterRequest $request,
        string $workDir
    ): FileConverterResponse {
        return $this->batchDownloadPackRepository->submitPackTask(
            $userId,
            $organizationCode,
            $sandboxId,
            $projectId,
            $request,
            $workDir
        );
    }

    public function queryPackTask(string $sandboxId, string $projectId, string $taskKey): FileConverterResponse
    {
        return $this->batchDownloadPackRepository->queryPackTask($sandboxId, $projectId, $taskKey);
    }

    /**
     * @return array{status:string,progress:int,message:string,error:string,zip_file_key:string,zip_file_name:string,file_count:int}
     */
    public function mapSandboxStatus(FileConverterResponse $response): array
    {
        $data = $response->getDataDTO();
        $status = strtolower($data->status);

        if ($status === ConvertStatusEnum::PENDING->value || $status === ConvertStatusEnum::PROCESSING->value) {
            return [
                'status' => 'processing',
                'progress' => $data->progress ?? 0,
                'message' => $response->getMessage() ?: 'Processing...',
                'error' => '',
                'zip_file_key' => '',
                'zip_file_name' => '',
                'file_count' => $data->totalFiles,
            ];
        }

        if ($status === ConvertStatusEnum::FAILED->value) {
            return [
                'status' => 'failed',
                'progress' => $data->progress ?? 0,
                'message' => 'Task failed',
                'error' => $data->errorMessage ?: ($response->getMessage() ?: 'Task failed'),
                'zip_file_key' => '',
                'zip_file_name' => '',
                'file_count' => $data->totalFiles,
            ];
        }

        if ($status === ConvertStatusEnum::COMPLETED->value) {
            [$zipFileKey, $zipFileName] = $this->extractZipFile($response->getConvertedFiles());

            return [
                'status' => 'ready',
                'progress' => 100,
                'message' => 'Files are ready',
                'error' => '',
                'zip_file_key' => $zipFileKey,
                'zip_file_name' => $zipFileName,
                'file_count' => $data->successCount > 0 ? $data->successCount : $data->totalFiles,
            ];
        }

        return [
            'status' => 'processing',
            'progress' => $data->progress ?? 0,
            'message' => $response->getMessage() ?: 'Processing...',
            'error' => '',
            'zip_file_key' => '',
            'zip_file_name' => '',
            'file_count' => $data->totalFiles,
        ];
    }

    /**
     * @param TaskFileEntity[] $entities
     * @return array<int,string>
     */
    private function buildRelativePathMap(array $entities, int $projectId): array
    {
        if (empty($entities)) {
            return [];
        }

        $fileIds = array_map(static fn (TaskFileEntity $entity): int => $entity->getFileId(), $entities);
        $filesWithParents = $this->taskFileDomainService->getFilesWithParentsByIds($fileIds, $projectId);
        $fileMap = RelativeFilePathUtil::indexByFileId($filesWithParents);

        return RelativeFilePathUtil::buildPathMapByParentChain($entities, $fileMap);
    }

    /**
     * @param TaskFileEntity[] $selectedEntities
     * @param array<int,string> $selectedRelativePathMap
     */
    private function buildRelativeBasePath(array $selectedEntities, array $selectedRelativePathMap): string
    {
        $paths = [];

        foreach ($selectedEntities as $entity) {
            $relativePath = $this->normalizeRelativePath($selectedRelativePathMap[$entity->getFileId()] ?? '');
            if ($relativePath === '') {
                continue;
            }

            // Keep legacy behavior: both file and directory use parent directory as LCA unit.
            $parentDir = dirname($relativePath);
            $paths[] = $parentDir === '.' ? '' : $parentDir;
        }

        return $this->findLca($paths);
    }

    /**
     * @param TaskFileEntity[] $selectedEntities
     * @param TaskFileEntity[] $authorizedEntities
     * @return array{
     *   authorized_entities:array<int,TaskFileEntity>,
     *   selected_visible_entities:array<int,TaskFileEntity>,
     *   selected_file_ids:array<int,int>,
     *   selected_directory_ids:array<int,int>,
     *   selected_directory_paths:array<int,string>,
     *   selected_relative_path_map:array<int,string>,
     *   authorized_relative_path_map:array<int,string>
     * }
     */
    private function buildAuthorizedSelectionContext(
        array $selectedEntities,
        array $authorizedEntities,
        int $projectId,
        string $fullProjectWorkDir
    ): array {
        $authorizedEntities = $this->deduplicateFilesById($authorizedEntities);
        $authorizedEntityMap = $this->indexEntitiesById($authorizedEntities);
        $authorizedRelativePathMap = $this->buildRelativePathMap($authorizedEntities, $projectId);

        $selectedVisibleEntities = [];
        foreach ($selectedEntities as $entity) {
            if (isset($authorizedEntityMap[$entity->getFileId()])) {
                $selectedVisibleEntities[] = $authorizedEntityMap[$entity->getFileId()];
            }
        }

        $selectedRelativePathMap = $this->buildRelativePathMap($selectedVisibleEntities, $projectId);

        $selectedFileIds = [];
        $selectedDirectoryIds = [];
        $selectedDirectoryPaths = [];

        foreach ($selectedEntities as $entity) {
            $fileId = $entity->getFileId();
            if (! isset($authorizedEntityMap[$fileId])) {
                continue;
            }

            if ($entity->getIsDirectory()) {
                $selectedDirectoryIds[] = $fileId;
                $directoryPath = $this->normalizeRelativePath(
                    $authorizedRelativePathMap[$fileId]
                    ?? $selectedRelativePathMap[$fileId]
                    ?? $this->buildLegacyFallbackPath($entity->getFileKey(), $fullProjectWorkDir)
                );
                if ($directoryPath !== '') {
                    $selectedDirectoryPaths[$fileId] = $directoryPath;
                }
                continue;
            }

            $selectedFileIds[] = $fileId;
        }

        return [
            'authorized_entities' => $authorizedEntities,
            'selected_visible_entities' => $selectedVisibleEntities,
            'selected_file_ids' => array_values(array_unique($selectedFileIds)),
            'selected_directory_ids' => array_values(array_unique($selectedDirectoryIds)),
            'selected_directory_paths' => $selectedDirectoryPaths,
            'selected_relative_path_map' => $selectedRelativePathMap,
            'authorized_relative_path_map' => $authorizedRelativePathMap,
        ];
    }

    /**
     * @param TaskFileEntity[] $authorizedEntities
     * @param array<int,string> $relativePathMap
     * @param int[] $selectedFileIds
     * @param array<int,string> $selectedDirectoryPaths
     * @return TaskFileEntity[]
     */
    private function collectLeafFilesForPack(
        array $authorizedEntities,
        array $relativePathMap,
        array $selectedFileIds,
        array $selectedDirectoryPaths
    ): array {
        $leafFiles = [];
        $selectedFileIdMap = array_fill_keys($selectedFileIds, true);

        foreach ($authorizedEntities as $entity) {
            if ($entity->getIsDirectory()) {
                continue;
            }

            $fileId = $entity->getFileId();
            if (isset($selectedFileIdMap[$fileId])) {
                $leafFiles[] = $entity;
                continue;
            }

            $relativePath = $this->normalizeRelativePath($relativePathMap[$fileId] ?? '');
            if ($relativePath === '') {
                continue;
            }

            foreach ($selectedDirectoryPaths as $directoryPath) {
                $normalizedDirectoryPath = $this->normalizeRelativePath($directoryPath);
                if ($normalizedDirectoryPath !== '' && str_starts_with($relativePath, $normalizedDirectoryPath . '/')) {
                    $leafFiles[] = $entity;
                    break;
                }
            }
        }

        return $leafFiles;
    }

    /**
     * @param TaskFileEntity[] $files
     * @param array<int,string> $relativePathMap
     * @return array<int,string>
     */
    private function buildPackFileKeys(
        array $files,
        array $relativePathMap,
        string $relativeBasePath,
        string $fullProjectWorkDir
    ): array {
        $fileKeys = [];
        $seen = [];

        foreach ($files as $file) {
            if ($file->getIsDirectory()) {
                continue;
            }

            $relativePath = $this->normalizeRelativePath($relativePathMap[$file->getFileId()] ?? '');
            if ($relativePath === '') {
                $relativePath = $this->buildLegacyFallbackPath($file->getFileKey(), $fullProjectWorkDir);
            }

            if ($relativePath === '') {
                continue;
            }

            $key = $this->normalizeRelativePath($this->stripRelativeBasePath($relativePath, $relativeBasePath));
            if ($this->isInvalidPackKey($key) || isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $fileKeys[] = $key;
        }

        sort($fileKeys);

        return $fileKeys;
    }

    /**
     * @param array<int,string> $selectedDirectoryPaths
     * @param string[] $packFileKeys
     * @return string[]
     */
    private function collectExplicitDirectoriesForPack(
        array $selectedDirectoryPaths,
        array $packFileKeys,
        string $relativeBasePath
    ): array {
        $explicitDirectories = [];
        $seen = [];

        foreach ($selectedDirectoryPaths as $directoryPath) {
            $relativeDirectoryKey = $this->normalizeRelativePath(
                $this->stripRelativeBasePath($directoryPath, $relativeBasePath)
            );

            if ($this->isInvalidPackKey($relativeDirectoryKey) || isset($seen[$relativeDirectoryKey])) {
                continue;
            }

            $hasLeafFile = false;
            foreach ($packFileKeys as $fileKey) {
                if ($fileKey === $relativeDirectoryKey || str_starts_with($fileKey, $relativeDirectoryKey . '/')) {
                    $hasLeafFile = true;
                    break;
                }
            }

            if (! $hasLeafFile) {
                continue;
            }

            $seen[$relativeDirectoryKey] = true;
            $explicitDirectories[] = $relativeDirectoryKey;
        }

        return $explicitDirectories;
    }

    /**
     * @param string[] $packFileKeys
     * @return string[]
     */
    private function collectAncestorDirectoriesForLeafFiles(array $packFileKeys): array
    {
        $directories = [];
        $seen = [];

        foreach ($packFileKeys as $fileKey) {
            $normalizedFileKey = $this->normalizeRelativePath($fileKey);
            if ($normalizedFileKey === '') {
                continue;
            }

            $segments = explode('/', $normalizedFileKey);
            if (count($segments) <= 1) {
                continue;
            }

            $currentPath = '';
            foreach (array_slice($segments, 0, -1) as $segment) {
                $currentPath = $currentPath === '' ? $segment : $currentPath . '/' . $segment;
                if (! isset($seen[$currentPath])) {
                    $seen[$currentPath] = true;
                    $directories[] = $currentPath;
                }
            }
        }

        return $directories;
    }

    /**
     * @param string[] $explicitDirectories
     * @param string[] $implicitDirectories
     * @param string[] $packFileKeys
     * @return string[]
     */
    private function buildPackEntries(
        array $explicitDirectories,
        array $implicitDirectories,
        array $packFileKeys
    ): array {
        $directories = array_values(array_unique(array_merge($explicitDirectories, $implicitDirectories)));
        $directories = array_values(array_filter(
            $directories,
            fn (string $directory): bool => ! $this->isInvalidPackKey($directory)
        ));
        $directories = $this->sortPackEntries($directories, true);

        $files = array_values(array_unique($packFileKeys));
        $files = array_values(array_filter(
            $files,
            fn (string $file): bool => ! $this->isInvalidPackKey($file)
        ));
        $files = $this->sortPackEntries($files, false);

        return array_values(array_merge($directories, $files));
    }

    /**
     * @param string[] $entries
     * @return string[]
     */
    private function sortPackEntries(array $entries, bool $isDirectory): array
    {
        usort($entries, static function (string $left, string $right) use ($isDirectory): int {
            if (! $isDirectory) {
                return strcmp($left, $right);
            }

            $leftDepth = substr_count($left, '/');
            $rightDepth = substr_count($right, '/');
            if ($leftDepth !== $rightDepth) {
                return $leftDepth <=> $rightDepth;
            }

            return strcmp($left, $right);
        });

        return $entries;
    }

    /**
     * @param TaskFileEntity[] $entities
     * @return array<int,TaskFileEntity>
     */
    private function indexEntitiesById(array $entities): array
    {
        $entityMap = [];
        foreach ($entities as $entity) {
            $entityMap[$entity->getFileId()] = $entity;
        }

        return $entityMap;
    }

    /**
     * @param TaskFileEntity[] $entities
     * @return TaskFileEntity[]
     */
    private function deduplicateFilesById(array $entities): array
    {
        return array_values($this->indexEntitiesById($entities));
    }

    private function isInvalidPackKey(string $key): bool
    {
        return $key === '' || str_starts_with($key, '../') || str_contains($key, '/../');
    }

    private function stripRelativeBasePath(string $relativePath, string $relativeBasePath): string
    {
        $relativeBasePath = trim($relativeBasePath, '/');
        if ($relativeBasePath === '') {
            return $relativePath;
        }

        $prefix = $relativeBasePath . '/';
        if (str_starts_with($relativePath, $prefix)) {
            return ltrim(substr($relativePath, strlen($prefix)), '/');
        }

        return $relativePath;
    }

    private function buildLegacyFallbackPath(string $fullFileKey, string $fullProjectWorkDir): string
    {
        $normalizedFileKey = str_replace('\\', '/', trim($fullFileKey));
        $normalizedWorkDir = rtrim(str_replace('\\', '/', trim($fullProjectWorkDir)), '/');

        if ($normalizedWorkDir === '') {
            return '';
        }

        if (str_starts_with($normalizedFileKey, $normalizedWorkDir . '/')) {
            $relativePath = substr($normalizedFileKey, strlen($normalizedWorkDir) + 1);
            return $this->normalizeRelativePath($relativePath);
        }

        return '';
    }

    private function normalizeRelativePath(string $path): string
    {
        $normalizedPath = str_replace('\\', '/', trim($path));
        $normalizedPath = preg_replace('#/+#', '/', $normalizedPath) ?? '';
        return trim($normalizedPath, '/');
    }

    /**
     * @param string[] $paths
     */
    private function findLca(array $paths): string
    {
        $paths = array_values(array_filter($paths, static fn (string $path): bool => $path !== ''));
        if (empty($paths)) {
            return '';
        }

        if (count($paths) === 1) {
            return trim($paths[0], '/');
        }

        $segmentsGroup = array_map(
            static fn (string $path): array => array_values(array_filter(explode('/', trim($path, '/')))),
            $paths
        );

        $first = $segmentsGroup[0];
        $common = [];
        for ($i = 0; $i < count($first); ++$i) {
            $segment = $first[$i];
            foreach ($segmentsGroup as $segments) {
                if (! isset($segments[$i]) || $segments[$i] !== $segment) {
                    return implode('/', $common);
                }
            }
            $common[] = $segment;
        }

        return implode('/', $common);
    }

    /**
     * @param FileItemDTO[] $files
     * @return array{0:string,1:string}
     */
    private function extractZipFile(array $files): array
    {
        foreach ($files as $file) {
            if (strtolower($file->type) === 'zip' && ($file->ossKey !== '' || $file->storageKey !== '')) {
                $zipKey = $file->storageKey !== '' ? $file->storageKey : $file->ossKey;
                return [$zipKey, basename($zipKey)];
            }
        }

        foreach ($files as $file) {
            if ($file->ossKey !== '' || $file->storageKey !== '') {
                $zipKey = $file->storageKey !== '' ? $file->storageKey : $file->ossKey;
                return [$zipKey, basename($zipKey)];
            }
        }

        return ['', ''];
    }
}
