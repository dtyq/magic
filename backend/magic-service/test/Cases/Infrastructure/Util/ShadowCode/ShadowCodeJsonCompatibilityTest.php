<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\ShadowCode;

use App\Infrastructure\Util\ShadowCode\ShadowCode;
use PHPUnit\Framework\TestCase;

/**
 * 验证 Python JSON 安全混淆载荷与现有 PHP 接收协议兼容。
 *
 * @internal
 */
final class ShadowCodeJsonCompatibilityTest extends TestCase
{
    // 由 Python ShadowCode.shadow_json 生成；Python 测试同步核对该合成向量。
    private const string PYTHON_SHADOW = <<<'SHADOW'
SHADOWED_N-=A*n8b-O-=AQqnn=AS|abz=AQ|qq=A*MBQz=ASamb=AQaQ?=A?nnn=A?n*n=A?Bqn=A?|nn=A*qbn=A*Qnn=A*qMb=A**?m-(-Fmh!m*-OdN-QUF!mF!-O-=Abm|*=AI2qBz=AI2m2=AIB|Q=Aq8amzm=AnMn?=A###*=Am#SQ-jG(-7Y!m'87-O-==AQqnn-(-uAU!m-O-=--(-Fm&7YFm-O-#Y'h!=FhmQUF*-(-#78.-O!'Am(-SUAF*8'Ymh-O-=An###=A?nnn=A?B##=A?qnn=AQB##=AQqnn=AQ###=A*nnn=A*qS#=A*###=A*qQn=A*Qnn=A*q##=A*###=A*ann=A*Qnn=A*SS#=A*###=A*SQn=A*Qnn=A*S##=A*###-j
SHADOW;

    private const string EXPECTED_JSON = <<<'JSON'
{"\ud0a4":"\uc800\ub294 \uc288\ud37c \ub9e4\uc9c1\u1000\u10d0\u1780\u1200\ud840\udc00\ud834\udd1e","nested":[{"content":"\u4e2d\u6587 \u65e5\u672c\u8a9e e\u0301\ufffd\uefbc"}],"literal":"\\uc800","quote":"\"","newline":"first\nsecond","flag":true,"boundaries":"\u0fff\u1000\u17ff\u1800\uc7ff\uc800\ucfff\ud000\ud8bf\udfff\ud8c0\udc00\ud8ff\udfff\ud900\udc00\udbbf\udfff\udbc0\udc00\udbff\udfff"}
JSON;

    /**
     * 先按现有字节协议解混淆，再由 JSON 解码恢复所有 Unicode 字段。
     */
    public function testPythonUnicodePayloadIsDecodedWithoutLoss(): void
    {
        $decoded = ShadowCode::unShadow(self::PYTHON_SHADOW);

        self::assertSame(self::EXPECTED_JSON, $decoded);
        self::assertSame(
            json_decode(self::EXPECTED_JSON, true, 512, JSON_THROW_ON_ERROR),
            json_decode($decoded, true, 512, JSON_THROW_ON_ERROR)
        );
    }
}
