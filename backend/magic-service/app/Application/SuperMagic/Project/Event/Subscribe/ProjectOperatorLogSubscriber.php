<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Project\Event\Subscribe;

use App\Domain\SuperMagic\Common\Constants\OperationAction;
use App\Domain\SuperMagic\Common\Constants\ResourceType;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Event\DirectoryDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileBatchMoveEvent;
use App\Domain\SuperMagic\File\Event\FileContentSavedEvent;
use App\Domain\SuperMagic\File\Event\FileDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileMovedEvent;
use App\Domain\SuperMagic\File\Event\FileRenamedEvent;
use App\Domain\SuperMagic\File\Event\FileReplacedEvent;
use App\Domain\SuperMagic\File\Event\FilesBatchDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileUploadedEvent;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectOperationLogEntity;
use App\Domain\SuperMagic\Project\Event\ProjectCreatedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectMembersUpdatedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectsBatchDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectShortcutCancelledEvent;
use App\Domain\SuperMagic\Project\Event\ProjectShortcutSetEvent;
use App\Domain\SuperMagic\Project\Event\ProjectUpdatedEvent;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectOperationLogDomainService;
use App\Domain\SuperMagic\Topic\Event\TopicCreatedEvent;
use App\Domain\SuperMagic\Topic\Event\TopicDeletedEvent;
use App\Domain\SuperMagic\Topic\Event\TopicRenamedEvent;
use App\Domain\SuperMagic\Topic\Event\TopicUpdatedEvent;
use App\Infrastructure\SuperMagic\Utils\IpUtil;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\RequestContext;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 项目审计日志事件监听器.
 */
