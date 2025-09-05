<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AIImage\Tools;

use App\Application\Chat\Service\MagicChatAIImageAppService;
use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AbstractBuiltInTool;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Chat\DTO\AIImage\Request\MagicChatAIImageReqDTO;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\Entity\ValueObject\AIImage\Radio;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

use function di;

abstract class AbstractAIImageBuiltInTool extends AbstractBuiltInTool
{
    public function getInput(): ?NodeInput
    {
        $input = new NodeInput();
        $input->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(
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
        "user_prompt"
    ],
    "properties": {
        "radio": {
            "type": "string",
            "key": "radio",
            "title": "生成图片的比例",
            "description": "可选：\"1:1\",\"2:3\",\"4:3\",\"9:16\",\"16:9\",默认\"1:1\"",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "user_prompt": {
            "type": "string",
            "key": "user_prompt",
            "title": "用户提示词",
            "description": "用户提示词",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "reference_image_ids": {
            "type": "array",
            "key": "reference_image_ids",
            "title": "引用的图片id列表",
            "description": "引用的图片id列表",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "string",
                "key": "reference_image_id",
                "sort": 0,
                "title": "reference_image_id",
                "description": "",
                "required": null,
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            },
            "properties": null
        },
        "attachments": {
            "type": "array",
            "key": "attachments",
            "title": "附件数组",
            "description": "传入文件列表数组",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "object",
                "key": "files",
                "sort": 0,
                "title": "文件",
                "description": "",
                "required": [
                ],
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": {
                    "file_name": {
                        "type": "string",
                        "key": "file_name",
                        "sort": 0,
                        "title": "文件名称",
                        "description": "",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "file_url": {
                        "type": "string",
                        "key": "file_url",
                        "sort": 1,
                        "title": "文件地址",
                        "description": "",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "file_ext": {
                        "type": "string",
                        "key": "file_ext",
                        "sort": 2,
                        "title": "文件后缀",
                        "description": "",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "file_size": {
                        "type": "number",
                        "key": "file_size",
                        "sort": 3,
                        "title": "文件大小",
                        "description": "",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    }
                }
            },
            "properties": null
        }
    }
}
JSON,
            true
        )));
        return $input;
    }

    protected function executeCallback(ExecutionData $executionData, string $modelVersion): array
    {
        if ($executionData->getExecutionType()->isDebug()) {
            // debug 模式
            return ['ai_image : current not support debug model'];
        }

        $args = $executionData->getTriggerData()?->getParams();
        $searchKeyword = $args['user_prompt'] ?? '';
        $radio = $args['radio'] ?? Radio::OneToOne->value;
        $model = $modelVersion;
        $agentConversationId = $executionData->getOriginConversationId();
        $assistantAuthorization = $this->getAssistantAuthorization($executionData->getAgentUserId());

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($assistantAuthorization);
        $requestContext->setOrganizationCode($assistantAuthorization->getOrganizationCode());

        $textMessage = new TextMessage([]);
        $textMessage->setContent($searchKeyword);
        $reqDto = (new MagicChatAIImageReqDTO())
            ->setTopicId($executionData->getTopicId() ?? '')
            ->setConversationId($agentConversationId)
            ->setUserMessage($textMessage)
            ->setAttachments($executionData->getTriggerData()?->getAttachments())
            ->setReferMessageId($executionData->getTriggerData()?->getSeqEntity()?->getSeqId());
        // 设置实际请求的尺寸和比例
        $enumModel = ImageGenerateModelType::fromModel($model, false);
        $imageGenerateParamsVO = $reqDto->getParams();
        $imageGenerateParamsVO->setSourceId($this->getCode());
        $imageGenerateParamsVO->setSourceType(ImageGenerateSourceEnum::TOOL);
        $imageGenerateParamsVO->setRatioForModel($radio, $enumModel);
        $radio = $imageGenerateParamsVO->getRatio();
        $imageGenerateParamsVO->setSizeFromRadioAndModel($radio, $enumModel)->setModel($model);
        $this->getMagicChatAIImageAppService()->handleUserMessage($requestContext, $reqDto);
        return [];
    }

    protected function getAssistantAuthorization(string $assistantUserId): MagicUserAuthorization
    {
        // 获取助理的用户信息。生成的图片上传者是助理自己。
        $assistantInfoEntity = $this->getMagicUserDomainService()->getUserById($assistantUserId);
        if ($assistantInfoEntity === null) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'assistant_not_found');
        }
        $assistantAuthorization = new MagicUserAuthorization();
        $assistantAuthorization->setId($assistantInfoEntity->getUserId());
        $assistantAuthorization->setOrganizationCode($assistantInfoEntity->getOrganizationCode());
        $assistantAuthorization->setUserType($assistantInfoEntity->getUserType());
        return $assistantAuthorization;
    }

    protected function getMagicChatAIImageAppService(): MagicChatAIImageAppService
    {
        return di(MagicChatAIImageAppService::class);
    }

    protected function getMagicUserDomainService(): MagicUserDomainService
    {
        return di(MagicUserDomainService::class);
    }

    protected function getMagicConversationDomainService(): MagicConversationDomainService
    {
        return di(MagicConversationDomainService::class);
    }
}
