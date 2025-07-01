<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Crontab;

use App\Application\Flow\ExecuteManager\Archive\FlowExecutorArchiveCloud;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\MagicFlowExecutor;
use App\Domain\Flow\Entity\MagicFlowExecuteLogEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Service\MagicFlowExecuteLogDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Coroutine\Parallel;
use Hyperf\Crontab\Annotation\Crontab;
use Psr\Container\ContainerInterface;

#[Crontab(rule: '* * * * *', name: 'FlowBreakpointRetryCrontab', singleton: true, mutexExpires: 60 * 5, onOneServer: true, callback: 'execute', memo: '流程断点重试定时任务', enable: true)]
class FlowBreakpointRetryCrontab
{
    private MagicFlowExecuteLogDomainService $magicFlowExecuteLogDomainService;

    private LockerInterface $locker;

    public function __construct(ContainerInterface $container)
    {
        $this->magicFlowExecuteLogDomainService = $container->get(MagicFlowExecuteLogDomainService::class);
        $this->locker = $container->get(LockerInterface::class);
    }

    public function execute(): void
    {
        $flowDataIsolation = FlowDataIsolation::create()->disabled();

        $page = new Page(1, 200);
        $maxPage = 1000;
        $parallel = new Parallel(50);
        while (true) {
            $parallel->clear();
            // 获取所有 10 分钟还在进行中的流程
            $list = $this->magicFlowExecuteLogDomainService->getRunningTimeoutList($flowDataIsolation, 60 * 10, $page);
            if (empty($list)) {
                break;
            }
            foreach ($list as $magicFlowExecuteLogEntity) {
                $parallel->add(function () use ($magicFlowExecuteLogEntity) {
                    $this->retry($magicFlowExecuteLogEntity);
                });
            }
            $parallel->wait();
            $page->setNextPage();
            if ($page->getPage() > $maxPage) {
                break;
            }
        }
    }

    private function retry(MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): void
    {
        $lockKey = "FlowBreakpointRetryCrontab-{$magicFlowExecuteLogEntity->getExecuteDataId()}";
        $lockOwner = 'FlowBreakpointRetryCrontab';
        if (! $this->locker->mutexLock($lockKey, $lockOwner, 60 * 10)) {
            return;
        }

        try {
            $flowDataIsolation = FlowDataIsolation::create()->disabled();

            // 实时查询最新
            $magicFlowExecuteLogEntity = $this->magicFlowExecuteLogDomainService->getByExecuteId($flowDataIsolation, $magicFlowExecuteLogEntity->getExecuteDataId());
            if ($magicFlowExecuteLogEntity->getRetryCount() >= 1) {
                return;
            }

            // 重试次数 +1
            $this->magicFlowExecuteLogDomainService->incrementRetryCount($flowDataIsolation, $magicFlowExecuteLogEntity);

            $extParams = $magicFlowExecuteLogEntity->getExtParams();
            $archive = FlowExecutorArchiveCloud::get($extParams['organization_code'], (string) $magicFlowExecuteLogEntity->getExecuteDataId());
            $flowEntity = $archive['magic_flow'];
            /** @var ExecutionData $executionData */
            $executionData = $archive['execution_data'];
            // 重置一些记录
            $executionData->rewind();

            $executor = new MagicFlowExecutor($flowEntity, $executionData, lastMagicFlowExecuteLogEntity: $magicFlowExecuteLogEntity);
            $executor->execute();
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }
}
