<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Input Tokens Details Value Object.
 */
class InputTokensDetails
{
    public function __construct(
        private ?int $cachedTokens,
        private ?int $cacheWriteTokens
    ) {
    }

    public static function fromArray(?array $data): ?self
    {
        if (empty($data)) {
            return null;
        }

        return new self(
            $data['cached_tokens'] ?? null,
            $data['cache_write_tokens'] ?? null
        );
    }

    public function toArray(): array
    {
        return [
            'cached_tokens' => $this->cachedTokens,
            'cache_write_tokens' => $this->cacheWriteTokens,
        ];
    }

    public function getCachedTokens(): ?int
    {
        return $this->cachedTokens;
    }

    public function getCacheWriteTokens(): ?int
    {
        return $this->cacheWriteTokens;
    }
}
