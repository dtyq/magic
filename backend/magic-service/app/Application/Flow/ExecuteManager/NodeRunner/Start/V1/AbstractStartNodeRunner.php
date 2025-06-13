<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Start\V1;

use App\Application\Agent\Service\MagicAgentAppService;
use App\Application\Flow\ExecuteManager\Attachment\AbstractAttachment;
use App\Application\Flow\ExecuteManager\Attachment\AttachmentUtil;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\Memory\LLMMemoryMessage;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\InstructionConfig;
use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\ValueObject\InstructionType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\MagicFlowMessage;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\Branch;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\V1\StartNodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Carbon\Carbon;
use Hyperf\Odin\Message\Role;

abstract class AbstractStartNodeRunner extends NodeRunner
{
    protected function chatMessage(VertexResult $vertexResult, ExecutionData $executionData, ?Branch $triggerBranch = null): array
    {
        if ($triggerBranch) {
            $vertexResult->setChildrenIds($triggerBranch->getNextNodes());
        }

        $result = $this->getChatMessageResult($executionData);

        // content 或者 files 同时为空
        if ($result['message_content'] === '' && empty($executionData->getTriggerData()->getAttachments())) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.start.content_empty');
        }

        $LLMMemoryMessage = new LLMMemoryMessage(Role::User, $result['message_content'], $executionData->getTriggerData()->getMessageEntity()->getMagicMessageId());
        $LLMMemoryMessage->setConversationId($executionData->getConversationId());
        $LLMMemoryMessage->setAttachments($executionData->getTriggerData()->getAttachments());
        $LLMMemoryMessage->setOriginalContent(
            MagicFlowMessage::createContent(
                message: $executionData->getTriggerData()->getMessageEntity()->getContent(),
                attachments: $executionData->getTriggerData()->getAttachments(),
            ),
        );
        $LLMMemoryMessage->setTopicId($executionData->getTopicIdString());
        $LLMMemoryMessage->setRequestId($executionData->getId());
        $LLMMemoryMessage->setUid($executionData->getOperator()->getUid());
        $this->flowMemoryManager->receive(
            memoryType: $this->getMemoryType($executionData),
            LLMMemoryMessage: $LLMMemoryMessage,
            nodeDebug: $this->isNodeDebug($executionData),
        );
        return $result;
    }

    protected function openChatWindow(VertexResult $vertexResult, ExecutionData $executionData, Branch $triggerBranch): array
    {
        $vertexResult->clearChildren();
        $userEntity = $executionData->getTriggerData()->getUserEntity();
        $accountEntity = $executionData->getTriggerData()->getAccountEntity();
        $openChatTime = $executionData->getTriggerData()->getTriggerTime();

        $result = [
            'conversation_id' => $executionData->getConversationId(),
            'topic_id' => $executionData->getTopicIdString(),
            'organization_code' => $executionData->getDataIsolation()->getCurrentOrganizationCode(),
            'user' => [
                'id' => $userEntity->getUserId(),
                'nickname' => $userEntity->getNickname(),
                'real_name' => $accountEntity?->getRealName() ?? '',
                'work_number' => $executionData->getTriggerData()->getUserExtInfo()->getWorkNumber(),
                'position' => $executionData->getTriggerData()->getUserExtInfo()->getPosition(),
                'departments' => $executionData->getTriggerData()->getUserExtInfo()->getDepartments(),
            ],
            'open_time' => $openChatTime->format('Y-m-d H:i:s'),
        ];

        // 获取上次打开触发的时间
        $key = 'open_chat_notice_' . $executionData->getConversationId();
        $lastNoticeTime = $this->cache->get($key);

        // 如果没有上次，或者距离上次的时间秒已经超过了，那么就需要执行
        $config = $triggerBranch->getConfig();
        $intervalSeconds = $this->getIntervalSeconds($config['interval'] ?? 0, $config['unit'] ?? '');
        if (! $lastNoticeTime || (Carbon::make($openChatTime)->diffInSeconds(Carbon::make($lastNoticeTime)) > $intervalSeconds)) {
            $vertexResult->setChildrenIds($triggerBranch->getNextNodes());
            $this->cache->set($key, Carbon::now()->toDateTimeString(), $intervalSeconds);
        }
        return $result;
    }

    protected function addFriend(VertexResult $vertexResult, ExecutionData $executionData, Branch $triggerBranch): array
    {
        $vertexResult->setChildrenIds($triggerBranch->getNextNodes());

        $userEntity = $executionData->getTriggerData()->getUserEntity();
        $accountEntity = $executionData->getTriggerData()->getAccountEntity();
        return [
            'user' => [
                'id' => $userEntity->getUserId(),
                'nickname' => $userEntity->getNickname(),
                'real_name' => $accountEntity?->getRealName() ?? '',
                'work_number' => $executionData->getTriggerData()->getUserExtInfo()->getWorkNumber(),
                'position' => $executionData->getTriggerData()->getUserExtInfo()->getPosition(),
                'departments' => $executionData->getTriggerData()->getUserExtInfo()->getDepartments(),
            ],
            'add_time' => $executionData->getTriggerData()->getTriggerTime()->format('Y-m-d H:i:s'),
        ];
    }

    protected function paramCall(VertexResult $vertexResult, ExecutionData $executionData, Branch $triggerBranch): array
    {
        $vertexResult->setChildrenIds($triggerBranch->getNextNodes());

        $result = [];
        $outputForm = $triggerBranch->getOutput()?->getFormComponent()?->getForm();
        if ($outputForm) {
            $appendConstValue = $executionData->getTriggerData()->getParams();
            foreach ($outputForm->getProperties() ?? [] as $key => $property) {
                if ($property->getType()->isComplex()) {
                    $value = $appendConstValue[$key] ?? [];
                    if (is_string($value)) {
                        // 尝试一次 json_decode
                        $value = json_decode($value, true);
                    }
                    if (! is_array($value)) {
                        ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, "[{$key}] is not {$property->getType()->value}");
                    }
                    $appendConstValue[$key] = $value;
                }
            }
            $outputForm->appendConstValue($appendConstValue);
            $result = $outputForm->getKeyValue(check: true);
        }

        // 增加系统输出
        $systemOutputResult = $this->getChatMessageResult($executionData);
        $executionData->saveNodeContext($this->node->getSystemNodeId(), $systemOutputResult);
        $vertexResult->addDebugLog('system_response', $executionData->getNodeContext($this->node->getSystemNodeId()));

        // 增加自定义的系统输出
        $customSystemOutput = $triggerBranch->getCustomSystemOutput()?->getFormComponent()?->getForm();
        if ($customSystemOutput) {
            $customSystemOutput->appendConstValue($executionData->getTriggerData()->getSystemParams());
            $customSystemOutputResult = $customSystemOutput->getKeyValue(check: true);
            $executionData->saveNodeContext($this->node->getCustomSystemNodeId(), $customSystemOutputResult);
        }
        $vertexResult->addDebugLog('custom_system_response', $executionData->getNodeContext($this->node->getCustomSystemNodeId()));

        return $result;
    }

    protected function routine(VertexResult $vertexResult, ExecutionData $executionData, StartNodeParamsConfig $startNodeParamsConfig): array
    {
        // 定时入参，都由外部调用，判断是哪个分支
        $branchId = $executionData->getTriggerData()->getParams()['branch_id'] ?? '';
        if (empty($branchId)) {
            // 没有找到任何分支，直接运行
            $vertexResult->setChildrenIds([]);
            return [];
        }
        $triggerBranch = $startNodeParamsConfig->getBranches()[$branchId] ?? null;
        if (! $triggerBranch) {
            $vertexResult->setChildrenIds([]);
            return [];
        }
        $vertexResult->setChildrenIds($triggerBranch->getNextNodes());
        return $executionData->getTriggerData()->getParams();
    }

    protected function getIntervalSeconds(int $interval, string $unit): int
    {
        return match ($unit) {
            'minutes', 'minute' => $interval * 60,
            'hours', 'hour' => $interval * 3600,
            'seconds', 'second' => $interval,
            default => ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.start.unsupported_unit', ['unit' => $unit]),
        };
    }

    private function getChatMessageResult(ExecutionData $executionData): array
    {
        // 处理成目前的参数格式
        $userEntity = $executionData->getTriggerData()->getUserEntity();
        $accountEntity = $executionData->getTriggerData()->getAccountEntity();
        $messageEntity = $executionData->getTriggerData()->getMessageEntity();

        // 处理附件
        $this->appendAttachments($executionData, $messageEntity);

        // 处理流程指令
        $this->appendInstructions($executionData, $messageEntity);

        $content = '';
        if (in_array($executionData->getTriggerType(), [TriggerType::ChatMessage, TriggerType::WaitMessage, TriggerType::ParamCall])) {
            $messageContent = $messageEntity->getContent();
            if ($messageContent instanceof TextContentInterface) {
                $content = $messageContent->getTextContent();
            }
            $content = trim($content);
            if ($content === '' && ! empty($messageContent->toArray()) && $executionData->getTriggerType() === TriggerType::ChatMessage) {
                $content = json_encode($messageContent->toArray(), JSON_UNESCAPED_UNICODE);
                simple_logger('StartNodeRunner')->warning('UndefinedMessageTypeToText', $messageEntity->toArray());
            }
        }

        return [
            'conversation_id' => $executionData->getConversationId(),
            'topic_id' => $executionData->getTopicIdString(),
            'message_content' => $content,
            'message_type' => $messageEntity->getMessageType()->getName(),
            'message_time' => $executionData->getTriggerData()->getTriggerTime()->format('Y-m-d H:i:s'),
            'organization_code' => $executionData->getDataIsolation()->getCurrentOrganizationCode(),
            'files' => array_map(function (AbstractAttachment $attachment) {
                return $attachment->toStartArray();
            }, $executionData->getTriggerData()->getAttachments()),
            'user' => [
                'id' => $userEntity->getUserId(),
                'nickname' => $userEntity->getNickname(),
                'real_name' => $accountEntity?->getRealName() ?? '',
                'work_number' => $executionData->getTriggerData()->getUserExtInfo()->getWorkNumber(),
                'position' => $executionData->getTriggerData()->getUserExtInfo()->getPosition(),
                'departments' => $executionData->getTriggerData()->getUserExtInfo()->getDepartments(),
            ],
            'agent_key' => $executionData->getTriggerData()->getAgentKey(),
        ];
    }

    private function appendAttachments(ExecutionData $executionData, MagicMessageEntity $messageEntity): void
    {
        if (! empty($executionData->getTriggerData()->getAttachments())) {
            return;
        }
        $attachments = AttachmentUtil::getByMagicMessageEntity($messageEntity);
        foreach ($attachments as $attachment) {
            $executionData->getTriggerData()->addAttachment($attachment);
        }
    }

    private function appendInstructions(ExecutionData $executionData, MagicMessageEntity $messageEntity): void
    {
        $magicFlowEntity = $executionData->getMagicFlowEntity();
        if (! $magicFlowEntity || ! $magicFlowEntity->getType()->isMain()) {
            return;
        }
        $instructions = $this->getInstructions($messageEntity);
        // 如果部分流程指令为空，但助理配置是有流程指令的，后端兜底，存储默认值
        if (! empty($executionData->getAgentId())) {
            $magicAgentInstruction = di(MagicAgentAppService::class)->getInstruct($executionData->getAgentId());
            // 分组存储
            foreach ($magicAgentInstruction as $groupInstructions) {
                foreach ($groupInstructions['items'] as $instruct) {
                    if (isset($instruct['instruction_type'])
                        && $instruct['instruction_type'] == InstructionType::Flow->value
                        && ! isset($instructions[$instruct['id']])) {
                        $instructConfig = new InstructionConfig($instruct);
                        $defaultValue = $instruct['default_value'] ?? '';
                        $instructions[$instruct['id']] = $instructConfig->getNameAndValueByType($defaultValue);
                    }
                }
            }
        }
        $executionData->saveNodeContext('instructions', $instructions);
    }

    private function getInstructions(MagicMessageEntity $messageEntity): array
    {
        $result = [];
        $messageContent = $messageEntity->getContent();

        if (! ($messageContent instanceof MagicMessageStruct) || empty($messageContent->getInstructs())) {
            return $result;
        }

        foreach ($messageContent->getInstructs() as $chatInstruction) {
            // 跳过对话指令
            if ($chatInstruction->getInstruction()->getInstructionType() === InstructionType::Conversation->value) {
                continue;
            }

            $instruction = $chatInstruction->getInstruction();
            $id = $instruction->getId();
            $instructionValue = $chatInstruction->getValue();
            $result[$id] = $instruction->getNameAndValueByType($instructionValue);
        }

        return $result;
    }
}
