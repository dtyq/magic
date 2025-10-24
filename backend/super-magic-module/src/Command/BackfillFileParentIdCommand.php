<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Command;

use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskFileModel;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskModel;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Input\InputArgument;
use Throwable;

#[Command]
class BackfillFileParentIdCommand extends HyperfCommand
{
    protected ?string $name = 'super-magic:backfill-file-parent-id';

    protected LoggerInterface $logger;

    public function __construct(
        protected ProjectRepositoryInterface $projectRepository,
        protected TopicRepositoryInterface $topicRepository,
        protected TaskFileDomainService $taskFileDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('backfill-file-parent-id');
        parent::__construct();
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('Backfill parent_id for existing files in magic_super_agent_task_files table');
        $this->addArgument('project_id', InputArgument::OPTIONAL, 'Optional project ID to process only one project');
        $this->addArgument('organization_code', InputArgument::OPTIONAL, 'Optional organization code to process projects by organization');
    }

    public function handle()
    {
        $this->line('🚀 Starting backfill process for file parent_id...');
        $this->logger->info('Starting backfill process for file parent_id.');

        $projectId = $this->input->getArgument('project_id');
        $organizationCode = $this->input->getArgument('organization_code');

        // Initialize result tracking
        $startTime = date('Y-m-d H:i:s');
        $resultLog = [
            'start_time' => $startTime,
            'success_projects' => [],
            'failed_projects' => [],
            'skipped_projects' => [],
            'total_processed_files' => 0,
            'total_errors' => 0,
        ];

        try {
            // Get projects based on input parameter
            $projects = $this->getProjectsToProcess($projectId, $organizationCode);

            if (empty($projects)) {
                $this->error('❌ No projects found to process.');
                $this->writeResultsToFile($resultLog, 'No projects found');
                return;
            }

            $this->line(sprintf('📊 Found %d project(s) to process.', count($projects)));

            // Process each project
            foreach ($projects as $project) {
                $projectResult = $this->processProject($project);

                // Record result
                if ($projectResult['status'] === 'success') {
                    $resultLog['success_projects'][] = $projectResult;
                    $resultLog['total_processed_files'] += $projectResult['processed_files'];
                    $resultLog['total_errors'] += $projectResult['errors'];
                } elseif ($projectResult['status'] === 'failed') {
                    $resultLog['failed_projects'][] = $projectResult;
                } else {
                    $resultLog['skipped_projects'][] = $projectResult;
                }
            }

            $resultLog['end_time'] = date('Y-m-d H:i:s');
            $this->writeResultsToFile($resultLog, 'Completed successfully');

            $this->line('✅ Backfill process completed successfully!');
            $this->logger->info('Backfill process completed successfully.');
        } catch (Throwable $e) {
            $resultLog['end_time'] = date('Y-m-d H:i:s');
            $resultLog['error'] = $e->getMessage();
            $this->writeResultsToFile($resultLog, 'Process failed');

            $this->error(sprintf('❌ Backfill process failed: %s', $e->getMessage()));
            $this->logger->error(sprintf('Backfill process failed: %s', $e->getMessage()), [
                'exception' => $e,
                'project_id' => $projectId,
                'organization_code' => $organizationCode,
            ]);
        }
    }

