<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

/**
 * Agent 发布类型。
 *
 * 对外发布语义分两层：
 * - `INTERNAL`：组织内发布，可继续选择 `PRIVATE / MEMBER / ORGANIZATION`
 * - `MARKET`：发布到市场，不再携带组织内发布值类型
 */
enum PublishType: string
{
    case INTERNAL = 'INTERNAL';
    case MARKET = 'MARKET';

    public static function fromPublishTargetType(?PublishTargetType $publishTargetType): ?self
    {
        if ($publishTargetType === null) {
            return null;
        }

        return $publishTargetType === PublishTargetType::MARKET ? self::MARKET : self::INTERNAL;
    }

    /**
     * @return PublishTargetType[]
     */
    public function getAllowedPublishTargetTypes(): array
    {
        return match ($this) {
            self::INTERNAL => [
                PublishTargetType::PRIVATE,
                PublishTargetType::MEMBER,
                PublishTargetType::ORGANIZATION,
            ],
            self::MARKET => [],
        };
    }

    /**
     * @return string[]
     */
    public function getAllowedPublishTargetTypeValues(): array
    {
        return array_map(
            static fn (PublishTargetType $publishTargetType) => $publishTargetType->value,
            $this->getAllowedPublishTargetTypes()
        );
    }

    public function acceptsPublishTargetType(PublishTargetType $publishTargetType): bool
    {
        return in_array($publishTargetType, $this->getAllowedPublishTargetTypes(), true);
    }
}
