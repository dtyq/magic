<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\Token;

use App\Domain\Token\DTO\ModelGatewayTokenDTO;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ModelGatewayTokenDTOTest extends TestCase
{
    public function testToArrayUsesApiKeyFields(): void
    {
        $dto = new ModelGatewayTokenDTO(
            'api_key_value',
            'refresh_token_value',
            '2026-02-26 12:00:00',
            '2026-03-05 12:00:00'
        );

        $this->assertSame('api_key_value', $dto->getApiKey());
        $this->assertSame('2026-02-26 12:00:00', $dto->getApiKeyExpiresAt());
        $this->assertSame([
            'api_key' => 'api_key_value',
            'refresh_token' => 'refresh_token_value',
            'api_key_expires_at' => '2026-02-26 12:00:00',
            'refresh_token_expires_at' => '2026-03-05 12:00:00',
        ], $dto->toArray());
    }
}