    /**
     * 根据存储类型处理文件路径，将旧格式的路径转换为新格式
     * 简化版：直接用新前缀替换旧前缀，然后添加相应的路径段.
     *
     * @param string $type 存储类型 (workspace 或其他)
     * @param string $fileKey 原始文件路径
     * @param string $prefix 新前缀，如：DT001/588417216353927169
     * @param string $oldPrefix 旧前缀，如：DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_xxx
     * @param bool $isDirectory 是否为目录
     * @return string 转换后的文件路径
     */
    public function handleFileKeyByType($type, $fileKey, $prefix, $oldPrefix, bool $isDirectory = false): string
    {
        $storageTypeValue = $type instanceof StorageType ? $type->value : $type;

        // 检查是否包含旧前缀，如果不包含则返回原路径
        if (strpos($fileKey, $oldPrefix . '/') !== 0) {
            return $fileKey;
        }

        // 移除旧前缀，获取相对路径部分
        $relativePath = substr($fileKey, strlen($oldPrefix . '/'));

        // 先规范化相对路径，移除双斜杠
        $relativePath = preg_replace('#/+#', '/', $relativePath);
        $relativePath = trim($relativePath, '/');

        if ($storageTypeValue == 'workspace') {
            // workspace 类型：添加 /workspace
            // 源：DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_xxx/project_804590875311198209/新建文件.php
            // 或：DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_xxx/topic_804590875311198209/新建文件.php
            // 目标：DT001/588417216353927169/project_804590875311198209/workspace/新建文件.php

            // 找到 project_ 或 topic_ 开头的部分
            $pathParts = explode('/', $relativePath);
            for ($i = 0; $i < count($pathParts); ++$i) {
                if (strpos($pathParts[$i], 'project_') === 0 || strpos($pathParts[$i], 'topic_') === 0) {
                    $entityName = $pathParts[$i];

                    // 如果是 topic_，需要转换为 project_ 格式
                    if (strpos($entityName, 'topic_') === 0) {
                        $entityName = str_replace('topic_', 'project_', $entityName);
                    }

                    // 检查是否已经包含 workspace
                    if ($i + 1 < count($pathParts) && $pathParts[$i + 1] === 'workspace') {
                        // 已经有 workspace，保留 workspace 之后的路径
                        $remainingParts = array_slice($pathParts, $i + 2);
                        $finalPath = empty($remainingParts) ? '' : implode('/', $remainingParts);
                        return $this->normalizePath($prefix . '/' . $entityName . '/workspace/' . $finalPath, $isDirectory);
                    }
                    // 需要添加 workspace
                    $remainingParts = array_slice($pathParts, $i + 1);
                    $finalPath = empty($remainingParts) ? '' : implode('/', $remainingParts);
                    return $this->normalizePath($prefix . '/' . $entityName . '/workspace/' . $finalPath, $isDirectory);
                }
            }
        } else {
            // 非 workspace 类型：添加 /runtime/message
            // 源：DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_xxx/project_808853145743884288/task_xxx/.chat/file.md
            // 或：DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/SUPER_MAGIC/usi_xxx/topic_808853145743884288/task_xxx/.chat/file.md
            // 目标：DT001/588417216353927169/project_808853145743884288/runtime/message/task_xxx/.chat/file.md

            // 找到 project_ 或 topic_ 开头的部分
            $pathParts = explode('/', $relativePath);
            for ($i = 0; $i < count($pathParts); ++$i) {
                if (strpos($pathParts[$i], 'project_') === 0 || strpos($pathParts[$i], 'topic_') === 0) {
                    $entityName = $pathParts[$i];

                    // 如果是 topic_，需要转换为 project_ 格式
                    if (strpos($entityName, 'topic_') === 0) {
                        $entityName = str_replace('topic_', 'project_', $entityName);
                    }

                    $remainingParts = array_slice($pathParts, $i + 1);
                    $finalPath = empty($remainingParts) ? '' : implode('/', $remainingParts);

                    // 处理空路径，避免双斜杠
                    return $this->normalizePath($prefix . '/' . $entityName . '/runtime/message/' . $finalPath, $isDirectory);
                }
            }
        }

        // 如果找不到 project_ 部分，返回原路径
        return $fileKey;
    }

