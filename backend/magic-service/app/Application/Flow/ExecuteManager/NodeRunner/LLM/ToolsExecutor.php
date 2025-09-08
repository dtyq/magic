<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\LLM;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\ExecutionData\TriggerData;
use App\Application\Flow\ExecuteManager\MagicFlowExecutor;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\OptionTool;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Domain\Flow\Factory\MagicFlowFactory;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\BuiltInToolSet\BuiltInToolSetCollector;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;
use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Structure\Form\Form;
use Hyperf\Context\Context;
use Hyperf\Engine\Coroutine;
use Hyperf\Odin\Tool\AbstractTool;
use Hyperf\Odin\Tool\Definition\ToolParameters;
use Throwable;

use function Hyperf\Coroutine\co;

class ToolsExecutor extends AbstractTool
{
    protected bool $validateParameters = false;

    private MagicFlowEntity $magicFlowEntity;

    private ExecutionData $executionData;

    private OptionTool $optionTool;

    private array $customSystemInput = [];

    /**
     * @param array<OptionTool> $optionTools
     * @return ToolsExecutor[]
     * @throws FlowExprEngineException
     */
    public static function createTools(FlowDataIsolation $dataIsolation, ExecutionData $executionData, array $optionTools = []): array
    {
        $tools = [];
        $toolsFlows = self::getToolFlows($dataIsolation, array_keys($optionTools));
        foreach ($toolsFlows as $toolsFlow) {
            if ($toolsFlow->getType() !== Type::Tools) {
                continue;
            }
            if (! $toolsFlow->isEnabled()) {
                continue;
            }
            $optionTool = $optionTools[$toolsFlow->getCode()] ?? null;
            if (! $optionTool) {
                continue;
            }

            // 这里就应该检测 系统输入
            $customSystemInput = $optionTool->getCustomSystemInput()?->getFormComponent()?->getForm()?->getKeyValue($executionData->getExpressionFieldData()) ?? [];

            $tool = new ToolsExecutor();
            $tool->setMagicFlowEntity($toolsFlow);
            $tool->setExecutionData($executionData);
            $tool->setOptionTool($optionTool);
            $tool->setCustomSystemInput($customSystemInput);
            $tool->setName($toolsFlow->getName());
            $tool->setDescription($toolsFlow->getDescription());
            $tool->createParametersByForm($toolsFlow->getInput()->getForm()?->getForm());
            $tools[] = $tool;
        }

        return $tools;
    }

    /**
     * @return array<MagicFlowEntity>
     */
    public static function getToolFlows(FlowDataIsolation $dataIsolation, array $codes, bool $keyWithCode = false): array
    {
        if (empty($codes)) {
            return [];
        }
        $list = [];
        // 优先尝试内置工具
        foreach (BuiltInToolSetCollector::list() as $builtInToolSet) {
            foreach ($builtInToolSet->getTools() as $tool) {
                if (in_array($tool->getCode(), $codes)) {
                    $toolFlow = $tool->generateToolFlow($dataIsolation->getCurrentOrganizationCode());
                    if ($keyWithCode) {
                        $list[$tool->getCode()] = $toolFlow;
                    } else {
                        $list[] = $toolFlow;
                    }
                    unset($codes[array_search($tool->getCode(), $codes)]);
                }
            }
        }
        if (! empty($codes)) {
            $toolFlows = di(MagicFlowDomainService::class)->getByCodes($dataIsolation, $codes);
            foreach ($toolFlows as $toolFlow) {
                if ($toolFlow->isEnabled() && $toolFlow->getType()->isTools()) {
                    if ($keyWithCode) {
                        $list[$toolFlow->getCode()] = $toolFlow;
                    } else {
                        $list[] = $toolFlow;
                    }
                }
            }
        }
        return $list;
    }

