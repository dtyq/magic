<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\TaskFileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskMessageRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Config\WebSocketConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\SandboxResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Volcengine\SandboxService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\WebSocket\WebSocketSession;
use Hyperf\Contract\StdoutLoggerInterface;
use RuntimeException;

class TaskDomainService
{
    public function __construct(
        protected TopicRepositoryInterface $topicRepository,
        protected TaskRepositoryInterface $taskRepository,
        protected TaskMessageRepositoryInterface $messageRepository,
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected StdoutLoggerInterface $logger,
        protected SandboxService $sandboxService,
    ) {
    }

    /**
     * 初始化话题任务
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param TopicEntity $topicEntity 话题实体
     * @param string $prompt 用户的问题
     * @param string $attachments 用户上传的附件信息（JSON格式）
     * @param ChatInstruction $instruction 指令 正常，追问，打断
     * @return TaskEntity 任务实体
     * @throws RuntimeException 如果任务仓库或话题仓库未注入
     */
    public function initTopicTask(DataIsolation $dataIsolation, TopicEntity $topicEntity, ChatInstruction $instruction, string $taskMode, string $prompt = '', string $attachments = ''): TaskEntity
    {
        // 获取当前用户ID
        $userId = $dataIsolation->getCurrentUserId();
        $topicId = $topicEntity->getId();

        // 如果指令是打断或者追问的情况下
        // 如果后续有其他情况变更，再从前端传 task_id
        if ($instruction == ChatInstruction::Interrupted) {
            $taskList = $this->taskRepository->getTasksByTopicId($topicId, 1, 1, ['task_status' => TaskStatus::RUNNING]);
            if (empty($taskList['list'])) {
                ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'task.not_found');
            }
            return $taskList['list'][0];
        }
        // 如果 $taskMode  为空，则取话题的 task_mode
        if ($taskMode == '') {
            $taskMode = $topicEntity->getTaskMode();
        }
        // 其他情况都是新建一个新的任务
        $taskEntity = new TaskEntity([
            'user_id' => $userId,
            'workspace_id' => $topicEntity->getWorkspaceId(),
            'topic_id' => $topicId,
            'task_id' => '', // 初始为空，这个是 agent 的任务id
            'task_mode' => $taskMode,
            'sandbox_id' => $topicEntity->getSandboxId(), // 当前 task 优先先复用之前的 话题的沙箱id
            'prompt' => $prompt,
            'attachments' => $attachments,
            'task_status' => TaskStatus::WAITING->value,
            'work_dir' => $topicEntity->getWorkDir() ?? '',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        // 创建任务
        $taskEntity = $this->taskRepository->createTask($taskEntity);

        // 4. 更新话题的当前任务ID和状态
        $topicEntity->setCurrentTaskId($taskEntity->getId());
        $topicEntity->setCurrentTaskStatus(TaskStatus::WAITING);
        $topicEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $topicEntity->setUpdatedUid($userId);
        $topicEntity->setTaskMode($taskMode);
        $this->topicRepository->updateTopic($topicEntity);

        return $taskEntity;
    }

    /**
     * 创建任务，并且更新话题的当前任务ID和状态
     *
     * @param TaskEntity $taskEntity 任务实体
     * @return TaskEntity 创建后的任务实体
     */
    public function createTask(TaskEntity $taskEntity): TaskEntity
    {
        // 创建任务
        $task = $this->taskRepository->createTask($taskEntity);

        // 更新话题的当前任务ID和状态
        $topic = $this->topicRepository->getTopicById($task->getTopicId());
        if ($topic) {
            $topic->setCurrentTaskId($task->getId());
            $topic->setCurrentTaskStatus(TaskStatus::WAITING);
            $this->topicRepository->updateTopic($topic);
        }

        return $task;
    }

    public function updateTaskStatus(DataIsolation $dataIsolation, int $topicId, TaskStatus $status, int $id, string $taskId, string $sandboxId, ?string $errMsg = null): bool
    {
        // 1. 通过话题 id 获取话题实体
        $topicEntity = $this->topicRepository->getTopicById($topicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'topic.not_found');
        }

        // 获取当前用户ID
        $userId = $dataIsolation->getCurrentUserId();

        // 2. 查找任务
        $taskEntity = $this->taskRepository->getTaskById($id);
        if (! $taskEntity) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'task.not_found');
        }

        // 更新任务状态
        $taskEntity->setTaskStatus($status->value);
        $taskEntity->setSandboxId($sandboxId);
        $taskEntity->setTaskId($taskId);
        $taskEntity->setUpdatedAt(date('Y-m-d H:i:s'));

        // 如果提供了错误信息，并且状态为ERROR，则设置错误信息
        if ($status === TaskStatus::ERROR && $errMsg !== null) {
            if (mb_strlen($errMsg, 'UTF-8') > 500) {
                $errMsg = mb_substr($errMsg, 0, 497, 'UTF-8') . '...';
            }
            $taskEntity->setErrMsg($errMsg);
        }

        $this->taskRepository->updateTask($taskEntity);

        // 3. 更新话题的相关信息
        $topicEntity->setSandboxId($sandboxId);
        $topicEntity->setCurrentTaskId($id);
        $topicEntity->setCurrentTaskStatus($status);
        $topicEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $topicEntity->setUpdatedUid($userId);

        // 保存话题更新
        return $this->topicRepository->updateTopic($topicEntity);
    }

    public function handleSandboxMessage(string $taskId, string $messageJson): TaskMessageEntity
    {
        $messageData = json_decode($messageJson, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException('Invalid message JSON');
        }

        return new TaskMessageEntity([
            'task_id' => $taskId,
            'type' => $messageData['type'] ?? MessageType::TaskUpdate->value,
            'content' => $messageData['content'] ?? '',
            'raw_data' => $messageJson,
            'status' => $messageData['status'] ?? null,
        ]);
    }

    /**
     * 删除任务
     *
     * @param int $taskId 任务ID
     * @return bool 是否删除成功
     */
    public function deleteTask(int $taskId): bool
    {
        // 检查任务是否存在
        $task = $this->taskRepository->getTaskById($taskId);
        if (! $task) {
            return false;
        }

        // 检查任务是否正在运行
        if ($task->getStatus() === TaskStatus::RUNNING) {
            return false;
        }

        // 删除任务
        return $this->taskRepository->deleteTask($taskId);
    }

    /**
     * 记录任务消息.
     */
    public function recordTaskMessage(
        string $taskId,
        string $role,
        string $senderUid,
        string $receiverUid,
        string $messageType,
        string $content,
        ?string $status = null,
        ?array $steps = null,
        ?array $tool = null,
        ?int $topicId = null,
        ?string $event = null,
        ?array $attachments = null,
        bool $showInUi = true
    ): TaskMessageEntity {
        $message = new TaskMessageEntity([
            'task_id' => $taskId,
            'sender_type' => $role,
            'sender_uid' => $senderUid,
            'receiver_uid' => $receiverUid,
            'type' => $messageType,
            'content' => $content,
            'status' => $status,
            'steps' => $steps,
            'tool' => $tool,
            'attachments' => $attachments,
            'topic_id' => $topicId,
            'event' => $event,
            'show_in_ui' => $showInUi,
        ]);

        $this->messageRepository->save($message);
        return $message;
    }

    /**
     * 记录用户发送的消息.
     */
    public function recordUserMessage(
        string $taskId,
        string $userId,
        string $aiId,
        string $content,
        ?array $tool = null,
        ?int $topicId = null,
        ?string $event = null,
        ?array $attachments = null,
        bool $showInUi = true
    ): TaskMessageEntity {
        return $this->recordTaskMessage(
            $taskId,
            'user',
            $userId,
            $aiId,
            'chat',
            $content,
            null,
            null,
            $tool,
            $topicId,
            $event,
            $attachments,
            $showInUi
        );
    }

    /**
     * 记录AI回复的消息.
     */
    public function recordAiMessage(
        string $taskId,
        string $aiId,
        string $userId,
        string $messageType,
        string $content,
        ?string $status = null,
        ?array $steps = null,
        ?array $tool = null,
        ?int $topicId = null,
        ?string $event = null,
        ?array $attachments = null,
        bool $showInUi = true
    ): TaskMessageEntity {
        return $this->recordTaskMessage(
            $taskId,
            'assistant',
            $aiId,
            $userId,
            $messageType,
            $content,
            $status,
            $steps,
            $tool,
            $topicId,
            $event,
            $attachments,
            $showInUi
        );
    }

    /**
     * 通过任务ID(沙箱服务返回的taskId)获取任务.
     *
     * @param string $taskId 任务ID
     * @return null|TaskEntity 任务实体或null
     */
    public function getTaskByTaskId(string $taskId): ?TaskEntity
    {
        return $this->taskRepository->getTaskByTaskId($taskId);
    }

    /**
     * 通过 id 获取任务实体.
     */
    public function getTaskById(int $id): ?TaskEntity
    {
        return $this->taskRepository->getTaskById($id);
    }

    /**
     * 保存任务文件.
     *
     * @param TaskFileEntity $entity 任务文件实体
     * @return TaskFileEntity 保存后的实体
     */
    public function saveTaskFile(TaskFileEntity $entity): TaskFileEntity
    {
        // 通过仓储接口保存任务文件
        return $this->taskFileRepository->insert($entity);
    }

    public function getTaskFile(int $fileId): ?TaskFileEntity
    {
        return $this->taskFileRepository->getById($fileId);
    }

    /**
     * 通过文件key和taskId获取任务文件.
     */
    public function getTaskFileByFileKey(string $fileKey): ?TaskFileEntity
    {
        return $this->taskFileRepository->getByFileKey($fileKey);
    }

    public function saveOrCreateTaskFileByFileId(
        int $fileId,
        string $fileKey,
        DataIsolation $dataIsolation,
        array $fileData,
        int $topicId,
        int $taskId,
        string $fileType = TaskFileType::PROCESS->value
    ): TaskFileEntity {
        // 先通过fileId检查是否已存在文件
        $taskFileEntity = $this->getTaskFileByFileKey($fileKey);

        // 如果已存在，则更新并返回
        if ($taskFileEntity) {
            $taskFileEntity->setFileKey($fileKey);
            $taskFileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $taskFileEntity->setTopicId($topicId);
            $taskFileEntity->setTaskId($taskId);
            $taskFileEntity->setFileType($fileType);
            $taskFileEntity->setFileName($fileData['display_filename'] ?? $fileData['filename'] ?? '');
            $taskFileEntity->setFileExtension($fileData['file_extension'] ?? '');
            $taskFileEntity->setFileSize($fileData['file_size'] ?? 0);
            // 判断并设置是否为隐藏文件
            $taskFileEntity->setIsHidden($this->isHiddenFile($fileKey));
            // 更新存储类型，如果提供了的话
            if (isset($fileData['storage_type'])) {
                $taskFileEntity->setStorageType($fileData['storage_type']);
            }

            return $this->taskFileRepository->updateById($taskFileEntity);
        }

        // 如果不存在，则创建新实体
        $taskFileEntity = new TaskFileEntity();
        $taskFileEntity->setFileId($fileId);
        $taskFileEntity->setFileKey($fileKey);

        // 处理用户ID: 优先使用DataIsolation中的用户ID，如果为null则从任务中获取
        $userId = $dataIsolation->getCurrentUserId();
        if ($userId === null) {
            // 通过任务ID获取任务实体，获取用户ID
            $taskEntity = $this->taskRepository->getTaskById($taskId);
            if ($taskEntity) {
                $userId = $taskEntity->getUserId();
            }
        }
        $taskFileEntity->setUserId($userId !== null ? $userId : 'system');

        $taskFileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $taskFileEntity->setTopicId($topicId);
        $taskFileEntity->setTaskId($taskId);
        $taskFileEntity->setFileType($fileType);
        $taskFileEntity->setFileName($fileData['display_filename'] ?? $fileData['filename'] ?? '');
        $taskFileEntity->setFileExtension($fileData['file_extension'] ?? '');
        $taskFileEntity->setFileSize($fileData['file_size'] ?? 0);
        // 判断并设置是否为隐藏文件
        $taskFileEntity->setIsHidden($this->isHiddenFile($fileKey));
        // 设置存储类型，默认为workspace
        $taskFileEntity->setStorageType($fileData['storage_type'] ?? 'workspace');

        // 使用insertOrIgnore方法，如果已存在相同file_key和topic_id的记录，则返回已存在的实体
        $result = $this->taskFileRepository->insertOrIgnore($taskFileEntity);
        return $result ?: $taskFileEntity;
    }

    /**
     * 根据fileKey保存或创建任务文件.
     * 如果文件已存在则跳过，不存在则创建.
     *
     * @param string $fileKey 文件key
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param array $fileData 文件数据
     * @param int $topicId 话题ID
     * @param string $sandboxId 沙箱ID
     * @param int $taskId 任务ID
     * @param string $fileType 文件类型
     * @return TaskFileEntity 任务文件实体
     */
    public function saveOrCreateTaskFileByFileKey(
        string $fileKey,
        DataIsolation $dataIsolation,
        array $fileData,
        int $topicId,
        string $sandboxId,
        int $taskId,
        string $fileType = TaskFileType::PROCESS->value
    ): TaskFileEntity {
        // 使用sandboxId获取任务ID
        $taskEntity = $this->taskRepository->getTaskBySandboxId($sandboxId);
        $taskId = $taskEntity ? $taskEntity->getId() : $taskId;

        // 先检查是否已存在相同fileKey的记录
        $taskFileEntity = $this->getTaskFileByFileKey($fileKey);

        // 如果已存在，直接返回
        if ($taskFileEntity) {
            return $taskFileEntity;
        }

        // 创建新实体
        $taskFileEntity = new TaskFileEntity();
        $taskFileEntity->setFileKey($fileKey);

        // 处理用户ID: 优先使用DataIsolation中的用户ID，如果为null则从任务中获取
        $userId = $dataIsolation->getCurrentUserId();
        if ($userId === null && $taskEntity) {
            $userId = $taskEntity->getUserId();
        }
        $taskFileEntity->setUserId($userId !== null ? $userId : 'system');

        $taskFileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $taskFileEntity->setTopicId($topicId);
        $taskFileEntity->setTaskId($taskId);
        $taskFileEntity->setFileType($fileType);
        $taskFileEntity->setFileName($fileData['display_filename'] ?? $fileData['filename'] ?? '');
        $taskFileEntity->setFileExtension($fileData['file_extension'] ?? '');
        $taskFileEntity->setFileSize($fileData['file_size'] ?? 0);
        $taskFileEntity->setExternalUrl($fileData['external_url'] ?? '');
        // 判断并设置是否为隐藏文件
        $taskFileEntity->setIsHidden($this->isHiddenFile($fileKey));
        // 设置存储类型，默认为workspace
        $taskFileEntity->setStorageType($fileData['storage_type'] ?? 'workspace');

        // 使用insertOrIgnore方法，如果已存在相同file_key和topic_id的记录，则返回已存在的实体
        $result = $this->taskFileRepository->insertOrIgnore($taskFileEntity);
        return $result ?: $taskFileEntity;
    }

    /**
     * 通过话题ID获取消息列表.
     *
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @param bool $shouldPage 是否分页
     * @param string $sortDirection 排序方向，支持asc和desc
     * @param bool $showInUi 是否只显示UI可见的消息，默认为true
     * @return array 返回消息列表和总数
     */
    public function getMessagesByTopicId(int $topicId, int $page = 1, int $pageSize = 20, bool $shouldPage = true, string $sortDirection = 'asc', bool $showInUi = true): array
    {
        return $this->messageRepository->findByTopicId($topicId, $page, $pageSize, $shouldPage, $sortDirection, $showInUi);
    }

    /**
     * 获取话题的附件列表.
     *
     * @param int $topicId 话题ID
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @param array $fileType 文件类型过滤
     * @param string $storageType 存储类型
     * @return array 附件列表和总数
     */
    public function getTaskAttachmentsByTopicId(int $topicId, DataIsolation $dataIsolation, int $page = 1, int $pageSize = 20, array $fileType = [], string $storageType = 'workspace'): array
    {
        // 调用TaskFileRepository获取文件列表
        return $this->taskFileRepository->getByTopicId($topicId, $page, $pageSize, $fileType, $storageType);
        // 直接返回实体对象列表，让应用层处理URL获取
    }

    public function getTaskBySandboxId(string $sandboxId): ?TaskEntity
    {
        return $this->taskRepository->getTaskBySandboxId($sandboxId);
    }

    public function getTasksCountByUserId(string $userId): array
    {
        $data = $this->taskRepository->getTasksByUserId($userId);
        if (empty($data)) {
            return [];
        }
        // 输出格式是 topicId => ['total' => 0, 'last_task_start_time' => '', 'last_task_update_time' => '']
        $result = [];
        foreach ($data as $item) {
            /**
             * @var TaskEntity $item
             */
            if (! isset($result[$item->getTopicId()])) {
                $result[$item->getTopicId()] = [];
                $result[$item->getTopicId()]['task_rounds'] = 0;
                $result[$item->getTopicId()]['last_task_start_time'] = '';
            }
            $result[$item->getTopicId()]['task_rounds'] = $result[$item->getTopicId()]['task_rounds'] + 1;
            // 将时间字符串转换为时间戳进行比较
            $currentTime = strtotime($item->getCreatedAt());
            $lastTime = strtotime($result[$item->getTopicId()]['last_task_start_time']);
            if ($currentTime > $lastTime) {
                $result[$item->getTopicId()]['last_task_start_time'] = $item->getCreatedAt();
            }
        }

        // 通过 topic_id 查出当前任务消息里最新一条的消息时间，以及内容
        foreach ($result as $topicId => $item) {
            $result[$topicId]['last_message_send_timestamp'] = '';
            $result[$topicId]['last_message_content'] = '';
            // 因为性能问题，先暂时注释，后面优化
            //            $messages = $this->messageRepository->findByTopicId($topicId, 1, 1, true, 'desc');
            //            if (! empty($messages['list'])) {
            //                /**
            //                 * @var TaskMessageEntity $lastMessage
            //                 */
            //                $lastMessage = $messages['list'][0];
            //                $result[$topicId]['last_message_send_timestamp'] = $lastMessage->getSendTimestamp();
            //                $result[$topicId]['last_message_content'] = $lastMessage->getContent();
            //            } else {
            //                $result[$topicId]['last_message_send_timestamp'] = '';
            //                $result[$topicId]['last_message_content'] = '';
            //            }
        }

        return $result;
    }

    public function handleInterruptInstruction(TaskEntity $taskEntity): bool
    {
        // 判断沙箱id 是否为空
        if (empty($taskEntity->getSandboxId())) {
            return false;
        }

        // 通过沙箱id ，判断容器是否存在
        // 检查沙箱是否存在
        $result = $this->sandboxService->checkSandboxExists($taskEntity->getSandboxId());
        // 如果沙箱存在且状态为 running，直接返回该沙箱
        if ($result->getCode() === SandboxResult::Normal
            && $result->getSandboxData()->getStatus() === 'running') {
            // 沙箱状态正在运行，需要连接沙箱，进行处理
            $config = new WebSocketConfig();
            $sandboxId = $taskEntity->getSandboxId();
            $wsUrl = $this->sandboxService->getWebsocketUrl($sandboxId);

            // 打印连接参数
            $this->logger->info(sprintf(
                'WebSocket连接参数，URL: %s，最大连接时间: %d秒',
                $wsUrl,
                $config->getConnectTimeout()
            ));

            // 创建 WebSocket 会话
            $session = new WebSocketSession(
                $config,
                $this->logger,
                $wsUrl,
                $taskEntity->getTaskId()
            );

            // 建立连接
            $session->connect();
            $message = (new MessageBuilderDomainService())->buildInterruptMessage($taskEntity->getUserId(), $taskEntity->getId());
            $session->send($message);
            // 等待响应
            $message = $session->receive(60);
            if ($message === null) {
                throw new RuntimeException('等待 agent 响应超时');
            }
        }

        return true;
    }

    /**
     * 更新长时间处于运行状态的任务为错误状态
     *
     * @param string $timeThreshold 时间阈值，早于此时间的运行中任务将被标记为错误
     * @return int 更新的任务数量
     */
    public function updateStaleRunningTasks(string $timeThreshold): int
    {
        return $this->taskRepository->updateStaleRunningTasks($timeThreshold);
    }

    /**
     * 获取指定状态的任务列表.
     *
     * @param TaskStatus $status 任务状态
     * @return array<TaskEntity> 任务实体列表
     */
    public function getTasksByStatus(TaskStatus $status): array
    {
        return $this->taskRepository->getTasksByStatus($status);
    }

    /**
     * 轻量级的更新任务状态方法，只修改任务状态
     *
     * @param int $id 任务ID
     * @param TaskStatus $status 任务状态
     * @param null|string $errMsg 错误信息，仅当状态为ERROR时有意义
     * @return bool 是否更新成功
     */
    public function updateTaskStatusByTaskId(int $id, TaskStatus $status, ?string $errMsg = null): bool
    {
        if ($status === TaskStatus::ERROR && $errMsg !== null) {
            return $this->taskRepository->updateTaskStatusAndErrMsgByTaskId($id, $status, $errMsg);
        }
        return $this->taskRepository->updateTaskStatusByTaskId($id, $status);
    }

    /**
     * 判断文件是否为隐藏文件
     *
     * @param string $fileKey 文件路径
     * @return bool 是否为隐藏文件：true-是，false-否
     */
    private function isHiddenFile(string $fileKey): bool
    {
        // 移除开头的斜杠，统一处理
        $fileKey = ltrim($fileKey, '/');

        // 分割路径为各个部分
        $pathParts = explode('/', $fileKey);

        // 检查每个路径部分是否以 . 开头
        foreach ($pathParts as $part) {
            if (!empty($part) && str_starts_with($part, '.')) {
                return true; // 是隐藏文件
            }
        }

        return false; // 不是隐藏文件
    }

    /**
     * 获取最近更新时间超过指定时间的任务列表.
     *
     * @param string $timeThreshold 时间阈值，如果任务的更新时间早于此时间，则会被包含在结果中
     * @param int $limit 返回结果的最大数量
     * @return array<TaskEntity> 任务实体列表
     */
    public function getTasksExceedingUpdateTime(string $timeThreshold, int $limit = 100): array
    {
        return $this->taskRepository->getTasksExceedingUpdateTime($timeThreshold, $limit);
    }

    public function getTaskNumByTopicId(int $topicId): int
    {
        return $this->taskRepository->getTaskCountByTopicId($topicId);
    }

    public function getUserFirstMessageByTopicId(int $topicId, string $userId): ?TaskMessageEntity
    {
        return $this->messageRepository->getUserFirstMessageByTopicId($topicId, $userId);
    }
}
