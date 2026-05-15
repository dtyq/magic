<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway\Entity\ValueObject;

use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class SourceIdTest extends TestCase
{
    public function testFragmentSavedShouldKeepNonBilling(): void
    {
        $this->assertTrue(SourceId::isNonBilling(SourceId::FRAGMENT_SAVED));
        $this->assertFalse(SourceId::isNonBilling('custom_embedding_billing_source'));
    }
}