    public static function execute(
        ExecutionData $executionData,
        MagicFlowEntity $toolFlow,
        array $args = [],
        array $customSystemInput = [],
        bool $async = false,
        bool $isAssistantParamCall = false
    ): ?array {
        $logger = simple_logger('ToolsExecutor');
        try {
            $triggerData = new TriggerData(
                triggerTime: new DateTime(),
                userInfo: $executionData->getTriggerData()->getUserInfo(),
                messageInfo: $executionData->getTriggerData()->getMessageInfo(),
                params: $args,
                globalVariable: $toolFlow->getGlobalVariable(),
                attachments: $executionData->getTriggerData()->getAttachments(),
                systemParams: $customSystemInput,
                triggerDataUserExtInfo: $executionData->getTriggerData()?->getUserExtInfo(),
            );
            $triggerData->setIsAssistantParamCall($isAssistantParamCall);

            $toolsExecutionData = new ExecutionData(
                flowDataIsolation: $executionData->getDataIsolation(),
                operator: $executionData->getOperator(),
                triggerType: TriggerType::ParamCall,
                triggerData: $triggerData,
                id: $executionData->getId(),
                conversationId: $executionData->getConversationId(),
            );
            $toolsExecutionData->extends($executionData);
            $toolsExecutor = new MagicFlowExecutor($toolFlow, $toolsExecutionData);

            if ($async) {
                $fromCoroutineId = Coroutine::id();
                co(function () use ($toolsExecutor, $fromCoroutineId) {
                    Context::copy($fromCoroutineId, ['request-id', 'x-b3-trace-id']);
                    $toolsExecutor->execute();
                });
                return null;
            }
            $toolsExecutor->execute();
            // 节点内部的异常在 node 的 debug 信息中记录
            foreach ($toolFlow->getNodes() as $node) {
                if ($node->getNodeDebugResult() && ! $node->getNodeDebugResult()->isSuccess()) {
                    $logger->warning(
                        'ToolsExecuteFailed',
                        [
                            'node_id' => $node->getNodeId(),
                            'debug' => $node->getNodeDebugResult()->toArray(),
                        ]
                    );
                    ExceptionBuilder::throw(
                        FlowErrorCode::ExecuteFailed,
                        'flow.node.tool.execute_failed',
                        ['flow_name' => $toolFlow->getName(), 'error' => $node->getNodeId() . ' | ' . $node->getNodeDebugResult()->getErrorMessage()]
                    );
                }
            }
        } catch (Throwable $throwable) {
            $logger->warning(
                'ToolsExecuteFailedInfo',
                [
                    'error' => $throwable->getMessage(),
                    'file' => $throwable->getFile(),
                    'line' => $throwable->getLine(),
                    'code' => $throwable->getCode(),
                    'trace' => $throwable->getTraceAsString(),
                ]
            );
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.llm.tools_execute_failed', ['error' => $throwable->getMessage()]);
        }
        $logger->info(
            'ToolEndNode',
            [
                'node_id' => $toolFlow->getEndNode()?->getNodeId(),
                'result' => $toolsExecutionData->getNodeContext((string) $toolFlow->getEndNode()?->getNodeId()),
            ]
        );
        return $toolsExecutionData->getNodeContext((string) $toolFlow->getEndNode()?->getNodeId());
    }

    /**
     * @param ToolsExecutor[] $tools
     */
    public static function toolsToArray(array $tools): array
    {
        $data = [];
        foreach ($tools as $tool) {
            $data[] = $tool->toToolDefinition()->toArray();
        }
        return $data;
    }

    public function setMagicFlowEntity(MagicFlowEntity $magicFlowEntity): void
    {
        $this->magicFlowEntity = $magicFlowEntity;
    }

    public function setExecutionData(ExecutionData $executionData): void
    {
        $this->executionData = $executionData;
    }

    public function getOptionTool(): OptionTool
    {
        return $this->optionTool;
    }

    public function setOptionTool(OptionTool $optionTool): void
    {
        $this->optionTool = $optionTool;
    }

    public function getCustomSystemInput(): array
    {
        return $this->customSystemInput;
    }

    public function setCustomSystemInput(array $customSystemInput): void
    {
        $this->customSystemInput = $customSystemInput;
    }

    public function createParametersByForm(?Form $form): void
    {
        if (! $form) {
            return;
        }
        // 暂时只处理 object 的数据
        if (! $form->getType()->isObject()) {
            return;
        }
        $this->setParameters(ToolParameters::fromArray($form->toJsonSchema()));
    }

    protected function handle(array $parameters): array
    {
        if (! isset($this->magicFlowEntity) || ! isset($this->executionData)) {
            return [];
        }
        $args = $parameters;
        // 隔离数据
        $flow = MagicFlowFactory::arrayToEntity($this->magicFlowEntity->toArray());
        // 内置工具特殊值
        if ($this->magicFlowEntity->hasCallback()) {
            $flow->setCallback($this->magicFlowEntity->getCallback());
            $flow->setEndNode($this->magicFlowEntity->getEndNode());
        }
        $executionData = clone $this->executionData;
        $executionData->setId(uniqid('', true));

        return self::execute($executionData, $flow, $args, $this->customSystemInput, $this->optionTool->isAsync(), true) ?? [];
    }
}