    /**
     * Get projects to process based on input parameter.
     *
     * @param null|string $projectId Optional project ID
     * @param null|string $organizationCode Optional organization code
     * @return ProjectEntity[] Array of project entities
     */
    private function getProjectsToProcess(?string $projectId, ?string $organizationCode): array
    {
        // Check if project_id is provided and not empty
        if ($projectId !== null && trim($projectId) !== '' && $projectId !== '-') {
            // Process single project
            $this->line(sprintf('🎯 Processing single project with ID: %s', $projectId));
            $project = $this->projectRepository->findById((int) $projectId);

            if ($project === null) {
                $this->error(sprintf('❌ Project with ID %s not found.', $projectId));
                return [];
            }

            return [$project];
        }

        // Prepare conditions for project filtering
        $conditions = [];
        if ($organizationCode !== null) {
            $conditions['user_organization_code'] = $organizationCode;
            $this->line(sprintf('🏢 Processing projects for organization: %s', $organizationCode));
        } else {
            $this->line('🌐 Processing all projects...');
        }

        // Process projects using pagination to avoid memory issues
        $allProjects = [];
        $page = 1;
        $pageSize = 100;

        do {
            $result = $this->projectRepository->getProjectsByConditions(
                conditions: $conditions,
                page: $page,
                pageSize: $pageSize,
                orderBy: 'id',
                orderDirection: 'asc'
            );

            if (empty($result['list'])) {
                break;
            }

            $projects = $result['list'] ?? [];
            $allProjects = array_merge($allProjects, $projects);

            $this->line(sprintf('📄 Loaded page %d with %d projects', $page, count($projects)));

            ++$page;
        } while (count($projects) === $pageSize);

        return $allProjects;
    }

    /**
     * Process a single project.
     *
     * @param ProjectEntity $project 项目实体
     * @return array 处理结果
     */
    private function processProject(ProjectEntity $project): array
    {
        $this->line(sprintf('🔄 Processing project ID: %d, Name: %s', $project->getId(), $project->getProjectName()));
        $this->logger->info(sprintf('Processing project ID: %d, Name: %s', $project->getId(), $project->getProjectName()));

        $projectResult = [
            'project_id' => $project->getId(),
            'project_name' => $project->getProjectName(),
            'status' => 'success',
            'processed_files' => 0,
            'errors' => 0,
            'cache_hits' => 0,
            'message' => '',
            'start_time' => date('Y-m-d H:i:s'),
        ];

        if (empty($project->getWorkDir())) {
            $this->warn(sprintf('⚠️  Project ID %d has empty work_dir, skipping...', $project->getId()));
            $this->logger->warning(sprintf('Project ID %d has empty work_dir, skipping', $project->getId()));

            $projectResult['status'] = 'skipped';
            $projectResult['message'] = 'Empty work_dir';
            $projectResult['end_time'] = date('Y-m-d H:i:s');
            return $projectResult;
        }

        // 🎯 第一步：更新 work_dir（必须在处理文件之前，因为后续处理依赖新的 work_dir）
        $updatedProject = $this->updateWorkDirectories($project);
        if ($updatedProject === null) {
            $this->error(sprintf('❌ Failed to update work_dir for project %d, skipping...', $project->getId()));

            $projectResult['status'] = 'failed';
            $projectResult['message'] = 'Failed to update work_dir';
            $projectResult['end_time'] = date('Y-m-d H:i:s');
            return $projectResult;
        }

        $processedCount = 0;
        $errorCount = 0;
        $cacheHitCount = 0;

        // 核心优化：维护目录路径与 parent_id 的缓存映射
        $directoryPathCache = [];

        $md5Key = md5(StorageBucketType::Private->value);
        $prefix = $this->taskFileDomainService->getFullPrefix($updatedProject->getUserOrganizationCode());
        $oldPrefix = $prefix . $md5Key . '/SUPER_MAGIC/' . $updatedProject->getUserId();

        // Process files in chunks to avoid memory issues
        // 🔄 支持重复执行：只处理需要处理的文件
        TaskFileModel::query()
            ->where('project_id', $updatedProject->getId())
            // ->where('is_directory', false)
            ->where(function ($query) use ($oldPrefix) {
                // 只处理需要转换的文件：包含旧前缀的文件 或 parent_id 为空的文件
                $query->where('file_key', 'like', $oldPrefix . '/%')
                    ->orWhereNull('parent_id');
            })
            ->chunkById(100, function ($files) use ($updatedProject, $prefix, $oldPrefix, &$processedCount, &$errorCount, &$cacheHitCount, &$directoryPathCache) {
                foreach ($files as $file) {
                    try {
                        // 根据类型处理路径，将旧格式转换为新格式
                        $storageTypeValue = $file['storage_type'] instanceof StorageType ? $file['storage_type']->value : $file['storage_type'];
                        $isDirectory = $file['is_directory'] == 1;
                        $newFileKey = $this->handleFileKeyByType($storageTypeValue, $file['file_key'], $prefix, $oldPrefix, $isDirectory);

                        $this->logger->info(sprintf('Processing file ID: %d, File key: %s', $file->file_id, $newFileKey));

                        // 如果路径发生了变化，更新 file_key
                        if ($newFileKey !== $file['file_key']) {
                            $this->logger->info(sprintf('File key converted: %s -> %s', $file['file_key'], $newFileKey));
                            $file->file_key = $newFileKey;
                        }

                        $parentId = 0; // 初始化 parentId

                        if ($file['storage_type'] == StorageType::WORKSPACE && $file['is_directory'] == 0) {
                            $parentId = $this->getFileParentIdWithCache($file, $updatedProject, $directoryPathCache, $cacheHitCount);
                            if ($parentId > 0) {
                                $file->parent_id = $parentId;
                            }
                        }

                        $file->updated_at = date('Y-m-d H:i:s');
                        $file->save();

                        $this->logger->info(sprintf('Updated file ID: %d with parent_id: %d', $file->file_id, $parentId));

                        ++$processedCount;

                        if ($processedCount % 50 === 0) {
                            $this->line(sprintf('  📈 Processed %d files... (Cache hits: %d)', $processedCount, $cacheHitCount));
                        }
                    } catch (Throwable $e) {
                        ++$errorCount;
                        $this->warn(sprintf('  ⚠️  Failed to process file ID: %d, Error: %s', $file->file_id, $e->getMessage()));
                        $this->logger->error(sprintf('Failed to process file ID: %d, Error: %s', $file->file_id, $e->getMessage()), [
                            'file_id' => $file->file_id,
                            'file_key' => $file->file_key,
                            'project_id' => $updatedProject->getId(),
                            'exception' => $e,
                        ]);
                    }
                }
            });

        $this->line(sprintf(
            '✅ Project %d completed. Processed: %d files, Errors: %d, Cache hits: %d (%.1f%%)',
            $updatedProject->getId(),
            $processedCount,
            $errorCount,
            $cacheHitCount,
            $processedCount > 0 ? ($cacheHitCount / $processedCount * 100) : 0
        ));
        $this->logger->info(sprintf(
            'Project %d completed. Processed: %d files, Errors: %d, Cache hits: %d',
            $updatedProject->getId(),
            $processedCount,
            $errorCount,
            $cacheHitCount
        ));

        // Update and return result
        $projectResult['processed_files'] = $processedCount;
        $projectResult['errors'] = $errorCount;
        $projectResult['cache_hits'] = $cacheHitCount;
        $projectResult['end_time'] = date('Y-m-d H:i:s');

        if ($errorCount > 0) {
            $projectResult['status'] = 'success_with_errors';
            $projectResult['message'] = sprintf('Completed with %d errors', $errorCount);
        } else {
            $projectResult['message'] = sprintf('Successfully processed %d files', $processedCount);
        }

        return $projectResult;
    }

