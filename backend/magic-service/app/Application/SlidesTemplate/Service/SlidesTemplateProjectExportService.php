<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SlidesTemplate\Service;

use App\Application\SlidesTemplate\DTO\SlidesTemplateProjectExportResult;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\Request\ExportWorkspaceRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\WorkspaceExporterInterface;
use App\Infrastructure\SuperMagic\Utils\RelativeFilePathUtil;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

final class SlidesTemplateProjectExportService extends AbstractAppService
{
    private const string EXPORT_DIRECTORY_PREFIX = 'slide-templates';

    private const string EXPORT_TYPE = 'slides_template_creator';

    private const string EXPORT_PROMPT = 'Slides Template Export Task';

    private LoggerInterface $logger;

    /**
     * 初始化幻灯片模板项目导出服务及其依赖。
     */
    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly CloudFileRepositoryInterface $cloudFileRepository,
        private readonly AgentDomainService $agentDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly WorkspaceExporterInterface $workspaceExporter,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('slides-template');
    }

    /**
     * 将项目工作区中的指定目录导出为幻灯片模板资源。
     *
     * 流程包括：校验项目和目录权限、解析工作区相对路径、准备 Sandbox
     * 导出目标、申请对象存储临时凭证、调用 WorkspaceExporter 导出，最后
     * 将导出结果转换为模板保存所需的 payload。任一步骤失败都会清理本次
     * 导出目录并重新抛出原始异常。
     *
     * @return array<string, mixed> 导出的模板文件、预览图及项目关联信息
     */
    public function publishFromProjectWorkspace(
        MagicUserAuthorization $authorization,
        SlidesTemplateDataIsolation $dataIsolation,
        int $projectId,
        int $directoryId,
        ?string $requestedCode,
        string $exportId,
    ): array {
        $startedAt = microtime(true);
        $sandboxId = null;
        $response = null;
        $code = trim((string) $requestedCode);
        try {
            // 先记录请求上下文，便于定位项目、目录、用户和组织维度的导出问题。
            $this->logger->info('Slides template project export started', [
                'project_id' => $projectId,
                'directory_id' => $directoryId,
                'requested_code' => $code,
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation->getCurrentUserId(),
            ]);

            // 项目和目录必须先完成权限及类型校验，避免导出其他项目或非工作区目录。
            $project = $this->getAccessibleProject($projectId, $authorization->getId(), $authorization->getOrganizationCode());
            $directory = $this->assertTemplateDirectory($projectId, $directoryId);

            // 优先使用工作区目录自身的 file_key 计算相对路径；必要时再通过父目录链回退解析。
            $sourcePath = $this->resolveSourcePath($project, $directory);
            if ($code === '') {
                $code = basename($sourcePath);
                if ($code === '') {
                    ExceptionBuilder::throw(
                        SlidesTemplateErrorCode::VALIDATE_FAILED,
                        'slides_template.project_template_code_required',
                    );
                }
            }

            // Sandbox 模式下确保目标 Sandbox 已初始化；关闭 Sandbox 时返回空 ID，交给本地服务处理。
            $sandboxId = $this->resolveExportTarget($dataIsolation, $project);
            $this->logger->info('Slides template export target resolved', [
                'project_id' => $projectId,
                'directory_id' => $directoryId,
                'code' => $code,
                'sandbox_id' => $sandboxId,
                'mode' => config('super-magic.sandbox.enabled', true) ? 'sandbox' : 'local-direct',
            ]);

            // 私有桶存放模板压缩包，公共桶存放预览资源，两者使用同一导出目录隔离本次任务。
            $exportDirectory = $this->buildExportDirectory($code, $exportId);
            $privateConfig = $this->cloudFileRepository->getStsTemporaryCredential(
                $dataIsolation->getCurrentOrganizationCode(),
                StorageBucketType::Private,
                $exportDirectory,
                options: ['internal_endpoint' => true]
            );
            $publicConfig = $this->cloudFileRepository->getStsTemporaryCredential(
                $dataIsolation->getCurrentOrganizationCode(),
                StorageBucketType::Public,
                $exportDirectory,
                options: ['internal_endpoint' => true]
            );
            $directoryName = $this->sanitizeFileName($directory->getFileName(), $code);
            $request = new ExportWorkspaceRequest(
                self::EXPORT_TYPE,
                $code,
                $privateConfig,
                $sourcePath,
                $directoryName,
                $directoryName . '.zip',
                $publicConfig,
            );
            // ExportWorkspaceRequest 只描述导出输入输出，实际文件打包由 Sandbox/本地导出器完成。
            $response = $this->workspaceExporter->export(
                $this->createContactDataIsolationByUser($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId()),
                $sandboxId,
                $request,
            );
            if (! $response->isSuccess()) {
                // 外部导出器可能返回业务失败但不抛异常，这里统一转换为模板导出错误码。
                $this->logger->error('Slides template Sandbox export returned failure', [
                    'project_id' => $projectId,
                    'directory_id' => $directoryId,
                    'sandbox_id' => $sandboxId,
                    'code' => $code,
                    'message' => $response->getMessage(),
                ]);
                $this->throwSandboxFailure($response->getMessage());
            }

            // 将导出器返回的文件 key 和元数据转换成模板发布接口统一的结果结构。
            $result = SlidesTemplateProjectExportResult::fromSandbox(
                $code,
                $response->getFileKey(),
                $response->getMetadata(),
                $projectId,
                $directoryId,
            );
            $payload = $result->toArray();
            $this->logger->info('Slides template project export completed', [
                'project_id' => $projectId,
                'directory_id' => $directoryId,
                'sandbox_id' => $sandboxId,
                'code' => $code,
                'template_file_key' => $payload['template_file_key'],
                'preview_image_count' => count($payload['preview_image_file_keys']),
                'duration_ms' => (int) ((microtime(true) - $startedAt) * 1000),
            ]);
            return $payload;
        } catch (Throwable $throwable) {
            if ($code !== '') {
                // 导出中途失败时删除本次临时目录，避免残留文件影响后续重试。
                $this->cleanupExportDirectory($dataIsolation, $code, $exportId);
            }
            $this->logger->error('Slides template project export failed', [
                'project_id' => $projectId,
                'directory_id' => $directoryId,
                'sandbox_id' => $sandboxId,
                'requested_code' => $code,
                'duration_ms' => (int) ((microtime(true) - $startedAt) * 1000),
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            if ($throwable instanceof SandboxOperationException) {
                $this->throwSandboxFailure($throwable->getMessage(), $throwable);
            }
            throw $throwable;
        }
    }

    /**
     * 清理导出结果中记录的临时文件。
     *
     * @param array<string, mixed> $payload 导出任务返回的 payload
     */
    public function cleanupExportedFiles(SlidesTemplateDataIsolation $dataIsolation, array $payload, string $exportId): void
    {
        $code = trim((string) ($payload['code'] ?? ''));
        if ($code === '') {
            // 没有模板 code 时无法定位对象存储目录，直接跳过清理。
            $this->logger->warning('Slides template export cleanup skipped', [
                'export_id' => $exportId,
                'message' => 'Template code is empty.',
            ]);
            return;
        }

        $this->cleanupExportDirectory($dataIsolation, $code, $exportId);
    }

    /**
     * 清理模板更新前一版本导出产生的目录。
     *
     * 当前导出 ID 与旧文件 key 中的导出 ID 相同时不重复清理。
     */
    public function cleanupPreviousTemplateDirectory(
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateEntity $template,
        string $currentExportId,
    ): void {
        $code = $template->getCode();
        $previousExportId = $this->resolveExportId($template->getTemplateFileKey(), $code);
        if ($previousExportId === null || $previousExportId === $currentExportId) {
            // 旧文件不存在或仍属于当前导出任务，无需执行删除。
            return;
        }

        $this->cleanupExportDirectory($dataIsolation, $code, $previousExportId);
    }

    /**
     * 校验目录属于当前项目、确实是目录且存储类型为工作区。
     */
    private function assertTemplateDirectory(int $projectId, int $directoryId): TaskFileEntity
    {
        $directory = $this->taskFileDomainService->getFileEntityById($directoryId);
        if ($directory->getProjectId() !== $projectId || ! $directory->getIsDirectory() || $directory->getStorageType() !== StorageType::WORKSPACE) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::PROJECT_TEMPLATE_DIRECTORY_INVALID);
        }
        return $directory;
    }

    /**
     * 解析导出目录在项目工作区中的相对路径。
     *
     * 优先根据 project.work_dir 直接裁剪路径；当 file_key 不在该目录下时，
     * 通过文件父子关系重新构造路径，兼容历史数据或根目录信息不完整的情况。
     */
    private function resolveSourcePath(ProjectEntity $project, TaskFileEntity $directory): string
    {
        $fileKey = trim(str_replace('\\', '/', $directory->getFileKey()), '/');
        $workDir = trim(str_replace('\\', '/', $project->getWorkDir()), '/');
        if ($workDir !== '' && ($fileKey === $workDir || str_starts_with($fileKey, $workDir . '/'))) {
            // 工作区路径匹配时无需查询父目录，直接得到 Sandbox 可识别的相对路径。
            $path = trim(WorkDirectoryUtil::getRelativeFilePath($fileKey, $workDir), '/');
            if ($path !== '') {
                return $path;
            }
        }

        // 回退方案需要补齐父目录链，避免仅凭当前 file_key 无法定位项目内路径。
        $allFiles = $this->taskFileDomainService->getFilesWithParentsByIds([$directory->getFileId()], $project->getId());
        $fileMap = RelativeFilePathUtil::indexByFileId($allFiles);
        $path = trim(str_replace('\\', '/', RelativeFilePathUtil::buildPathByParentChain($directory, $fileMap)), '/');
        if ($path === '') {
            ExceptionBuilder::throw(
                SlidesTemplateErrorCode::PROJECT_TEMPLATE_DIRECTORY_INVALID,
                'slides_template.project_template_source_path_invalid',
            );
        }

        return $path;
    }

    /**
     * 确定本次导出的 Sandbox 目标并完成其初始化。
     *
     * Sandbox 开关关闭时返回空字符串；开启时使用项目当前话题的 Sandbox，
     * 通过 AgentDomainService 确保初始化完成，并同步话题和任务状态。
     */
    private function resolveExportTarget(SlidesTemplateDataIsolation $dataIsolation, ProjectEntity $project): string
    {
        if (! config('super-magic.sandbox.enabled', true)) {
            $this->logger->info('Slides template export using local Super Magic service', [
                'project_id' => $project->getId(),
            ]);
            return '';
        }

        $topicId = $project->getCurrentTopicId();
        if (empty($topicId)) {
            // 没有当前话题就没有可绑定的 Sandbox，无法继续导出。
            ExceptionBuilder::throw(
                SlidesTemplateErrorCode::VALIDATE_FAILED,
                'slides_template.project_template_topic_required',
            );
        }
        $topic = $this->topicDomainService->getTopicById($topicId);
        if ($topic === null || $topic->getProjectId() !== $project->getId()) {
            // 防止项目引用了不存在或属于其他项目的话题。
            ExceptionBuilder::throw(
                SlidesTemplateErrorCode::VALIDATE_FAILED,
                'slides_template.project_template_topic_invalid',
            );
        }
        $sandboxId = (string) $topic->getSandboxId();
        if ($sandboxId === (string) $topic->getId()) {
            // 话题 ID 只是历史占位值，不是实际 Sandbox ID，需要按未初始化处理。
            $sandboxId = '';
        }

        $topic->setSandboxId($sandboxId);
        $contactIsolation = $this->createContactDataIsolationByBase($dataIsolation);
        // 初始化任务和 Agent 上下文，确保 Sandbox 拥有导出所需的工作区文件。
        $task = $this->taskDomainService->initDefaultTask($contactIsolation, $topic, self::EXPORT_PROMPT);
        $context = $this->agentDomainService->buildInitAgentContext($contactIsolation, $project, $topic, $task, $sandboxId, true);
        $sandboxId = $this->agentDomainService->ensureSandboxInitialized($contactIsolation, $context);

        // 初始化完成后将最终 Sandbox ID 回写到话题和任务，供后续导出请求使用。
        $this->topicDomainService->updateTopicStatusAndSandboxId($topic->getId(), $task->getId(), TaskStatus::FINISHED, $sandboxId);
        $this->taskDomainService->updateTaskStatus(TaskStatus::FINISHED, $task->getId(), (string) $task->getId(), $sandboxId);
        return $sandboxId;
    }

    /**
     * 将 Sandbox 错误统一转换为模板导出业务错误，同时保留原始消息和异常链。
     */
    private function throwSandboxFailure(string $message, ?Throwable $throwable = null): never
    {
        ExceptionBuilder::throw(
            SlidesTemplateErrorCode::PROJECT_TEMPLATE_EXPORT_FAILED,
            trim($message),
            throwable: $throwable,
        );
    }

    /**
     * 清理目录名称，阻止路径穿越或多级路径输入；非法名称使用模板 code 兜底。
     */
    private function sanitizeFileName(string $fileName, string $fallback): string
    {
        $fileName = trim($fileName, '/');
        if ($fileName === '' || $fileName === '.' || $fileName === '..' || str_contains($fileName, '/')) {
            return $fallback;
        }
        return $fileName;
    }

    /**
     * 清理指定模板 code 和导出 ID 对应的私有桶、公共桶目录。
     */
    private function cleanupExportDirectory(
        SlidesTemplateDataIsolation $dataIsolation,
        string $code,
        string $exportId,
    ): void {
        try {
            $directory = $this->buildExportDirectory($code, $exportId);
        } catch (Throwable $throwable) {
            $this->logger->warning('Slides template export directory cleanup skipped', [
                'code' => $code,
                'export_id' => $exportId,
                'message' => $throwable->getMessage(),
            ]);
            return;
        }

        // 两个桶分别保存压缩包和预览资源，必须一起清理才能避免临时文件残留。
        foreach ([StorageBucketType::Private, StorageBucketType::Public] as $bucket) {
            $this->cleanupBucketDirectory($dataIsolation, $directory, $bucket);
        }
    }

    /**
     * 分页读取并批量删除单个对象存储桶中的导出文件。
     *
     * 清理属于最佳努力操作：单个桶清理失败只记录日志，不覆盖原始导出异常。
     */
    private function cleanupBucketDirectory(
        SlidesTemplateDataIsolation $dataIsolation,
        string $directory,
        StorageBucketType $bucket,
    ): void {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $marker = null;
        try {
            $objectKeys = [];
            do {
                // 对象存储列表接口按 marker 分页，每页最多收集 1000 个对象。
                $options = ['max-keys' => 1000];
                if ($marker !== null) {
                    $options['marker'] = $marker;
                }
                $result = $this->cloudFileRepository->listObjectsByCredential(
                    $organizationCode,
                    $directory,
                    $bucket,
                    $options,
                );
                $objectKeys = array_merge($objectKeys, array_values(array_filter(array_map(
                    static fn (array $object): string => (string) ($object['key'] ?? ''),
                    $result['objects'] ?? [],
                ))));
                $marker = ($result['next_marker'] ?? null) ?: null;
            } while ($marker !== null);

            $objectKeys = array_values(array_unique($objectKeys));
            $deletedCount = 0;
            $errorCount = 0;
            foreach (array_chunk($objectKeys, 1000) as $objectKeyBatch) {
                // 删除接口同样按 1000 个 key 分批，避免单次请求过大。
                $deleteResult = $this->cloudFileRepository->deleteObjectsByCredential(
                    $directory,
                    $organizationCode,
                    $objectKeyBatch,
                    $bucket,
                    ['internal_endpoint' => true],
                );
                $batchErrors = $deleteResult['errors'] ?? [];
                $deletedCount += count($deleteResult['deleted'] ?? []);
                $errorCount += count($batchErrors);
                if ($batchErrors !== []) {
                    $this->logger->warning('Slides template export directory cleanup partially failed', [
                        'directory' => $directory,
                        'bucket' => $bucket->value,
                        'deleted_count' => count($deleteResult['deleted'] ?? []),
                        'error_count' => count($batchErrors),
                    ]);
                }
            }

            $this->logger->info('Slides template export directory cleaned', [
                'directory' => $directory,
                'bucket' => $bucket->value,
                'scanned_count' => count($objectKeys),
                'deleted_count' => $deletedCount,
                'error_count' => $errorCount,
            ]);
        } catch (Throwable $throwable) {
            $this->logger->warning('Slides template export directory cleanup failed', [
                'directory' => $directory,
                'bucket' => $bucket->value,
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
        }
    }

    /**
     * 构造本次导出的对象存储目录，并校验 code 与 export ID 的格式。
     */
    private function buildExportDirectory(string $code, string $exportId): string
    {
        $code = trim($code);
        if ($code === '' || str_contains($code, '/') || str_contains($code, '\\')) {
            ExceptionBuilder::throw(
                SlidesTemplateErrorCode::VALIDATE_FAILED,
                'slides_template.project_template_export_directory_invalid',
            );
        }
        if (preg_match('/^[a-f0-9]{24}$/', $exportId) !== 1) {
            ExceptionBuilder::throw(
                SlidesTemplateErrorCode::VALIDATE_FAILED,
                'slides_template.project_template_export_id_invalid',
            );
        }
        return self::EXPORT_DIRECTORY_PREFIX . '/' . $code . '/' . $exportId;
    }

    /**
     * 从模板文件 key 中提取历史导出 ID，用于更新模板时清理旧目录。
     */
    private function resolveExportId(string $fileKey, string $code): ?string
    {
        $pattern = '#(?:^|/)' . preg_quote(self::EXPORT_DIRECTORY_PREFIX, '#')
            . '/' . preg_quote($code, '#') . '/([a-f0-9]{24})(?:/|$)#';
        return preg_match($pattern, $fileKey, $matches) === 1 ? $matches[1] : null;
    }
}
