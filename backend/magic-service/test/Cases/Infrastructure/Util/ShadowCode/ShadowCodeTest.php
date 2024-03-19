<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\ShadowCode;

use App\Infrastructure\Util\ShadowCode\ShadowCode;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class ShadowCodeTest extends BaseTest
{
    public function testCode()
    {
        $language = 'php';
        $code = <<<'TEXT'
<?php if ($yes) {   return [       'result' => 'ok',    ];} else {  return ['result' => 'no',];}
TEXT;
        $data = [
            'language' => $language,
            'code' => $code,
        ];
        $newData = [
            'language' => $language,
            'code' => ShadowCode::shadow($code),
        ];
        var_dump(json_encode($data, JSON_UNESCAPED_UNICODE));
        var_dump(json_encode($newData, JSON_UNESCAPED_UNICODE));
        $newData['code'] = ShadowCode::unShadow($newData['code']);
        $this->assertEquals($data, $newData);
    }
}
