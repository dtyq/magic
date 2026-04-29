<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Transport\Ipc\Uds;

use App\Infrastructure\Transport\Ipc\Uds\IpcFrameCodec;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * @internal
 */
class IpcFrameCodecTest extends TestCase
{
    public function testIdentityRoundTrip(): void
    {
        $rawJson = '{"jsonrpc":"2.0","method":"ipc.hello","id":1}';

        $frameBody = IpcFrameCodec::encodeFrame($rawJson, 30 * 1024 * 1024);
        $decoded = IpcFrameCodec::decodeFrame($frameBody);
        $summary = IpcFrameCodec::summarizeJson($rawJson);

        $this->assertSame($rawJson, $decoded);
        $this->assertSame('identity', $summary['frame_codec']);
        $this->assertSame(strlen($rawJson), $summary['raw_json_bytes']);
    }

    public function testGzipRoundTripAboveThreshold(): void
    {
        $rawJson = str_repeat('a', IpcFrameCodec::IDENTITY_THRESHOLD_BYTES + 1);

        $frameBody = IpcFrameCodec::encodeFrame($rawJson, 30 * 1024 * 1024);
        $decoded = IpcFrameCodec::decodeFrame($frameBody);
        $summary = IpcFrameCodec::summarizeJson($rawJson);

        $this->assertSame($rawJson, $decoded);
        $this->assertSame('gzip', $summary['frame_codec']);
    }

    public function testDecodeFrameWithSummaryShouldReturnIdentityMetadata(): void
    {
        $rawJson = '{"jsonrpc":"2.0","result":{"ok":true}}';

        $frameBody = IpcFrameCodec::encodeFrame($rawJson, 30 * 1024 * 1024);
        $decoded = IpcFrameCodec::decodeFrameWithSummary($frameBody);

        $this->assertSame($rawJson, $decoded['payload']);
        $this->assertSame(strlen($rawJson), $decoded['raw_json_bytes']);
        $this->assertSame(strlen($frameBody), $decoded['frame_bytes']);
        $this->assertSame('identity', $decoded['frame_codec']);
    }

    public function testDecodeFrameWithSummaryShouldReturnGzipMetadata(): void
    {
        $rawJson = str_repeat('z', IpcFrameCodec::IDENTITY_THRESHOLD_BYTES + 64);

        $frameBody = IpcFrameCodec::encodeFrame($rawJson, 30 * 1024 * 1024);
        $decoded = IpcFrameCodec::decodeFrameWithSummary($frameBody);

        $this->assertSame($rawJson, $decoded['payload']);
        $this->assertSame(strlen($rawJson), $decoded['raw_json_bytes']);
        $this->assertSame(strlen($frameBody), $decoded['frame_bytes']);
        $this->assertSame('gzip', $decoded['frame_codec']);
    }

    public function testThresholdBoundaryUsesIdentityAt10KiB(): void
    {
        $rawJson = str_repeat('b', IpcFrameCodec::IDENTITY_THRESHOLD_BYTES);
        $summary = IpcFrameCodec::summarizeJson($rawJson);

        $this->assertSame('identity', $summary['frame_codec']);
    }

    public function testDecodeRejectsInvalidMagic(): void
    {
        $frameBody = IpcFrameCodec::encodeFrame('{"jsonrpc":"2.0","id":1}', 30 * 1024 * 1024);
        $frameBody = 'NOPE' . substr($frameBody, 4);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Invalid IPC frame magic');
        IpcFrameCodec::decodeFrame($frameBody);
    }

    public function testDecodeRejectsCorruptedGzipPayload(): void
    {
        $rawJson = str_repeat('c', IpcFrameCodec::IDENTITY_THRESHOLD_BYTES + 1);
        $frameBody = IpcFrameCodec::encodeFrame($rawJson, 30 * 1024 * 1024);
        $frameBody[strlen($frameBody) - 1] = chr(ord($frameBody[strlen($frameBody) - 1]) ^ 0xFF);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Failed to decode IPC gzip payload');
        IpcFrameCodec::decodeFrame($frameBody);
    }

    public function testDecodeRejectsRawLengthMismatch(): void
    {
        $frameBody = IpcFrameCodec::encodeFrame('{"jsonrpc":"2.0","id":1}', 30 * 1024 * 1024);
        $rawLength = unpack('N', substr($frameBody, 6, 4))[1] + 1;
        $frameBody = substr($frameBody, 0, 6) . pack('N', $rawLength) . substr($frameBody, 10);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('IPC frame raw length mismatch');
        IpcFrameCodec::decodeFrame($frameBody);
    }

    public function testEncodeRejectsFramesAboveConfiguredLimit(): void
    {
        $rawJson = str_repeat('d', 256);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('IPC frame too large');
        IpcFrameCodec::encodeFrame($rawJson, 64);
    }
}