#[Listener]
class ProjectOperatorLogSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    private ProjectOperationLogDomainService $projectOperationLogDomainService;

    private ProjectMemberDomainService $projectMemberDomainService;

    private TaskFileDomainService $taskFileDomainService;

    public function __construct()
    {
        $container = ApplicationContext::getContainer();
        $loggerFactory = $container->get(LoggerFactory::class);
        $this->logger = $loggerFactory->get(static::class);
        $this->projectOperationLogDomainService = $container->get(ProjectOperationLogDomainService::class);
        $this->projectMemberDomainService = $container->get(ProjectMemberDomainService::class);
        $this->taskFileDomainService = $container->get(TaskFileDomainService::class);
    }

    /**
     * 监听的事件列表.
     */
    public function listen(): array
    {
        return [
            // 项目操作事件
            ProjectCreatedEvent::class,
            ProjectUpdatedEvent::class,
            ProjectDeletedEvent::class,
            ProjectsBatchDeletedEvent::class,

            // 话题操作事件
            TopicCreatedEvent::class,
            TopicUpdatedEvent::class,
            TopicDeletedEvent::class,
            TopicRenamedEvent::class,

            // 文件操作事件
            FileUploadedEvent::class,
            FileDeletedEvent::class,
            FileRenamedEvent::class,
            FileMovedEvent::class,
            FileContentSavedEvent::class,
            FileReplacedEvent::class,
            DirectoryDeletedEvent::class,
            FileBatchMoveEvent::class,
            FilesBatchDeletedEvent::class,

            // 项目成员操作事件
            ProjectMembersUpdatedEvent::class,

            // 项目快捷方式操作事件
            ProjectShortcutSetEvent::class,
            ProjectShortcutCancelledEvent::class,
        ];
    }

    /**
     * 处理事件.
     */
    public function process(object $event): void
    {
        $projectSpaceFiles = $event instanceof FilesBatchDeletedEvent
            ? $this->getProjectSpaceFiles($event)
            : null;
        $fileEntity = $this->getFileEntity($event);
        if ($fileEntity !== null && ! $this->taskFileDomainService->isProjectSpaceFile($fileEntity)) {
            return;
        }
        if ($event instanceof FilesBatchDeletedEvent && $projectSpaceFiles === []) {
            return;
        }

        // Debug: 记录接收到的事件
        $this->logger->info('ProjectOperatorLogSubscriber received event', [
            'event_class' => get_class($event),
        ]);

        // 使用 defer 延迟处理，避免阻塞主业务流程
        try {
            $ip = $this->getClientIp();
            $operationLogEntity = $this->convertEventToEntity($event, $ip, $projectSpaceFiles);
            if ($operationLogEntity !== null) {
                $this->projectOperationLogDomainService->saveOperationLog($operationLogEntity);
                $this->logger->info('项目操作日志已保存', [
                    'event_class' => get_class($event),
                    'project_id' => $operationLogEntity->getProjectId(),
                    'action' => $operationLogEntity->getOperationAction(),
                ]);
            }
            // 更新项目成员的活跃时间
            $this->updateUserLastActiveTime($event, $projectSpaceFiles);
        } catch (Throwable $e) {
            $this->logger->error('保存项目操作日志失败', [
                'event_class' => get_class($event),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 获取客户端IP地址，如果获取不到request则返回空字符串.
     */
    private function getClientIp(): string
    {
        try {
            if (! RequestContext::has()) {
                $this->logger->info('获取客户端IP失败，RequestContext不存在');
                return '';
            }
            $request = RequestContext::get();
            $ip = IpUtil::getClientIpAddress($request) ?? '';
            if ($ip === '') {
                $this->logger->info('获取客户端IP为空');
            }
            return $ip;
        } catch (Throwable $e) {
            $this->logger->warning('获取客户端IP异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return '';
        }
    }

    private function updateUserLastActiveTime(object $event, ?array $projectSpaceFiles = null): void
    {
        $projectId = null;
        $userId = null;
        $organizationCode = null;

        // 更新项目成员的活跃时间
        switch (true) {
            case $event instanceof ProjectUpdatedEvent:
                $projectId = $event->getProjectEntity()->getId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof FileUploadedEvent:
                if (! $this->taskFileDomainService->isProjectSpaceFile($event->getFileEntity())) {
                    return;
                }
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserId();
                $organizationCode = $event->getOrganizationCode();
                break;
            case $event instanceof FileDeletedEvent:
                if (! $this->taskFileDomainService->isProjectSpaceFile($event->getFileEntity())) {
                    return;
                }
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserId();
                $organizationCode = $event->getOrganizationCode();
                break;
            case $event instanceof FileRenamedEvent:
                if (! $this->taskFileDomainService->isProjectSpaceFile($event->getFileEntity())) {
                    return;
                }
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof FileMovedEvent:
                if (! $this->taskFileDomainService->isProjectSpaceFile($event->getFileEntity())) {
                    return;
                }
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof FileContentSavedEvent:
                if (! $this->taskFileDomainService->isProjectSpaceFile($event->getFileEntity())) {
                    return;
                }
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserId();
                $organizationCode = $event->getOrganizationCode();
                break;
            case $event instanceof FileReplacedEvent:
                if (! $this->taskFileDomainService->isProjectSpaceFile($event->getFileEntity())) {
                    return;
                }
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof DirectoryDeletedEvent:
                if (! $this->taskFileDomainService->isProjectSpaceFile($event->getDirectoryEntity())) {
                    return;
                }
                $projectId = $event->getDirectoryEntity()->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof FileBatchMoveEvent:
                $projectId = $event->getProjectId();
                $userId = $event->getUserId();
                $organizationCode = $event->getOrganizationCode();
                break;
            case $event instanceof FilesBatchDeletedEvent:
                if ($projectSpaceFiles === []) {
                    return;
                }
                $projectId = $event->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof ProjectMembersUpdatedEvent:
                $projectId = $event->getProjectEntity()->getId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof ProjectShortcutSetEvent:
                $projectId = $event->getProjectEntity()->getId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof ProjectShortcutCancelledEvent:
                $projectId = $event->getProjectEntity()->getId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
        }

        if ($projectId !== null) {
            $this->projectMemberDomainService->updateUserLastActiveTime($userId, $projectId, $organizationCode);
        }
    }

    private function getFileEntity(object $event): ?TaskFileEntity
    {
        return match (true) {
            $event instanceof FileUploadedEvent,
            $event instanceof FileDeletedEvent,
            $event instanceof FileRenamedEvent,
            $event instanceof FileMovedEvent,
            $event instanceof FileContentSavedEvent,
            $event instanceof FileReplacedEvent => $event->getFileEntity(),
            $event instanceof DirectoryDeletedEvent => $event->getDirectoryEntity(),
            default => null,
        };
    }

    /**
     * @return TaskFileEntity[]
     */
    private function getProjectSpaceFiles(FilesBatchDeletedEvent $event): array
    {
        return $this->taskFileDomainService->filterProjectSpaceFiles($event->getAllEntities());
    }

    /**
     * 将事件转换为操作日志实体.
     */
    private function convertEventToEntity(object $event, string $ip, ?array $projectSpaceFiles = null): ?ProjectOperationLogEntity
    {
        $entity = new ProjectOperationLogEntity();

        switch (true) {
            case $event instanceof ProjectCreatedEvent:
                $project = $event->getProjectEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($project->getId());
                $entity->setOperationAction(OperationAction::CREATE_PROJECT);
                $entity->setResourceType(ResourceType::PROJECT);
                $entity->setResourceId((string) $project->getId());
                $entity->setOperationDetails([
                    'project_name' => $project->getProjectName(),
                    'project_description' => $project->getProjectDescription(),
                    'project_mode' => $project->getProjectMode(),
                ]);
                break;
            case $event instanceof ProjectUpdatedEvent:
                $project = $event->getProjectEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($project->getId());
                $entity->setOperationAction(OperationAction::UPDATE_PROJECT);
                $entity->setResourceType(ResourceType::PROJECT);
                $entity->setResourceId((string) $project->getId());
                $entity->setOperationDetails([
                    'project_name' => $project->getProjectName(),
                    'project_description' => $project->getProjectDescription(),
                ]);
                break;
            case $event instanceof ProjectDeletedEvent:
                $project = $event->getProjectEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($project->getId());
                $entity->setOperationAction(OperationAction::DELETE_PROJECT);
                $entity->setResourceType(ResourceType::PROJECT);
                $entity->setResourceId((string) $project->getId());
                break;
            case $event instanceof ProjectsBatchDeletedEvent:
                $userAuthorization = $event->getUserAuthorization();
                $projectIds = $event->getProjectIds();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId(0);
                $entity->setOperationAction(OperationAction::BATCH_DELETE_PROJECT);
                $entity->setResourceType(ResourceType::PROJECT);
                $entity->setResourceId('batch');
                $entity->setOperationDetails([
                    'project_ids' => $projectIds,
                    'count' => count($projectIds),
                ]);
                break;
            case $event instanceof TopicCreatedEvent:
                $topic = $event->getTopicEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($topic->getProjectId());
                $entity->setOperationAction(OperationAction::CREATE_TOPIC);
                $entity->setResourceType(ResourceType::TOPIC);
                $entity->setResourceId((string) $topic->getId());
                $entity->setOperationDetails([
                    'topic_name' => $topic->getTopicName(),
                ]);
                break;
            case $event instanceof TopicUpdatedEvent:
                $topic = $event->getTopicEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($topic->getProjectId());
                $entity->setOperationAction(OperationAction::UPDATE_TOPIC);
                $entity->setResourceType(ResourceType::TOPIC);
                $entity->setResourceId((string) $topic->getId());
                $entity->setOperationDetails([
                    'topic_name' => $topic->getTopicName(),
                ]);
                break;
            case $event instanceof TopicDeletedEvent:
                $topic = $event->getTopicEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($topic->getProjectId());
                $entity->setOperationAction(OperationAction::DELETE_TOPIC);
                $entity->setResourceType(ResourceType::TOPIC);
                $entity->setResourceId((string) $topic->getId());
                break;
            case $event instanceof TopicRenamedEvent:
                $topic = $event->getTopicEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($topic->getProjectId());
                $entity->setOperationAction(OperationAction::RENAME_TOPIC);
                $entity->setResourceType(ResourceType::TOPIC);
                $entity->setResourceId((string) $topic->getId());
                $entity->setOperationDetails([
                    'topic_name' => $topic->getTopicName(),
                ]);
                break;
            case $event instanceof FileUploadedEvent:
                $file = $event->getFileEntity();
                // 获取用户授权信息
                $entity->setUserId($event->getUserId());
                $entity->setOrganizationCode($event->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($file->getProjectId());
                $entity->setOperationAction(OperationAction::UPLOAD_FILE);
                $entity->setResourceType(ResourceType::FILE);
                $entity->setResourceId((string) $file->getFileId());
                $entity->setOperationDetails([
                    'file_name' => $file->getFileName(),
                    'parent_id' => $file->getParentId(),
                    'is_directory' => $file->getIsDirectory(),
                ]);
                break;
            case $event instanceof FileDeletedEvent:
                $file = $event->getFileEntity();
                // 获取用户授权信息
                $entity->setUserId($event->getUserId());
                $entity->setOrganizationCode($event->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($file->getProjectId());
                $entity->setOperationAction(OperationAction::DELETE_FILE);
                $entity->setResourceType(ResourceType::FILE);
                $entity->setResourceId((string) $file->getFileId());
                break;
            case $event instanceof FileRenamedEvent:
                $file = $event->getFileEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($file->getProjectId());
                $entity->setOperationAction(OperationAction::RENAME_FILE);
                $entity->setResourceType(ResourceType::FILE);
                $entity->setResourceId((string) $file->getFileId());
                $entity->setOperationDetails([
                    'file_name' => $file->getFileName(),
                    'parent_id' => $file->getParentId(),
                    'is_directory' => $file->getIsDirectory(),
                ]);
                break;
            case $event instanceof FileMovedEvent:
                $file = $event->getFileEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($file->getProjectId());
                $entity->setOperationAction(OperationAction::MOVE_FILE);
                $entity->setResourceType(ResourceType::FILE);
                $entity->setResourceId((string) $file->getFileId());
                $entity->setOperationDetails([
                    'file_name' => $file->getFileName(),
                    'parent_id' => $file->getParentId(),
                    'is_directory' => $file->getIsDirectory(),
                ]);
                break;
            case $event instanceof FileContentSavedEvent:
                $file = $event->getFileEntity();
                // 获取用户授权信息
                $entity->setUserId($event->getUserId());
                $entity->setOrganizationCode($event->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($file->getProjectId());
                $entity->setOperationAction(OperationAction::SAVE_FILE_CONTENT);
                $entity->setResourceType(ResourceType::FILE);
                $entity->setResourceId((string) $file->getFileId());
                $entity->setOperationDetails([]);
                break;
            case $event instanceof FileReplacedEvent:
                $file = $event->getFileEntity();
                $versionEntity = $event->getVersionEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($file->getProjectId());
                $entity->setOperationAction(OperationAction::REPLACE_FILE);
                $entity->setResourceType(ResourceType::FILE);
                $entity->setResourceId((string) $file->getFileId());
                // 详细的操作信息
                $operationDetails = [
                    'file_name' => $file->getFileName(),
                    'file_extension' => $file->getFileExtension(),
                    'file_size' => $file->getFileSize(),
                    'is_cross_type_replace' => $event->isCrossTypeReplace(),
                ];
                // 如果创建了版本快照，记录版本ID
                if ($versionEntity !== null) {
                    $operationDetails['version_id'] = $versionEntity->getId();
                }
                $entity->setOperationDetails($operationDetails);
                break;
            case $event instanceof DirectoryDeletedEvent:
                $directory = $event->getDirectoryEntity();
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($directory->getProjectId());
                $entity->setOperationAction(OperationAction::DELETE_DIRECTORY);
                $entity->setResourceType(ResourceType::DIRECTORY);
                $entity->setResourceId((string) $directory->getFileId());
                break;
            case $event instanceof FileBatchMoveEvent:
                $entity->setUserId($event->getUserId());
                $entity->setOrganizationCode($event->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($event->getProjectId());
                $entity->setOperationAction(OperationAction::BATCH_MOVE_FILE);
                $entity->setResourceType(ResourceType::FILE);
                $entity->setResourceId('batch');
                $entity->setOperationDetails([
                    'parent_id' => $event->getTargetParentId(),
                    'file_ids' => $event->getFileIds(),
                ]);
                break;
            case $event instanceof FilesBatchDeletedEvent:
                // 获取用户授权信息
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($event->getProjectId());
                $entity->setOperationAction(OperationAction::BATCH_DELETE_FILE);
                $entity->setResourceType(ResourceType::FILE);
                $entity->setResourceId('batch');
                $entity->setOperationDetails([
                    'file_ids' => array_map(
                        static fn (TaskFileEntity $fileEntity): int => $fileEntity->getFileId(),
                        $projectSpaceFiles ?? $this->getProjectSpaceFiles($event)
                    ),
                ]);
                break;
            case $event instanceof ProjectMembersUpdatedEvent:
                $project = $event->getProjectEntity();
                $members = $event->getCurrentMembers();
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($project->getId());
                $entity->setOperationAction(OperationAction::UPDATE_PROJECT_MEMBERS);
                $entity->setResourceType(ResourceType::PROJECT);
                $entity->setResourceId((string) $project->getId());
                $entity->setOperationDetails(['members' => $members]);
                break;
            case $event instanceof ProjectShortcutSetEvent:
                $project = $event->getProjectEntity();
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($project->getId());
                $entity->setOperationAction(OperationAction::SET_PROJECT_SHORTCUT);
                $entity->setResourceType(ResourceType::PROJECT);
                $entity->setResourceId((string) $project->getId());
                $entity->setOperationDetails([
                    'workspace_id' => $event->getWorkspaceId(),
                    'project_name' => $project->getProjectName(),
                ]);
                break;
            case $event instanceof ProjectShortcutCancelledEvent:
                $project = $event->getProjectEntity();
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($project->getId());
                $entity->setOperationAction(OperationAction::CANCEL_PROJECT_SHORTCUT);
                $entity->setResourceType(ResourceType::PROJECT);
                $entity->setResourceId((string) $project->getId());
                $entity->setOperationDetails([
                    'project_name' => $project->getProjectName(),
                ]);
                break;
            default:
                $this->logger->warning('未处理的事件类型', ['event_class' => get_class($event)]);
                return null;
        }

        return $entity;
    }
}
