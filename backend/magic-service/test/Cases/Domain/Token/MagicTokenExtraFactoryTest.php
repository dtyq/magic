<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\Token;

use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Entity\ValueObject\ModelGatewayTokenExtra;
use App\Domain\Token\Repository\Persistence\Factory\MagicTokenExtraFactory;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MagicTokenExtraFactoryTest extends TestCase
{
    public function testMappedTokenTypeShouldCreateModelGatewayExtra(): void
    {
        $factory = new MagicTokenExtraFactory();

        $extra = $factory->create(MagicTokenType::RefreshToken, ['user_id' => 'u_001', 'audience' => 'model_gateway']);

        $this->assertInstanceOf(ModelGatewayTokenExtra::class, $extra);
        $this->assertSame('u_001', $extra->getUserId());
        $this->assertSame('model_gateway', $extra->getAudience());
    }

    public function testMappedTokenTypeShouldHandleJsonString(): void
    {
        $factory = new MagicTokenExtraFactory();

        $extra = $factory->create(MagicTokenType::ModelGatewayUser, '{"user_id":"u_002"}');

        $this->assertInstanceOf(ModelGatewayTokenExtra::class, $extra);
        $this->assertSame('u_002', $extra->getUserId());
    }

    public function testUnmappedTokenTypeShouldReturnNull(): void
    {
        $factory = new MagicTokenExtraFactory();

        $extra = $factory->create(MagicTokenType::User, ['user_id' => 'u_003']);

        $this->assertNull($extra);
    }
}
