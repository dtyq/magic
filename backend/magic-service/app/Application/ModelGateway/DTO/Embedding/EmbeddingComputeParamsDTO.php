<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\DTO\Embedding;

use App\Application\ModelGateway\DTO\Common\BusinessParamsDTO;

readonly class EmbeddingComputeParamsDTO
{
    /**
     * @param array<int, string>|string $input
     */
    public function __construct(
        public string $model,
        public array|string $input,
        public BusinessParamsDTO $businessParams,
        public string $accessToken = '',
    ) {
    }

    public static function fromArray(array $params): self
    {
        $input = $params['input'] ?? [];
        $normalizedInput = [];
        if (is_array($input)) {
            $normalizedInput = array_map(static fn ($value): string => (string) $value, $input);
        } elseif (is_string($input)) {
            $normalizedInput = $input;
        }

        return new self(
            model: (string) ($params['model'] ?? ''),
            input: $normalizedInput,
            businessParams: BusinessParamsDTO::fromArray((array) ($params['business_params'] ?? [])),
            accessToken: (string) ($params['access_token'] ?? ''),
        );
    }
}
