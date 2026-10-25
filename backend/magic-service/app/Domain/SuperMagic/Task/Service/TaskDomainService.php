<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\Message\Entity\TaskMessageEntity;
use App\Domain\SuperMagic\Message\Repository\Facade\TaskMessageRepositoryInterface;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Entity\ScriptTaskEntity;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Repository\Facade\TopicRepositoryInterface;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\ScriptTaskRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\SandboxAgentInterface;
use App\Infrastructure\SuperMagic\Utils\WorkFileUtil;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;
use RuntimeException;

class TaskDomainService
{
    use HasLogger;

    public function __construct(
        protected ProjectRepositoryInterface $projectRepository,
        protected TopicRepositoryInterface $topicRepository,
        protected TaskRepositoryInterface $taskRepository,
        protected TaskMessageRepositoryInterface $messageRepository,
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected SandboxAgentInterface $sandboxAgent,
    ) {
    }

    /**
     * Initialize a task for a topic.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param TopicEntity $topicEntity Topic entity
     * @param TaskEntity $taskEntity Task entity
     * @param string $topicMode Topic mode
     * @param string $agentCode Agent code for custom agent mode
     * @return TaskEntity Task entity
     * @throws RuntimeException If task repository or topic repository not injected
     */
    public function initTopicTask(DataIsolation $dataIsolation, TopicEntity $topicEntity, TaskEntity $taskEntity, string $topicMode = '', string $agentCode = ''): TaskEntity
    {
        // Get current user ID
        $userId = $dataIsolation->getCurrentUserId();
        $currentTime = date('Y-m-d H:i:s');

        // Get task mode from DTO, fallback to topic's task mode if empty
        if ($topicMode === '') {
            $topicMode = $topicEntity->getTopicMode();
        }

        // Handle SMA- prefix: treat as custom_agent mode with the original value as agent_code
        if (str_starts_with($topicMode, 'SMA-')) {
            $agentCode = $topicMode;
            $topicMode = ProjectMode::CUSTOM_AGENT->value;
        }

        // if project mode is empty and topic mode is data analysis, set project mode to data analysis
        $projectEntity = $this->projectRepository->findById($topicEntity->getProjectId());
        if (empty($projectEntity->getProjectMode())) {
            $this->projectRepository->updateProjectByCondition(['id' => $projectEntity->getId()], ['project_mode' => $topicMode, 'updated_at' => $currentTime]);
        }

        // Set task start time
        $taskEntity->setStartedAt($currentTime);

        // Update running tasks in current topic to suspended before creating new task， 暂时去掉，等加上 task_type 类型
        $this->taskRepository->updateTaskByCondition(
            [
                'topic_id' => $topicEntity->getId(),
                'task_status' => TaskStatus::RUNNING->value,
            ],
            [
                'task_status' => TaskStatus::Suspended->value,
                'err_msg' => '新任务开始',
                'finished_at' => $currentTime,
                'updated_at' => $currentTime,
            ]
        );

        // Create task
        $taskEntity = $this->taskRepository->createTask($taskEntity);
        // Update topic's current task ID and status
        $topicEntity->setCurrentTaskId($taskEntity->getId());
        $topicEntity->setCurrentTaskStatus(TaskStatus::RUNNING);
        $topicEntity->setUpdatedAt($currentTime);
        $topicEntity->setUpdatedUid($userId);
        $topicEntity->setTaskMode($taskEntity->getTaskMode());
        $conditions = [
            'id' => $topicEntity->getId(),
        ];
        $data = [
            'current_task_id' => $taskEntity->getId(),
            'current_task_status' => TaskStatus::RUNNING->value,
            'updated_uid' => $userId,
            'updated_at' => $currentTime,
        ];
        if (empty($topicEntity->getTopicMode())) {
            $topicEntity->setTopicMode($topicMode);
            $data['topic_mode'] = $topicMode;
        }
        if (! empty($agentCode)) {
            $topicEntity->setAgentCode($agentCode);
            $data['agent_code'] = $agentCode;
        }
        $this->topicRepository->updateTopicByCondition($conditions, $data);
        return $taskEntity;
    }

