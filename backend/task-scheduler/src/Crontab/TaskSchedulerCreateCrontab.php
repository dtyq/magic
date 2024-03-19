<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Crontab;

use DateTime;
use Dtyq\TaskScheduler\Entity\Query\Page;
use Dtyq\TaskScheduler\Entity\Query\TaskSchedulerCrontabQuery;
use Dtyq\TaskScheduler\Service\TaskSchedulerDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Config\config;

class TaskSchedulerCreateCrontab
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly TaskSchedulerDomainService $scheduleTaskDomainService,
        private readonly LoggerFactory $loggerFactory
    ) {
        $this->logger = $this->loggerFactory->get('task_scheduler');
    }

    public function execute(): void
    {
        $days = config('task_scheduler.crontab_days', 3);
        $lastTime = new DateTime();
        // 获取 lastTime 超过的数据
        $query = new TaskSchedulerCrontabQuery();
        $query->setLastGenTimeGt($lastTime);
        $query->setEnable(true);
        $page = new Page(1, 100);
        $limitPage = 100;
        while (true) {
            $data = $this->scheduleTaskDomainService->queriesCrontab($query, $page);
            $list = $data['list'] ?? [];
            if (empty($list)) {
                break;
            }
            foreach ($list as $scheduleTask) {
                try {
                    $this->scheduleTaskDomainService->createByCrontab($scheduleTask, $days);
                } catch (Throwable $throwable) {
                    $this->logger->notice('创建调度失败', [
                        'task_scheduler_id' => $scheduleTask->getId(),
                        'exception' => $throwable->getMessage(),
                    ]);
                }
            }
            if ($data['total'] <= $page->getPageNum() * $page->getPage()) {
                break;
            }
            $page->setNextPage();
            if ($page->getPage() > $limitPage) {
                break;
            }
        }
    }
}
