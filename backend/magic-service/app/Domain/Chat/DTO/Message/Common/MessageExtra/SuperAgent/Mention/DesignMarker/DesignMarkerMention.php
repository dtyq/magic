<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\DesignMarker;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

/**
 * 设计标记提及.
 */
final class DesignMarkerMention extends AbstractMention
{
    public function getMentionTextStruct(): string
    {
        return '';
    }

    public function getMentionJsonStruct(): array
    {
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof DesignMarkerData) {
            return [];
        }

        return [
            'type' => MentionType::DESIGN_MARKER->value,
            'image' => $data->getImage(),
            'label' => $data->getLabel(),
            'kind' => $data->getKind(),
            'mark' => $data->getMark(),
            'mark_number' => $data->getMarkNumber(),
            'bbox' => $data->getBbox(),
            'mark_type' => $data->getMarkType(),
            'area' => $data->getArea(),
        ];
    }
}