    public function initDefaultTask(DataIsolation $dataIsolation, TopicEntity $topicEntity, string $prompt = ''): TaskEntity
    {
        $data = [
            'user_id' => $dataIsolation->getCurrentUserId(),
            'workspace_id' => $topicEntity->getWorkspaceId(),
            'project_id' => $topicEntity->getProjectId(),
            'topic_id' => $topicEntity->getId(),
            'task_id' => '', // Initially empty, this is agent's task id
            'task_mode' => '',
            'sandbox_id' => $topicEntity->getSandboxId(), // Current task prioritizes reusing previous topic's sandbox id
            'prompt' => $prompt,
            'task_status' => TaskStatus::WAITING->value,
            'work_dir' => $topicEntity->getWorkDir() ?? '',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        $taskEntity = TaskEntity::fromArray($data);

        return $this->taskRepository->createTask($taskEntity);
    }

    public function initPreWarmTask(DataIsolation $dataIsolation, TopicEntity $topicEntity)
    {
        $data = [
            'user_id' => $dataIsolation->getCurrentUserId(),
            'workspace_id' => $topicEntity->getWorkspaceId(),
            'project_id' => $topicEntity->getProjectId(),
            'topic_id' => $topicEntity->getId(),
            'task_id' => '', // Initially empty, this is agent's task id
            'task_mode' => '',
            'sandbox_id' => $topicEntity->getSandboxId(), // Current task prioritizes reusing previous topic's sandbox id
            'prompt' => 'Pre Warm Task',
            'task_status' => TaskStatus::WAITING->value,
            'work_dir' => $topicEntity->getWorkDir() ?? '',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        $taskEntity = TaskEntity::fromArray($data);

        return $this->taskRepository->createTask($taskEntity);
    }

    /**
     * Initialize or get ASR task for a topic.
     * ASR 场景专用的任务初始化方法.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param TopicEntity $topicEntity Topic entity (avoid redundant query)
     * @param string $projectId Project ID
     * @return TaskEntity Task entity
     */
    public function initAsrTask(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        string $projectId
    ): TaskEntity {
        // Check if topic has current task
        $currentTaskId = $topicEntity->getCurrentTaskId();
        if ($currentTaskId !== null && $currentTaskId > 0) {
            $taskEntity = $this->taskRepository->getTaskById($currentTaskId);
            if ($taskEntity
                && $taskEntity->getTopicId() === $topicEntity->getId()
                && $taskEntity->getProjectId() === $topicEntity->getProjectId()) {
                $this->logger->info('[TaskDomain][ASR] Reusing existing task from topic', [
                    'topic_id' => $topicEntity->getId(),
                    'current_task_id' => $currentTaskId,
                    'project_id' => $projectId,
                ]);
                return $taskEntity;
            }
        }

        return Db::transaction(function () use ($dataIsolation, $topicEntity, $projectId): TaskEntity {
            $lockedTopic = $this->topicRepository->getTopicByIdForUpdate($topicEntity->getId()) ?? $topicEntity;
            $currentTaskId = $lockedTopic->getCurrentTaskId();
            if ($currentTaskId !== null && $currentTaskId > 0) {
                $existingTask = $this->taskRepository->getTaskById($currentTaskId);
                if ($existingTask !== null
                    && $existingTask->getTopicId() === $lockedTopic->getId()
                    && $existingTask->getProjectId() === $lockedTopic->getProjectId()) {
                    return $existingTask;
                }
            }

            $this->logger->info('[TaskDomain][ASR] Creating new ASR task', [
                'topic_id' => $lockedTopic->getId(),
                'project_id' => $projectId,
            ]);
            $currentTime = date('Y-m-d H:i:s');
            $taskEntity = TaskEntity::fromArray([
                'user_id' => $dataIsolation->getCurrentUserId(),
                'workspace_id' => $lockedTopic->getWorkspaceId(),
                'project_id' => $lockedTopic->getProjectId(),
                'topic_id' => $lockedTopic->getId(),
                'task_id' => '',
                'task_mode' => $lockedTopic->getTaskMode() ?: 'general',
                'sandbox_id' => $lockedTopic->getSandboxId() ?: '',
                'prompt' => 'ASR Recording Task',
                'task_status' => TaskStatus::WAITING->value,
                'work_dir' => $lockedTopic->getWorkDir() ?? '',
                'created_at' => $currentTime,
                'updated_at' => $currentTime,
            ]);
            $createdTask = $this->taskRepository->createTask($taskEntity);
            $lockedTopic->setCurrentTaskId($createdTask->getId());
            $lockedTopic->setCurrentTaskStatus(TaskStatus::WAITING);
            $lockedTopic->setUpdatedAt($currentTime);
            $this->topicRepository->updateTopicByCondition(
                ['id' => $lockedTopic->getId()],
                [
                    'current_task_id' => $createdTask->getId(),
                    'current_task_status' => TaskStatus::WAITING->value,
                    'updated_at' => $currentTime,
                ]
            );
            $this->logger->info('[TaskDomain][ASR] ASR task created successfully', [
                'topic_id' => $lockedTopic->getId(),
                'task_id' => $createdTask->getId(),
                'project_id' => $projectId,
            ]);
            return $createdTask;
        });
    }

    /**
     * Create task and update topic's current task ID and status.
     *
     * @param TaskEntity $taskEntity Task entity
     * @return TaskEntity Created task entity
     */
    public function createTask(TaskEntity $taskEntity): TaskEntity
    {
        // Create task
        $task = $this->taskRepository->createTask($taskEntity);

        // Update topic's current task ID and status
        $topic = $this->topicRepository->getTopicById($task->getTopicId());
        if ($topic) {
            $topic->setCurrentTaskId($task->getId());
            $topic->setCurrentTaskStatus(TaskStatus::WAITING);
            $this->topicRepository->updateTopic($topic);
        }

        return $task;
    }

    public function updateTaskStatus(TaskStatus $status, int $id, string $taskId, string $sandboxId, ?string $errMsg = null): bool
    {
        // Find task
        $taskEntity = $this->taskRepository->getTaskById($id);
        if (! $taskEntity) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'task.not_found');
        }

        // Update task status
        $taskEntity->setTaskStatus($status->value);
        $taskEntity->setSandboxId($sandboxId);
        $taskEntity->setTaskId($taskId);
        $taskEntity->setUpdatedAt(date('Y-m-d H:i:s'));

        // If error message is provided and status is ERROR, set error message
        if ($status === TaskStatus::ERROR && $errMsg !== null) {
            if (mb_strlen($errMsg, 'UTF-8') > 500) {
                $errMsg = mb_substr($errMsg, 0, 497, 'UTF-8') . '...';
            }
            $taskEntity->setErrMsg($errMsg);
        }

        // Set task finish time when task is finished or error
        if ($status->isFinal()) {
            $taskEntity->setFinishedAt(date('Y-m-d H:i:s'));
        }

        $this->taskRepository->updateTask($taskEntity);
        return true;
    }

