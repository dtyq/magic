<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\Token;

use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Entity\ValueObject\ModelGatewayTokenExtra;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ModelGatewayTokenExtraTest extends TestCase
{
    public function testMagicTokenTypeValuesAreExpected(): void
    {
        $this->assertSame(MagicTokenType::PersonalAccessToken, MagicTokenType::from(6));
        $this->assertSame(MagicTokenType::RefreshToken, MagicTokenType::from(8));
        $this->assertSame(MagicTokenType::ModelGatewayUser, MagicTokenType::from(9));
    }

    public function testModelGatewayRefreshMetadataValidation(): void
    {
        $extra = new ModelGatewayTokenExtra([
            'user_id' => 'u_123',
            'audience' => ModelGatewayTokenExtra::MODEL_GATEWAY_AUDIENCE,
            'target_token_type' => MagicTokenType::ModelGatewayUser->value,
        ]);

        $this->assertSame('u_123', $extra->getUserId());
        $this->assertSame(ModelGatewayTokenExtra::MODEL_GATEWAY_AUDIENCE, $extra->getAudience());
        $this->assertSame(MagicTokenType::ModelGatewayUser->value, $extra->getTargetTokenType());
        $this->assertTrue($extra->isModelGatewayRefreshForType(MagicTokenType::ModelGatewayUser));
        $this->assertFalse($extra->isModelGatewayRefreshForType(MagicTokenType::User));
    }
}
