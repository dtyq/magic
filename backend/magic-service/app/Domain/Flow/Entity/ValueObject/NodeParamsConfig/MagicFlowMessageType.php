<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;

enum MagicFlowMessageType: string
{
    case None = 'none';
    case Text = 'text';
    case Markdown = 'markdown';
    case Image = 'img';
    case Video = 'video';
    case Audio = 'audio';
    case File = 'file';

    // 这个是暂时的，本身应该不会存在这个，利用卡片消息的形式来实现才对
    case AIMessage = 'ai_message';

    public function isAttachment(): bool
    {
        return in_array($this, [self::Image, self::Video, self::Audio, self::File]);
    }

    public static function make(string $type): ?MagicFlowMessageType
    {
        return match (strtolower($type)) {
            'text' => self::Text,
            'markdown' => self::Markdown,
            'image', 'img' => self::Image,
            'video' => self::Video,
            'audio' => self::Audio,
            'file' => self::File,
            'ai_message' => self::AIMessage,
            default => null,
        };
    }

    /**
     * @return array{type: MagicFlowMessageType, content: null|Component, link: null|Component, link_desc: null|Component}
     */
    public static function validateParams(array $params): array
    {
        $type = MagicFlowMessageType::make($params['message_type'] ?? ($params['type'] ?? ''));
        if (! $type) {
            ExceptionBuilder::throw(FlowErrorCode::MessageError, 'flow.node.message.type_error');
        }

        // 全部解析，按需取用
        $contentComponent = ComponentFactory::fastCreate($params['content'] ?? []);
        $linkComponent = ComponentFactory::fastCreate($params['link'] ?? []);
        $linkDescComponent = ComponentFactory::fastCreate($params['link_desc'] ?? []);

        switch ($type) {
            case MagicFlowMessageType::Text:
            case MagicFlowMessageType::Markdown:
                if (! $contentComponent?->isValue()) {
                    ExceptionBuilder::throw(FlowErrorCode::MessageError, 'flow.component.format_error', ['label' => 'content']);
                }
                break;
            case MagicFlowMessageType::Image:
            case MagicFlowMessageType::Video:
            case MagicFlowMessageType::Audio:
            case MagicFlowMessageType::File:
                if (! $linkComponent?->isValue()) {
                    ExceptionBuilder::throw(FlowErrorCode::MessageError, 'flow.component.format_error', ['label' => 'link']);
                }
                if (! $linkDescComponent?->isValue()) {
                    ExceptionBuilder::throw(FlowErrorCode::MessageError, 'flow.component.format_error', ['label' => 'link_desc']);
                }
                break;
            case MagicFlowMessageType::AIMessage:
                if (! $contentComponent?->isForm()) {
                    ExceptionBuilder::throw(FlowErrorCode::MessageError, 'flow.component.format_error', ['label' => 'content']);
                }
                break;
            default:
                ExceptionBuilder::throw(FlowErrorCode::MessageError, 'flow.node.message.unsupported_message_type');
        }

        if ($contentComponent && $contentComponent->getStructure()) {
            $contentComponent->getValue()->getExpressionValue()?->setIsStringTemplate(true);
        }
        if ($linkComponent && $linkComponent->getStructure()) {
            $linkComponent->getValue()->getExpressionValue()?->setIsStringTemplate(true);
        }
        if ($linkDescComponent && $linkDescComponent->getStructure()) {
            $linkDescComponent->getValue()->getExpressionValue()?->setIsStringTemplate(true);
        }

        return [
            'type' => $type,
            'content' => $contentComponent,
            'link' => $linkComponent,
            'link_desc' => $linkDescComponent,
        ];
    }
}
