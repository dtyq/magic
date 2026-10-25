<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway;

use App\Domain\ModelGateway\Entity\ValueObject\Code;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ModelGatewayCodeTest extends TestCase
{
    public function testImageGenerationTaskCodeUsesBusinessPrefix(): void
    {
        $code = Code::ImageGenerationTask->gen();

        $this->assertMatchesRegularExpression('/^IGT-[0-9a-f]{14}-[0-9]{8}$/', $code);
    }
}