    /**
     * 获取文件的 parent_id，优先使用缓存，缓存未命中时调用领域服务
     *
     * @param mixed $file 文件模型
     * @param ProjectEntity $project 项目实体
     * @param array $directoryPathCache 目录路径缓存 [dirPath => parentId]
     * @param int $cacheHitCount 缓存命中计数（引用传递）
     * @return int parent_id
     */
    private function getFileParentIdWithCache($file, ProjectEntity $project, array &$directoryPathCache, int &$cacheHitCount): int
    {
        $this->logger->info(sprintf('Processing file ID: %d, File Key: %s', $file->file_id, $file->file_key));

        // 提取文件的目录路径（去掉文件名）
        $directoryPath = dirname($file->file_key);

        // 规范化路径，避免 "." 和空路径的问题
        if ($directoryPath === '.' || $directoryPath === '' || $directoryPath === '/') {
            $directoryPath = '/'; // 根目录统一用 '/'
        }

        // 创建缓存键：项目ID + 目录路径
        $cacheKey = $project->getId() . ':' . $directoryPath;

        // 优先检查缓存
        if (isset($directoryPathCache[$cacheKey])) {
            $parentId = $directoryPathCache[$cacheKey];
            ++$cacheHitCount;

            $this->logger->info(sprintf(
                'Cache hit for directory "%s" -> parent_id: %d (file: %d)',
                $directoryPath,
                $parentId,
                $file->file_id
            ));

            return $parentId;
        }

        // 缓存未命中，调用领域服务获取 parent_id
        $this->logger->info(sprintf(
            'Cache miss for directory "%s", calling domain service (file: %d)',
            $directoryPath,
            $file->file_id
        ));

        $parentId = $this->taskFileDomainService->findOrCreateDirectoryAndGetParentId(
            projectId: $project->getId(),
            userId: $file->user_id,
            organizationCode: $file->organization_code,
            projectOrganizationCode: $project->getUserOrganizationCode(),
            fullFileKey: $file->file_key,
            workDir: $project->getWorkDir(),
        );

        // 将结果存入缓存
        if ($parentId > 0) {
            $directoryPathCache[$cacheKey] = $parentId;
            $this->logger->info(sprintf(
                'Cached directory "%s" -> parent_id: %d (file: %d)',
                $directoryPath,
                $parentId,
                $file->file_id
            ));
        }

        return $parentId;
    }

