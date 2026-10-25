<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Project\Service;

use App\Application\SuperMagic\Project\DTO\Request\PublishMicroAppRequestDTO;
use App\Interfaces\SuperMagic\Common\Share\DTO\Request\CreateShareRequestDTO;

final class MicroAppShareConfig
{
    public function buildExtra(?array $existingExtra, PublishMicroAppRequestDTO $requestDTO): ?array
    {
        if (! $requestDTO->hasExtra()) {
            return null;
        }

        $extra = $existingExtra ?? [];
        // 持久化层内部字段不能回灌给客户端请求 DTO。
        unset($extra['_authorization_version']);
        $requestedExtra = $requestDTO->getExtra();
        if (array_key_exists(CreateShareRequestDTO::EXTRA_FIELD_PURE_MODE, $requestedExtra)) {
            $extra[CreateShareRequestDTO::EXTRA_FIELD_PURE_MODE] = filter_var(
                $requestedExtra[CreateShareRequestDTO::EXTRA_FIELD_PURE_MODE],
                FILTER_VALIDATE_BOOLEAN,
            );
        }
        return $extra;
    }

    public function formatResponseExtra(?array $extra): array
    {
        return [CreateShareRequestDTO::EXTRA_FIELD_PURE_MODE => filter_var(
            ($extra ?? [])[CreateShareRequestDTO::EXTRA_FIELD_PURE_MODE] ?? false,
            FILTER_VALIDATE_BOOLEAN,
        )];
    }
}
