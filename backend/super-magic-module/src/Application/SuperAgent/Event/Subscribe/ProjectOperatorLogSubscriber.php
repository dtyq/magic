<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\SuperAgent\Constants\OperationAction;
use Dtyq\SuperMagic\Domain\SuperAgent\Constants\ResourceType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectOperationLogEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\DirectoryDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchMoveEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileContentSavedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileMovedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileRenamedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FilesBatchDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectCreatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectMembersUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicCreatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicRenamedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectOperationLogDomainService;
use Dtyq\SuperMagic\Infrastructure\Utils\IpUtil;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 项目审计日志事件监听器.
 */
#[AsyncListener]
#[Listener]
class ProjectOperatorLogSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly ProjectOperationLogDomainService $projectOperationLogDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly RequestInterface $request,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
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
            DirectoryDeletedEvent::class,
            FileBatchMoveEvent::class,
            FilesBatchDeletedEvent::class,

            // 项目成员操作事件
            ProjectMembersUpdatedEvent::class,
        ];
    }

    /**
     * 处理事件.
     */
    public function process(object $event): void
    {
        // 使用 defer 延迟处理，避免阻塞主业务流程
        try {
            $ip = IpUtil::getClientIpAddress($this->request);
            $operationLogEntity = $this->convertEventToEntity($event, $ip);
            if ($operationLogEntity !== null) {
                $this->projectOperationLogDomainService->saveOperationLog($operationLogEntity);
                $this->logger->info('项目操作日志已保存', [
                    'event_class' => get_class($event),
                    'project_id' => $operationLogEntity->getProjectId(),
                    'action' => $operationLogEntity->getOperationAction(),
                ]);
            }
            // 更新项目成员的活跃时间
            $this->updateUserLastActiveTime($event);
        } catch (Throwable $e) {
            $this->logger->error('保存项目操作日志失败', [
                'event_class' => get_class($event),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    private function updateUserLastActiveTime(object $event): void
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
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof FileDeletedEvent:
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof FileRenamedEvent:
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof FileMovedEvent:
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof FileContentSavedEvent:
                $projectId = $event->getFileEntity()->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof DirectoryDeletedEvent:
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
                $projectId = $event->getProjectId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
            case $event instanceof ProjectMembersUpdatedEvent:
                $projectId = $event->getProjectEntity()->getId();
                $userId = $event->getUserAuthorization()->getId();
                $organizationCode = $event->getUserAuthorization()->getOrganizationCode();
                break;
        }

        if ($projectId !== null) {
            $this->projectMemberDomainService->updateUserLastActiveTime($userId, $projectId, $organizationCode);
            $this->projectDomainService->updateUpdatedAtToNow($projectId);
        }
    }

    /**
     * 将事件转换为操作日志实体.
     */
    private function convertEventToEntity(object $event, string $ip): ?ProjectOperationLogEntity
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
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
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
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
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
                $userAuthorization = $event->getUserAuthorization();
                $entity->setUserId($userAuthorization->getId());
                $entity->setOrganizationCode($userAuthorization->getOrganizationCode());
                $entity->setOperationStatus('success');
                $entity->setIpAddress($ip);
                $entity->setProjectId($file->getProjectId());
                $entity->setOperationAction(OperationAction::SAVE_FILE_CONTENT);
                $entity->setResourceType(ResourceType::FILE);
                $entity->setResourceId((string) $file->getFileId());
                $entity->setOperationDetails([]);
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
                    'file_ids' => $event->getFileIds(),
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
            default:
                $this->logger->warning('未处理的事件类型', ['event_class' => get_class($event)]);
                return null;
        }

        return $entity;
    }
}
