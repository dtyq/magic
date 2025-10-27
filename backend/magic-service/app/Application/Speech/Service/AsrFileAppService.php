<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Speech\Assembler\AsrDirectoryAssembler;
use App\Application\Speech\Assembler\AsrPromptAssembler;
use App\Application\Speech\Assembler\ChatMessageAssembler;
use App\Application\Speech\DTO\AsrRecordingDirectoryDTO;
use App\Application\Speech\DTO\AsrSandboxMergeResultDTO;
use App\Application\Speech\DTO\NoteDTO;
use App\Application\Speech\DTO\ProcessSummaryTaskDTO;
use App\Application\Speech\DTO\SummaryRequestDTO;
use App\Application\Speech\Enum\AsrDirectoryTypeEnum;
use App\Application\Speech\Enum\AsrRecordingStatusEnum;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus as SuperAgentTaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageQueueDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\AsrRecorderInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Codec\Json;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Engine\Coroutine;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * ASR文件管理应用服务 - 负责ASR相关的所有业务逻辑.
 */
readonly class AsrFileAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private ProjectDomainService $projectDomainService,
        private ProjectMemberDomainService $projectMemberDomainService,
        private TaskFileDomainService $taskFileDomainService,
        private WorkspaceDomainService $workspaceDomainService,
        private MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private MagicUserDomainService $magicUserDomainService,
        private ChatMessageAssembler $chatMessageAssembler,
        private MagicChatMessageAppService $magicChatMessageAppService,
        private MagicChatDomainService $magicChatDomainService,
        private TopicDomainService $superAgentTopicDomainService,
        private MessageQueueDomainService $messageQueueDomainService,
        private SandboxGatewayInterface $sandboxGateway,
        private AsrRecorderInterface $asrRecorder,
        private TranslatorInterface $translator,
        private Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('AsrFileAppService');
    }

    /**
     * 处理ASR总结任务的完整流程（包含聊天消息发送）.
     *
     * @param SummaryRequestDTO $summaryRequest 总结请求DTO
     * @param MagicUserAuthorization $userAuthorization 用户授权信息（包含用户ID和组织编码）
     * @return array 处理结果
     */
    public function processSummaryWithChat(
        SummaryRequestDTO $summaryRequest,
        MagicUserAuthorization $userAuthorization
    ): array {
        try {
            // 从用户授权信息中获取必要的用户数据
            $userId = $userAuthorization->getId();
            $organizationCode = $userAuthorization->getOrganizationCode();

            // 1. 通过SuperAgent话题ID获取话题实体，再获取对话ID
            $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $summaryRequest->topicId);

            if ($topicEntity === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
            }

            // 验证话题权限
            if ($topicEntity->getUserId() !== $userId) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
            }

            $chatTopicId = $topicEntity->getChatTopicId();
            $conversationId = $this->magicChatDomainService->getConversationIdByTopicId($chatTopicId);

            // 2. 获取并验证任务状态（如果有file_id则跳过此步骤）
            if (! $summaryRequest->hasFileId()) {
                $this->getAndValidateTaskStatus($summaryRequest->taskKey, $userId);
            }

            // 3. 验证项目权限 - 确保项目属于当前用户和组织
            $this->validateProjectAccess($summaryRequest->projectId, $userId, $organizationCode);

            // 4. 查询项目、工作区和话题信息（先查询，后续可判断是否需要更新）
            $projectName = null;
            $workspaceName = null;
            try {
                $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $summaryRequest->projectId);
                if ($projectEntity === null) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
                }
                $projectName = $projectEntity->getProjectName();

                // 查询工作区信息
                $workspaceId = $projectEntity->getWorkspaceId();
                $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($workspaceId);
                $workspaceName = $workspaceEntity?->getName();
            } catch (Throwable $projectError) {
                // 查询失败时记录日志，但不影响主流程
                $this->logger->warning('查询项目或工作区信息失败', [
                    'project_id' => $summaryRequest->projectId,
                    'error' => $projectError->getMessage(),
                ]);
            }

            // 获取话题名称
            $topicName = $topicEntity->getTopicName();

            // 4.5. 检查并更新项目/话题名称（如果为空且有生成的标题）
            // 支持两种场景：场景一（实时录音）和场景二（上传已有文件）
            $generatedTitle = $summaryRequest->generatedTitle;
            if (! empty($generatedTitle)) {
                $needUpdateProject = empty($projectName) || trim($projectName) === '';
                $needUpdateTopic = empty($topicName) || trim($topicName) === '';

                // 只在确实需要更新时才调用更新方法
                if ($needUpdateProject || $needUpdateTopic) {
                    $this->updateEmptyProjectAndTopicNames(
                        $summaryRequest->projectId,
                        (int) $summaryRequest->topicId,
                        $generatedTitle,
                        $userId,
                        $organizationCode
                    );

                    // 更新本地变量，避免再次查询数据库
                    if ($needUpdateProject) {
                        $projectName = $generatedTitle;
                    }
                    if ($needUpdateTopic) {
                        $topicName = $generatedTitle;
                    }
                }
            }

            // 5. 使用协程异步执行录音总结流程（沙箱合并音频并发送总结消息），对外直接返回
            // 协程透传语言和 requestId
            $language = $this->translator->getLocale();
            $requestId = CoContext::getRequestId();
            Coroutine::create(function () use ($summaryRequest, $userAuthorization, $language, $requestId) {
                // 在协程内重新设置语言和 requestId
                $this->translator->setLocale($language);
                CoContext::setRequestId($requestId);
                try {
                    $this->handleAsrSummary($summaryRequest, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
                } catch (Throwable $e) {
                    $this->logger->error('协程执行ASR总结流程失败', [
                        'task_key' => $summaryRequest->taskKey,
                        'error' => $e->getMessage(),
                    ]);
                }
            });

            return [
                'success' => true,
                'task_status' => null,
                'conversation_id' => $conversationId,
                'chat_result' => true,
                'topic_name' => $topicName,
                'project_name' => $projectName,
                'workspace_name' => $workspaceName,
            ];
        } catch (Throwable $e) {
            $this->logger->error('处理ASR总结任务失败', [
                'task_key' => $summaryRequest->taskKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'task_status' => null,
                'conversation_id' => null,
                'chat_result' => ['success' => false, 'message_sent' => false, 'error' => $e->getMessage()],
            ];
        }
    }

    /**
     * 处理ASR总结任务的异步执行流程（支持重复执行）.
     *
     * 流程说明：
     * - 场景一（实时录音）：沙箱合并音频碎片，重命名目录，发送总结消息
     * - 场景二（上传已有文件）：直接发送总结消息
     *
     * @throws Throwable
     */
    public function handleAsrSummary(
        SummaryRequestDTO $summaryRequest,
        string $userId,
        string $organizationCode
    ): void {
        // 1. 根据 SuperAgent 话题获取 Chat 话题及会话
        $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $summaryRequest->topicId);
        if ($topicEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
        }
        $chatTopicId = $topicEntity->getChatTopicId();
        $conversationId = $this->magicChatDomainService->getConversationIdByTopicId($chatTopicId);

        // 2. 任务状态准备
        if ($summaryRequest->hasFileId()) {
            $taskStatus = $this->createVirtualTaskStatusFromFileId($summaryRequest, $userId);
        } else {
            $taskStatus = $this->getAndValidateTaskStatus($summaryRequest->taskKey, $userId);
            $existingWorkspaceFilePath = $taskStatus->filePath;

            // 如果有智能标题，重命名显示目录
            if (! empty($summaryRequest->generatedTitle)) {
                $newDisplayDirectory = $this->renameDisplayDirectory(
                    $taskStatus,
                    $summaryRequest->generatedTitle,
                    $summaryRequest->projectId
                );
                // 更新 taskStatus 中的显示目录路径
                $taskStatus->displayDirectory = $newDisplayDirectory;
            }

            try {
                // 统一使用沙箱合并流程
                $this->updateAudioFromSandbox(
                    $taskStatus,
                    $organizationCode,
                    $summaryRequest->projectId,
                    $userId,
                    $summaryRequest->generatedTitle
                );
            } catch (Throwable $mergeException) {
                // 若上次已生成过工作区文件，则回退到使用已有的工作区文件继续发消息
                if (! empty($existingWorkspaceFilePath)) {
                    $this->logger->warning('沙箱合并失败，回退使用已有工作区文件', [
                        'task_key' => $summaryRequest->taskKey,
                        'file_path' => $existingWorkspaceFilePath,
                        'error' => $mergeException->getMessage(),
                    ]);
                    $taskStatus->filePath = $existingWorkspaceFilePath;
                } else {
                    throw $mergeException;
                }
            }
        }

        // 4. 发送总结消息
        // 注：笔记文件现在由前端直接上传处理，服务端只在生成标题时使用笔记内容
        $processSummaryTaskDTO = new ProcessSummaryTaskDTO(
            $taskStatus,
            $organizationCode,
            $summaryRequest->projectId,
            $userId,
            $summaryRequest->topicId,
            $chatTopicId,
            $conversationId,
            $summaryRequest->modelId
        );

        // 组装用户授权（从用户实体还原）
        $userEntity = $this->magicUserDomainService->getUserById($userId);
        if ($userEntity === null) {
            throw new InvalidArgumentException('用户不存在');
        }
        $userAuthorization = MagicUserAuthorization::fromUserEntity($userEntity);

        $this->sendSummaryChatMessage($processSummaryTaskDTO, $userAuthorization);

        // 6. 保存任务状态
        $this->saveTaskStatusToRedis($taskStatus);
    }

    /**
     * 根据文件ID获取文件实体.
     *
     * @param int $fileId 文件ID
     * @return null|TaskFileEntity 文件实体，不存在时返回null
     */
    public function getFileEntityById(int $fileId): ?TaskFileEntity
    {
        return $this->taskFileDomainService->getById($fileId);
    }

    /**
     * 验证项目权限 - 确保项目属于当前用户和组织.
     *
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @return ProjectEntity 项目实体
     * @throws InvalidArgumentException 当项目不存在或无权限时抛出异常
     */
    public function validateProjectAccess(string $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        try {
            // 获取项目信息
            $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $projectId);
            if ($projectEntity === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
            }
            // 校验项目是否属于当前组织
            if ($projectEntity->getUserOrganizationCode() !== $organizationCode) {
                throw new InvalidArgumentException(trans('asr.api.validation.project_access_denied_organization'));
            }

            // 校验项目是否属于当前用户
            if ($projectEntity->getUserId() === $userId) {
                return $projectEntity;
            }

            // 检查用户是否是项目成员
            if ($this->projectMemberDomainService->isProjectMemberByUser((int) $projectId, $userId)) {
                return $projectEntity;
            }

            // 检查用户所在部门是否有项目权限
            $dataIsolation = DataIsolation::create($organizationCode, $userId);
            $departmentIds = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId, true);

            if (! empty($departmentIds) && $this->projectMemberDomainService->isProjectMemberByDepartments((int) $projectId, $departmentIds)) {
                return $projectEntity;
            }

            // 所有权限检查都失败
            throw new InvalidArgumentException(trans('asr.api.validation.project_access_denied_user'));
        } catch (BusinessException $e) {
            // 处理 ExceptionBuilder::throw 抛出的业务异常
            if ($e->getCode() === SuperAgentErrorCode::PROJECT_NOT_FOUND->value) {
                throw new InvalidArgumentException(trans('asr.api.validation.project_not_found'));
            }

            // 其他业务异常转换为权限验证失败
            throw new InvalidArgumentException(trans('asr.api.validation.project_access_validation_failed', ['error' => $e->getMessage()]));
        } catch (InvalidArgumentException $e) {
            // 重新抛出权限相关异常
            throw $e;
        } catch (Throwable $e) {
            // 其他异常统一处理为权限验证失败
            throw new InvalidArgumentException(trans('asr.api.validation.project_access_validation_failed', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 从Redis获取任务状态
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return AsrTaskStatusDTO 任务状态DTO
     */
    public function getTaskStatusFromRedis(string $taskKey, string $userId): AsrTaskStatusDTO
    {
        $redisKey = sprintf('asr:task:%s', md5(sprintf('%s:%s', $userId, $taskKey)));

        try {
            $taskData = $this->redis->hGetAll($redisKey);

            if (empty($taskData)) {
                return new AsrTaskStatusDTO();
            }

            return AsrTaskStatusDTO::fromArray($taskData);
        } catch (Throwable) {
            return new AsrTaskStatusDTO();
        }
    }

    /**
     * 保存任务状态到Redis.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态DTO
     * @param int $ttl 缓存过期时间（秒)
     */
    public function saveTaskStatusToRedis(AsrTaskStatusDTO $taskStatus, int $ttl = 3600 * 24 * 7): void
    {
        try {
            $redisKey = sprintf('asr:task:%s', md5(sprintf('%s:%s', $taskStatus->userId, $taskStatus->taskKey)));

            // 保存任务状态数据
            $this->redis->hMSet($redisKey, $taskStatus->toArray());

            // 设置过期时间
            $this->redis->expire($redisKey, $ttl);
        } catch (Throwable $e) {
            // Redis操作失败时记录但不抛出异常
            $this->logger->warning(trans('asr.api.redis.save_task_status_failed'), [
                'task_key' => $taskStatus->taskKey ?? 'unknown',
                'user_id' => $taskStatus->userId ?? 'unknown',
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 获取并验证任务状态 - 包含安全检查.
     *
     * @throws InvalidArgumentException
     */
    public function getAndValidateTaskStatus(string $taskKey, string $userId): AsrTaskStatusDTO
    {
        // 从Redis获取任务状态
        $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);

        if ($taskStatus->isEmpty()) {
            throw new InvalidArgumentException(trans('asr.api.validation.upload_audio_first'));
        }

        // 验证用户ID匹配（基本的安全检查）
        if ($taskStatus->userId !== $userId) {
            throw new InvalidArgumentException('任务不属于当前用户');
        }

        return $taskStatus;
    }

    /**
     * 生成ASR目录名（统一的目录名生成规则）.
     *
     * @return string ASR目录名
     */
    public function generateAsrDirectoryName(?string $customTitle = null): string
    {
        $base = $customTitle ?: trans('asr.directory.recordings_summary_folder');
        return sprintf('%s_%s', $base, date('Ymd_His'));
    }

    /**
     * 创建隐藏的临时录音目录（用于存放分片文件）.
     * 目录格式：.asr_recordings/{task_key}.
     *
     * @param string $organizationCode 组织编码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $taskKey 任务键
     * @throws InvalidArgumentException
     */
    public function createTempHiddenDirectory(
        string $organizationCode,
        string $projectId,
        string $userId,
        string $taskKey
    ): AsrRecordingDirectoryDTO {
        try {
            // 1. 确保项目工作区根目录存在
            $rootDirectoryId = $this->ensureWorkspaceRootDirectoryExists($organizationCode, $projectId, $userId);

            // 2. 生成隐藏目录路径
            $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
            $workDir = $projectEntity->getWorkDir();
            $relativePath = sprintf('.asr_recordings/%s', $taskKey);
            $hiddenDirPath = trim(sprintf('%s/%s', $workDir, $relativePath), '/');

            // 3. 检查目录是否已存在
            $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $hiddenDirPath);
            if ($existingDir !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $existingDir->getFileId(),
                    true,
                    AsrDirectoryTypeEnum::ASR_HIDDEN_DIR
                );
            }

            // 4. 创建隐藏目录实体
            $taskFileEntity = AsrDirectoryAssembler::createHiddenDirectoryEntity(
                $userId,
                $organizationCode,
                (int) $projectId,
                $relativePath,
                $hiddenDirPath,
                $rootDirectoryId,
                $taskKey
            );

            // 5. 插入或忽略
            $result = $this->taskFileDomainService->insertOrIgnore($taskFileEntity);
            if ($result !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $result->getFileId(),
                    true,
                    AsrDirectoryTypeEnum::ASR_HIDDEN_DIR
                );
            }

            // 6. 如果插入被忽略，查询现有目录
            $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $hiddenDirPath);
            if ($existingDir !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $existingDir->getFileId(),
                    true,
                    AsrDirectoryTypeEnum::ASR_HIDDEN_DIR
                );
            }

            throw new InvalidArgumentException(sprintf('无法创建隐藏录音目录，项目ID: %s', $projectId));
        } catch (Throwable $e) {
            $this->logger->error('创建隐藏录音目录失败', [
                'project_id' => $projectId,
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            throw new InvalidArgumentException(sprintf('创建隐藏录音目录失败: %s', $e->getMessage()));
        }
    }

    /**
     * 创建显示的录音纪要目录（用于存放流式文本和笔记）.
     * 目录格式：录音纪要_Ymd_His（国际化）.
     *
     * @param string $organizationCode 组织编码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @throws InvalidArgumentException
     */
    public function createDisplayDirectory(
        string $organizationCode,
        string $projectId,
        string $userId
    ): AsrRecordingDirectoryDTO {
        try {
            // 1. 确保项目工作区根目录存在
            $rootDirectoryId = $this->ensureWorkspaceRootDirectoryExists($organizationCode, $projectId, $userId);

            // 2. 生成显示目录名称
            $directoryName = $this->generateAsrDirectoryName();
            $relativePath = $directoryName;  // 显示目录直接用目录名作为相对路径

            // 3. 生成完整路径
            $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
            $workDir = $projectEntity->getWorkDir();
            $displayDirPath = trim(sprintf('%s/%s', $workDir, $directoryName), '/');

            // 4. 创建显示目录实体
            $taskFileEntity = AsrDirectoryAssembler::createDisplayDirectoryEntity(
                $userId,
                $organizationCode,
                (int) $projectId,
                $directoryName,
                $displayDirPath,
                $rootDirectoryId
            );

            // 5. 插入或忽略
            $result = $this->taskFileDomainService->insertOrIgnore($taskFileEntity);
            if ($result !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $result->getFileId(),
                    false,
                    AsrDirectoryTypeEnum::ASR_DISPLAY_DIR
                );
            }

            // 6. 如果插入被忽略，查询现有目录
            $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $displayDirPath);
            if ($existingDir !== null) {
                return new AsrRecordingDirectoryDTO(
                    $relativePath,
                    $existingDir->getFileId(),
                    false,
                    AsrDirectoryTypeEnum::ASR_DISPLAY_DIR
                );
            }

            throw new InvalidArgumentException(sprintf('无法创建显示录音目录，项目ID: %s', $projectId));
        } catch (Throwable $e) {
            $this->logger->error('创建显示录音目录失败', [
                'project_id' => $projectId,
                'error' => $e->getMessage(),
            ]);
            throw new InvalidArgumentException(sprintf('创建显示录音目录失败: %s', $e->getMessage()));
        }
    }

    /**
     * 准备录音所需的目录结构.
     *
     * @param string $organizationCode 组织编码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $taskKey 任务键
     * @return AsrRecordingDirectoryDTO[] 返回包含两个目录的数组 [隐藏目录DTO, 显示目录DTO]
     */
    public function prepareRecordingDirectories(
        string $organizationCode,
        string $projectId,
        string $userId,
        string $taskKey
    ): array {
        $hiddenDir = $this->createTempHiddenDirectory($organizationCode, $projectId, $userId, $taskKey);
        $displayDir = $this->createDisplayDirectory($organizationCode, $projectId, $userId);

        return [$hiddenDir, $displayDir];
    }

    /**
     * 从话题获取项目ID（包含话题归属验证）.
     *
     * @param int $topicId 话题ID
     * @param string $userId 用户ID
     * @return string 项目ID
     * @throws InvalidArgumentException 当话题不存在或不属于当前用户时
     */
    public function getProjectIdFromTopic(int $topicId, string $userId): string
    {
        // 1. 验证话题归属
        $topicEntity = $this->superAgentTopicDomainService->getTopicById($topicId);
        if ($topicEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
        }

        // 2. 验证话题属于当前用户
        if ($topicEntity->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
        }

        // 3. 返回项目ID
        return (string) $topicEntity->getProjectId();
    }

    /**
     * 验证话题并准备录音目录.
     *
     * @param string $topicId 话题ID
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @param string $taskKey 任务键
     * @return AsrRecordingDirectoryDTO[] 返回包含两个目录的数组
     * @throws InvalidArgumentException
     */
    public function validateTopicAndPrepareDirectories(
        string $topicId,
        string $projectId,
        string $userId,
        string $organizationCode,
        string $taskKey
    ): array {
        // 1. 验证话题归属
        $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $topicId);
        if ($topicEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
        }

        // 2. 验证话题属于当前用户
        if ($topicEntity->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
        }

        // 3. 验证项目权限
        $this->validateProjectAccess($projectId, $userId, $organizationCode);

        // 4. 准备录音目录
        return $this->prepareRecordingDirectories(
            $organizationCode,
            $projectId,
            $userId,
            $taskKey
        );
    }

    /**
     * 处理录音状态上报.
     *
     * @param string $taskKey 任务键
     * @param AsrRecordingStatusEnum $status 录音状态枚举
     * @param string $modelId 模型ID
     * @param string $asrStreamContent ASR流式识别内容
     * @param null|string $noteContent 笔记内容
     * @param null|string $noteFileType 笔记文件类型
     * @param string $language 语种（zh_CN、en_US等）
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @return bool 处理是否成功
     * @throws InvalidArgumentException
     */
    public function handleStatusReport(
        string $taskKey,
        AsrRecordingStatusEnum $status,
        string $modelId,
        string $asrStreamContent,
        ?string $noteContent,
        ?string $noteFileType,
        string $language,
        string $userId,
        string $organizationCode
    ): bool {
        $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);

        if ($taskStatus->isEmpty()) {
            throw new InvalidArgumentException('任务不存在，请先调用 getUploadToken');
        }

        // 保存 model_id
        if (! empty($modelId)) {
            $taskStatus->modelId = $modelId;
        }

        // 保存 ASR 流式内容（用于生成标题）
        if (! empty($asrStreamContent)) {
            // 限制内容长度
            $maxLength = 10000;
            if (mb_strlen($asrStreamContent) > $maxLength) {
                $asrStreamContent = mb_substr($asrStreamContent, 0, $maxLength);
            }
            $taskStatus->asrStreamContent = $asrStreamContent;
        }

        // 保存笔记内容（用于生成标题）
        if (! empty($noteContent)) {
            // 限制内容长度
            $maxLength = 25000;
            if (mb_strlen($noteContent) > $maxLength) {
                $noteContent = mb_substr($noteContent, 0, $maxLength);
            }
            $taskStatus->noteContent = $noteContent;
            $taskStatus->noteFileType = $noteFileType ?? 'md';
        }

        // 保存语种（用于生成标题时使用正确的语言）
        if (! empty($language)) {
            $taskStatus->language = $language;
        }

        // 根据状态处理（使用枚举）
        return match ($status) {
            AsrRecordingStatusEnum::START => $this->handleStartRecording($taskStatus, $userId, $organizationCode),
            AsrRecordingStatusEnum::RECORDING => $this->handleRecordingHeartbeat($taskStatus),
            AsrRecordingStatusEnum::PAUSED => $this->handlePauseRecording($taskStatus),
            AsrRecordingStatusEnum::STOPPED => $this->handleStopRecording($taskStatus, $userId, $organizationCode),
        };
    }

    /**
     * 获取项目的 workspace 路径（供 API 层使用）.
     *
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return string workspace 路径
     */
    public function getWorkspacePathForProject(string $projectId, string $userId): string
    {
        return $this->getWorkspacePath($projectId, $userId);
    }

    /**
     * 确保工作区根目录存在，如果不存在则创建.
     *
     * 使用TaskFileDomainService的findOrCreateProjectRootDirectory方法
     * 获取项目实际的根目录ID，确保层级关系正确
     *
     * @param string $organizationCode 组织代码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return int 项目工作区根目录的实际file_id
     */
    private function ensureWorkspaceRootDirectoryExists(string $organizationCode, string $projectId, string $userId): int
    {
        // 获取项目实体以获取workDir
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        $workDir = $projectEntity->getWorkDir();

        if (empty($workDir)) {
            throw new InvalidArgumentException(sprintf('项目 %s 的工作区目录为空', $projectId));
        }

        // 使用TaskFileDomainService查找或创建项目根目录
        // 使用默认的 TaskFileSource::PROJECT_DIRECTORY
        return $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            (int) $projectId,
            $workDir,
            $userId,
            $organizationCode
        );
    }

    /**
     * 调用沙箱处理音频合并并创建工作区文件记录.
     *
     * 沙箱负责：
     * - 合并隐藏目录中的音频碎片
     * - 根据实际格式添加音频扩展名（webm/mp3/m4a/wav等）
     * - 将合并后的文件移动到显示目录
     * - 生成笔记文件（如果有笔记内容）
     *
     * 本方法负责：
     * - 准备沙箱ID和文件标题
     * - 调用沙箱finish接口并轮询等待完成
     * - 在数据库中创建文件记录
     * - 更新任务状态
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $organizationCode 组织编码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param null|string $customTitle 自定义标题
     * @throws InvalidArgumentException
     */
    private function updateAudioFromSandbox(
        AsrTaskStatusDTO $taskStatus,
        string $organizationCode,
        string $projectId,
        string $userId,
        ?string $customTitle = null
    ): void {
        try {
            $this->logger->info('开始沙箱音频处理流程', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $projectId,
                'hidden_directory' => $taskStatus->tempHiddenDirectory,
                'display_directory' => $taskStatus->displayDirectory,
            ]);

            // 1. 准备沙箱ID（如果已有则使用，否则生成新的）
            $sandboxId = $taskStatus->sandboxId;
            if (empty($sandboxId)) {
                $sandboxId = WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId(
                    $projectId . '_asr_recording',
                    12  // 使用12位以降低碰撞概率
                );
                $taskStatus->sandboxId = $sandboxId;

                $this->logger->info('生成ASR录音沙箱ID', [
                    'task_key' => $taskStatus->taskKey,
                    'project_id' => $projectId,
                    'sandbox_id' => $sandboxId,
                ]);
            }

            // 2. 准备文件标题（不含扩展名）
            //    沙箱会根据实际音频格式（webm/mp3/m4a/wav等）添加相应扩展名
            $safeTitle = $this->sanitizeTitleForPath($customTitle ?? '');
            $fileTitle = $safeTitle !== '' ? $safeTitle : trans('asr.file_names.original_recording');

            // 3. 合并音频并更新任务状态
            //    传入不含扩展名的标题，扩展名由沙箱根据实际音频格式添加
            $this->mergeAudioAndUpdateTaskStatus($taskStatus, $fileTitle, $organizationCode);

            $this->logger->info('沙箱音频处理完成', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $sandboxId,
                'file_id' => $taskStatus->audioFileId,
                'file_path' => $taskStatus->filePath,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('沙箱音频处理失败', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $projectId,
                'error' => $e->getMessage(),
                'user_id' => $userId,
                'trace' => $e->getTraceAsString(),
            ]);
            throw new InvalidArgumentException(sprintf('沙箱音频处理失败: %s', $e->getMessage()));
        }
    }

    /**
     * 调用沙箱合并音频并更新任务状态.
     *
     * 该方法协调沙箱音频合并流程：
     * 1. 调用沙箱finish接口，传入不含扩展名的文件标题
     * 2. 轮询等待沙箱完成合并，沙箱会根据实际音频格式添加扩展名
     * 3. 从沙箱响应中获取实际文件名（含扩展名）
     * 4. 在数据库中创建文件记录
     * 5. 更新任务状态为已完成
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $fileTitle 文件标题（不含扩展名），沙箱会自动添加
     * @param string $organizationCode 组织编码
     * @throws InvalidArgumentException
     */
    private function mergeAudioAndUpdateTaskStatus(
        AsrTaskStatusDTO $taskStatus,
        string $fileTitle,
        string $organizationCode
    ): void {
        // 1. 传递文件标题（不含扩展名），实际扩展名由沙箱根据音频格式决定
        //    支持的格式：webm、mp3、m4a、wav 等

        // 2. 调用沙箱 finish 并轮询等待完成，沙箱会返回实际的文件路径（含扩展名）
        $mergeResult = $this->callSandboxFinishAndWait($taskStatus, $fileTitle);

        // 3. 从沙箱返回的文件路径中提取实际的文件名（含沙箱添加的扩展名）
        $actualFileName = basename($mergeResult->filePath);

        $this->logger->info('沙箱返回的文件信息', [
            'task_key' => $taskStatus->taskKey,
            'sandbox_file_path' => $mergeResult->filePath,
            'actual_file_name' => $actualFileName,  // 含扩展名（沙箱添加）
            'input_file_title' => $fileTitle,       // 不含扩展名
        ]);

        // 4. 创建文件记录（从隐藏目录到显示目录），使用沙箱返回的实际文件名
        $audioFileEntity = $this->createAudioFileRecordFromSandbox(
            $taskStatus,
            $mergeResult,
            $actualFileName,
            $organizationCode
        );

        // 5. 更新任务状态
        $taskStatus->audioFileId = (string) $audioFileEntity->getFileId();
        $taskStatus->filePath = $this->chatMessageAssembler->extractWorkspaceRelativePath(
            $audioFileEntity->getFileKey()
        );

        // 6. 标记任务已完成
        $taskStatus->updateStatus(AsrTaskStatusEnum::COMPLETED);
    }

    /**
     * 根据沙箱合并结果在数据库中创建音频文件记录.
     *
     * 注意：
     * - 本方法仅在数据库中创建文件记录（task_files表）
     * - 实际的文件合并和移动操作由沙箱完成
     * - 文件最终位置：显示目录（用户可见）
     * - 文件来源：隐藏目录中的音频碎片（沙箱合并）
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param AsrSandboxMergeResultDTO $mergeResult 沙箱合并结果
     * @param string $fileName 目标文件名
     * @param string $organizationCode 组织编码
     * @throws InvalidArgumentException
     */
    private function createAudioFileRecordFromSandbox(
        AsrTaskStatusDTO $taskStatus,
        AsrSandboxMergeResultDTO $mergeResult,
        string $fileName,
        string $organizationCode
    ): TaskFileEntity {
        // 1. 验证必要信息
        $displayDirectoryId = $taskStatus->displayDirectoryId;
        if ($displayDirectoryId === null) {
            throw new InvalidArgumentException('显示目录ID不存在，无法创建文件记录');
        }

        $relativeDisplayDir = $taskStatus->displayDirectory;
        if (empty($relativeDisplayDir)) {
            throw new InvalidArgumentException('显示目录路径不存在，无法创建文件记录');
        }

        $userId = $taskStatus->userId;
        $projectId = $taskStatus->projectId;

        // 2. 构建显示目录中的文件路径（需要完整路径）
        $fullDisplayPath = $this->getFullPath(
            $projectId,
            $userId,
            $relativeDisplayDir
        );
        $fileKey = rtrim($fullDisplayPath, '/') . '/' . $fileName;

        $this->logger->info('创建沙箱音频文件记录', [
            'task_key' => $taskStatus->taskKey,
            'source_path' => $mergeResult->filePath,
            'target_path' => $fileKey,
            'parent_id' => $displayDirectoryId,
            'duration' => $mergeResult->duration,
            'file_size' => $mergeResult->fileSize,
        ]);

        // 3. 创建文件实体
        $metadata = [
            'asr_task' => true,
            'created_by' => 'asr_sandbox_summary',
            'created_at' => date('Y-m-d H:i:s'),
            'sandbox_merge' => true,
            'source_file' => $mergeResult->filePath, // 记录源文件路径（隐藏目录）
        ];

        // 如果有时长信息，添加到 metadata
        if ($mergeResult->duration !== null) {
            $metadata['duration'] = $mergeResult->duration;
        }

        $taskFileEntity = new TaskFileEntity([
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'project_id' => (int) $projectId,
            'topic_id' => 0,
            'task_id' => 0,
            'file_type' => 'user_upload',
            'file_name' => $fileName,
            'file_extension' => pathinfo($fileName, PATHINFO_EXTENSION),
            'file_key' => $fileKey,
            'file_size' => $mergeResult->fileSize ?? 0,
            'external_url' => '',
            'storage_type' => 'workspace',
            'is_hidden' => false,
            'is_directory' => false,
            'sort' => 0,
            'parent_id' => $displayDirectoryId, // 父目录为显示目录
            'source' => 2, // 2-项目目录
            'metadata' => Json::encode($metadata),
        ]);

        // 4. 插入或查询现有记录
        try {
            $result = $this->taskFileDomainService->insertOrIgnore($taskFileEntity);
            if ($result !== null) {
                return $result;
            }

            // 如果插入被忽略，查询现有记录
            $existingFile = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $fileKey);
            if ($existingFile !== null) {
                $this->logger->info('文件记录已存在，使用现有记录', [
                    'task_key' => $taskStatus->taskKey,
                    'file_id' => $existingFile->getFileId(),
                    'file_key' => $fileKey,
                ]);
                return $existingFile;
            }

            throw new InvalidArgumentException('创建文件记录失败且无法查询到现有记录');
        } catch (Throwable $e) {
            $this->logger->error('创建沙箱音频文件记录失败', [
                'task_key' => $taskStatus->taskKey,
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
            ]);
            throw new InvalidArgumentException(sprintf('创建文件记录失败: %s', $e->getMessage()));
        }
    }

    /**
     * 用于生成安全的目录/文件名片段。
     */
    private function sanitizeTitleForPath(string $title): string
    {
        $title = trim($title);
        if ($title === '') {
            return '';
        }
        $title = preg_replace('/[\\\\\/\:\*\?\"\<\>\|]/u', '', $title) ?? '';
        $title = preg_replace('/\s+/u', ' ', $title) ?? '';
        if (mb_strlen($title) > 50) {
            $title = mb_substr($title, 0, 50);
        }
        return $title;
    }

    /**
     * 从已上传文件ID创建虚拟任务状态（场景二：直接总结已有音频文件）.
     *
     * 使用场景：
     * - 场景一（实时录音）：任务状态存储在Redis中，通过 getTaskStatusFromRedis() 获取
     * - 场景二（上传已有文件）：从数据库文件记录临时构建虚拟任务状态（本方法）
     *
     * 虚拟状态说明：
     * - 不从Redis读取，而是从数据库文件记录即时构建
     * - 目的是统一两种场景的后续处理流程（发送聊天消息等）
     * - 直接标记为COMPLETED状态，跳过沙箱合并流程
     *
     * @param SummaryRequestDTO $summaryRequest 总结请求DTO（必须包含file_id）
     * @param string $userId 用户ID
     * @return AsrTaskStatusDTO 虚拟任务状态DTO
     * @throws InvalidArgumentException 当文件不存在或不属于当前项目时
     */
    private function createVirtualTaskStatusFromFileId(SummaryRequestDTO $summaryRequest, string $userId): AsrTaskStatusDTO
    {
        $fileId = $summaryRequest->fileId;

        // 根据文件ID查询文件信息
        $fileEntity = $this->taskFileDomainService->getById((int) $fileId);

        if ($fileEntity === null) {
            throw new InvalidArgumentException(sprintf(
                '根据文件ID未找到文件记录。file_id: %s, task_key: %s, project_id: %s',
                $fileId,
                $summaryRequest->taskKey,
                $summaryRequest->projectId
            ));
        }

        // 验证文件属于当前项目
        if ((string) $fileEntity->getProjectId() !== $summaryRequest->projectId) {
            throw new InvalidArgumentException(sprintf(
                '文件不属于当前项目。file_id: %s, file_project_id: %s, request_project_id: %s',
                $fileId,
                $fileEntity->getProjectId(),
                $summaryRequest->projectId
            ));
        }

        // 提取工作区相对路径
        $workspaceRelativePath = $this->chatMessageAssembler->extractWorkspaceRelativePath($fileEntity->getFileKey());

        // 创建虚拟任务状态，用于构建聊天消息
        return new AsrTaskStatusDTO([
            'task_key' => $summaryRequest->taskKey,
            'user_id' => $userId,
            'status' => AsrTaskStatusEnum::COMPLETED->value,
            'file_path' => $workspaceRelativePath,
            'audio_file_id' => $fileId,
        ]);
    }

    /**
     * 根据taskStatus构建文件数据（从数据库查询）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $projectId 项目ID
     * @return array 文件数据数组
     * @throws InvalidArgumentException 当找不到文件时
     */
    private function buildFileDataFromTaskStatus(AsrTaskStatusDTO $taskStatus, string $projectId): array
    {
        // 获取文件ID
        $fileId = $taskStatus->audioFileId;
        $fileType = '音频文件';

        if (empty($fileId)) {
            throw new InvalidArgumentException(sprintf(
                '%s ID为空，无法构建文件数据。task_key: %s, project_id: %s',
                $fileType,
                $taskStatus->taskKey,
                $projectId
            ));
        }

        // 根据文件ID查询数据库
        $fileEntity = $this->taskFileDomainService->getById((int) $fileId);

        if ($fileEntity === null) {
            throw new InvalidArgumentException(sprintf(
                '根据文件ID未找到%s记录。file_id: %s, task_key: %s, project_id: %s',
                $fileType,
                $fileId,
                $taskStatus->taskKey,
                $projectId
            ));
        }

        // 提取工作区相对路径
        $workspaceRelativePath = $this->chatMessageAssembler->extractWorkspaceRelativePath($fileEntity->getFileKey());

        return [
            'file_id' => (string) $fileEntity->getFileId(),
            'file_name' => $fileEntity->getFileName(),
            'file_path' => $workspaceRelativePath,
            'file_extension' => $fileEntity->getFileExtension(),
            'file_size' => $fileEntity->getFileSize(),
        ];
    }

    /**
     * 发送总结聊天消息.
     *
     * @param ProcessSummaryTaskDTO $dto 处理总结任务DTO
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     */
    private function sendSummaryChatMessage(ProcessSummaryTaskDTO $dto, MagicUserAuthorization $userAuthorization): void
    {
        try {
            // 1. 查询音频文件数据
            $audioFileData = $this->buildFileDataFromTaskStatus($dto->taskStatus, $dto->projectId);

            // 2. 构建聊天请求（笔记文件由前端处理，不再由服务端上传和引用）
            $chatRequest = $this->chatMessageAssembler->buildSummaryMessage($dto, $audioFileData);

            // 4. 检查话题状态，决定是直接发送消息还是写入队列
            $shouldQueueMessage = $this->shouldQueueMessage($dto->topicId);
            if ($shouldQueueMessage) {
                // 话题状态为waiting或running，将消息写入队列
                $this->queueChatMessage($dto, $chatRequest, $userAuthorization);
            } else {
                // 话题状态不是waiting/running，直接发送聊天消息
                $this->magicChatMessageAppService->onChatMessage($chatRequest, $userAuthorization);
            }
        } catch (Throwable $e) {
            $this->logger->error('发送聊天消息失败', [
                'task_key' => $dto->taskStatus->taskKey,
                'conversation_id' => $dto->conversationId,
                'topic_id' => $dto->topicId, // SuperAgent话题ID
                'chat_topic_id' => $dto->chatTopicId, // Chat话题ID
                'error' => $e->getMessage(),
                'user_id' => $dto->userId,
            ]);
            return;
        }
    }

    /**
     * 检查是否应该将消息写入队列.
     *
     * 当话题状态为WAITING或RUNNING时，消息需要写入队列处理
     *
     * @param string $topicId 话题ID
     * @return bool 是否应该队列处理
     * @throws InvalidArgumentException 当找不到话题时
     */
    private function shouldQueueMessage(string $topicId): bool
    {
        // 创建数据隔离对象
        // 通过SuperAgent话题ID获取话题实体
        $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $topicId);

        if ($topicEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
        }

        // 检查话题的当前任务状态是否为 running（需要队列处理）
        $currentStatus = $topicEntity->getCurrentTaskStatus();
        return $currentStatus !== null && ($currentStatus === SuperAgentTaskStatus::RUNNING);
    }

    /**
     * 将聊天消息写入消息队列.
     *
     * @param ProcessSummaryTaskDTO $dto 处理总结任务DTO
     * @param ChatRequest $chatRequest 聊天请求对象（在队列情况下不使用，保留参数用于兼容）
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     */
    private function queueChatMessage(ProcessSummaryTaskDTO $dto, ChatRequest $chatRequest, MagicUserAuthorization $userAuthorization): void
    {
        // 创建数据隔离对象
        $dataIsolation = DataIsolation::create(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );

        // 通过SuperAgent话题ID获取话题实体
        $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $dto->topicId);
        if ($topicEntity === null) {
            throw new InvalidArgumentException(sprintf('未找到话题ID: %s', $dto->topicId));
        }
        $messageContent = $chatRequest->getData()->getMessage()->getMagicMessage()->toArray();
        // 写入消息队列
        $this->messageQueueDomainService->createMessage(
            $dataIsolation,
            (int) $dto->projectId, // 转换为int类型
            $topicEntity->getId(), // 使用SuperAgent话题的数据库ID
            $messageContent,
            ChatMessageType::RichText // ASR总结消息使用富文本类型
        );
    }

    /**
     * 检查并更新项目/话题名称（如果为空且有生成的标题）.
     *
     * @param string $projectId 项目ID
     * @param int $topicId 话题ID
     * @param string $generatedTitle 生成的标题
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     */
    private function updateEmptyProjectAndTopicNames(
        string $projectId,
        int $topicId,
        string $generatedTitle,
        string $userId,
        string $organizationCode
    ): void {
        try {
            // 1. 检查项目名称是否为空
            $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
            if (empty($projectEntity->getProjectName()) || trim($projectEntity->getProjectName()) === '') {
                $projectEntity->setProjectName($generatedTitle);
                $projectEntity->setUpdatedUid($userId);
                $this->projectDomainService->saveProjectEntity($projectEntity);
            }

            // 2. 检查话题名称是否为空
            $topicEntity = $this->superAgentTopicDomainService->getTopicById($topicId);
            if ($topicEntity && (empty($topicEntity->getTopicName()) || trim($topicEntity->getTopicName()) === '')) {
                // 创建数据隔离对象
                $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);
                $this->superAgentTopicDomainService->updateTopic($dataIsolation, $topicId, $generatedTitle);
            }

            return;
        } catch (Throwable $e) {
            $this->logger->warning(sprintf(
                '[AsrFileAppService][updateEmptyProjectAndTopicNames] 更新项目/话题名称失败: %s',
                $e->getMessage()
            ));
            return;
        }
    }

    /**
     * 处理开始录音.
     * @return bool 处理是否成功
     */
    private function handleStartRecording(
        AsrTaskStatusDTO $taskStatus,
        string $userId,
        string $organizationCode
    ): bool {
        // 如果沙箱任务未创建，则创建
        if (! $taskStatus->sandboxTaskCreated) {
            // 生成沙箱ID
            $sandboxId = WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId(
                $taskStatus->projectId . '_asr_recording',
                12
            );
            $taskStatus->sandboxId = $sandboxId;

            // 设置用户上下文
            $this->sandboxGateway->setUserContext($userId, $organizationCode);

            // 确保沙箱可用
            $actualSandboxId = $this->sandboxGateway->ensureSandboxAvailable(
                $sandboxId,
                $taskStatus->projectId,
                ''
            );

            $this->logger->info('ASR 录音：沙箱已就绪', [
                'task_key' => $taskStatus->taskKey,
                'requested_sandbox_id' => $sandboxId,
                'actual_sandbox_id' => $actualSandboxId,
            ]);

            // 调用沙箱启动任务（需要完整路径）
            $fullHiddenPath = $this->getFullPath(
                $taskStatus->projectId,
                $userId,
                $taskStatus->tempHiddenDirectory
            );
            $response = $this->asrRecorder->startTask(
                $actualSandboxId,
                $taskStatus->taskKey,
                $fullHiddenPath,
            );

            if (! $response->isSuccess()) {
                throw new InvalidArgumentException('创建沙箱任务失败: ' . $response->getMessage());
            }

            $taskStatus->sandboxTaskCreated = true;

            $this->logger->info('ASR 录音：沙箱任务已创建', [
                'task_key' => $taskStatus->taskKey,
                'sandbox_id' => $actualSandboxId,
                'status' => $response->getStatus(),
            ]);
        }

        // 更新状态和心跳
        $taskStatus->recordingStatus = 'start';
        $taskStatus->isPaused = false;
        $this->saveTaskStatusToRedis($taskStatus);

        // 设置 Redis 心跳 key（TTL 5分钟）
        $this->setHeartbeatKey($taskStatus->taskKey, $taskStatus->userId);

        return true;
    }

    /**
     * 处理录音心跳.
     * @return bool 处理是否成功
     */
    private function handleRecordingHeartbeat(AsrTaskStatusDTO $taskStatus): bool
    {
        $taskStatus->recordingStatus = 'recording';
        $this->saveTaskStatusToRedis($taskStatus);

        $this->setHeartbeatKey($taskStatus->taskKey, $taskStatus->userId);

        return true;
    }

    /**
     * 处理暂停录音.
     * @return bool 处理是否成功
     */
    private function handlePauseRecording(AsrTaskStatusDTO $taskStatus): bool
    {
        $taskStatus->recordingStatus = 'paused';
        $taskStatus->isPaused = true;
        $this->saveTaskStatusToRedis($taskStatus);

        // 删除心跳 key，停止超时检测
        $this->deleteHeartbeatKey($taskStatus->taskKey, $taskStatus->userId);

        return true;
    }

    /**
     * 处理终止录音.
     * @return bool 处理是否成功
     */
    private function handleStopRecording(
        AsrTaskStatusDTO $taskStatus,
        string $userId,
        string $organizationCode
    ): bool {
        $taskStatus->recordingStatus = 'stopped';
        $this->saveTaskStatusToRedis($taskStatus);

        $this->deleteHeartbeatKey($taskStatus->taskKey, $taskStatus->userId);

        // 异步发起自动总结
        $language = $this->translator->getLocale();
        $requestId = CoContext::getRequestId();

        Coroutine::create(function () use ($taskStatus, $userId, $organizationCode, $language, $requestId) {
            $this->translator->setLocale($language);
            CoContext::setRequestId($requestId);
            $this->autoTriggerSummary($taskStatus, $userId, $organizationCode);
        });

        return true;
    }

    /**
     * 获取心跳 Key.
     */
    private function getHeartbeatKey(string $taskKey, string $userId): string
    {
        return sprintf('asr:heartbeat:%s', md5($userId . ':' . $taskKey));
    }

    /**
     * 设置心跳 Key.
     */
    private function setHeartbeatKey(string $taskKey, string $userId): void
    {
        $key = $this->getHeartbeatKey($taskKey, $userId);
        $ttl = 5 * 60; // 5分钟
        $this->redis->setex($key, $ttl, (string) time());
    }

    /**
     * 删除心跳 Key.
     */
    private function deleteHeartbeatKey(string $taskKey, string $userId): void
    {
        $key = $this->getHeartbeatKey($taskKey, $userId);
        $this->redis->del($key);
    }

    /**
     * 自动触发总结.
     */
    private function autoTriggerSummary(
        AsrTaskStatusDTO $taskStatus,
        string $userId,
        string $organizationCode
    ): void {
        try {
            $this->logger->info('开始自动总结', [
                'task_key' => $taskStatus->taskKey,
                'project_id' => $taskStatus->projectId,
            ]);

            // 生成文件标题（使用保存的 ASR 内容和笔记内容）
            // 不含扩展名，扩展名由沙箱根据实际音频格式添加
            $fileTitle = $this->generateTitleFromTaskStatus($taskStatus);

            // 如果生成了标题，重命名显示目录
            if (! empty($fileTitle)) {
                $newDisplayDirectory = $this->renameDisplayDirectory(
                    $taskStatus,
                    $fileTitle,
                    $taskStatus->projectId
                );
                // 更新 taskStatus 中的显示目录路径
                $taskStatus->displayDirectory = $newDisplayDirectory;
            }

            // 合并音频并更新任务状态
            // 传入不含扩展名的标题，沙箱会根据实际音频格式添加相应扩展名
            $this->mergeAudioAndUpdateTaskStatus($taskStatus, $fileTitle, $organizationCode);

            // 保存任务状态到 Redis
            $this->saveTaskStatusToRedis($taskStatus);

            // 发送聊天消息
            $this->sendAutoSummaryChatMessage($taskStatus, $userId, $organizationCode);
        } catch (Throwable $e) {
            $this->logger->error('自动总结失败', [
                'task_key' => $taskStatus->taskKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 调用沙箱 finish 并轮询等待完成.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $fileTitle 文件标题（不含扩展名），沙箱会根据实际音频格式添加扩展名
     */
    private function callSandboxFinishAndWait(
        AsrTaskStatusDTO $taskStatus,
        string $fileTitle
    ): AsrSandboxMergeResultDTO {
        $sandboxId = $taskStatus->sandboxId;

        if (empty($sandboxId)) {
            throw new InvalidArgumentException('沙箱ID不存在，无法完成录音任务');
        }

        // 准备笔记信息（如果有）
        $noteFilename = null;
        $noteContent = null;
        if (! empty($taskStatus->noteContent)) {
            // fileTitle 是不含扩展名的标题，直接使用
            // 创建 NoteDTO 并生成笔记文件名（格式：{title}-笔记.{ext}）
            $noteDTO = new NoteDTO(
                $taskStatus->noteContent,
                $taskStatus->noteFileType ?? 'md'
            );
            $noteFilename = $noteDTO->generateFileName($fileTitle);
            $noteContent = $taskStatus->noteContent;

            $this->logger->info('准备传递笔记到沙箱', [
                'task_key' => $taskStatus->taskKey,
                'audio_title' => $fileTitle,  // 不含扩展名
                'note_filename' => $noteFilename,
                'note_length' => mb_strlen($noteContent),
            ]);
        }

        // 首次调用 finish，传递不含扩展名的标题
        // 沙箱会根据实际音频格式（webm/mp3/m4a/wav等）添加相应扩展名
        // 需要传递完整路径给沙箱
        $fullDisplayPath = $this->getFullPath(
            $taskStatus->projectId,
            $taskStatus->userId,
            $taskStatus->displayDirectory
        );
        $fullHiddenPath = $this->getFullPath(
            $taskStatus->projectId,
            $taskStatus->userId,
            $taskStatus->tempHiddenDirectory
        );
        $response = $this->asrRecorder->finishTask(
            $sandboxId,
            $taskStatus->taskKey,
            $fullDisplayPath,
            $fileTitle,  // 不含扩展名
            $fullHiddenPath,
            '.workspace',
            $noteFilename,
            $noteContent
        );

        // 轮询等待完成
        $maxAttempts = 60;
        $interval = 1;

        for ($attempt = 1; $attempt <= $maxAttempts; ++$attempt) {
            $status = $response->getStatus();

            if ($status === 'finished') {
                $this->logger->info('沙箱音频合并完成', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $sandboxId,
                    'attempt' => $attempt,
                    'file_path' => $response->getFilePath(),
                ]);

                return AsrSandboxMergeResultDTO::fromSandboxResponse([
                    'status' => 'finished',
                    'file_path' => $response->getFilePath(),
                    'duration' => $response->getDuration(),
                    'file_size' => $response->getFileSize(),
                ]);
            }

            if ($status === 'error') {
                throw new InvalidArgumentException('沙箱合并失败: ' . $response->getErrorMessage());
            }

            // 记录进度（每10次）
            if ($attempt % 10 === 0) {
                $this->logger->info('等待沙箱音频合并', [
                    'task_key' => $taskStatus->taskKey,
                    'sandbox_id' => $sandboxId,
                    'attempt' => $attempt,
                    'status' => $status,
                ]);
            }

            sleep($interval);

            // 继续轮询（传递不含扩展名的标题和完整路径）
            $response = $this->asrRecorder->finishTask(
                $sandboxId,
                $taskStatus->taskKey,
                $fullDisplayPath,
                $fileTitle,  // 不含扩展名
                $fullHiddenPath,
                '.workspace',
                $noteFilename,
                $noteContent
            );
        }

        throw new InvalidArgumentException('沙箱合并超时');
    }

    /**
     * 重命名显示目录（使用智能标题）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @param string $intelligentTitle 智能生成的标题
     * @param string $projectId 项目ID
     * @return string 新的相对路径
     */
    private function renameDisplayDirectory(
        AsrTaskStatusDTO $taskStatus,
        string $intelligentTitle,
        string $projectId
    ): string {
        // 1. 获取原显示目录信息（相对路径）
        $relativeOldPath = $taskStatus->displayDirectory;
        $oldDirectoryId = $taskStatus->displayDirectoryId;

        if (empty($relativeOldPath) || $oldDirectoryId === null) {
            $this->logger->warning('显示目录信息不完整，跳过重命名', [
                'task_key' => $taskStatus->taskKey,
                'old_path' => $relativeOldPath,
                'old_id' => $oldDirectoryId,
            ]);
            return $relativeOldPath;
        }

        // 2. 提取原目录名并获取时间戳
        $oldDirectoryName = basename($relativeOldPath);
        // 从 "录音总结_20251026_210626" 中提取时间戳 "_20251026_210626"
        if (preg_match('/_(\d{8}_\d{6})$/', $oldDirectoryName, $matches)) {
            $timestamp = '_' . $matches[1];
        } else {
            // 如果没有匹配到时间戳，使用当前时间
            $timestamp = '_' . date('Ymd_His');
            $this->logger->info('未找到原时间戳，使用当前时间', [
                'task_key' => $taskStatus->taskKey,
                'old_directory_name' => $oldDirectoryName,
            ]);
        }

        // 3. 构建新目录名（智能标题 + 原时间戳）
        $safeTitle = $this->sanitizeTitleForPath($intelligentTitle);
        if (empty($safeTitle)) {
            $this->logger->warning('智能标题为空，跳过重命名', [
                'task_key' => $taskStatus->taskKey,
                'intelligent_title' => $intelligentTitle,
            ]);
            return $relativeOldPath;
        }
        $newDirectoryName = $safeTitle . $timestamp;
        $newRelativePath = $newDirectoryName;  // 新的相对路径

        // 4. 构建新旧完整路径（用于数据库操作）
        $fullOldPath = $this->getFullPath(
            $projectId,
            $taskStatus->userId,
            $relativeOldPath
        );
        $fullNewPath = $this->getFullPath(
            $projectId,
            $taskStatus->userId,
            $newRelativePath
        );

        // 如果新旧路径相同，无需重命名
        if ($newRelativePath === $relativeOldPath) {
            $this->logger->info('新旧目录路径相同，无需重命名', [
                'task_key' => $taskStatus->taskKey,
                'directory_path' => $newRelativePath,
            ]);
            return $relativeOldPath;
        }

        // 5. 更新 task_files 表中的目录记录
        try {
            $dirEntity = $this->taskFileDomainService->getById($oldDirectoryId);
            if ($dirEntity === null) {
                $this->logger->error('目录记录不存在', [
                    'task_key' => $taskStatus->taskKey,
                    'directory_id' => $oldDirectoryId,
                ]);
                return $relativeOldPath;
            }

            // 更新数据库时使用完整路径
            $dirEntity->setFileName($newDirectoryName);
            $dirEntity->setFileKey($fullNewPath);
            $dirEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $this->taskFileDomainService->updateById($dirEntity);

            $this->logger->info('显示目录重命名成功', [
                'task_key' => $taskStatus->taskKey,
                'old_relative_path' => $relativeOldPath,
                'new_relative_path' => $newRelativePath,
                'old_full_path' => $fullOldPath,
                'new_full_path' => $fullNewPath,
                'intelligent_title' => $intelligentTitle,
                'directory_id' => $oldDirectoryId,
            ]);

            // 返回新的相对路径（用于更新 Redis）
            return $newRelativePath;
        } catch (Throwable $e) {
            $this->logger->error('重命名显示目录失败', [
                'task_key' => $taskStatus->taskKey,
                'old_path' => $relativeOldPath,
                'new_path' => $newRelativePath,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            // 失败时返回原路径，不影响后续流程
            return $relativeOldPath;
        }
    }

    /**
     * 从任务状态生成标题（使用保存的 ASR 内容和笔记内容）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态
     * @return string 生成的标题
     */
    private function generateTitleFromTaskStatus(AsrTaskStatusDTO $taskStatus): string
    {
        try {
            // 使用上报时保存的语种，如果没有则使用当前语种
            $language = $taskStatus->language ?: $this->translator->getLocale() ?: 'zh_CN';

            $this->logger->info('使用语种生成标题', [
                'task_key' => $taskStatus->taskKey,
                'language' => $language,
                'has_asr_content' => ! empty($taskStatus->asrStreamContent),
                'has_note' => ! empty($taskStatus->noteContent),
            ]);

            // 如果有 ASR 流式内容，使用它生成标题
            if (! empty($taskStatus->asrStreamContent)) {
                // 构建笔记 DTO（如果有）
                $note = null;
                if (! empty($taskStatus->noteContent)) {
                    $note = new NoteDTO(
                        $taskStatus->noteContent,
                        $taskStatus->noteFileType ?? 'md'
                    );
                }

                // 获取完整的录音总结提示词
                $customPrompt = AsrPromptAssembler::getTitlePrompt(
                    $taskStatus->asrStreamContent,
                    $note,
                    $language
                );

                // 使用自定义提示词生成标题
                $title = $this->magicChatMessageAppService->summarizeTextWithCustomPrompt(
                    $this->getUserAuthorizationFromUserId($taskStatus->userId),
                    $customPrompt
                );

                return $this->sanitizeTitleForPath($title);
            }

            // 如果没有 ASR 内容，返回默认标题
            return $this->generateAsrDirectoryName();
        } catch (Throwable $e) {
            $this->logger->warning('生成标题失败，使用默认标题', [
                'task_key' => $taskStatus->taskKey,
                'error' => $e->getMessage(),
            ]);
            return $this->generateAsrDirectoryName();
        }
    }

    /**
     * 从用户ID获取用户授权对象.
     */
    private function getUserAuthorizationFromUserId(string $userId): MagicUserAuthorization
    {
        $userEntity = $this->magicUserDomainService->getUserById($userId);
        if ($userEntity === null) {
            throw new InvalidArgumentException('用户不存在');
        }
        return MagicUserAuthorization::fromUserEntity($userEntity);
    }

    /**
     * 发送自动总结聊天消息.
     */
    private function sendAutoSummaryChatMessage(
        AsrTaskStatusDTO $taskStatus,
        string $userId,
        string $organizationCode
    ): void {
        // 获取话题实体
        $topicEntity = $this->superAgentTopicDomainService->getTopicById((int) $taskStatus->topicId);
        if ($topicEntity === null) {
            throw new InvalidArgumentException('话题不存在');
        }

        $chatTopicId = $topicEntity->getChatTopicId();
        $conversationId = $this->magicChatDomainService->getConversationIdByTopicId($chatTopicId);

        // 构建处理总结任务DTO
        $processSummaryTaskDTO = new ProcessSummaryTaskDTO(
            $taskStatus,
            $organizationCode,
            $taskStatus->projectId,
            $userId,
            $taskStatus->topicId,
            $chatTopicId,
            $conversationId,
            $taskStatus->modelId ?? ''
        );

        $userEntity = $this->magicUserDomainService->getUserById($userId);
        if ($userEntity === null) {
            throw new InvalidArgumentException('用户不存在');
        }
        $userAuthorization = MagicUserAuthorization::fromUserEntity($userEntity);

        $this->sendSummaryChatMessage($processSummaryTaskDTO, $userAuthorization);
    }

    /**
     * 将相对路径转换为完整路径（用于沙箱和数据库操作）.
     *
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $relativePath 相对路径（如 ".asr_recordings/task_xxx"）
     * @return string 完整路径（如 "project_xxx/workspace/.asr_recordings/task_xxx"）
     */
    private function getFullPath(string $projectId, string $userId, string $relativePath): string
    {
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        $workDir = $projectEntity->getWorkDir();
        return trim(sprintf('%s/%s', $workDir, $relativePath), '/');
    }

    /**
     * 获取项目的 workspace 路径.
     *
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return string workspace 路径（如 "project_xxx/workspace/"）
     */
    private function getWorkspacePath(string $projectId, string $userId): string
    {
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        return rtrim($projectEntity->getWorkDir(), '/') . '/';
    }
}
