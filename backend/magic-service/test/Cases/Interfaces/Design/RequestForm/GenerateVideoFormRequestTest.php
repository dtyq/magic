<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Design\RequestForm;

use App\Interfaces\Design\RequestForm\GenerateVideoFormRequest;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class GenerateVideoFormRequestTest extends BaseTest
{
    /** 验证画布合成字段已纳入请求校验，避免 validated 丢失 composition。 */
    public function testRulesKeepCanvasCompositionFields(): void
    {
        $rules = di(GenerateVideoFormRequest::class)->rules();

        $this->assertSame('nullable|array', $rules['composition']);
        $this->assertSame('nullable|array|max:10', $rules['composition.videos']);
        $this->assertSame('required|string|max:4096', $rules['composition.videos.*.path']);
        $this->assertSame('nullable|array|max:1', $rules['composition.audios']);
        $this->assertSame('required|string|max:4096', $rules['composition.audios.*.path']);
    }
}