    public function updateTaskSandboxId(DataIsolation $dataIsolation, int $id, string $sandboxId)
    {
        $conditions = [
            'id' => $id,
        ];
        $data = [
            'sandbox_id' => $sandboxId,
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        return $this->taskRepository->updateTaskByCondition($conditions, $data);
    }

    /**
     * Delete task.
     *
     * @param int $taskId Task ID
     * @return bool Whether deletion was successful
     */
    public function deleteTask(int $taskId): bool
    {
        // Check if task exists
        $task = $this->taskRepository->getTaskById($taskId);
        if (! $task) {
            return false;
        }

        // Check if task is running
        if ($task->getStatus() === TaskStatus::RUNNING) {
            return false;
        }

        // Delete task
        return $this->taskRepository->deleteTask($taskId);
    }

    /**
     * Record task message.
     */
    public function recordTaskMessage(TaskMessageEntity $taskMessageEntity): TaskMessageEntity
    {
        $this->messageRepository->save($taskMessageEntity);
        return $taskMessageEntity;
    }

    /**
     * Get task entity by id.
     */
    public function getTaskById(int $id): ?TaskEntity
    {
        return $this->taskRepository->getTaskById($id);
    }

    public function getTaskFile(int $fileId): ?TaskFileEntity
    {
        return $this->taskFileRepository->getById($fileId);
    }

    /**
     * Update task file.
     */
    public function updateTaskFile(TaskFileEntity $taskFileEntity): TaskFileEntity
    {
        // 验证TaskFileEntity是否存在
        $existingTaskFile = $this->taskFileRepository->getById($taskFileEntity->getFileId());
        if (! $existingTaskFile) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'Task file not found');
        }
        return $this->taskFileRepository->updateById($taskFileEntity);
    }

    /**
     * Get task file by file key and task ID.
     */
    public function getTaskFileByFileKey(string $fileKey, int $topicId): ?TaskFileEntity
    {
        return $this->taskFileRepository->getByFileKey($fileKey);
    }

    /**
     * Determine if a file should be hidden based on its relative path from project root.
     * Builds relative path by querying parent chain in one query, then checks each segment
     * against known hidden directory names.
     */
    public function determineIsHidden(string $fileName, ?int $parentId, int $projectId = 0): bool
    {
        // Quick check: if file name itself is a hidden directory
        if (WorkFileUtil::isHiddenFileName($fileName)) {
            return true;
        }

        if ($parentId === null || $parentId <= 0) {
            return false;
        }

        // Get all ancestor entities in one query
        $ancestorEntities = $this->taskFileRepository->getFilesWithParentsByIds([$parentId], $projectId);

        // Check if any ancestor's name matches hidden directory
        foreach ($ancestorEntities as $ancestor) {
            if (WorkFileUtil::isHiddenFileName($ancestor->getFileName())) {
                return true;
            }
        }

        return false;
    }

    /**
     * insert or update task file entity by file key.
     */
    public function saveTaskFileByFileKey(
        DataIsolation $dataIsolation,
        string $fileKey,
        array $fileData,
        int $projectId,
        int $topicId,
        int $taskId,
        string $fileType = FileType::PROCESS->value,
        bool $isUpdate = false,
        string $storageType = StorageType::WORKSPACE->value,
        int $source = TaskFileSource::AGENT->value,
        ?int $parentId = null,
    ): TaskFileEntity {
        // First, check if the file already exists
        $taskFileEntity = $this->getTaskFileByFileKey($fileKey, $topicId);

        // If exists and no need to update, return directly
        if ($taskFileEntity && ! $isUpdate) {
            return $taskFileEntity;
        }

        // If exists, update and return
        if ($taskFileEntity) {
            $taskFileEntity->setFileKey($fileKey);
            $taskFileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $taskFileEntity->setTopicId($topicId);
            $taskFileEntity->setTaskId($taskId);
            $taskFileEntity->setFileType($fileType);
            $taskFileEntity->setFileName($fileData['display_filename'] ?? $fileData['filename'] ?? '');
            $taskFileEntity->setFileExtension($fileData['file_extension'] ?? '');
            $taskFileEntity->setFileSize($fileData['file_size'] ?? 0);
            // Check and set whether it's a hidden file
            $taskFileEntity->setIsHidden($this->determineIsHidden($fileData['display_filename'] ?? $fileData['filename'] ?? '', $parentId, $projectId));
            if ($parentId !== null) {
                $taskFileEntity->setParentId($parentId);
            }

            return $this->taskFileRepository->updateById($taskFileEntity);
            // return $taskFileEntity;
        }

        // If not exists, create new entity
        $taskFileEntity = new TaskFileEntity();
        $fileId = ! empty($fileData['file_id']) ? (int) $fileData['file_id'] : IdGenerator::getSnowId();
        $taskFileEntity->setFileId($fileId);
        $taskFileEntity->setFileKey($fileKey);

        // Always get task entity to obtain project_id and user_id if needed
        $taskEntity = $this->taskRepository->getTaskById($taskId);

        // 优先使用隔离对象身份；无身份时从任务补齐，最终保留系统身份兜底。
        $userId = $dataIsolation->getCurrentUserId();
        if (empty($userId) && $taskEntity) {
            $userId = $taskEntity->getUserId();
        }

        $taskFileEntity->setUserId($userId !== '' ? $userId : 'system');
        $taskFileEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $taskFileEntity->setTopicId($topicId);
        $taskFileEntity->setTaskId($taskId);
        $taskFileEntity->setProjectId($projectId);
        $taskFileEntity->setFileType($fileType);
        $taskFileEntity->setFileName($fileData['display_filename'] ?? $fileData['filename'] ?? '');
        $taskFileEntity->setFileExtension($fileData['file_extension'] ?? '');
        $taskFileEntity->setFileSize($fileData['file_size'] ?? 0);
        // Check and set whether it's a hidden file
        $taskFileEntity->setIsHidden($this->determineIsHidden($fileData['display_filename'] ?? $fileData['filename'] ?? '', $parentId, $projectId));
        // Set storage type, default to workspace
        $taskFileEntity->setStorageType($storageType);
        $taskFileEntity->setSource($source);

        // Set parent_id if provided
        if ($parentId !== null) {
            $taskFileEntity->setParentId($parentId);
        }

        // Use insertOrIgnore method, if there's already a record with the same file_key and topic_id, return the existing entity
        $result = $this->taskFileRepository->insertOrIgnore($taskFileEntity);
        return $result ?: $taskFileEntity;
    }

    /**
     * Get message list by topic ID.
     *
     * @param int $topicId Topic ID
     * @param int $page Page number
     * @param int $pageSize Page size
     * @param bool $shouldPage Whether to page
     * @param string $sortDirection Sort direction, supports asc and desc
     * @param bool $showInUi Whether to display only UI visible messages, default true
     * @return array Return message list and total
     */
    public function getMessagesByTopicId(int $topicId, int $page = 1, int $pageSize = 20, bool $shouldPage = true, string $sortDirection = 'asc', bool $showInUi = true): array
    {
        return $this->messageRepository->findByTopicId($topicId, $page, $pageSize, $shouldPage, $sortDirection, $showInUi);
    }

    /**
     * Get topic messages after a cursor ID.
     *
     * @return array{list: TaskMessageEntity[], has_more: bool, next_cursor: ?string}
     */
    public function getMessagesByTopicIdAfterId(int $topicId, ?int $afterId = null, int $limit = 20, bool $showInUi = true): array
    {
        return $this->messageRepository->findByTopicIdAfterId($topicId, $afterId, $limit, $showInUi);
    }

    /**
     * Get topic attachment list.
     *
     * @param int $topicId Topic ID
     * @param DataIsolation $dataIsolation Data isolation object
     * @param int $page Page number
     * @param int $pageSize Page size
     * @param array $fileType File type filter
     * @param string $storageType Storage type
     * @return array Attachment list and total
     */
    public function getTaskAttachmentsByTopicId(int $topicId, DataIsolation $dataIsolation, int $page = 1, int $pageSize = 20, array $fileType = [], string $storageType = 'workspace'): array
    {
        // Call TaskFileRepository to get file list
        return $this->taskFileRepository->getByTopicId($topicId, $page, $pageSize, $fileType, $storageType);
        // Directly return entity object list, let application layer handle URL acquisition
    }

    /**
     * 获取项目下的任务附件列表.
     *
     * @param int $projectId Project ID
     * @param int $page Page number
     * @param int $pageSize Page size
     * @param array $fileType File type filter
     * @param string $storageType Storage type filter
     * @param null|string $updatedAfter Updated after timestamp filter
     * @return array Attachment list and total
     */
    public function getTaskAttachmentsByProjectId(int $projectId, DataIsolation $dataIsolation, int $page = 1, int $pageSize = 20, array $fileType = [], string $storageType = '', ?string $updatedAfter = null): array
    {
        return $this->taskFileRepository->getByProjectId($projectId, $page, $pageSize, $fileType, $storageType, $updatedAfter);
    }

    /**
     * Lightweight update task status method, only modify task status.
     *
     * @param int $id Task ID
     * @param TaskStatus $status Task status
     * @param null|string $errMsg Error message, only meaningful when status is ERROR
     * @return bool Whether update was successful
     */
    public function updateTaskStatusByTaskId(int $id, TaskStatus $status, ?string $errMsg = null): bool
    {
        // Get task entity to check if finished_at needs to be set
        $taskEntity = $this->taskRepository->getTaskById($id);
        if ($taskEntity && ($status === TaskStatus::FINISHED || $status === TaskStatus::ERROR) && $taskEntity->getFinishedAt() === null) {
            $taskEntity->setTaskStatus($status->value);
            $taskEntity->setFinishedAt(date('Y-m-d H:i:s'));
            if ($status === TaskStatus::ERROR && $errMsg !== null) {
                $taskEntity->setErrMsg($errMsg);
            }
            $this->taskRepository->updateTask($taskEntity);
            return true;
        }

        if ($status === TaskStatus::ERROR && $errMsg !== null) {
            return $this->taskRepository->updateTaskStatusAndErrMsgByTaskId($id, $status, $errMsg);
        }
        return $this->taskRepository->updateTaskStatusByTaskId($id, $status);
    }

    public function getTaskNumByTopicId(int $topicId): int
    {
        return $this->taskRepository->getTaskCountByTopicId($topicId);
    }

    public function getUserFirstMessageByTopicId(int $topicId, string $userId): ?TaskMessageEntity
    {
        return $this->messageRepository->getUserFirstMessageByTopicId($topicId, $userId);
    }

    /**
     * Batch get task counts by topic IDs.
     *
     * @param array $topicIds Array of topic IDs
     * @return array Array with structure [topic_id => task_count]
     */
    public function batchGetTaskNumsByTopicIds(array $topicIds): array
    {
        if (empty($topicIds)) {
            return [];
        }

        $result = [];
        foreach ($topicIds as $topicId) {
            $result[$topicId] = $this->taskRepository->getTaskCountByTopicId($topicId);
        }

        return $result;
    }

    /**
     * Batch get user first messages by topic IDs.
     *
     * @param array $topicIds Array of topic IDs
     * @return array Array with structure [topic_id => TaskMessageEntity|null]
     */
    public function batchGetUserFirstMessagesByTopicIds(array $topicIds): array
    {
        if (empty($topicIds)) {
            return [];
        }

        $result = [];
        // Note: This needs user_id which is not available here
        // We'll need to get this info from the calling service
        foreach ($topicIds as $topicId) {
            $result[$topicId] = null; // Will be filled by calling service if needed
        }

        return $result;
    }

    /**
     * Update task status by topic IDs.
     *
     * Only tasks in one of $fromStatuses are touched, so a batch operation can
     * never drag an already finished task back into a live state. Default is the
     * "not yet terminal" pair (waiting/running), which is what status sync and
     * sandbox recovery need. Callers that must include a human-in-the-loop task
     * (waiting_for_user) pass their own list explicitly.
     *
     * @param TaskStatus[] $fromStatuses statuses allowed to transition; empty = waiting + running
     */
    public function updateTaskStatusByTopicIds(
        array $topicIds,
        TaskStatus $taskStatus,
        ?string $errMsg = null,
        array $fromStatuses = []
    ): int {
        $finishedTime = null;
        if ($taskStatus->isFinal()) {
            $finishedTime = date('Y-m-d H:i:s');
        }
        $sourceStatuses = $fromStatuses === []
            ? [TaskStatus::WAITING->value, TaskStatus::RUNNING->value]
            : array_values(array_unique(array_map(
                static fn (TaskStatus $status): string => $status->value,
                $fromStatuses
            )));
        return $this->taskRepository->updateTaskStatusByTopicIds($topicIds, $taskStatus->value, $errMsg, $finishedTime, $sourceStatuses);
    }

    public function executeScriptTask(DataIsolation $dataIsolation, ScriptTaskEntity $scriptTaskEntity): void
    {
        $scriptTaskRequest = ScriptTaskRequest::create($scriptTaskEntity->getTaskId(), $scriptTaskEntity->getArguments(), $scriptTaskEntity->getScriptName());
        $this->sandboxAgent->executeScriptTask($dataIsolation, $scriptTaskEntity->getSandboxId(), $scriptTaskRequest);
    }
}
