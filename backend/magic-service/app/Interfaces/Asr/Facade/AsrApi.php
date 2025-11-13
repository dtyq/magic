<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asr\Facade;

use App\Application\File\Service\FileAppService;
use App\Application\Speech\Assembler\AsrAssembler;
use App\Application\Speech\DTO\AsrRecordingDirectoryDTO;
use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\DTO\NoteDTO;
use App\Application\Speech\DTO\SummaryRequestDTO;
use App\Application\Speech\Enum\AsrRecordingStatusEnum;
use App\Application\Speech\Enum\AsrRecordingTypeEnum;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Application\Speech\Service\AsrDirectoryService;
use App\Application\Speech\Service\AsrFileAppService;
use App\Application\Speech\Service\AsrPresetFileService;
use App\Application\Speech\Service\AsrTitleGeneratorService;
use App\ErrorCode\AsrErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Asr\Service\ByteDanceSTSService;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Exception;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

#[Controller]
#[ApiResponse('low_code')]
class AsrApi extends AbstractApi
{
    private LoggerInterface $logger;

    public function __construct(
        protected ByteDanceSTSService $stsService,
        protected FileAppService $fileAppService,
        protected AsrFileAppService $asrFileAppService,
        protected AsrTitleGeneratorService $titleGeneratorService,
        protected AsrDirectoryService $directoryService,
        protected AsrPresetFileService $presetFileService,
        protected LockerInterface $locker,
        LoggerFactory $loggerFactory,
        RequestInterface $request,
    ) {
        $this->logger = $loggerFactory->get('AsrApi');
        parent::__construct($request);
    }

    /**
     * 获取当前用户的ASR JWT Token
     * GET /api/v1/asr/tokens.
     * @throws Exception
     */
    public function show(RequestInterface $request): array
    {
        $userAuthorization = $this->getAuthorization();
        $magicId = $userAuthorization->getMagicId();

        $refresh = (bool) $request->input('refresh', false);
        $duration = 60 * 60 * 12; // 12小时

        $tokenData = $this->stsService->getJwtTokenForUser($magicId, $duration, $refresh);

        return [
            'token' => $tokenData['jwt_token'],
            'app_id' => $tokenData['app_id'],
            'duration' => $tokenData['duration'],
            'expires_at' => $tokenData['expires_at'],
            'resource_id' => $tokenData['resource_id'],
            'user' => [
                'user_id' => $userAuthorization->getId(),
                'magic_id' => $userAuthorization->getMagicId(),
                'organization_code' => $userAuthorization->getOrganizationCode(),
            ],
        ];
    }

    /**
     * 清除当前用户的ASR JWT Token缓存
     * DELETE /api/v1/asr/tokens.
     */
    public function destroy(): array
    {
        $userAuthorization = $this->getAuthorization();
        $magicId = $userAuthorization->getMagicId();

        $cleared = $this->stsService->clearUserJwtTokenCache($magicId);

        return [
            'cleared' => $cleared,
            'message' => $cleared ? trans('asr.api.token.cache_cleared') : trans('asr.api.token.cache_not_exist'),
            'user' => [
                'user_id' => $userAuthorization->getId(),
                'magic_id' => $userAuthorization->getMagicId(),
                'organization_code' => $userAuthorization->getOrganizationCode(),
            ],
        ];
    }

