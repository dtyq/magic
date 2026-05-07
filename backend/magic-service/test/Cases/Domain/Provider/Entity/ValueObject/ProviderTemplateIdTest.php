<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Provider\Entity\ValueObject;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderTemplateId;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ProviderTemplateIdTest extends TestCase
{
    public function testVolcengineArkVgmTemplateMapping(): void
    {
        $templateId = ProviderTemplateId::fromProviderCodeAndCategory(
            ProviderCode::VolcengineArk,
            Category::VGM
        );

        $this->assertSame(ProviderTemplateId::VolcengineArkVgm, $templateId);
        $this->assertSame(
            [
                'providerCode' => ProviderCode::VolcengineArk,
                'category' => Category::VGM,
            ],
            $templateId?->toProviderCodeAndCategory()
        );
    }
}
