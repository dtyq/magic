<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Memory\MultiModal;

use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AtomicNode\Tools\VisionTool;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Flow\Entity\MagicFlowMultiModalLogEntity;
use App\Domain\Flow\Service\MagicFlowMultiModalLogDomainService;

class MultiModalBuilder
{
    public static function vision(ExecutionData $executionData, string $visionModel): ?MagicFlowMultiModalLogEntity
    {
        if (empty($executionData->getTriggerData()->getAttachments())) {
            return null;
        }
        if (empty($visionModel)) {
            return null;
        }

        $content = '';
        $messageContent = $executionData->getTriggerData()?->getMessageEntity()?->getContent();
        if ($messageContent instanceof TextContentInterface) {
            $content = $messageContent->getTextContent();
        }
        $content = trim($content);

        $attachments = $executionData->getTriggerData()->getAttachments();
        $imageUrls = [];
        foreach ($attachments as $attachment) {
            if ($attachment->isImage()) {
                $imageUrls[] = $attachment->getUrl();
            }
        }
        if (empty($imageUrls)) {
            return null;
        }

        // 调用工具提前识别
        $visionExecutionData = clone $executionData;
        $visionExecutionData->getTriggerData()->setParams([
            'model' => $visionModel,
            'intent' => $content,
            'image_urls' => $imageUrls,
        ]);

        $visionResult = VisionTool::execute($executionData);
        if (empty($visionResult['response'])) {
            return null;
        }

        $magicFlowMultiModalLogEntity = new MagicFlowMultiModalLogEntity();
        $magicFlowMultiModalLogEntity->setMessageId($executionData->getTriggerData()->getMessageEntity()->getMagicMessageId());
        $magicFlowMultiModalLogEntity->setAnalysisResult($visionResult['response']);
        $magicFlowMultiModalLogEntity->setType(1);
        $magicFlowMultiModalLogEntity->setModel($visionResult['model']);
        return di(MagicFlowMultiModalLogDomainService::class)->create($executionData->getDataIsolation(), $magicFlowMultiModalLogEntity);
    }
}
