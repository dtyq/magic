<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Speech\Assembler\AsrAssembler;
use App\Application\Speech\DTO\AsrSandboxMergeResultDTO;
use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Application\Speech\Enum\SandboxAsrStatusEnum;
use App\Domain\Asr\Constants\AsrConfig;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\InitializationMetadataDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Constant\WorkspaceStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\AsrRecorderInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrAudioConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrNoteFileConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrTranscriptFileConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Response\AsrRecorderResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * ASR 沙箱服务
 * 负责沙箱任务启动、合并、轮询和文件记录创建.
 */
readonly class AsrSandboxService
{
    private LoggerInterface $logger;

    public function __construct(
        private SandboxGatewayInterface $sandboxGateway,
        private AsrRecorderInterface $asrRecorder,
        private AsrSandboxResponseHandler $responseHandler,
        private ProjectDomainService $projectDomainService,
        private TaskFileDomainService $taskFileDomainService,
        private AgentDomainService $agentDomainService,
        private TopicDomainService $topicDomainService,
        private TaskDomainService $taskDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('AsrSandboxService');
    }

    /**
     * 启动录音任务.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     */
    public function startRecordingTask(
        AsrTaskStatusDTO $taskStatus,
        string $userId,
        string $organizationCode
    ): void {
        // 生成沙箱ID
        $sandboxId = WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId(
            $taskStatus->projectId . '_asr_recording',
            12
        );
        $taskStatus->sandboxId = $sandboxId;

        // 设置用户上下文
        $this->sandboxGateway->setUserContext($userId, $organizationCode);

        // 获取完整工作目录路径
        $projectEntity = $this->projectDomainService->getProject((int) $taskStatus->projectId, $userId);
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

        // 创建沙箱并等待工作区可用
        $actualSandboxId = $this->ensureSandboxWorkspaceReady(
            $taskStatus,
            $sandboxId,
            $taskStatus->projectId,
            $fullWorkdir,
            $userId,
            $organizationCode
        );

        $this->logger->info('startRecordingTask ASR 录音：沙箱已就绪', [
            'task_key' => $taskStatus->taskKey,
            'requested_sandbox_id' => $sandboxId,
            'actual_sandbox_id' => $actualSandboxId,
            'full_workdir' => $fullWorkdir,
        ]);

        // 构建文件配置对象（复用公共方法）
        $noteFileConfig = $this->buildNoteFileConfig($taskStatus);
        $transcriptFileConfig = $this->buildTranscriptFileConfig($taskStatus);

        $this->logger->info('准备调用沙箱 start 接口', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $actualSandboxId,
            'temp_hidden_directory' => $taskStatus->tempHiddenDirectory,
            'workspace' => '.workspace',
            'note_file_config' => $noteFileConfig?->toArray(),
            'transcript_file_config' => $transcriptFileConfig?->toArray(),
        ]);

        // 调用沙箱启动任务
        // 注意：沙箱 API 只接受工作区相对路径 (如: .asr_recordings/session_xxx)
        $response = $this->asrRecorder->startTask(
            $actualSandboxId,
            $taskStatus->taskKey,
            $taskStatus->tempHiddenDirectory,  // 如: .asr_recordings/session_xxx
            '.workspace',
            $noteFileConfig,
            $transcriptFileConfig
        );

        if (! $response->isSuccess()) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxTaskCreationFailed, '', ['message' => $response->message]);
        }

        $taskStatus->sandboxTaskCreated = true;

        $this->logger->info('ASR 录音：沙箱任务已创建', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $actualSandboxId,
            'status' => $response->getStatus(),
        ]);
    }

    /**
     * 取消录音任务.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @return AsrRecorderResponse 响应结果
     */
    public function cancelRecordingTask(AsrTaskStatusDTO $taskStatus): AsrRecorderResponse
    {
        $sandboxId = $taskStatus->sandboxId;

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxIdNotExist);
        }

        $this->logger->info('ASR 录音：准备取消沙箱任务', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $sandboxId,
        ]);

        // 调用沙箱取消任务
        $response = $this->asrRecorder->cancelTask(
            $sandboxId,
            $taskStatus->taskKey
        );

        if (! $response->isSuccess()) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxCancelFailed, '', ['message' => $response->message]);
        }

        $this->logger->info('ASR 录音：沙箱任务已取消', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $sandboxId,
            'status' => $response->getStatus(),
        ]);

        return $response;
    }

    /**
     * 合并音频文件.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $fileTitle 文件标题（不含扩展名）
     * @param string $organizationCode 组织编码
     * @return AsrSandboxMergeResultDTO 合并结果
     */
    public function mergeAudioFiles(
        AsrTaskStatusDTO $taskStatus,
        string $fileTitle,
        string $organizationCode
    ): AsrSandboxMergeResultDTO {
        $this->logger->info('开始沙箱音频处理流程', [
            'task_key' => $taskStatus->taskKey,
            'project_id' => $taskStatus->projectId,
            'hidden_directory' => $taskStatus->tempHiddenDirectory,
            'display_directory' => $taskStatus->displayDirectory,
            'sandbox_id' => $taskStatus->sandboxId,
        ]);

        // 准备沙箱ID
        if (empty($taskStatus->sandboxId)) {
            $sandboxId = WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId(
                $taskStatus->projectId . '_asr_recording',
                12
            );
            $taskStatus->sandboxId = $sandboxId;
        }

        // 设置用户上下文
        $this->sandboxGateway->setUserContext($taskStatus->userId, $organizationCode);

        // 获取完整工作目录路径
        $projectEntity = $this->projectDomainService->getProject((int) $taskStatus->projectId, $taskStatus->userId);
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

        $requestedSandboxId = $taskStatus->sandboxId;
        $actualSandboxId = $this->ensureSandboxWorkspaceReady(
            $taskStatus,
            $requestedSandboxId,
            $taskStatus->projectId,
            $fullWorkdir,
            $taskStatus->userId,
            $organizationCode
        );

        // 更新实际的沙箱ID（可能已经变化）
        if ($actualSandboxId !== $requestedSandboxId) {
            $this->logger->warning('沙箱ID发生变化，可能是沙箱重启', [
                'task_key' => $taskStatus->taskKey,
                'old_sandbox_id' => $requestedSandboxId,
                'new_sandbox_id' => $actualSandboxId,
            ]);
        }

        $this->logger->info('沙箱已就绪，准备调用 finish', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $actualSandboxId,
            'full_workdir' => $fullWorkdir,
        ]);

        // 调用沙箱 finish 并轮询等待完成（会通过响应处理器自动创建/更新文件记录）
        $mergeResult = $this->callSandboxFinishAndWait($taskStatus, $fileTitle);

        $this->logger->info('沙箱返回的文件信息', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_file_path' => $mergeResult->filePath,
            'audio_file_id' => $taskStatus->audioFileId,
            'note_file_id' => $taskStatus->noteFileId,
        ]);

        // 更新任务状态（文件记录已由响应处理器创建）
        $taskStatus->updateStatus(AsrTaskStatusEnum::COMPLETED);

        $this->logger->info('沙箱音频处理完成', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $taskStatus->sandboxId,
            'file_id' => $taskStatus->audioFileId,
            'file_path' => $taskStatus->filePath,
        ]);

        return $mergeResult;
    }

    /**
     * 调用沙箱 finish 并轮询等待完成.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $intelligentTitle 智能标题（用于重命名）
     * @return AsrSandboxMergeResultDTO 合并结果
     */
    private function callSandboxFinishAndWait(
        AsrTaskStatusDTO $taskStatus,
        string $intelligentTitle,
    ): AsrSandboxMergeResultDTO {
        $sandboxId = $taskStatus->sandboxId;

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxIdNotExist);
        }

        // 构建音频配置对象
        $audioConfig = new AsrAudioConfig(
            sourceDir: $taskStatus->tempHiddenDirectory,  // 如: .asr_recordings/session_xxx
            targetDir: $taskStatus->displayDirectory,     // 如: 录音总结_20251027_230949
            outputFilename: $intelligentTitle              // 如: 被讨厌的勇气
        );

        // 构建笔记文件配置对象（需要重命名）
        $noteFileConfig = $this->buildNoteFileConfig(
            $taskStatus,
            $taskStatus->displayDirectory,
            $intelligentTitle
        );

        // 构建流式识别文件配置对象
        $transcriptFileConfig = $this->buildTranscriptFileConfig($taskStatus);

        $this->logger->info('准备调用沙箱 finish', [
            'task_key' => $taskStatus->taskKey,
            'intelligent_title' => $intelligentTitle,
            'audio_config' => $audioConfig->toArray(),
            'note_file_config' => $noteFileConfig?->toArray(),
            'transcript_file_config' => $transcriptFileConfig?->toArray(),
        ]);

        // 记录开始时间
        $finishStartTime = microtime(true);

        // 首次调用 finish
        $response = $this->asrRecorder->finishTask(
            $sandboxId,
            $taskStatus->taskKey,
            '.workspace',
            $audioConfig,
            $noteFileConfig,
            $transcriptFileConfig
        );

        // 轮询等待完成（基于预设时间与休眠间隔）
        $timeoutSeconds = AsrConfig::SANDBOX_MERGE_TIMEOUT;
        $pollingInterval = AsrConfig::POLLING_INTERVAL;
        $attempt = 0;
        $lastLogTime = $finishStartTime;
        $logInterval = AsrConfig::SANDBOX_MERGE_LOG_INTERVAL;

        while (true) {
            $elapsedSeconds = (int) (microtime(true) - $finishStartTime);

            if ($elapsedSeconds >= $timeoutSeconds) {
                break;
            }

            ++$attempt;

            $statusString = $response->getStatus();
            $status = SandboxAsrStatusEnum::from($statusString);

            // 检查完成状态或错误状态
            $result = $this->checkAndHandleResponseStatus(
                $response,
                $status,
                $taskStatus,
                $sandboxId,
                $finishStartTime,
                $attempt
            );
            if ($result !== null) {
                return $result;
            }

            // 中间状态（waiting, running, finalizing）：继续轮询并按间隔记录进度
            $currentTime = microtime(true);
            $elapsedSeconds = (int) ($currentTime - $finishStartTime);
            if ($attempt % AsrConfig::SANDBOX_MERGE_LOG_FREQUENCY === 0 || ($currentTime - $lastLogTime) >= $logInterval) {
                $remainingSeconds = max(0, $timeoutSeconds - $elapsedSeconds);
                $this->logger->info('等待沙箱音频合并', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $sandboxId,
                    'attempt' => $attempt,
                    'elapsed_seconds' => $elapsedSeconds,
                    'remaining_seconds' => $remainingSeconds,
                    'status' => $status->value ?? $statusString,
                    'status_description' => $status->getDescription(),
                ]);
                $lastLogTime = $currentTime;
            }

            // 时间不足，不再 sleep，直接进行最后一次 finishTask
            if (($elapsedSeconds + $pollingInterval) >= $timeoutSeconds) {
                break;
            }

            sleep($pollingInterval);

            // 继续轮询
            $response = $this->asrRecorder->finishTask(
                $sandboxId,
                $taskStatus->taskKey,
                '.workspace',
                $audioConfig,
                $noteFileConfig,
                $transcriptFileConfig
            );
        }

        // 时间即将耗尽，进行最后一次检查
        $statusString = $response->getStatus();
        $status = SandboxAsrStatusEnum::from($statusString);
        $result = $this->checkAndHandleResponseStatus(
            $response,
            $status,
            $taskStatus,
            $sandboxId,
            $finishStartTime,
            $attempt
        );
        if ($result !== null) {
            return $result;
        }

        // 超时记录
        $totalElapsedTime = (int) (microtime(true) - $finishStartTime);
        $this->logger->error('沙箱音频合并超时', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_id' => $sandboxId,
            'total_attempts' => $attempt,
            'total_elapsed_seconds' => $totalElapsedTime,
            'timeout_seconds' => $timeoutSeconds,
            'last_status' => $status->value ?? $statusString,
        ]);

        ExceptionBuilder::throw(AsrErrorCode::SandboxMergeTimeout);
    }

    /**
     * 检查并处理沙箱响应状态.
     *
     * @param AsrRecorderResponse $response 沙箱响应
     * @param SandboxAsrStatusEnum $status 状态枚举
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $sandboxId 沙箱ID
     * @param float $finishStartTime 开始时间
     * @param int $attempt 尝试次数
     * @return null|AsrSandboxMergeResultDTO 如果完成则返回结果，否则返回null
     * @throws BusinessException 如果是错误状态则抛出异常
     */
    private function checkAndHandleResponseStatus(
        AsrRecorderResponse $response,
        SandboxAsrStatusEnum $status,
        AsrTaskStatusDTO $taskStatus,
        string $sandboxId,
        float $finishStartTime,
        int $attempt
    ): ?AsrSandboxMergeResultDTO {
        // 检查是否为完成状态（包含 completed 和 finished）
        if ($status->isCompleted()) {
            // 计算总耗时
            $finishEndTime = microtime(true);
            $totalElapsedTime = round($finishEndTime - $finishStartTime);

            $this->logger->info('沙箱音频合并完成', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $sandboxId,
                'attempt' => $attempt,
                'status' => $status->value,
                'file_path' => $response->getFilePath(),
                'total_elapsed_time_seconds' => $totalElapsedTime,
            ]);

            // 处理沙箱响应，更新文件和目录记录
            $responseData = $response->getData();
            $this->responseHandler->handleFinishResponse(
                $taskStatus,
                $responseData,
            );

            return AsrSandboxMergeResultDTO::fromSandboxResponse([
                'status' => $status->value,
                'file_path' => $response->getFilePath(),
                'duration' => $response->getDuration(),
                'file_size' => $response->getFileSize(),
            ]);
        }

        // 检查是否为错误状态
        if ($status->isError()) {
            ExceptionBuilder::throw(AsrErrorCode::SandboxMergeFailed, '', ['message' => $response->getErrorMessage()]);
        }

        return null;
    }

    /**
     * 等待沙箱启动（能够响应接口）.
     * ASR 功能不需要工作区初始化，只需要沙箱能够响应 getWorkspaceStatus 接口即可.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $taskKey 任务Key（用于日志）
     * @throws BusinessException 当超时时抛出异常
     */
    private function waitForSandboxStartup(
        string $sandboxId,
        string $taskKey
    ): void {
        $this->logger->info('ASR 录音：等待沙箱启动', [
            'task_key' => $taskKey,
            'sandbox_id' => $sandboxId,
            'timeout_seconds' => AsrConfig::SANDBOX_STARTUP_TIMEOUT,
            'interval_seconds' => AsrConfig::POLLING_INTERVAL,
        ]);

        $startTime = time();
        $endTime = $startTime + AsrConfig::SANDBOX_STARTUP_TIMEOUT;

        while (time() < $endTime) {
            try {
                // 尝试获取工作区状态，只要接口能成功返回就说明沙箱已启动
                $response = $this->agentDomainService->getWorkspaceStatus($sandboxId);
                $status = $response->getDataValue('status');

                $this->logger->info('ASR 录音：沙箱已启动并可响应', [
                    'task_key' => $taskKey,
                    'sandbox_id' => $sandboxId,
                    'status' => $status,
                    'status_description' => WorkspaceStatus::getDescription($status),
                    'elapsed_seconds' => time() - $startTime,
                ]);

                // 接口成功返回，沙箱已启动
                return;
            } catch (Throwable $e) {
                // 接口调用失败，说明沙箱还未启动，继续等待
                $this->logger->debug('ASR 录音：沙箱尚未启动，继续等待', [
                    'task_key' => $taskKey,
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                    'elapsed_seconds' => time() - $startTime,
                ]);

                // 等待下一次轮询
                sleep(AsrConfig::POLLING_INTERVAL);
            }
        }

        // 超时
        $this->logger->error('ASR 录音：等待沙箱启动超时', [
            'task_key' => $taskKey,
            'sandbox_id' => $sandboxId,
            'timeout_seconds' => AsrConfig::SANDBOX_STARTUP_TIMEOUT,
        ]);

        ExceptionBuilder::throw(
            AsrErrorCode::SandboxTaskCreationFailed,
            '',
            ['message' => '等待沙箱启动超时（' . AsrConfig::SANDBOX_STARTUP_TIMEOUT . '秒）']
        );
    }

    /**
     * 通过 AgentDomainService 创建沙箱并等待工作区就绪.
     */
    private function ensureSandboxWorkspaceReady(
        AsrTaskStatusDTO $taskStatus,
        string $requestedSandboxId,
        ?string $projectId,
        string $fullWorkdir,
        string $userId,
        string $organizationCode
    ): string {
        if ($requestedSandboxId === '') {
            ExceptionBuilder::throw(AsrErrorCode::SandboxIdNotExist);
        }

        $projectIdString = (string) $projectId;
        if ($projectIdString === '') {
            ExceptionBuilder::throw(AsrErrorCode::SandboxTaskCreationFailed, '', ['message' => '项目ID为空，无法创建沙箱']);
        }

        // 尝试获取工作区状态
        $workspaceStatusResponse = null;
        try {
            $workspaceStatusResponse = $this->agentDomainService->getWorkspaceStatus($requestedSandboxId);
        } catch (Throwable $throwable) {
            $this->logger->warning('获取沙箱工作区状态失败，沙箱可能未启动，将创建新沙箱', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $requestedSandboxId,
                'error' => $throwable->getMessage(),
            ]);
        }

        // 如果工作区状态响应存在，检查是否需要初始化
        if ($workspaceStatusResponse !== null) {
            $responseCode = $workspaceStatusResponse->getCode();
            $workspaceStatus = (int) $workspaceStatusResponse->getDataValue('status');

            // 如果响应成功（code 1000）且工作区已就绪，直接返回
            if ($responseCode === ResponseCode::SUCCESS && WorkspaceStatus::isReady($workspaceStatus)) {
                $this->logger->info('检测到沙箱工作区已就绪，无需初始化', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $requestedSandboxId,
                    'status' => $workspaceStatus,
                    'status_description' => WorkspaceStatus::getDescription($workspaceStatus),
                ]);

                $taskStatus->sandboxId = $requestedSandboxId;

                return $requestedSandboxId;
            }

            // 如果响应成功但工作区未初始化，或响应失败，需要初始化工作区
            $this->logger->info('检测到沙箱工作区未初始化或响应异常，需要初始化工作区', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $requestedSandboxId,
                'response_code' => $responseCode,
                'workspace_status' => $workspaceStatus,
                'status_description' => WorkspaceStatus::getDescription($workspaceStatus),
            ]);

            $taskStatus->sandboxId = $requestedSandboxId;
            $this->initializeWorkspace($taskStatus, $requestedSandboxId, $userId, $organizationCode);

            return $requestedSandboxId;
        }

        // 工作区状态响应不存在，沙箱未启动，需要创建沙箱
        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);

        $this->logger->info('准备调用 AgentDomainService 创建沙箱', [
            'task_key' => $taskStatus->taskKey,
            'project_id' => $projectIdString,
            'requested_sandbox_id' => $requestedSandboxId,
            'full_workdir' => $fullWorkdir,
        ]);

        $actualSandboxId = $this->agentDomainService->createSandbox(
            $dataIsolation,
            $projectIdString,
            $requestedSandboxId,
            $fullWorkdir
        );

        $this->logger->info('沙箱创建请求完成，等待沙箱启动', [
            'task_key' => $taskStatus->taskKey,
            'requested_sandbox_id' => $requestedSandboxId,
            'actual_sandbox_id' => $actualSandboxId,
        ]);

        // 等待沙箱启动（能够响应接口）
        $this->waitForSandboxStartup($actualSandboxId, $taskStatus->taskKey);

        $taskStatus->sandboxId = $actualSandboxId;

        // 初始化工作区
        $this->initializeWorkspace($taskStatus, $actualSandboxId, $userId, $organizationCode);

        return $actualSandboxId;
    }

    /**
     * 初始化工作区.
     * 复用 AgentDomainService::initializeAgent 方法，确保初始化配置一致.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $actualSandboxId 实际沙箱ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     */
    private function initializeWorkspace(
        AsrTaskStatusDTO $taskStatus,
        string $actualSandboxId,
        string $userId,
        string $organizationCode
    ): void {
        $this->logger->info('沙箱已启动，准备发送初始化消息', [
            'task_key' => $taskStatus->taskKey,
            'actual_sandbox_id' => $actualSandboxId,
            'topic_id' => $taskStatus->topicId,
        ]);

        // 获取或创建 Task Entity（用于构建 TaskContext）
        $taskEntity = $this->getOrCreateTaskEntity($taskStatus, $userId, $organizationCode);

        $this->logger->info('获取到 ASR 任务 Entity', [
            'task_key' => $taskStatus->taskKey,
            'topic_id' => $taskStatus->topicId,
            'task_id' => $taskEntity->getId(),
        ]);

        // 创建 DataIsolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);

        // 获取 topic 实体（用于获取 workspaceId 等信息）
        $topicEntity = $this->topicDomainService->getTopicById((int) $taskStatus->topicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(
                AsrErrorCode::SandboxTaskCreationFailed,
                '',
                ['message' => '话题不存在']
            );
        }

        // 获取项目实体（用于获取项目组织编码）
        $projectEntity = $this->projectDomainService->getProject((int) $taskStatus->projectId, $userId);
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode();

        // 确定 agentUserId：使用 topic 的创建者ID，如果没有则使用 topic 的用户ID（参考 AgentAppService）
        $agentUserId = $topicEntity->getCreatedUid() ?: $topicEntity->getUserId();

        // 构建 TaskContext（ASR 场景中 chatConversationId、chatTopicId 使用空字符串）
        $taskContext = new TaskContext(
            task: $taskEntity,
            dataIsolation: $dataIsolation,
            chatConversationId: '', // ASR 场景不需要聊天会话ID
            chatTopicId: '', // ASR 场景不需要聊天主题ID
            agentUserId: $agentUserId, // 使用 topic 的创建者ID或用户ID
            sandboxId: $actualSandboxId,
            taskId: (string) $taskEntity->getId(),
            instruction: ChatInstruction::Normal,
            agentMode: $topicEntity->getTaskMode() ?: 'general',
            workspaceId: (string) $topicEntity->getWorkspaceId(),
            isFirstTask: false, // ASR 场景通常不是首次任务
        );

        // 复用 initializeAgent 方法（会自动构建 message_subscription_config 和 magic_service_host）
        // 传入项目组织编码，用于获取正确的 STS Token
        // ASR 场景设置 skip_init_messages = true，让沙箱不发送聊天消息过来
        $initMetadata = (new InitializationMetadataDTO(skipInitMessages: true));
        $this->agentDomainService->initializeAgent($dataIsolation, $taskContext, null, $projectOrganizationCode, $initMetadata);

        $this->logger->info('沙箱初始化消息已发送，等待工作区初始化完成', [
            'task_key' => $taskStatus->taskKey,
            'actual_sandbox_id' => $actualSandboxId,
            'task_id' => $taskEntity->getId(),
        ]);

        // 等待工作区初始化完成（包括文件同步）
        $this->agentDomainService->waitForWorkspaceReady(
            $actualSandboxId,
            AsrConfig::WORKSPACE_INIT_TIMEOUT,
            AsrConfig::POLLING_INTERVAL
        );

        $this->logger->info('沙箱工作区已初始化完成，文件已同步，可以开始使用', [
            'task_key' => $taskStatus->taskKey,
            'actual_sandbox_id' => $actualSandboxId,
            'task_id' => $taskEntity->getId(),
        ]);
    }

    /**
     * 构建笔记文件配置对象.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param null|string $targetDirectory 目标目录（可选，默认与源目录相同）
     * @param null|string $intelligentTitle 智能标题（可选，用于重命名）
     */
    private function buildNoteFileConfig(
        AsrTaskStatusDTO $taskStatus,
        ?string $targetDirectory = null,
        ?string $intelligentTitle = null
    ): ?AsrNoteFileConfig {
        if (empty($taskStatus->presetNoteFilePath)) {
            return null;
        }

        $workspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath($taskStatus->presetNoteFilePath);

        // 如果未指定目标目录，使用源路径（不重命名）
        if ($targetDirectory === null || $intelligentTitle === null) {
            return new AsrNoteFileConfig(
                sourcePath: $workspaceRelativePath,
                targetPath: $workspaceRelativePath
            );
        }

        // 需要重命名：使用智能标题和国际化的笔记后缀构建目标路径
        $fileExtension = pathinfo($workspaceRelativePath, PATHINFO_EXTENSION);
        $noteSuffix = trans('asr.file_names.note_suffix'); // 根据语言获取国际化的"笔记"/"Note"
        $noteFilename = sprintf('%s-%s.%s', $intelligentTitle, $noteSuffix, $fileExtension);

        return new AsrNoteFileConfig(
            sourcePath: $workspaceRelativePath,
            targetPath: rtrim($targetDirectory, '/') . '/' . $noteFilename
        );
    }

    /**
     * 构建流式识别文件配置对象.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     */
    private function buildTranscriptFileConfig(AsrTaskStatusDTO $taskStatus): ?AsrTranscriptFileConfig
    {
        if (empty($taskStatus->presetTranscriptFilePath)) {
            return null;
        }

        $transcriptWorkspaceRelativePath = AsrAssembler::extractWorkspaceRelativePath(
            $taskStatus->presetTranscriptFilePath
        );

        return new AsrTranscriptFileConfig(
            sourcePath: $transcriptWorkspaceRelativePath
        );
    }

    /**
     * 获取或创建 Task Entity（用于构建 TaskContext）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @return TaskEntity Task Entity
     */
    private function getOrCreateTaskEntity(
        AsrTaskStatusDTO $taskStatus,
        string $userId,
        string $organizationCode
    ): TaskEntity {
        // 检查 topicId 是否存在
        if (empty($taskStatus->topicId)) {
            $this->logger->error('ASR 任务缺少 topicId，无法获取或创建 task', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
            ]);
            ExceptionBuilder::throw(
                AsrErrorCode::SandboxTaskCreationFailed,
                '',
                ['message' => 'Topic ID 为空，无法创建沙箱任务']
            );
        }

        // 获取 topic 实体
        $topicEntity = $this->topicDomainService->getTopicById((int) $taskStatus->topicId);
        if (! $topicEntity) {
            $this->logger->error('ASR 任务关联的 topic 不存在', [
                'task_key' => $taskStatus->taskKey,
                'topic_id' => $taskStatus->topicId,
            ]);
            ExceptionBuilder::throw(
                AsrErrorCode::SandboxTaskCreationFailed,
                '',
                ['message' => '话题不存在']
            );
        }

        // 检查 topic 是否有当前任务
        $currentTaskId = $topicEntity->getCurrentTaskId();
        if ($currentTaskId !== null && $currentTaskId > 0) {
            $taskEntity = $this->taskDomainService->getTaskById($currentTaskId);
            if ($taskEntity) {
                $this->logger->info('ASR 任务使用 topic 的当前任务 Entity', [
                    'task_key' => $taskStatus->taskKey,
                    'topic_id' => $taskStatus->topicId,
                    'current_task_id' => $currentTaskId,
                ]);
                return $taskEntity;
            }
        }

        // topic 没有当前任务，为 ASR 场景创建一个新任务
        $this->logger->info('ASR 任务关联的 topic 没有当前任务，准备创建新任务', [
            'task_key' => $taskStatus->taskKey,
            'topic_id' => $taskStatus->topicId,
            'project_id' => $taskStatus->projectId,
        ]);

        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);

        $taskData = [
            'user_id' => $userId,
            'workspace_id' => $topicEntity->getWorkspaceId(),
            'project_id' => $topicEntity->getProjectId(),
            'topic_id' => $topicEntity->getId(),
            'task_id' => '', // 数据库会自动生成
            'task_mode' => $topicEntity->getTaskMode() ?: 'general',
            'sandbox_id' => $topicEntity->getSandboxId() ?: '',
            'prompt' => 'ASR Recording Task', // ASR 任务标识
            'task_status' => 'waiting',
            'work_dir' => $topicEntity->getWorkDir() ?? '',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        $taskEntity = TaskEntity::fromArray($taskData);

        // 创建任务并更新 topic
        $createdTask = $this->taskDomainService->initTopicTask($dataIsolation, $topicEntity, $taskEntity);

        $this->logger->info('为 ASR 任务创建了新的 task', [
            'task_key' => $taskStatus->taskKey,
            'topic_id' => $taskStatus->topicId,
            'created_task_id' => $createdTask->getId(),
        ]);

        return $createdTask;
    }
}
