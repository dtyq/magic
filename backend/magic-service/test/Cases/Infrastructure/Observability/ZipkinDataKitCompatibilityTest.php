<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Observability;

use GuzzleHttp\Psr7\ServerRequest;
use Kkguan\Service\Opentracer\Utils\W3cTraceContextNormalizer;
use PHPUnit\Framework\TestCase;
use Zipkin\Endpoint;
use Zipkin\Propagation\TraceContext;
use Zipkin\Recording\Span;
use Zipkin\Reporter;
use Zipkin\Samplers\BinarySampler;
use Zipkin\Tracer;
use Zipkin\TracingBuilder;

/**
 * @internal
 */
final class ZipkinDataKitCompatibilityTest extends TestCase
{
    public function testParentAndChildSpansUseDataKitCompatibleZipkinFields(): void
    {
        $reporter = new InMemoryReporter();
        $tracer = $this->createTracer($reporter);
        $trace = $tracer->newTrace();
        $trace->setName('POST /api/chat');
        $trace->setKind('SERVER');
        $trace->start(1787818379711000);

        $child = $tracer->newChild($trace->getContext());
        $child->setName('db.query');
        $child->setKind('CLIENT');
        $child->start(1787818379721000);
        $child->finish(1787818379722220);
        $child->flush();

        $trace->finish(1787818379811000);
        $trace->flush();

        self::assertCount(2, $reporter->spans);

        $payload = array_map($this->toZipkinV2Payload(...), $reporter->spans);
        $parent = $payload[1];
        $childPayload = $payload[0];

        self::assertSame($parent['traceId'], $childPayload['traceId']);
        self::assertSame($parent['id'], $childPayload['parentId']);
        self::assertNotSame($parent['id'], $childPayload['id']);
        self::assertSame('POST /api/chat', $parent['name']);
        self::assertSame('db.query', $childPayload['name']);
        self::assertSame(1787818379721000, $childPayload['timestamp']);
        self::assertSame(1220, $childPayload['duration']);
        self::assertSame(32, strlen($childPayload['traceId']));
        self::assertSame(16, strlen($childPayload['id']));
        self::assertSame(16, strlen($childPayload['parentId']));
    }

    public function testAChildWithMissingParentCannotBeAssociatedByTraceIdAlone(): void
    {
        $reporter = new InMemoryReporter();
        $tracer = $this->createTracer($reporter);
        $traceId = '0000000000000000ed6adbf748a15196';
        $traceContext = TraceContext::create($traceId, '6cd30b846771713f');
        $trace = $tracer->nextSpan($traceContext);
        $trace->start(1787818379711000);

        $orphanContext = TraceContext::create($traceId, '7fd42e8b91c6a203');
        $child = $tracer->nextSpan($orphanContext);
        $child->start(1787818379721000);
        $child->finish(1787818379722220);
        $child->flush();
        $trace->finish(1787818379811000);
        $trace->flush();

        $payload = array_map($this->toZipkinV2Payload(...), $reporter->spans);
        self::assertSame($payload[0]['traceId'], $payload[1]['traceId']);
        self::assertArrayNotHasKey('parentId', $payload[0] ?? []);
    }

    public function testW3cTraceparentIsConvertedToB3Headers(): void
    {
        $request = new ServerRequest('POST', '/v1/chat/completions', [
            'traceparent' => '00-138d03e6c5672361ca89af5e00886cbb-b856947fee7cdd64-01',
        ]);

        $normalized = W3cTraceContextNormalizer::normalize($request);

        self::assertSame('138d03e6c5672361ca89af5e00886cbb', $normalized->getHeaderLine('x-b3-traceid'));
        self::assertSame('b856947fee7cdd64', $normalized->getHeaderLine('x-b3-spanid'));
        self::assertSame('1', $normalized->getHeaderLine('x-b3-sampled'));
    }

    public function testInvalidW3cTraceparentIsIgnored(): void
    {
        $request = new ServerRequest('POST', '/v1/chat/completions', [
            'traceparent' => 'invalid-traceparent',
        ]);

        $normalized = W3cTraceContextNormalizer::normalize($request);

        self::assertFalse($normalized->hasHeader('x-b3-traceid'));
        self::assertFalse($normalized->hasHeader('x-b3-spanid'));
    }

    public function testExistingB3HeadersTakePrecedenceOverW3cTraceparent(): void
    {
        $request = new ServerRequest('POST', '/v1/chat/completions', [
            'traceparent' => '00-138d03e6c5672361ca89af5e00886cbb-b856947fee7cdd64-01',
            'x-b3-traceid' => 'aaaaaaaaaaaaaaaa',
            'x-b3-spanid' => 'bbbbbbbbbbbbbbbb',
        ]);

        $normalized = W3cTraceContextNormalizer::normalize($request);

        self::assertSame('aaaaaaaaaaaaaaaa', $normalized->getHeaderLine('x-b3-traceid'));
        self::assertSame('bbbbbbbbbbbbbbbb', $normalized->getHeaderLine('x-b3-spanid'));
    }

    private function createTracer(InMemoryReporter $reporter): Tracer
    {
        return TracingBuilder::create()
            ->havingLocalEndpoint(Endpoint::create('magic-service-saas', '0.0.0.0', null, 9501))
            ->havingReporter($reporter)
            ->havingSampler(BinarySampler::createAsAlwaysSample())
            ->havingTraceId128bits(true)
            ->build()
            ->getTracer();
    }

    /**
     * @return array<string,mixed>
     */
    private function toZipkinV2Payload(Span $span): array
    {
        $payload = [
            'traceId' => $span->getTraceId(),
            'id' => $span->getSpanId(),
            'name' => $span->getName(),
            'timestamp' => $span->getTimestamp(),
            'duration' => $span->getDuration(),
        ];

        if ($span->getParentId() !== null) {
            $payload['parentId'] = $span->getParentId();
        }

        return $payload;
    }
}

final class InMemoryReporter implements Reporter
{
    /**
     * @var list<Span>
     */
    public array $spans = [];

    /**
     * @param list<Span> $spans
     */
    public function report(array $spans): void
    {
        $this->spans = array_merge($this->spans, $spans);
    }
}