    /**
     * 规范化路径，移除多余的斜杠.
     *
     * @param string $path 原始路径
     * @param bool $isDirectory 是否为目录（目录需要保留末尾斜杠）
     * @return string 规范化后的路径
     */
    private function normalizePath(string $path, bool $isDirectory = false): string
    {
        // 移除多个连续的斜杠，但保留路径开头的斜杠
        $normalized = preg_replace('#/+#', '/', $path);

        // 对于目录，保留末尾的斜杠；对于文件，移除末尾的斜杠（除非是根目录）
        if (! $isDirectory && strlen($normalized) > 1) {
            $normalized = rtrim($normalized, '/');
        } elseif ($isDirectory && ! str_ends_with($normalized, '/') && $normalized !== '/') {
            // 确保目录以斜杠结尾
            $normalized .= '/';
        }

        return $normalized;
    }

    /**
     * 转换 work_dir 路径格式（简化版）
     * 将 /SUPER_MAGIC/usi_xxx/project_xxx/workspace 转换为 /project_xxx/workspace.
     *
     * @param string $workDir 原始 work_dir 路径
     * @param string $oldPrefix 旧前缀，如：SUPER_MAGIC/usi_xxx
     * @return string 转换后的路径
     */
    private function convertWorkDir(string $workDir, string $oldPrefix): string
    {
        // 标准化路径，确保以 / 开头
        $workDir = '/' . ltrim($workDir, '/');
        $searchPrefix = '/' . trim($oldPrefix, '/') . '/';

        // 检查是否包含旧前缀
        if (strpos($workDir, $searchPrefix) !== false) {
            // 移除旧前缀部分
            $convertedPath = str_replace($searchPrefix, '/', $workDir);

            // 🔄 将 topic_ 开头的路径替换为 project_
            $convertedPath = preg_replace('#/topic_(\d+)#', '/project_$1', $convertedPath);

            // 检查是否需要补充 workspace
            if (! str_ends_with($convertedPath, '/workspace')) {
                $convertedPath = rtrim($convertedPath, '/') . '/workspace';
            }

            return $convertedPath;
        }

        // 不匹配转换模式，检查是否需要补充 workspace
        if (! str_ends_with($workDir, '/workspace')) {
            $workDir = rtrim($workDir, '/') . '/workspace';
        }

        return $workDir;
    }

