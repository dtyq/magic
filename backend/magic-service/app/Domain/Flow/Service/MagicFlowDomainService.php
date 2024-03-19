<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Application\Flow\Service\MagicFlowExecuteAppService;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine\RoutineType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\StartNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowQuery;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Domain\Flow\Event\MagicFlowPublishedEvent;
use App\Domain\Flow\Event\MagicFLowSavedEvent;
use App\Domain\Flow\Repository\Facade\MagicFlowRepositoryInterface;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use DateTime;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\TaskScheduler\Entity\TaskScheduler;
use Dtyq\TaskScheduler\Entity\TaskSchedulerCrontab;
use Dtyq\TaskScheduler\Service\TaskSchedulerDomainService;
use Throwable;

class MagicFlowDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowRepositoryInterface $magicFlowRepository,
        private readonly TaskSchedulerDomainService $taskSchedulerDomainService,
    ) {
    }

    /**
     * 获取节点配置模板.
     */
    public function getNodeTemplate(FlowDataIsolation $dataIsolation, Node $node): Node
    {
        return Node::generateTemplate($node->getNodeType(), $node->getParams(), $node->getNodeVersion());
    }

    /**
     * 获取流程.
     */
    public function getByCode(FlowDataIsolation $dataIsolation, string $code): ?MagicFlowEntity
    {
        return $this->magicFlowRepository->getByCode($dataIsolation, $code);
    }

    /**
     * 获取流程.
     * @return array<MagicFlowEntity>
     */
    public function getByCodes(FlowDataIsolation $dataIsolation, array $codes): array
    {
        return $this->magicFlowRepository->getByCodes($dataIsolation, $codes);
    }

    /**
     * 获取流程.
     */
    public function getByName(FlowDataIsolation $dataIsolation, string $name, Type $type): ?MagicFlowEntity
    {
        return $this->magicFlowRepository->getByName($dataIsolation, $name, $type);
    }

    public function createByAgent(FlowDataIsolation $dataIsolation, MagicFlowEntity $savingMagicFlow): MagicFlowEntity
    {
        $savingMagicFlow->prepareForCreation();
        $savingMagicFlow->setEnabled(true);
        return $this->magicFlowRepository->save($dataIsolation, $savingMagicFlow);
    }

    public function create(FlowDataIsolation $dataIsolation, MagicFlowEntity $savingMagicFlow): MagicFlowEntity
    {
        $dateTime = new DateTime();
        $savingMagicFlow->setCreatedAt($dateTime);
        $savingMagicFlow->setUpdatedAt($dateTime);
        $flow = $this->magicFlowRepository->save($dataIsolation, $savingMagicFlow);
        AsyncEventUtil::dispatch(new MagicFLowSavedEvent($flow, true));
        return $flow;
    }

    /**
     * 保存流程，仅基础信息.
     */
    public function save(FlowDataIsolation $dataIsolation, MagicFlowEntity $savingMagicFlow): MagicFlowEntity
    {
        $savingMagicFlow->setCreator($dataIsolation->getCurrentUserId());
        $savingMagicFlow->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        if ($savingMagicFlow->shouldCreate()) {
            $magicFlow = clone $savingMagicFlow;
            $magicFlow->prepareForCreation();
        } else {
            $magicFlow = $this->magicFlowRepository->getByCode($dataIsolation, $savingMagicFlow->getCode());
            if (! $magicFlow) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => $savingMagicFlow->getCode()]);
            }
            $savingMagicFlow->prepareForModification($magicFlow);
        }

        $flow = $this->magicFlowRepository->save($dataIsolation, $magicFlow);
        AsyncEventUtil::dispatch(new MagicFLowSavedEvent($flow, $savingMagicFlow->shouldCreate()));
        return $flow;
    }

    /**
     * 保存节点，nodes、edges.
     */
    public function saveNode(FlowDataIsolation $dataIsolation, MagicFlowEntity $savingMagicFlow): MagicFlowEntity
    {
        $magicFlow = $this->magicFlowRepository->getByCode($dataIsolation, $savingMagicFlow->getCode());
        if (! $magicFlow) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => $savingMagicFlow->getCode()]);
        }
        $savingMagicFlow->prepareForSaveNode($magicFlow);

        // todo 检测子流程循环调用

        $this->magicFlowRepository->save($dataIsolation, $magicFlow);

        AsyncEventUtil::dispatch(new MagicFlowPublishedEvent($magicFlow));
        return $magicFlow;
    }

    /**
     * 删除流程.
     */
    public function destroy(FlowDataIsolation $dataIsolation, MagicFlowEntity $deletingMagicFlow): void
    {
        $deletingMagicFlow->prepareForDeletion();
        $this->magicFlowRepository->remove($dataIsolation, $deletingMagicFlow);
    }

    /**
     * 查询流程.
     * @return array{total: int, list: array<MagicFlowEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFLowQuery $query, Page $page): array
    {
        return $this->magicFlowRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * 修改流程状态.
     */
    public function changeEnable(FlowDataIsolation $dataIsolation, MagicFlowEntity $magicFlow, ?bool $enable = null): void
    {
        // 如果传入了明确的状态值，则直接设置
        if ($enable !== null) {
            // 如果当前状态与要设置的状态相同，则无需操作
            if ($magicFlow->isEnabled() === $enable) {
                return;
            }
            $magicFlow->setEnabled($enable);
        } else {
            // 否则保持原有的自动切换逻辑
            $magicFlow->prepareForChangeEnable();
        }

        // 如果启用状态为true，需要进行验证
        if ($magicFlow->isEnabled() && empty($magicFlow->getNodes())) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.node.cannot_enable_empty_nodes');
        }

        $this->magicFlowRepository->changeEnable($dataIsolation, $magicFlow->getCode(), $magicFlow->isEnabled());
    }

    /**
     * 创建定时任务.
     */
    public function createRoutine(FlowDataIsolation $dataIsolation, MagicFlowEntity $magicFlow): void
    {
        // 获取开始节点的定时配置
        /** @var null|StartNodeParamsConfig $startNodeParamsConfig */
        $startNodeParamsConfig = $magicFlow->getStartNode()?->getNodeParamsConfig();
        if (! $startNodeParamsConfig) {
            return;
        }
        $startNodeParamsConfig->validate();
        $routineConfigs = $startNodeParamsConfig->getRoutineConfigs();

        // 使用流程的 code 作为外部 id
        $externalId = $magicFlow->getCode();
        $retryTimes = 2;
        $callbackMethod = [MagicFlowExecuteAppService::class, 'routine'];
        $callbackParams = [
            'flowCode' => $magicFlow->getCode(),
        ];

        // 先清理一下历史定时任务和调度规则
        $this->taskSchedulerDomainService->clearByExternalId($externalId);

        foreach ($routineConfigs as $branchId => $routineConfig) {
            try {
                $routineConfig->validate();
            } catch (Throwable $throwable) {
                simple_logger('CreateRoutine')->notice('无效的定时规则', [
                    'flowCode' => $magicFlow->getCode(),
                    'branchId' => $branchId,
                    'routineConfig' => $routineConfig->toConfigArray(),
                    'error' => $throwable->getMessage(),
                ]);
            }

            $callbackParams['branchId'] = $branchId;
            $callbackParams['routineConfig'] = $routineConfig->toConfigArray();
            // 如果是不重复的，那么是直接创建调度任务
            if ($routineConfig->getType() === RoutineType::NoRepeat) {
                $taskScheduler = new TaskScheduler();
                $taskScheduler->setExternalId($externalId);
                $taskScheduler->setName($magicFlow->getCode());
                $taskScheduler->setExpectTime($routineConfig->getDatetime());
                $taskScheduler->setType(2);
                $taskScheduler->setRetryTimes($retryTimes);
                $taskScheduler->setCallbackMethod($callbackMethod);
                $taskScheduler->setCallbackParams($callbackParams);
                $taskScheduler->setCreator($magicFlow->getCode());
                $this->taskSchedulerDomainService->create($taskScheduler);
            } else {
                $crontabRule = $routineConfig->getCrontabRule();
                $taskSchedulerCrontab = new TaskSchedulerCrontab();
                $taskSchedulerCrontab->setExternalId($externalId);
                $taskSchedulerCrontab->setName($magicFlow->getCode());
                $taskSchedulerCrontab->setCrontab($crontabRule);
                $taskSchedulerCrontab->setRetryTimes($retryTimes);
                $taskSchedulerCrontab->setEnabled(true);
                $taskSchedulerCrontab->setCallbackMethod($callbackMethod);
                $taskSchedulerCrontab->setCallbackParams($callbackParams);
                $taskSchedulerCrontab->setCreator($magicFlow->getCode());
                $taskSchedulerCrontab->setDeadline($routineConfig->getDeadline());
                $this->taskSchedulerDomainService->createCrontab($taskSchedulerCrontab);
            }
        }
    }
}
