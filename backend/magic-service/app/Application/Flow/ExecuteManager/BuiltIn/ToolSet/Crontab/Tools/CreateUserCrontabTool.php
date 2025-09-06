<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\Crontab\Tools;

use App\Application\Chat\Service\MagicUserContactAppService;
use App\Application\Chat\Service\MagicUserTaskAppService;
use App\Application\Flow\ExecuteManager\BuiltIn\BuiltInToolSet;
use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AbstractBuiltInTool;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\DTO\UserTaskDTO;
use App\Interfaces\Chat\DTO\UserTaskValueDTO;
use Closure;
use DateTime;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

#[BuiltInToolDefine]
class CreateUserCrontabTool extends AbstractBuiltInTool
{
    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $params = $executionData->getTriggerData()->getParams();

            $dataIsolation = $executionData->getDataIsolation();

            $authorization = new MagicUserAuthorization();
            $magicUserContactAppService = di(MagicUserContactAppService::class);
            $user = $magicUserContactAppService->getByUserId($dataIsolation->getCurrentUserId());

            $authorization->setMagicEnvId($dataIsolation->getEnvId());
            $authorization->setId($dataIsolation->getCurrentUserId());
            $authorization->setOrganizationCode($user->getOrganizationCode());
            $authorization->setUserType(UserType::Human);

            $userTaskDTO = new UserTaskDTO($params);
            $creator = $authorization->getId();
            $userTaskDTO->setCreator($creator);
            $userTaskDTO->setMagicEnvId($authorization->getMagicEnvId());
            $userTaskDTO->setNickname($user->getNickname());

            $userTaskDTO->setConversationId($userTaskDTO->getConversationId());
            $userTaskDTO->setTopicId($userTaskDTO->getTopicId());
            $userTaskDTO->setAgentId($userTaskDTO->getAgentId());

            $userTaskValueDTO = new UserTaskValueDTO();
            $userTaskValueDTO->setInterval(0);
            $userTaskValueDTO->setUnit('');
            $userTaskValueDTO->setValues([]);
            $userTaskDTO->setValue($userTaskValueDTO->toArray());

            if ($userTaskDTO->getValue()['deadline']) {
                $userTaskValueDTO->setDeadline(new DateTime($userTaskDTO->getValue()['deadline']));
            }
            $magicUserTaskAppService = di(MagicUserTaskAppService::class);
            $crontab = $magicUserTaskAppService->createTask($userTaskDTO, $userTaskValueDTO);
            return [
                'crontab' => $crontab,
                'message' => '定时任务创建成功',
            ];
        };
    }

    public function getToolSetCode(): string
    {
        return BuiltInToolSet::Crontab->getCode();
    }

    public function getName(): string
    {
        return 'create_user_crontab';
    }

    public function getDescription(): string
    {
        return '创建一个新的用户级别定时任务';
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
        "agent_id": {
            "type": "string",
            "key": "agent_id",
            "title": "助理ID",
            "description": "助理ID, 如果为空，则使用当前助理D",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "topic_id": {
            "type": "string",
            "key": "topic_id",
            "title": "话题ID",
            "description": "话题ID, 如果为空，则使用当前话题ID",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "conversation_id": {
            "type": "string",
            "key": "conversation_id",
            "title": "会话ID",
            "description": "会话ID, 如果为空，则使用当前会话ID",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "name": {
            "type": "string",
            "key": "name",
            "title": "任务名称",
            "description": "任务的名称",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "description": {
            "type": "string",
            "key": "description",
            "title": "任务描述",
            "description": "任务的描述",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "day": {
            "type": "string",
            "key": "day",
            "title": "执行日期",
            "description": "执行日期，格式：YYYY-MM-DD",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "time": {
            "type": "string",
            "key": "time",
            "title": "执行时间",
            "description": "执行时间，格式：HH:mm",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "type": {
            "type": "string",
            "key": "type",
            "title": "重复周期",
            "description": "重复周期，no_repeat 不重复，daily_repeat 每天参数，weekly_repeat 每周重复，monthly_repeat 每月重复，annually_repeat 每年重复，weekday_repeat 每个工作日重复，custom_repeat 自定义重复",
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
