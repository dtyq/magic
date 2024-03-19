<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig;

use App\Application\Flow\ExecuteManager\Attachment\AbstractAttachment;
use App\Domain\Chat\DTO\Message\MessageInterface;
use Dtyq\FlowExprEngine\Component;

class MagicFlowMessage
{
    private MagicFlowMessageType $type;

    private ?Component $content;

    private ?Component $link;

    private ?Component $linkDesc;

    public function __construct(MagicFlowMessageType $type, ?Component $content = null, ?Component $link = null, ?Component $linkDesc = null)
    {
        $this->type = $type;
        $this->content = $content;
        $this->link = $link;
        $this->linkDesc = $linkDesc;
    }

    public function getType(): MagicFlowMessageType
    {
        return $this->type;
    }

    public function getContent(): ?Component
    {
        return $this->content;
    }

    public function getLink(): ?Component
    {
        return $this->link;
    }

    public function getLinkDesc(): ?Component
    {
        return $this->linkDesc;
    }

    /**
     * @param AbstractAttachment[] $attachments
     */
    public static function createContent(MessageInterface $message, array $attachments = []): array
    {
        return [
            'type' => $message->getMessageTypeEnum()->getName(),
            $message->getMessageTypeEnum()->getName() => $message->toArray(),
            'flow_attachments' => array_map(fn (AbstractAttachment $attachment) => $attachment->toArray(), $attachments),
        ];
    }

    public function getLinks(array $sourceData = []): array
    {
        if ($this->type->isAttachment()) {
            $links = $this->link?->getValue()?->getResult($sourceData);
            if (is_string($links)) {
                $links = [$links];
            }
            if (is_array($links)) {
                return $links;
            }
        }
        return [];
    }
}
