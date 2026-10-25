<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MicroApp;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

final class MicroAppMention extends AbstractMention
{
    public function getMentionTextStruct(): string
    {
        /** @var MicroAppData $data */
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof MicroAppData) {
            return '';
        }

        $appId = $data->getAppId();
        $appName = $data->getAppName() !== '' ? $data->getAppName() : $appId;
        if ($appId === '') {
            return '';
        }

        $label = str_replace(['\\', '[', ']'], ['\\\\', '\[', '\]'], $appName);
        return sprintf('[%s](micro-app://%s)', $label, rawurlencode($appId));
    }

    public function getMentionJsonStruct(): array
    {
        /** @var MicroAppData $data */
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof MicroAppData) {
            return [];
        }

        return [
            'type' => MentionType::MICRO_APP->value,
            'app_id' => $data->getAppId(),
            'app_name' => $data->getAppName(),
            'icon' => $data->getIcon(),
        ];
    }
}
