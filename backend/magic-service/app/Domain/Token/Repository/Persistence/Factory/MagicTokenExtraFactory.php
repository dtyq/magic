<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Repository\Persistence\Factory;

use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Entity\ValueObject\ModelGatewayTokenExtra;
use App\Domain\Token\Repository\Facade\MagicTokenExtraInterface;

class MagicTokenExtraFactory
{
    /**
     * @var array<int, class-string<MagicTokenExtraInterface>>
     */
    private array $extraClassMap;

    /**
     * @param null|array<int, class-string<MagicTokenExtraInterface>> $extraClassMap
     */
    public function __construct(?array $extraClassMap = null)
    {
        $this->extraClassMap = $extraClassMap ?? [
            MagicTokenType::ModelGatewayUser->value => ModelGatewayTokenExtra::class,
            MagicTokenType::Sandbox->value => ModelGatewayTokenExtra::class,
            MagicTokenType::RefreshToken->value => ModelGatewayTokenExtra::class,
        ];
    }

    public function create(MagicTokenType $tokenType, null|array|string $rawExtra): ?MagicTokenExtraInterface
    {
        $extraClass = $this->extraClassMap[$tokenType->value] ?? null;
        if (! is_string($extraClass) || ! is_a($extraClass, MagicTokenExtraInterface::class, true)) {
            return null;
        }

        /* @var class-string<MagicTokenExtraInterface> $extraClass */
        return new $extraClass($rawExtra);
    }
}
