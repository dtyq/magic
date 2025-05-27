<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Crontab;

use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskAfterEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\SandboxInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\SandboxResult;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\Crontab\Annotation\Crontab;
use Throwable;

/**
 * 检查长时间处于运行状态的任务
 */
#[Crontab(rule: '15 * * * *', name: 'CheckTaskStatus', singleton: true, onOneServer: true, callback: 'execute', memo: '每小时的第15分钟检查超过6小时未完成的话题和容器状态')]
readonly class CheckTaskStatusTask
{
    public function __construct(
        protected TaskDomainService $taskDomainService,
        protected TopicDomainService $topicDomainService,
        protected StdoutLoggerInterface $logger,
        protected SandboxInterface $sandboxService,
    ) {
    }

    /**
     * 执行任务，检查超过7小时未更新的任务并根据沙箱状态更新任务状态
     */
    public function execute(): void
    {
        $this->logger->info('[CheckTaskStatusTask] 开始检查长时间未更新的任务');
        try {
            // 检查任务状态和容器状态
            $this->checkTasksStatus();
        } catch (Throwable $e) {
            $this->logger->error(sprintf('[CheckTaskStatusTask] 执行失败: %s', $e->getMessage()));
        }
    }

    /**
     * 检查任务状态和容器状态
     */
    private function checkTasksStatus(): void
    {
        try {
            // 获取6小时前的时间点
            $timeThreshold = date('Y-m-d H:i:s', strtotime('-6 hours'));

            // 获取超时话题列表（更新时间超过7小时的话题，最多100条）
            $staleRunningTopics = $this->topicDomainService->getTopicsExceedingUpdateTime($timeThreshold, 100);

            if (empty($staleRunningTopics)) {
                $this->logger->info('[CheckTaskStatusTask] 没有需要检查的超时话题');
                return;
            }

            $this->logger->info(sprintf('[CheckTaskStatusTask] 开始检查 %d 个超时话题的容器状态', count($staleRunningTopics)));

            $updatedToRunningCount = 0;
            $updatedToErrorCount = 0;

            foreach ($staleRunningTopics as $topic) {
                $sandboxId = $topic->getSandboxId();
                if (empty($sandboxId)) {
                    continue;
                }

                // 每次循环后休眠0.1秒，避免请求过于频繁
                usleep(100000); // 100000微秒 = 0.1秒

                // 调用SandboxService的getStatus接口获取容器状态
                $result = $this->sandboxService->getStatus($sandboxId);

                // 如果沙箱存在且状态为 running，直接返回该沙箱
                if ($result->getCode() === SandboxResult::Normal
                    && $result->getSandboxData()->getStatus() === 'running') {
                    $this->logger->info(sprintf('沙箱状态正常(running): sandboxId=%s', $sandboxId));
                    continue;
                }

                // 记录需要创建新沙箱的原因
                if ($result->getCode() === SandboxResult::NotFound) {
                    $errMsg = '沙箱不存在';
                } elseif ($result->getCode() === SandboxResult::Normal
                    && $result->getSandboxData()->getStatus() === 'exited') {
                    $errMsg = '沙箱已经退出';
                } else {
                    $errMsg = '沙箱异常';
                }

                // 获取当前任务
                $taskId = $topic->getCurrentTaskId();
                if ($taskId) {
                    // 更新任务状态
                    $this->taskDomainService->updateTaskStatusByTaskId($taskId, TaskStatus::ERROR, $errMsg);
                }

                // 更新话题状态
                $this->topicDomainService->updateTopicStatus($topic->getId(), $taskId, TaskStatus::ERROR);

                // 触发完成事件
                AsyncEventUtil::dispatch(new RunTaskAfterEvent($topic->getUserOrganizationCode(), $topic->getUserId(), $topic->getId(), $taskId, TaskStatus::ERROR->value, null));
                ++$updatedToErrorCount;
            }

            $this->logger->info(sprintf(
                '[CheckTaskStatusTask] 检查完成，共更新 %d 个话题为运行状态，%d 个话题为错误状态',
                $updatedToRunningCount,
                $updatedToErrorCount
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf('[CheckTaskStatusTask] 检查任务状态失败: %s', $e->getMessage()));
            throw $e;
        }
    }
}