    /**
     * 将执行结果写入文件.
     *
     * @param array $resultLog 执行结果日志
     * @param string $status 执行状态
     */
    private function writeResultsToFile(array $resultLog, string $status): void
    {
        try {
            $timestamp = date('Y-m-d_H-i-s');
            $filename = "backfill_results_{$timestamp}.json";
            $filepath = BASE_PATH . "/storage/logs/{$filename}";

            // Ensure logs directory exists
            $logDir = dirname($filepath);
            if (! is_dir($logDir)) {
                mkdir($logDir, 0755, true);
            }

            // Prepare summary
            $summary = [
                'status' => $status,
                'execution_time' => $resultLog['start_time'] . ' - ' . ($resultLog['end_time'] ?? 'In Progress'),
                'summary' => [
                    'total_projects' => count($resultLog['success_projects']) + count($resultLog['failed_projects']) + count($resultLog['skipped_projects']),
                    'successful_projects' => count($resultLog['success_projects']),
                    'failed_projects' => count($resultLog['failed_projects']),
                    'skipped_projects' => count($resultLog['skipped_projects']),
                    'total_processed_files' => $resultLog['total_processed_files'],
                    'total_errors' => $resultLog['total_errors'],
                ],
                'details' => $resultLog,
            ];

            // Write to file
            file_put_contents($filepath, json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            $this->line(sprintf('📝 Results written to: %s', $filepath));
            $this->logger->info(sprintf('Results written to file: %s', $filepath));
        } catch (Throwable $e) {
            $this->warn(sprintf('⚠️  Failed to write results to file: %s', $e->getMessage()));
            $this->logger->warning(sprintf('Failed to write results to file: %s', $e->getMessage()));
        }
    }

    /**
     * 更新项目、文件表、话题表、任务表的 work_dir.
     *
     * @param ProjectEntity $project 项目实体
     * @return null|ProjectEntity 更新后的项目实体，失败时返回 null
     */
    private function updateWorkDirectories(ProjectEntity $project): ?ProjectEntity
    {
        $this->line(sprintf('🔄 Updating work_dir for project %d...', $project->getId()));
        $this->logger->info(sprintf('Starting work_dir update for project %d', $project->getId()));

        try {
            $originalWorkDir = $project->getWorkDir();
            $oldWorkDirPrefix = 'SUPER_MAGIC/' . $project->getUserId();
            $convertedWorkDir = $this->convertWorkDir($originalWorkDir, $oldWorkDirPrefix);

            // 记录转换结果
            if ($originalWorkDir !== $convertedWorkDir) {
                $this->line(sprintf('  📝 work_dir converted: %s -> %s', $originalWorkDir, $convertedWorkDir));
                $this->logger->info(sprintf('work_dir converted: %s -> %s', $originalWorkDir, $convertedWorkDir));

                // 1. 更新项目表的 work_dir
                $this->projectRepository->updateProjectByCondition(
                    ['id' => $project->getId()],
                    ['work_dir' => $convertedWorkDir, 'updated_at' => date('Y-m-d H:i:s')]
                );

                // 2. 更新话题表的 work_dir
                $this->topicRepository->updateTopicByCondition(
                    ['project_id' => $project->getId()],
                    ['work_dir' => $convertedWorkDir, 'updated_at' => date('Y-m-d H:i:s')]
                );

                // 3. 更新任务表的 work_dir
                TaskModel::query()
                    ->where('project_id', $project->getId())
                    ->update([
                        'work_dir' => $convertedWorkDir,
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);

                $this->line(sprintf('  ✅ Updated work_dir in project, topics, and tasks tables'));
                $this->logger->info(sprintf('Updated work_dir for project %d and its topics and tasks', $project->getId()));

                // 创建更新后的项目实体
                $updatedProject = clone $project;
                $updatedProject->setWorkDir($convertedWorkDir);
                return $updatedProject;
            }
            $this->line(sprintf('  ✅ work_dir already in correct format: %s', $originalWorkDir));
            $this->logger->info(sprintf('work_dir already in correct format for project %d: %s', $project->getId(), $originalWorkDir));
            return $project; // 无需更新，返回原项目
        } catch (Throwable $e) {
            $this->warn(sprintf('  ⚠️  Failed to update work_dir for project %d: %s', $project->getId(), $e->getMessage()));
            $this->logger->error(sprintf('Failed to update work_dir for project %d: %s', $project->getId(), $e->getMessage()), [
                'project_id' => $project->getId(),
                'exception' => $e,
            ]);
            return null; // 更新失败，返回 null
        }
    }
}
