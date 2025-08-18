<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start;

use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine\IntervalUnit;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine\RoutineConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine\RoutineType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\Branch;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Template\StartInputTemplate;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class StartNodeParamsConfig extends NodeParamsConfig
{
    /**
     * @var RoutineConfig[]
     */
    private array $routineConfigs = [];

    /**
     * @var Branch[]
     */
    private array $branches = [];

    /**
     * @return RoutineConfig[]
     */
    public function getRoutineConfigs(): array
    {
        return $this->routineConfigs;
    }

    /**
     * @return Branch[]
     */
    public function getBranches(): array
    {
        return $this->branches;
    }

    public function getBranchByTriggerType(TriggerType $triggerType): ?Branch
    {
        $triggerBranch = null;
        foreach ($this->getBranches() as $branch) {
            if ($branch->getTriggerType() === $triggerType) {
                $triggerBranch = $branch;
                break;
            }
        }
        return $triggerBranch;
    }

    public function validate(): array
    {
        $params = $this->node->getParams();

        $branches = $params['branches'] ?? [];
        if (empty($branches)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'branches']);
        }

        $list = [];
        foreach ($branches as $branch) {
            $branchId = $branch['branch_id'] ?? uniqid('branch_');
            $triggerType = TriggerType::from($branch['trigger_type'] ?? 0);
            $nextNodes = $branch['next_nodes'] ?? [];
            $input = null;
            $output = null;
            $systemOutput = null;
            $customSystemOutput = null;
            $config = $branch['config'] ?? [];
            // 可同时选择多种方式触发，所以他的入参和出参放到这里来处理
            switch ($triggerType) {
                case TriggerType::ChatMessage:
                    $output = $this->getChatMessageOutputTemplate();
                    break;
                case TriggerType::OpenChatWindow:
                    $output = $this->getOpenChatWindowOutputTemplate();
                    // 如果有下游节点，那么间隔时间就不能为空
                    if (! empty($nextNodes) && ! empty($branch['config'])) {
                        // 秒
                        $interval = $branch['config']['interval'] ?? 0;
                        if (! is_int($interval) || $interval <= 0) {
                            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.start.interval_valid');
                        }
                        $unit = $branch['config']['unit'] ?? '';
                        if (! is_string($unit) && ! in_array($unit, ['minutes', 'hours', 'seconds'])) {
                            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.start.unsupported_unit', ['unit' => $unit]);
                        }
                        $config = [
                            'interval' => $interval,
                            'unit' => $unit,
                        ];
                    }
                    break;
                case TriggerType::AddFriend:
                    $output = $this->getAddFriendOutputTemplate();
                    break;
                case TriggerType::ParamCall:
                    $outputComponent = ComponentFactory::fastCreate($branch['output']['form'] ?? []);
                    // 参数调用可以无参数触发，例如触发一个事件
                    if ($outputComponent) {
                        $output = new NodeOutput();
                        $output->setForm($outputComponent);
                    }

                    $systemOutput = $this->getChatMessageOutputTemplate();

                    // 支持自定义输出
                    $customSystemOutput = new NodeOutput();
                    $customSystemOutput->setForm(ComponentFactory::fastCreate($branch['custom_system_output']['form'] ?? []));

                    break;
                case TriggerType::Routine:
                    $routineType = RoutineType::tryFrom($config['type'] ?? '');
                    if (! $routineType) {
                        ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.start.unsupported_routine_type');
                    }
                    $routineConfig = new RoutineConfig(
                        type: $routineType,
                        day: $config['day'] ?? null,
                        time: $config['time'] ?? null,
                        unit: IntervalUnit::tryFrom($config['value']['unit'] ?? ''),
                        interval: $config['value']['interval'] ?? null,
                        values: $config['value']['values'] ?? null,
                        deadline: $config['value']['deadline'] ?? null,
                    );
                    $config = $routineConfig->toConfigArray();
                    $this->routineConfigs[$branchId] = $routineConfig;
                    $output = $this->getRoutineOutputTemplate();
                    break;
                case TriggerType::LoopStart:
                    // 循环开始节点，不需要配置
                    break;
                default:
                    ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.start.unsupported_trigger_type', ['trigger_type' => $triggerType->name]);
            }

            $input = new NodeInput();
            $input->setForm($output?->getForm());
            $branchStructure = new Branch($branchId, $triggerType, $nextNodes, $config, $input, $output, $systemOutput, $customSystemOutput);
            $this->branches[$branchStructure->getBranchId()] = $branchStructure;

            $list[] = $branchStructure->toArray();
        }

        // 这俩参数没有用了
        $this->node->setInput(null);
        $this->node->setOutput(null);

        return [
            'branches' => $list,
        ];
    }

    public function generateTemplate(): void
    {
        $branches = [];
        foreach ([
            TriggerType::ChatMessage,
            TriggerType::OpenChatWindow,
            TriggerType::ParamCall,
            //            TriggerType::Routine,
            TriggerType::LoopStart,
            TriggerType::AddFriend,
        ] as $triggerType) {
            $branch = [
                'branch_id' => uniqid('branch_'),
                'trigger_type' => $triggerType->value,
                'next_nodes' => [],
                'config' => null,
                'input' => null,
                'output' => null,
                'system_output' => null,
                'custom_system_output' => null,
            ];
            switch ($triggerType) {
                case TriggerType::ChatMessage:
                    $branch['output'] = $this->getChatMessageOutputTemplate()->toArray();
                    break;
                case TriggerType::OpenChatWindow:
                    $branch['output'] = $this->getOpenChatWindowOutputTemplate()->toArray();
                    $branch['config'] = [
                        'interval' => 10,
                        'unit' => 'minutes',
                    ];
                    break;
                case TriggerType::ParamCall:
                    $branch['output'] = $this->getParamCallOutputTemplate()->toArray();
                    $branch['system_output'] = $this->getChatMessageOutputTemplate()->toArray();
                    $branch['custom_system_output'] = $this->getParamCallOutputTemplate()->toArray();
                    break;
                case TriggerType::Routine:
                    $branch['output'] = $this->getRoutineOutputTemplate()->toArray();
                    break;
                case TriggerType::LoopStart:
                    break;
                case TriggerType::AddFriend:
                    $branch['output'] = $this->getAddFriendOutputTemplate()->toArray();
                    break;
                default:
            }

            $branches[] = $branch;
        }

        $this->node->setParams([
            'branches' => $branches,
        ]);
        $this->node->setInput(null);
        $this->node->setOutput(null);
    }

    private function getChatMessageOutputTemplate(): NodeOutput
    {
        $form = StartInputTemplate::getChatMessageInputTemplateComponent();
        $output = new NodeOutput();
        $output->setForm($form);
        return $output;
    }

    private function getOpenChatWindowOutputTemplate(): NodeOutput
    {
        $formJson = <<<'JSON'
{
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "user_id",
            "nickname",
            "open_time",
            "organization_code",
            "conversation_id",
            "topic_id"
        ],
        "properties": {
            "user_id": {
                "type": "string",
                "key": "user_id",
                "sort": 0,
                "title": " 用户ID",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "nickname": {
                "type": "string",
                "key": "nickname",
                "sort": 1,
                "title": " 用户昵称",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "open_time": {
                "type": "string",
                "key": "open_time",
                "sort": 2,
                "title": "打开时间",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "organization_code": {
                "type": "string",
                "key": "organization_code",
                "sort": 3,
                "title": "组织编码",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "conversation_id": {
                "type": "string",
                "key": "conversation_id",
                "sort": 4,
                "title": "会话 ID",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "topic_id": {
                "type": "string",
                "key": "topic_id",
                "sort": 5,
                "title": "话题 ID",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
JSON;
        $form = ComponentFactory::generateTemplate(StructureType::Form, json_decode($formJson, true));
        $output = new NodeOutput();
        $output->setForm($form);
        return $output;
    }

    private function getParamCallOutputTemplate(): NodeOutput
    {
        $form = ComponentFactory::generateTemplate(StructureType::Form);
        $output = new NodeOutput();
        $output->setForm($form);
        return $output;
    }

    private function getRoutineOutputTemplate(): NodeOutput
    {
        $formJson = <<<'JSON'
{
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "trigger_time",
            "trigger_timestamp"
        ],
        "properties": {
            "trigger_time": {
                "type": "string",
                "key": "trigger_time",
                "sort": 0,
                "title": "触发时间",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "trigger_timestamp": {
                "type": "number",
                "key": "trigger_timestamp",
                "sort": 1,
                "title": "触发时间戳",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
JSON;
        $form = ComponentFactory::generateTemplate(StructureType::Form, json_decode($formJson, true));
        $output = new NodeOutput();
        $output->setForm($form);
        return $output;
    }

    private function getAddFriendOutputTemplate(): NodeOutput
    {
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": "",
    "items": null,
    "value": null,
    "required": [
        "add_time",
        "user"
    ],
    "properties": {
        "user": {
            "type": "object",
            "key": "user",
            "title": " 用户ID",
            "description": "",
            "items": null,
            "required": [
                "id",
                "nickname",
                "real_name"
            ],
            "properties": {
                "id": {
                    "type": "string",
                    "key": "id",
                    "title": "用户 ID",
                    "description": "",
                    "items": null,
                    "properties": null,
                    "required": null,
                    "value": null
                },
                "nickname": {
                    "type": "string",
                    "key": "nickname",
                    "title": "用户昵称",
                    "description": "",
                    "items": null,
                    "properties": null,
                    "required": null,
                    "value": null
                },
                "real_name": {
                    "type": "string",
                    "key": "real_name",
                    "title": "真实姓名",
                    "description": "",
                    "items": null,
                    "properties": null,
                    "required": null,
                    "value": null
                }
            },
            "value": null
        },
        "add_time": {
            "type": "string",
            "key": "add_time",
            "title": "添加时间",
            "description": "",
            "items": null,
            "properties": null,
            "required": null,
            "value": null
        }
    }
}
JSON,
            true
        )));
        return $output;
    }
}
