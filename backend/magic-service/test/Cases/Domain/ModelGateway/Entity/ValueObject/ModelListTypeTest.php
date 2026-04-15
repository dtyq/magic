<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway\Entity\ValueObject;

use App\Domain\ModelGateway\Entity\ValueObject\ModelListType;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ModelListTypeTest extends TestCase
{
    public function testFromRequestShouldMapKnownTypes(): void
    {
        $this->assertSame(ModelListType::CHAT, ModelListType::fromRequest('chat'));
        $this->assertSame(ModelListType::EMBEDDING, ModelListType::fromRequest('embedding'));
        $this->assertSame(ModelListType::IMAGE, ModelListType::fromRequest('image'));
    }

    public function testFromRequestShouldFallbackToAllForEmptyOrUnknownType(): void
    {
        $this->assertSame(ModelListType::ALL, ModelListType::fromRequest(''));
        $this->assertSame(ModelListType::ALL, ModelListType::fromRequest(null));
        $this->assertSame(ModelListType::ALL, ModelListType::fromRequest('foo'));
        $this->assertSame(ModelListType::ALL, ModelListType::fromRequest(' CHAT_UNKNOWN '));
    }
}
