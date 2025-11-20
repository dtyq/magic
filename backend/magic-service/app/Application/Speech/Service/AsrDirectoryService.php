<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Speech\Assembler\AsrAssembler;
use App\Application\Speech\DTO\AsrRecordingDirectoryDTO;
use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\Enum\AsrDirectoryTypeEnum;
use App\Domain\Asr\Constants\AsrPaths;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Contract\TranslatorInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * ASR 目录管理服务
 * 负责目录创建、查询、重命名和路径转换.
 */
readonly class AsrDirectoryService
{
    public function __construct(
        private ProjectDomainService $projectDomainService,
        private TaskFileDomainService $taskFileDomainService,
        private TranslatorInterface $translator,
        private LoggerInterface $logger
    ) {
    }

    /**
     * 创建隐藏的临时录音目录（用于存放分片文件）.
     * 目录格式：.asr_recordings/{task_key}.
     *
     * @param string $organizationCode 组织编码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $taskKey 任务键
     * @return AsrRecordingDirectoryDTO 目录DTO
     */
    public function createHiddenDirectory(
        string $organizationCode,
        string $projectId,
        string $userId,
        string $taskKey
    ): AsrRecordingDirectoryDTO {
        $relativePath = AsrPaths::getHiddenDirPath($taskKey);

        return $this->createDirectoryInternal(
            organizationCode: $organizationCode,
            projectId: $projectId,
            userId: $userId,
            relativePath: $relativePath,
            directoryType: AsrDirectoryTypeEnum::ASR_HIDDEN_DIR,
            isHidden: true,
            taskKey: $taskKey,
            errorContext: ['project_id' => $projectId, 'task_key' => $taskKey],
            logMessage: '创建隐藏录音目录失败',
            failedProjectError: AsrErrorCode::CreateHiddenDirectoryFailedProject,
            failedError: AsrErrorCode::CreateHiddenDirectoryFailedError
        );
    }

    /**
     * 创建 .asr_states 隐藏目录（用于存放前端录音的状态信息）.
     * 目录格式：.asr_states.
     *
     * @param string $organizationCode 组织编码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return AsrRecordingDirectoryDTO 目录DTO
     */
    public function createStatesDirectory(
        string $organizationCode,
        string $projectId,
        string $userId
    ): AsrRecordingDirectoryDTO {
        $relativePath = AsrPaths::getStatesDirPath();

        return $this->createDirectoryInternal(
            organizationCode: $organizationCode,
            projectId: $projectId,
            userId: $userId,
            relativePath: $relativePath,
            directoryType: AsrDirectoryTypeEnum::ASR_STATES_DIR,
            isHidden: true,
            taskKey: null,
            errorContext: ['project_id' => $projectId],
            logMessage: '创建 .asr_states 目录失败',
            failedProjectError: AsrErrorCode::CreateStatesDirectoryFailedProject,
            failedError: AsrErrorCode::CreateStatesDirectoryFailedError
        );
    }

    /**
     * 创建显示的录音纪要目录（用于存放流式文本和笔记）.
     * 目录格式：录音纪要_Ymd_His（国际化）.
     *
     * @param string $organizationCode 组织编码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return AsrRecordingDirectoryDTO 目录DTO
     */
    public function createDisplayDirectory(
        string $organizationCode,
        string $projectId,
        string $userId
    ): AsrRecordingDirectoryDTO {
        $relativePath = $this->generateDirectoryName();

        return $this->createDirectoryInternal(
            organizationCode: $organizationCode,
            projectId: $projectId,
            userId: $userId,
            relativePath: $relativePath,
            directoryType: AsrDirectoryTypeEnum::ASR_DISPLAY_DIR,
            isHidden: false,
            taskKey: null,
            errorContext: ['project_id' => $projectId],
            logMessage: '创建显示录音目录失败',
            failedProjectError: AsrErrorCode::CreateDisplayDirectoryFailedProject,
            failedError: AsrErrorCode::CreateDisplayDirectoryFailedError
        );
    }

    /**
     * 生成新的显示目录名（基于智能标题）.
     * 此方法只负责生成新的相对路径，不执行实际的重命名操作。
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $intelligentTitle 智能生成的标题
     * @param AsrTitleGeneratorService $titleGenerator 标题生成器（用于清洗标题）
     * @return string 新的相对路径（如果无需重命名则返回原路径）
     */
    public function getNewDisplayDirectory(
        mixed $taskStatus,
        string $intelligentTitle,
        AsrTitleGeneratorService $titleGenerator
    ): string {
        // 1. 获取原显示目录信息
        $relativeOldPath = $taskStatus->displayDirectory;

        if (empty($relativeOldPath)) {
            $this->logger->warning('显示目录路径为空，跳过生成新路径', [
                'task_key' => $taskStatus->taskKey,
            ]);
            return $relativeOldPath;
        }

        // 2. 提取时间戳
        $oldDirectoryName = basename($relativeOldPath);
        $timestamp = $this->extractTimestamp($oldDirectoryName, $taskStatus->taskKey);

        // 3. 清洗并构建新目录名
        $safeTitle = $titleGenerator->sanitizeTitle($intelligentTitle);
        if (empty($safeTitle)) {
            $this->logger->warning('智能标题为空，跳过生成新路径', [
                'task_key' => $taskStatus->taskKey,
                'intelligent_title' => $intelligentTitle,
            ]);
            return $relativeOldPath;
        }

        $newDirectoryName = $safeTitle . $timestamp;

        // 新的工作区相对路径 (如: 被讨厌的勇气笔记_20251027_230949)
        $newRelativePath = $newDirectoryName;

        // 如果新旧路径相同，无需重命名
        if ($newRelativePath === $relativeOldPath) {
            $this->logger->info('新旧目录路径相同，无需重命名', [
                'task_key' => $taskStatus->taskKey,
                'directory_path' => $newRelativePath,
            ]);
            return $relativeOldPath;
        }

        $this->logger->info('生成新的显示目录路径', [
            'task_key' => $taskStatus->taskKey,
            'old_relative_path' => $relativeOldPath,
            'new_relative_path' => $newRelativePath,
            'intelligent_title' => $intelligentTitle,
        ]);

        return $newRelativePath;
    }

    /**
     * 获取项目的 workspace 路径.
     *
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return string workspace 路径
     */
    public function getWorkspacePath(string $projectId, string $userId): string
    {
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        return rtrim($projectEntity->getWorkDir(), '/') . '/';
    }

    /**
     * 生成 ASR 目录名.
     *
     * @return string 目录名
     */
    private function generateDirectoryName(): string
    {
        $base = $this->translator->trans('asr.directory.recordings_summary_folder');
        return sprintf('%s_%s', $base, date('Ymd_His'));
    }

    /**
     * 从目录名提取时间戳.
     *
     * @param string $directoryName 目录名
     * @param string $taskKey 任务键（用于日志）
     * @return string 时间戳（格式：_20251026_210626）
     */
    private function extractTimestamp(string $directoryName, string $taskKey): string
    {
        if (preg_match('/_(\d{8}_\d{6})$/', $directoryName, $matches)) {
            return '_' . $matches[1];
        }

        // 如果没有匹配到时间戳，使用当前时间
        $this->logger->info('未找到原时间戳，使用当前时间', [
            'task_key' => $taskKey,
            'old_directory_name' => $directoryName,
        ]);
        return '_' . date('Ymd_His');
    }

    /**
     * 创建目录的内部实现（提取公共逻辑）.
     *
     * @param string $organizationCode 组织编码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $relativePath 相对路径
     * @param AsrDirectoryTypeEnum $directoryType 目录类型
     * @param bool $isHidden 是否隐藏
     * @param null|string $taskKey 任务键
     * @param array $errorContext 错误日志上下文
     * @param string $logMessage 错误日志消息
     * @param AsrErrorCode $failedProjectError 项目失败错误码
     * @param AsrErrorCode $failedError 通用失败错误码
     * @return AsrRecordingDirectoryDTO 目录DTO
     */
    private function createDirectoryInternal(
        string $organizationCode,
        string $projectId,
        string $userId,
        string $relativePath,
        AsrDirectoryTypeEnum $directoryType,
        bool $isHidden,
        ?string $taskKey,
        array $errorContext,
        string $logMessage,
        AsrErrorCode $failedProjectError,
        AsrErrorCode $failedError
    ): AsrRecordingDirectoryDTO {
        try {
            // 1. 确保项目工作区根目录存在
            $rootDirectoryId = $this->ensureWorkspaceRootDirectoryExists($organizationCode, $projectId, $userId);

            // 2. 获取项目信息
            $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
            $workDir = $projectEntity->getWorkDir();
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);

            // 3. 检查目录是否已存在
            $fileKey = AsrAssembler::buildFileKey($fullPrefix, $workDir, $relativePath);
            $fileKey = rtrim($fileKey, '/') . '/';
            $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $fileKey);
            if ($existingDir !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $existingDir->getFileId(),
                    $isHidden,
                    $directoryType
                );
            }

            // 4. 创建目录实体
            $taskFileEntity = AsrAssembler::createDirectoryEntity(
                $userId,
                $organizationCode,
                (int) $projectId,
                $relativePath,
                $fullPrefix,
                $workDir,
                $rootDirectoryId,
                isHidden: $isHidden,
                taskKey: $taskKey
            );

            // 5. 插入或忽略
            $result = $this->taskFileDomainService->insertOrIgnore($taskFileEntity);
            if ($result !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $result->getFileId(),
                    $isHidden,
                    $directoryType
                );
            }

            // 6. 如果插入被忽略，查询现有目录
            $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $fileKey);
            if ($existingDir !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $existingDir->getFileId(),
                    $isHidden,
                    $directoryType
                );
            }

            ExceptionBuilder::throw($failedProjectError, '', ['projectId' => $projectId]);
        } catch (Throwable $e) {
            $this->logger->error($logMessage, array_merge($errorContext, ['error' => $e->getMessage()]));
            ExceptionBuilder::throw($failedError, '', ['error' => $e->getMessage()]);
        }
    }

    /**
     * 确保工作区根目录存在.
     *
     * @param string $organizationCode 组织代码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return int 项目工作区根目录的 file_id
     */
    private function ensureWorkspaceRootDirectoryExists(string $organizationCode, string $projectId, string $userId): int
    {
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        $workDir = $projectEntity->getWorkDir();

        if (empty($workDir)) {
            ExceptionBuilder::throw(AsrErrorCode::WorkspaceDirectoryEmpty, '', ['projectId' => $projectId]);
        }

        return $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            (int) $projectId,
            $workDir,
            $userId,
            $organizationCode,
            $projectEntity->getUserOrganizationCode()
        );
    }
}
