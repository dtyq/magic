<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Skill;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

final class SkillMention extends AbstractMention
{
    public function getMentionTextStruct(): string
    {
        /** @var SkillData $data */
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof SkillData) {
            return '';
        }

        return $data->getName() ?? '';
    }

    /**
     * Build the mention payload sent to task mentions JSON.
     *
     * @return array{
     *     type: string,
     *     id: ?string,
     *     code: ?string,
     *     name: ?string,
     *     icon: ?string,
     *     description: ?string,
     *     mention_source: ?string
     * }|array{}
     */
    public function getMentionJsonStruct(): array
    {
        /** @var SkillData $data */
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof SkillData) {
            return [];
        }

        return [
            'type' => MentionType::SKILL->value,
            'id' => $data->getId(),
            'code' => $data->getCode(),
            'name' => $data->getName(),
            'icon' => $data->getIcon(),
            'description' => $data->getDescription(),
            'mention_source' => $data->getMentionSource(),
        ];
    }
}
