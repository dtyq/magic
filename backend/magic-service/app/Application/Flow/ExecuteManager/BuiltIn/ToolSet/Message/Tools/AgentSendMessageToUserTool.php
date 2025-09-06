<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\Message\Tools;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Flow\ExecuteManager\BuiltIn\BuiltInToolSet;
use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AbstractBuiltInTool;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Closure;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

#[BuiltInToolDefine]
class AgentSendMessageToUserTool extends AbstractBuiltInTool
{
    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $params = $executionData->getTriggerData()->getParams();
            // $magicAgentAppService = di(MagicAgentAppService::class);
            $senderUserId = $executionData->getAgentUserId();
            // 助手发送消息
            $assistantMessage = new TextMessage(['content' => $params['content']]);
            $appMessageId = IdGenerator::getUniqueId32();
            $receiveSeqDTO = new MagicSeqEntity();
            $receiveSeqDTO->setContent($assistantMessage);
            $receiveSeqDTO->setSeqType($assistantMessage->getMessageTypeEnum());
            $receiverIds = $params['receiver_user_ids'];

            $receiverType = ConversationType::User;

            foreach ($receiverIds as $receiverId) {
                di(MagicChatMessageAppService::class)->agentSendMessage(
                    aiSeqDTO: $receiveSeqDTO,
                    senderUserId: $senderUserId,
                    receiverId: $receiverId,
                    appMessageId: $appMessageId,
                    receiverType: $receiverType
                );
            }
            return [
                'message' => '发送消息成功',
            ];
        };
    }

    public function getToolSetCode(): string
    {
        return BuiltInToolSet::Message->getCode();
    }

    public function getName(): string
    {
        return 'agent_send_message_to_user';
    }

    public function getDescription(): string
    {
        return '发送消息给个人';
    }

    public function getInput(): ?NodeInput
    {
        $input = new NodeInput();
        $input->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root",
    "description": "",
    "items": null,
    "value": null,
    "required": [
        "name",
        "day",
        "time",
        "type",
        "value"
    ],
    "properties": {
        "receiver_user_ids": {
            "type": "array",
            "key": "receiver_user_ids",
            "title": "接收人的用户id",
            "description": "接收人的用户id",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items":  {
                "type": "string"
            },
            "properties": null
        },
        "content": {
            "type": "string",
            "key": "content",
            "title": "消息内容",
            "description": "消息内容",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        }
        }
  
}
JSON,
            true
        )));
        return $input;
    }
}

/* "value": {
     "type": "object",
     "key": "value",
     "title": "自定义重复参数",
     "description": "自定义重复参数",
     "required": [
   "unit",
   "deadline",
   "interval",
   "values"
     ],
     "value": null,
     "encryption": false,
     "encryption_value": null,
     "properties": {
   "unit": {
       "type": "string",
       "key": "unit",
       "title": "单位",
       "description": "单位 ，day 天，week 周，month 月，year 年",
       "required": null,
       "value": null,
       "encryption": false,
       "encryption_value": null,
       "items": null,
       "properties": null
   },
   "deadline": {
       "type": "string",
       "key": "deadline",
       "title": "截止日期",
       "description": "截止日期，格式：YYYY-MM-DD",
       "required": null,
       "value": null,
       "encryption": false,
       "encryption_value": null,
       "items": null,
       "properties": null
   },
   "interval": {
       "type": "number",
       "key": "interval",
       "title": "失败重试次数",
       "description": "失败重试次数",
       "required": null,
       "value": null,
       "encryption": false,
       "encryption_valugit e": null,
       "items": null,
       "properties": null
   },
   "values": {
       "type": "array",
       "key": "values",
       "title": "重复值",
       "description": "重复值",
       "required": null,
       "value": null,
       "encryption": false,
       "encryption_value": null,
       "items": null,
       "properties": null
   }
     }

     }*/
