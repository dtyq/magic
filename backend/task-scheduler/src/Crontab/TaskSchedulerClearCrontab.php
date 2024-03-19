<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Crontab;

use DateInterval;
use DateTime;
use Dtyq\TaskScheduler\Entity\Query\Page;
use Dtyq\TaskScheduler\Entity\Query\TaskSchedulerQuery;
use Dtyq\TaskScheduler\Entity\TaskScheduler;
use Dtyq\TaskScheduler\Service\TaskSchedulerDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

use function Hyperf\Config\config;

class TaskSchedulerClearCrontab
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
        // 清理超过 n 天的调度数据
        $clearDays = config('task_scheduler.clear_days', 3);
        $clearTime = (new DateTime())->sub(new DateInterval("P{$clearDays}D"));

        $query = new TaskSchedulerQuery();
        $query->setOrder(['id' => 'asc']);
        // 1 页 1 页慢慢删除
        $page = new Page(1, 1000);
        $limitPage = 100;
        while (true) {
            $data = $this->scheduleTaskDomainService->queries($query, $page);
            $list = $data['list'] ?? [];
            if (empty($list)) {
                break;
            }
            $clearIds = [];
            foreach ($list as $scheduleTask) {
                if ($scheduleTask->getExpectTime() < $clearTime) {
                    $clearIds[] = $scheduleTask->getId();
                }
            }
            if (! empty($clearIds)) {
                $this->scheduleTaskDomainService->deleteByIds($clearIds);
                $this->logger->info('清理调度数据', [
                    'clear_ids' => $clearIds,
                ]);
            }
            /** @var TaskScheduler $end */
            $end = end($list);
            if ($end->getExpectTime() >= $clearTime) {
                break;
            }
            $page->setNextPage();
            if ($page->getPage() > $limitPage) {
                break;
            }
        }
    }
}
