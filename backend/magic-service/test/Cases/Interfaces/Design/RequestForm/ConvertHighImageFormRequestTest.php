<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Design\RequestForm;

use App\Interfaces\Design\RequestForm\ConvertHighImageFormRequest;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class ConvertHighImageFormRequestTest extends BaseTest
{
    public function testRulesKeepRequestedSize(): void
    {
        $rules = di(ConvertHighImageFormRequest::class)->rules();

        $this->assertArrayHasKey('size', $rules);
        $this->assertSame('nullable|string|max:50', $rules['size']);
    }
}
