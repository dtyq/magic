<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Message;

use App\Application\Flow\ExecuteManager\Attachment\AbstractAttachment;
use App\Application\Flow\ExecuteManager\Attachment\Event\ExternalAttachmentUploadEvent;
use App\Application\Flow\ExecuteManager\Attachment\ExternalAttachment;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Chat\DTO\Message\ChatMessage\AggregateAISearchCardMessageV2;
use App\Domain\Chat\DTO\Message\ChatMessage\FilesMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\ChatAttachment;
use App\Domain\Chat\DTO\Message\ChatMessage\MarkdownMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\Entity\MagicChatFileEntity;
use App\Domain\Chat\Entity\ValueObject\FileType;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\MagicFlowMessage;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\MagicFlowMessageType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\AsyncEvent\AsyncEventUtil;

class MessageUtil
{
    public static function getIMResponse(MagicFlowMessage $magicFlowMessage, ExecutionData $executionData, array $linkPaths = []): ?MessageInterface
    {
        switch ($magicFlowMessage->getType()) {
            case MagicFlowMessageType::Text:
            case MagicFlowMessageType::Markdown:
                $content = clone $magicFlowMessage->getContent()?->getValue();
                if (! $content) {
                    return null;
                }
                $content->getExpressionValue()?->setIsStringTemplate(true);
                $contentString = $content->getResult($executionData->getExpressionFieldData());
                if (is_numeric($contentString) || is_null($contentString) || is_bool($contentString)) {
                    $contentString = (string) $contentString;
                }
                if (! is_string($contentString)) {
                    ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.message.content_error');
                }
                $contentString = trim($contentString);
                if ($magicFlowMessage->getType() === MagicFlowMessageType::Markdown) {
                    return new MarkdownMessage([
                        'content' => $contentString,
                    ]);
                }
                return new TextMessage([
                    'content' => $contentString,
                ]);
            case MagicFlowMessageType::Image:
                $chatAttachments = [];
                foreach ($linkPaths as $linkPath) {
                    if (! is_string($linkPath) || ! $attachment = $executionData->getAttachmentRecord($linkPath)) {
                        continue;
                    }
                    // todo 批量处理
                    $chatFile = self::report2ChatFile($attachment, $executionData);
                    $chatAttachment = new ChatAttachment($chatFile->toArray());
                    $chatAttachment->setFileUrl($attachment->getUrl());
                    $chatAttachments[] = $chatAttachment;

                    if ($attachment instanceof ExternalAttachment) {
                        // 异步下载外链文件并上传到本服务 oss
                        $imageUploadEvent = new ExternalAttachmentUploadEvent($attachment, $executionData->getDataIsolation()->getCurrentOrganizationCode());
                        AsyncEventUtil::dispatch($imageUploadEvent);
                    }
                }

                $message = new FilesMessage([]);
                $linkDesc = $magicFlowMessage->getLinkDesc()?->getValue()?->getResult($executionData->getExpressionFieldData());
                if (is_string($linkDesc) && $linkDesc !== '') {
                    // 如果具有描述，那么应该是富文本形式
                    $message = new TextMessage([]);
                    $message->setContent($linkDesc);
                }
                if (empty($chatAttachments)) {
                    return new TextMessage([
                        'content' => $linkDesc ?: '抱歉',
                    ]);
                }
                $message->setAttachments($chatAttachments);
                return $message;
            case MagicFlowMessageType::File:
                $chatAttachments = [];
                // 这里的描述是用来标记文件名称
                $linkDesc = $magicFlowMessage->getLinkDesc()?->getValue()?->getResult($executionData->getExpressionFieldData());
                foreach ($linkPaths as $linkPath) {
                    if (! is_string($linkPath) || ! $attachment = $executionData->getAttachmentRecord($linkPath)) {
                        continue;
                    }
                    // 获取文件名称。如果 linkPaths 只有 1 个，并且 linkDesc 也是只有一个，那么可以直接使用 linkDesc 作为文件名称
                    if (count($linkPaths) === 1 && is_string($linkDesc) && $linkDesc !== '') {
                        $attachment->setName($linkDesc);
                    }
                    // 下标寻找
                    if (is_array($linkDesc) && $fileName = $linkDesc[$attachment->getOriginAttachment()] ?? null) {
                        is_string($fileName) && $attachment->setName($fileName);
                    }

                    $chatFile = self::report2ChatFile($attachment, $executionData);
                    $chatAttachment = new ChatAttachment($chatFile->toArray());
                    $chatAttachment->setFileUrl($attachment->getUrl());
                    $chatAttachments[] = $chatAttachment;

                    if ($attachment instanceof ExternalAttachment) {
                        // 异步下载外链文件并上传到本服务 oss
                        $imageUploadEvent = new ExternalAttachmentUploadEvent($attachment, $executionData->getDataIsolation()->getCurrentOrganizationCode());
                        AsyncEventUtil::dispatch($imageUploadEvent);
                    }
                }

                $message = new FilesMessage([]);
                $message->setAttachments($chatAttachments);
                return $message;
            case MagicFlowMessageType::AIMessage:
                $content = clone $magicFlowMessage->getContent()?->getForm();
                if (! $content) {
                    return null;
                }
                $contentString = $content->getKeyValue($executionData->getExpressionFieldData());
                // todo 实际上没实现，以下是伪代码
                return new AggregateAISearchCardMessageV2([
                    'search' => $contentString['search'] ?? [],
                    'llm_response' => $contentString['llm_response'] ?? '',
                    'related_questions' => $contentString['related_questions'] ?? [],
                ]);
            default:
                return null;
        }
    }

    /**
     * 上报文件.
     */
    private static function report2ChatFile(AbstractAttachment $attachment, ExecutionData $executionData): MagicChatFileEntity
    {
        // 这里应该是相当于 agent 上传了文件
        $dataIsolation = ContactDataIsolation::create(
            $executionData->getDataIsolation()->getCurrentOrganizationCode(),
            $executionData->getAgentUserId() ?: $executionData->getDataIsolation()->getCurrentUserId()
        );

        $magicChatFileEntity = new MagicChatFileEntity();

        $magicChatFileEntity->setFileType(FileType::getTypeFromFileExtension($attachment->getExt()));
        $magicChatFileEntity->setFileSize($attachment->getSize());
        $magicChatFileEntity->setFileKey($attachment->getPath());
        $magicChatFileEntity->setFileName($attachment->getName());
        $magicChatFileEntity->setFileExtension($attachment->getExt());
        $magicChatFileEntity->setExternalUrl($attachment->getUrl());

        $chatFileDomainService = di(MagicChatFileDomainService::class);
        $chatFile = $chatFileDomainService->fileUpload([$magicChatFileEntity], $dataIsolation)[0] ?? null;
        if (! $chatFile) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.message.attachment_report_failed');
        }
        $attachment->setChatFileId($chatFile->getFileId());
        return $chatFile;
    }
}
