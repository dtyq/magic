<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\RecycleBin\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * 回收站话题移动领域服务.
 *
 * 负责回收站内话题移动的核心业务逻辑：
 * - 验证目标项目存在
 * - 更新话题的 project_id 和 workspace_id
 * - 级联更新任务的 project_id 和 workspace_id
 */
class TopicRecycleDomainService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected TopicRepositoryInterface $topicRepository,
        protected TaskRepositoryInterface $taskRepository,
        protected ProjectRepositoryInterface $projectRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * 移动话题到目标项目.
     *
     * @param int $topicId 话题ID
     * @param int $targetProjectId 目标项目ID
     * @param string $userId 操作用户ID
     * @throws RuntimeException
     */
    public function moveTopicInRecycleBin(int $topicId, int $targetProjectId, string $userId): TopicEntity
    {
        $currentTime = date('Y-m-d H:i:s');

        $topic = $this->topicRepository->getTopicById($topicId);
        if (! $topic) {
            throw new RuntimeException('话题不存在');
        }

        $targetProject = $this->projectRepository->findById($targetProjectId);
        if (! $targetProject) {
            throw new RuntimeException('目标项目不存在');
        }

        $originalProjectId = $topic->getProjectId();
        $targetWorkspaceId = $targetProject->getWorkspaceId();

        if ($originalProjectId === $targetProjectId) {
            $this->logger->info('话题已在目标项目中，无需移动', [
                'topic_id' => $topicId,
                'project_id' => $targetProjectId,
            ]);
            return $topic;
        }

        $this->logger->info('开始移动话题', [
            'topic_id' => $topicId,
            'from_project_id' => $originalProjectId,
            'to_project_id' => $targetProjectId,
            'to_workspace_id' => $targetWorkspaceId,
            'user_id' => $userId,
        ]);

        $topicUpdateResult = $this->topicRepository->updateTopicByCondition(
            ['id' => $topicId],
            [
                'project_id' => $targetProjectId,
                'workspace_id' => $targetWorkspaceId,
                'updated_uid' => $userId,
                'updated_at' => $currentTime,
            ]
        );

        if (! $topicUpdateResult) {
            throw new RuntimeException('更新话题信息失败');
        }

        // 级联更新任务（任务跟随话题移动）
        $this->taskRepository->updateTaskByCondition(
            ['topic_id' => $topicId],
            [
                'project_id' => $targetProjectId,
                'workspace_id' => $targetWorkspaceId,
                'updated_at' => $currentTime,
            ]
        );

        $this->logger->info('话题移动成功', [
            'topic_id' => $topicId,
            'from_project_id' => $originalProjectId,
            'to_project_id' => $targetProjectId,
            'to_workspace_id' => $targetWorkspaceId,
        ]);

        $updatedTopic = $this->topicRepository->getTopicById($topicId);
        if (! $updatedTopic) {
            throw new RuntimeException('移动后无法获取话题信息');
        }

        return $updatedTopic;
    }
}
