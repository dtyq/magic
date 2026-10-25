<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\Log;

use App\Infrastructure\Util\Log\PayloadLogSanitizer;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class PayloadLogSanitizerTest extends TestCase
{
    public function testSanitizeValueKeepsNonBase64ValuesUnchanged(): void
    {
        $payload = [
            'api_key' => 'secret-api-key',
            'url' => 'https://example.com/generate?token=secret',
            'prompt' => 'a long prompt that should stay intact',
            'nested' => ['model' => 'test-model'],
        ];

        $this->assertSame($payload, PayloadLogSanitizer::sanitizeValue($payload));
    }

    public function testSanitizeValueDoesNotSpecialCaseTextFieldNames(): void
    {
        $this->assertSame('short prompt', PayloadLogSanitizer::sanitizeValue('short prompt'));
    }

    public function testSanitizeValueSummarizesAnyMediaDataUri(): void
    {
        $binary = 'video-binary';
        $dataUri = 'data:video/mp4;base64,' . base64_encode($binary);

        $sanitized = PayloadLogSanitizer::sanitizeValue($dataUri);

        $this->assertSame('data_uri', $sanitized['type']);
        $this->assertSame('video/mp4', $sanitized['mime_type']);
        $this->assertSame(strlen(base64_encode($binary)), $sanitized['base64_length']);
    }

    public function testSanitizeValueDoesNotSpecialCaseDataFieldName(): void
    {
        $this->assertSame('c3RhcnQ=', PayloadLogSanitizer::sanitizeValue('c3RhcnQ='));
    }

    public function testSanitizeValueRecursivelySummarizesBase64WithoutFieldNameCoupling(): void
    {
        $binary = str_repeat('gemini-inline-image-binary-', 10);

        $sanitized = PayloadLogSanitizer::sanitizeValue([
            'inlineData' => [
                'mimeType' => 'image/jpeg',
                'data' => base64_encode($binary),
            ],
        ]);

        $data = $sanitized['inlineData']['data'];
        $this->assertSame('image/jpeg', $sanitized['inlineData']['mimeType']);
        $this->assertSame('base64', $data['type']);
        $this->assertSame(strlen(base64_encode($binary)), $data['base64_length']);
        $this->assertArrayNotHasKey('mime_type', $data);
    }

    public function testSanitizeValueSummarizesLongBase64ByValue(): void
    {
        $binary = str_repeat('base64-data-', 20);

        $sanitized = PayloadLogSanitizer::sanitizeValue(base64_encode($binary));

        $this->assertSame('base64', $sanitized['type']);
        $this->assertSame(strlen(base64_encode($binary)), $sanitized['base64_length']);
    }

    public function testSanitizeValueKeepsLongPlainStringUnchanged(): void
    {
        $longText = str_repeat('a-', 1024);

        $this->assertSame($longText, PayloadLogSanitizer::sanitizeValue($longText));
    }

    public function testSanitizeValueKeepsSmallSafeValues(): void
    {
        $this->assertSame('MiniMax-H3', PayloadLogSanitizer::sanitizeValue('MiniMax-H3'));
        $this->assertSame(10, PayloadLogSanitizer::sanitizeValue(10));
        $this->assertTrue(PayloadLogSanitizer::sanitizeValue(true));
    }

    public function testSanitizeResponseBodyOnlySummarizesBase64(): void
    {
        $body = json_encode([
            'message' => 'request failed',
            'data' => 'data:image/png;base64,' . base64_encode('image-binary'),
            'token' => 'secret-token',
        ], JSON_THROW_ON_ERROR);

        $sanitized = PayloadLogSanitizer::sanitizeResponseBody($body);
        $decoded = json_decode($sanitized, true);

        $this->assertSame('request failed', $decoded['message']);
        $this->assertSame('data_uri', $decoded['data']['type']);
        $this->assertSame('secret-token', $decoded['token']);
        $this->assertStringNotContainsString('image-binary', $sanitized);
    }
}