    /**
     * 查询录音总结状态
     * POST /api/v1/asr/summary.
     */
    public function summary(RequestInterface $request): array
    {
        /** @var MagicUserAuthorization $userAuthorization */
        $userAuthorization = $this->getAuthorization();
        $userId = $userAuthorization->getId();
        $summaryRequest = $this->validateAndBuildSummaryRequest($request, $userAuthorization);

        // 状态检查：如果不是通过 file_id 发起的总结，需要检查任务状态
        if (! $summaryRequest->hasFileId()) {
            $taskStatus = $this->asrFileAppService->getTaskStatusFromRedis($summaryRequest->taskKey, $userId);

            if (! $taskStatus->isEmpty()) {
                // 状态检查 1：任务已取消，不允许总结
                if ($taskStatus->recordingStatus === AsrRecordingStatusEnum::CANCELED->value) {
                    ExceptionBuilder::throw(AsrErrorCode::TaskAlreadyCanceled);
                }

                // 状态检查 2：任务已完成（只在这里记录日志，允许重新总结以更换模型）
                if ($taskStatus->isSummaryCompleted()) {
                    $this->logger->info('任务已完成，允许使用新模型重新总结', [
                        'task_key' => $summaryRequest->taskKey,
                        'old_model_id' => $taskStatus->modelId,
                        'new_model_id' => $summaryRequest->modelId,
                    ]);
                }
            }
        }

        // 应用层已有分布式锁，这里无需再加锁，直接调用
        try {
            // 处理总结任务
            $result = $this->asrFileAppService->processSummaryWithChat($summaryRequest, $userAuthorization);

            if (! $result['success']) {
                return $this->buildSummaryResponse(false, $summaryRequest, $result['error']);
            }

            return $this->buildSummaryResponse(true, $summaryRequest, null, $result);
        } catch (Throwable $e) {
            $this->logger->error('ASR总结处理异常', [
                'task_key' => $summaryRequest->taskKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->buildSummaryResponse(false, $summaryRequest, sprintf('处理异常: %s', $e->getMessage()));
        }
    }

    /**
     * 获取ASR录音文件上传STS Token
     * GET /api/v1/asr/upload-tokens.
     */
    public function getUploadToken(RequestInterface $request): array
    {
        $operationId = uniqid('op_', true);

        /** @var MagicUserAuthorization $userAuthorization */
        $userAuthorization = $this->getAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 1. 验证参数
        /** @var AsrRecordingTypeEnum $recordingType */
        [$taskKey, $topicId, $projectId, $recordingType, $fileName] = $this->validateUploadTokenParams($request, $userId);

        $this->logger->info('getUploadToken 开始处理', [
            'operation_id' => $operationId,
            'task_key' => $taskKey,
            'user_id' => $userId,
            'recording_type' => $recordingType->value,
            'needs_preset_files' => $recordingType->needsPresetFiles(),
            'has_file_name' => ! empty($fileName),
        ]);

        // 2. 获取分布式锁（防止并发创建目录）
        $lockName = sprintf('asr:upload_token:lock:%s:%s', $userId, $taskKey);
        $lockOwner = sprintf('%s:%s', $userId, microtime(true));
        $locked = $this->locker->spinLock($lockName, $lockOwner);

        if (! $locked) {
            ExceptionBuilder::throw(AsrErrorCode::SystemBusy);
        }

        try {
            // 3. 创建或更新任务状态
            $taskStatus = $this->createOrUpdateTaskStatus($taskKey, $topicId, $projectId, $userId, $organizationCode);

            // 3.1 为文件直传类型生成标题（如果有文件名且还未生成过标题）
            if ($recordingType === AsrRecordingTypeEnum::FILE_UPLOAD
                && ! empty($fileName)
                && empty($taskStatus->uploadGeneratedTitle)) {
                try {
                    $generatedTitle = $this->titleGeneratorService->generateTitleForFileUpload(
                        $userAuthorization,
                        $fileName,
                        $taskKey
                    );

                    if (! empty($generatedTitle)) {
                        $taskStatus->uploadGeneratedTitle = $generatedTitle;
                        $this->logger->info('文件直传标题生成成功', [
                            'task_key' => $taskKey,
                            'file_name' => $fileName,
                            'generated_title' => $generatedTitle,
                        ]);
                    }
                } catch (Throwable $e) {
                    // 标题生成失败不影响主流程
                    $this->logger->warning('文件直传标题生成失败', [
                        'task_key' => $taskKey,
                        'file_name' => $fileName,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // 3.2 创建 .asr_states 目录（所有录音类型都需要）
            try {
                $statesDir = $this->directoryService->createStatesDirectory($organizationCode, $projectId, $userId);
                $this->logger->info('.asr_states 目录创建或确认存在', [
                    'task_key' => $taskKey,
                    'recording_type' => $recordingType->value,
                    'states_dir_id' => $statesDir->directoryId,
                    'states_dir_path' => $statesDir->directoryPath,
                ]);
            } catch (Throwable $e) {
                // .asr_states 目录创建失败不影响主流程
                $this->logger->warning('创建 .asr_states 目录失败', [
                    'task_key' => $taskKey,
                    'recording_type' => $recordingType->value,
                    'error' => $e->getMessage(),
                ]);
            }

            // 4. 获取STS Token
            $tokenData = $this->buildStsToken($userAuthorization, $projectId, $userId);

            // 5. 创建预设文件（如果还未创建，且录音类型需要预设文件）
            if (empty($taskStatus->presetNoteFileId)
                && ! empty($taskStatus->displayDirectory)
                && ! empty($taskStatus->displayDirectoryId)
                && ! empty($taskStatus->tempHiddenDirectory)
                && ! empty($taskStatus->tempHiddenDirectoryId)
              && $recordingType->needsPresetFiles()) {
                try {
                    $presetFiles = $this->presetFileService->createPresetFiles(
                        $userId,
                        $organizationCode,
                        (int) $projectId,
                        $taskStatus->displayDirectory,
                        (int) $taskStatus->displayDirectoryId,
                        $taskStatus->tempHiddenDirectory,
                        (int) $taskStatus->tempHiddenDirectoryId,
                        $taskKey
                    );

                    // 保存预设文件ID和路径到任务状态
                    $taskStatus->presetNoteFileId = (string) $presetFiles['note_file']->getFileId();
                    $taskStatus->presetTranscriptFileId = (string) $presetFiles['transcript_file']->getFileId();
                    $taskStatus->presetNoteFilePath = $presetFiles['note_file']->getFileKey();
                    $taskStatus->presetTranscriptFilePath = $presetFiles['transcript_file']->getFileKey();

                    $this->logger->info('预设文件创建成功', [
                        'task_key' => $taskKey,
                        'note_file_id' => $taskStatus->presetNoteFileId,
                        'transcript_file_id' => $taskStatus->presetTranscriptFileId,
                        'note_file_path' => $taskStatus->presetNoteFilePath,
                        'transcript_file_path' => $taskStatus->presetTranscriptFilePath,
                    ]);
                } catch (Throwable $e) {
                    // 预设文件创建失败不影响主流程
                    $this->logger->warning('创建预设文件失败', [
                        'task_key' => $taskKey,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // 6. 保存任务状态
            $this->asrFileAppService->saveTaskStatusToRedis($taskStatus);

            // 7. 返回响应
            return $this->buildUploadTokenResponse($tokenData, $taskStatus, $taskKey);
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 录音状态上报接口
     * POST /api/v1/asr/status.
     */
    public function reportStatus(RequestInterface $request): array
    {
        $operationId = uniqid('op_', true);

        $userAuthorization = $this->getAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 获取并验证参数
        $taskKey = $request->input('task_key', '');
        $status = $request->input('status', '');
        $modelId = $request->input('model_id', '');
        $asrStreamContent = $request->input('asr_stream_content', '');
        $noteData = $request->input('note');

        // 获取语种
        $language = CoContext::getLanguage();

        $this->logger->info('reportStatus 开始处理', [
            'operation_id' => $operationId,
            'task_key' => $taskKey,
            'status' => $status,
            'user_id' => $userId,
        ]);

        // 验证参数
        if (empty($taskKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.exception.task_key_empty'));
        }

        $statusEnum = AsrRecordingStatusEnum::tryFromString($status);
        if ($statusEnum === null) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterMissing,
                sprintf('无效的状态，有效值：%s', implode(', ', ['start', 'recording', 'paused', 'stopped', 'canceled']))
            );
        }

        // 状态检查：获取当前任务状态
        $taskStatus = $this->asrFileAppService->getTaskStatusFromRedis($taskKey, $userId);
        if (! $taskStatus->isEmpty()) {
            if ($taskStatus->hasServerSummaryLock()) {
                $this->logger->info('reportStatus 服务端总结进行中，拒绝状态上报', [
                    'task_key' => $taskKey,
                    'user_id' => $userId,
                    'retry_count' => $taskStatus->serverSummaryRetryCount,
                ]);
                ExceptionBuilder::throw(AsrErrorCode::TaskIsSummarizing);
            }

            // 状态检查 1：任务已完成，不允许报告状态（除非是 canceled）
            if ($statusEnum !== AsrRecordingStatusEnum::CANCELED && $taskStatus->isSummaryCompleted()) {
                ExceptionBuilder::throw(AsrErrorCode::TaskAlreadyCompleted);
            }

            // 状态检查 2：任务已取消，不允许再报告其他状态
            if ($taskStatus->recordingStatus === AsrRecordingStatusEnum::CANCELED->value
                && $statusEnum !== AsrRecordingStatusEnum::CANCELED) {
                ExceptionBuilder::throw(AsrErrorCode::TaskAlreadyCanceled);
            }

            // 状态检查 3：录音已停止且已合并，不允许再 start/recording（可能是心跳超时自动停止）
            if ($taskStatus->recordingStatus === AsrRecordingStatusEnum::STOPPED->value
                && ! empty($taskStatus->audioFileId)
                && in_array($statusEnum, [AsrRecordingStatusEnum::START, AsrRecordingStatusEnum::RECORDING], true)) {
                ExceptionBuilder::throw(AsrErrorCode::TaskAutoStoppedByTimeout);
            }
        }

        // 处理 note 参数
        $noteContent = null;
        $noteFileType = null;
        if (! empty($noteData) && is_array($noteData)) {
            $noteContent = $noteData['content'] ?? '';
            $noteFileType = $noteData['file_type'] ?? 'md';
        }

        // 调用应用服务处理
        $success = $this->asrFileAppService->handleStatusReport(
            $taskKey,
            $statusEnum,
            $modelId,
            $asrStreamContent,
            $noteContent,
            $noteFileType,
            $language,
            $userId,
            $organizationCode
        );

        return ['success' => $success];
    }

    /**
     * 验证并构建总结请求DTO.
     */
    private function validateAndBuildSummaryRequest(RequestInterface $request, MagicUserAuthorization $userAuthorization): SummaryRequestDTO
    {
        $taskKey = $request->input('task_key', '');
        $projectId = $request->input('project_id', '');
        $topicId = $request->input('topic_id', '');
        $modelId = $request->input('model_id', '');
        $fileId = $request->input('file_id');
        $noteData = $request->input('note');
        $asrStreamContent = $request->input('asr_stream_content', '');

        // 限制内容长度
        if (! empty($asrStreamContent) && mb_strlen($asrStreamContent) > 10000) {
            $asrStreamContent = mb_substr($asrStreamContent, 0, 10000);
        }

        // 如果有file_id且没有task_key，生成一个
        if (! empty($fileId) && empty($taskKey)) {
            $taskKey = uniqid('', true);
        }

        // 验证必传参数
        if (empty($taskKey) && empty($fileId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.task_key_required'));
        }

        if (empty($projectId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.project_id_required'));
        }

        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.topic_id_required'));
        }

        if (empty($modelId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.model_id_required'));
        }

        // 处理笔记
        $note = $this->parseNoteData($noteData);

        // 生成标题：优先从 Redis 中复用 upload-tokens 生成的标题
        $generatedTitle = null;

        // 1. 尝试从 Redis 中获取已生成的标题（文件直传场景）
        if (! empty($taskKey)) {
            $taskStatus = $this->asrFileAppService->getTaskStatusFromRedis($taskKey, $userAuthorization->getId());
            if (! $taskStatus->isEmpty() && ! empty($taskStatus->uploadGeneratedTitle)) {
                $generatedTitle = $taskStatus->uploadGeneratedTitle;
                $this->logger->info('复用 upload-tokens 生成的标题', [
                    'task_key' => $taskKey,
                    'title' => $generatedTitle,
                ]);
            }
        }

        // 2. 如果没有从 Redis 获取到标题，则重新生成（前端录音或旧逻辑）
        if (empty($generatedTitle)) {
            $generatedTitle = $this->titleGeneratorService->generateTitleForScenario(
                $userAuthorization,
                $asrStreamContent,
                $fileId,
                $note,
                $taskKey
            );
        }

        return new SummaryRequestDTO($taskKey, $projectId, $topicId, $modelId, $fileId, $note, $asrStreamContent ?: null, $generatedTitle);
    }

    /**
     * 解析笔记数据.
     */
    private function parseNoteData(mixed $noteData): ?NoteDTO
    {
        if (empty($noteData) || ! is_array($noteData)) {
            return null;
        }

        $noteContent = $noteData['content'] ?? '';
        $noteFileType = $noteData['file_type'] ?? 'md';

        if (empty(trim($noteContent))) {
            return null;
        }

        // 验证长度
        $contentLength = mb_strlen($noteContent);
        if ($contentLength > 25000) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterMissing,
                trans('asr.api.validation.note_content_too_long', ['length' => $contentLength])
            );
        }

        $note = new NoteDTO($noteContent, $noteFileType);

        // 验证文件类型
        if (! $note->isValidFileType()) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterMissing,
                sprintf('不支持的文件类型: %s，支持的类型: txt, md, json', $noteFileType)
            );
        }

        return $note;
    }

    /**
     * 构建总结响应.
     */
    private function buildSummaryResponse(bool $success, SummaryRequestDTO $request, ?string $error = null, ?array $result = null): array
    {
        if (! $success) {
            return [
                'success' => false,
                'error' => $error,
                'task_key' => $request->taskKey,
                'project_id' => $request->projectId,
                'topic_id' => $request->topicId,
                'topic_name' => null,
                'project_name' => null,
                'workspace_name' => null,
            ];
        }

        return [
            'success' => true,
            'task_key' => $request->taskKey,
            'project_id' => $request->projectId,
            'topic_id' => $request->topicId,
            'conversation_id' => $result['conversation_id'] ?? null,
            'topic_name' => $result['topic_name'] ?? null,
            'project_name' => $result['project_name'] ?? null,
            'workspace_name' => $result['workspace_name'] ?? null,
        ];
    }

    /**
     * 验证上传Token请求参数.
     */
    private function validateUploadTokenParams(RequestInterface $request, string $userId): array
    {
        $taskKey = $request->input('task_key', '');
        if (empty($taskKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.task_key_required'));
        }

        $topicId = $request->input('topic_id', '');
        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.exception.topic_id_empty'));
        }

        // 验证录音类型参数（可选，默认为 file_upload）
        $typeString = $request->input('type', '');
        $recordingType = empty($typeString)
            ? AsrRecordingTypeEnum::default()
            : AsrRecordingTypeEnum::fromString($typeString);

        if ($recordingType === null) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                trans('asr.api.validation.invalid_recording_type', ['type' => $typeString])
            );
        }

        $projectId = $this->asrFileAppService->getProjectIdFromTopic((int) $topicId, $userId);

        // 获取文件名（仅在 file_upload 类型时使用）
        $fileName = $request->input('file_name', '');

        return [$taskKey, $topicId, $projectId, $recordingType, $fileName];
    }

    /**
     * 创建或更新任务状态.
     */
    private function createOrUpdateTaskStatus(
        string $taskKey,
        string $topicId,
        string $projectId,
        string $userId,
        string $organizationCode
    ): AsrTaskStatusDTO {
        $taskStatus = $this->asrFileAppService->getTaskStatusFromRedis($taskKey, $userId);

        if ($taskStatus->isEmpty()) {
            // 第一次调用：创建新任务状态
            return $this->createNewTaskStatus($taskKey, $topicId, $projectId, $userId, $organizationCode);
        }

        if ($taskStatus->hasServerSummaryLock()) {
            $this->logger->info('getUploadToken 服务端总结进行中，拒绝发放上传凭证', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'retry_count' => $taskStatus->serverSummaryRetryCount,
            ]);
            ExceptionBuilder::throw(AsrErrorCode::TaskIsSummarizing);
        }

        // 状态检查 1：任务已完成，不允许上传
        if ($taskStatus->isSummaryCompleted()) {
            ExceptionBuilder::throw(AsrErrorCode::TaskAlreadyCompleted);
        }

        // 状态检查 2：任务已取消，不允许上传
        if ($taskStatus->recordingStatus === AsrRecordingStatusEnum::CANCELED->value) {
            ExceptionBuilder::throw(AsrErrorCode::TaskAlreadyCanceled);
        }

        // 状态检查 3：录音已停止，不允许上传（可能是心跳超时自动停止）
        if ($taskStatus->recordingStatus === AsrRecordingStatusEnum::STOPPED->value
            && ! empty($taskStatus->audioFileId)) {
            ExceptionBuilder::throw(AsrErrorCode::TaskAutoStoppedByTimeout);
        }

        // 后续调用：更新必要字段
        $this->asrFileAppService->validateProjectAccess($projectId, $userId, $organizationCode);
        $taskStatus->projectId = $projectId;
        $taskStatus->topicId = $topicId;

        $this->logger->info('后续调用 getUploadToken，使用已有目录', [
            'task_key' => $taskKey,
            'hidden_directory' => $taskStatus->tempHiddenDirectory,
            'display_directory' => $taskStatus->displayDirectory,
            'recording_status' => $taskStatus->recordingStatus,
        ]);

        return $taskStatus;
    }

    /**
     * 创建新任务状态.
     */
    private function createNewTaskStatus(
        string $taskKey,
        string $topicId,
        string $projectId,
        string $userId,
        string $organizationCode
    ): AsrTaskStatusDTO {
        $this->logger->info('第一次调用 getUploadToken，创建新目录', [
            'task_key' => $taskKey,
            'project_id' => $projectId,
            'topic_id' => $topicId,
        ]);

        $directories = $this->asrFileAppService->validateTopicAndPrepareDirectories(
            $topicId,
            $projectId,
            $userId,
            $organizationCode,
            $taskKey
        );

        $hiddenDir = $this->findDirectoryByType($directories, true);
        $displayDir = $this->findDirectoryByType($directories, false);

        if ($hiddenDir === null) {
            ExceptionBuilder::throw(AsrErrorCode::HiddenDirectoryNotFound);
        }

        return new AsrTaskStatusDTO([
            'task_key' => $taskKey,
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'status' => AsrTaskStatusEnum::PROCESSING->value,
            'project_id' => $projectId,
            'topic_id' => $topicId,
            'temp_hidden_directory' => $hiddenDir->directoryPath,
            'display_directory' => $displayDir?->directoryPath,
            'temp_hidden_directory_id' => $hiddenDir->directoryId,
            'display_directory_id' => $displayDir?->directoryId,
        ]);
    }

    /**
     * 构建STS Token.
     */
    private function buildStsToken(MagicUserAuthorization $userAuthorization, string $projectId, string $userId): array
    {
        $storageType = StorageBucketType::SandBox->value;
        $expires = 60 * 60;

        $workspacePath = $this->directoryService->getWorkspacePath($projectId, $userId);

        $tokenData = $this->fileAppService->getStsTemporaryCredentialV2(
            $userAuthorization->getOrganizationCode(),
            $storageType,
            $workspacePath,
            $expires,
            false
        );

        unset($tokenData['magic_service_host']);

        if (empty($tokenData['temporary_credential']['dir'])) {
            $this->logger->error(trans('asr.api.token.sts_get_failed'), [
                'workspace_path' => $workspacePath,
                'user_id' => $userId,
            ]);
            ExceptionBuilder::throw(GenericErrorCode::SystemError, trans('asr.api.token.sts_get_failed'));
        }

        return $tokenData;
    }

    /**
     * 构建上传Token响应.
     */
    private function buildUploadTokenResponse(array $tokenData, AsrTaskStatusDTO $taskStatus, string $taskKey): array
    {
        $directories = $this->buildDirectoriesArray($taskStatus);
        $presetFiles = $this->buildPresetFilesArray($taskStatus);

        $response = [
            'sts_token' => $tokenData,
            'task_key' => $taskKey,
            'expires_in' => 60 * 60,
            'directories' => $directories,
        ];

        // 只有当预设文件存在时才添加到返回中
        if (! empty($presetFiles)) {
            $response['preset_files'] = $presetFiles;
        }

        return $response;
    }

    /**
     * 构建目录数组.
     */
    private function buildDirectoriesArray(AsrTaskStatusDTO $taskStatus): array
    {
        $directories = [];

        if (! empty($taskStatus->tempHiddenDirectory)) {
            $directories['asr_hidden_dir'] = [
                'directory_path' => $taskStatus->tempHiddenDirectory,
                'directory_id' => (string) $taskStatus->tempHiddenDirectoryId,
                'hidden' => true,
                'type' => 'asr_hidden_dir',
            ];
        }

        if (! empty($taskStatus->displayDirectory)) {
            $directories['asr_display_dir'] = [
                'directory_path' => $taskStatus->displayDirectory,
                'directory_id' => (string) $taskStatus->displayDirectoryId,
                'hidden' => false,
                'type' => 'asr_display_dir',
            ];
        }

        return $directories;
    }

    /**
     * 构建预设文件数组.
     */
    private function buildPresetFilesArray(AsrTaskStatusDTO $taskStatus): array
    {
        $presetFiles = [];

        // 笔记文件
        if (! empty($taskStatus->presetNoteFileId) && ! empty($taskStatus->presetNoteFilePath)) {
            $relativePath = AsrAssembler::extractWorkspaceRelativePath($taskStatus->presetNoteFilePath);
            $fileName = basename($relativePath);

            $presetFiles['note_file'] = [
                'file_id' => $taskStatus->presetNoteFileId,
                'file_name' => $fileName,
                'file_path' => $relativePath,
            ];
        }

        // 流式识别文件
        if (! empty($taskStatus->presetTranscriptFileId) && ! empty($taskStatus->presetTranscriptFilePath)) {
            $relativePath = AsrAssembler::extractWorkspaceRelativePath($taskStatus->presetTranscriptFilePath);
            $fileName = basename($relativePath);

            $presetFiles['transcript_file'] = [
                'file_id' => $taskStatus->presetTranscriptFileId,
                'file_name' => $fileName,
                'file_path' => $relativePath,
            ];
        }

        return $presetFiles;
    }

    /**
     * 从目录数组中查找指定类型的目录.
     */
    private function findDirectoryByType(array $directories, bool $hidden): ?AsrRecordingDirectoryDTO
    {
        return array_find($directories, static fn ($directory) => $directory->hidden === $hidden);
    }
}
