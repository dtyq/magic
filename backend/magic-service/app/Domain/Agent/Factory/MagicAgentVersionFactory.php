<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Factory;

use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use Hyperf\Codec\Json;

class MagicAgentVersionFactory
{
    public static function toEntity(array $botVersion): MagicAgentVersionEntity
    {
        if (isset($botVersion['instructs']) && is_string($botVersion['instructs'])) {
            $botVersion['instructs'] = Json::decode($botVersion['instructs']);
        }
        if (isset($botVersion['visibility_config']) && is_string($botVersion['visibility_config'])) {
            $botVersion['visibility_config'] = Json::decode($botVersion['visibility_config']);
        }
        return new MagicAgentVersionEntity($botVersion);
    }

    public static function toEntities(array $botVersions): array
    {
        if (empty($botVersions)) {
            return [];
        }
        $botEntities = [];
        foreach ($botVersions as $botVersion) {
            $botEntities[] = self::toEntity((array) $botVersion);
        }
        return $botEntities;
    }

    /**
     * @param $botVersionEntities MagicAgentVersionEntity[]
     */
    public static function toArrays(array $botVersionEntities): array
    {
        if (empty($botVersionEntities)) {
            return [];
        }
        $result = [];
        foreach ($botVersionEntities as $botVersionEntity) {
            $result[] = $botVersionEntity->toArray();
        }
        return $result;
    }
}
