<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\KnowledgeBase\Facade;

use App\Application\File\Service\FileAppService;
use App\Application\KnowledgeBase\DTO\RpcHttpPassthroughResult;
use App\Application\KnowledgeBase\Port\EmbeddingProviderPort;
use App\Application\KnowledgeBase\Service\KnowledgeBaseAppService;
use App\Application\KnowledgeBase\Service\KnowledgeBaseDocumentAppService;
use App\Application\KnowledgeBase\Service\KnowledgeBaseFragmentAppService;
use App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase\KnowledgeBaseStrategyInterface;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Http\RpcHttpPassthroughResponseFactory;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\KnowledgeBase\Facade\KnowledgeBaseFragmentApi;
use Hyperf\HttpMessage\Server\Response as PsrResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\HttpServer\Response;
use Hyperf\HttpServer\Router\Dispatched;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class KnowledgeBaseFragmentApiTest extends TestCase
{
    public function testFragmentPreviewShouldReturnPassthroughResponse(): void
    {
        $request = $this->newRequestMock([
            'document_file' => ['name' => 'test.md', 'key' => 'demo-key'],
            'strategy_config' => ['mode' => 'demo'],
            'fragment_config' => ['mode' => 'normal'],
            'document_code' => 'doc-001',
        ]);
        $authorization = $this->setAuthorization();

        $appService = $this->createMock(KnowledgeBaseFragmentAppService::class);
        $appService->expects($this->once())
            ->method('fragmentPreviewHttpPassthroughRaw')
            ->with(
                $authorization,
                ['name' => 'test.md', 'key' => 'demo-key'],
                ['mode' => 'demo'],
                ['mode' => 'normal'],
                'gzip',
                'doc-001',
            )
            ->willReturn($this->newPassthroughResult());

        $factory = $this->newFactory();

        $api = $this->newApi($request, $appService, $factory);

        $response = $api->fragmentPreview();
        $this->assertSame('application/json; charset=utf-8', $response->getHeaderLine('Content-Type'));
        $this->assertSame('{"code":1000,"message":"ok","data":{}}', (string) $response->getBody());
    }

    public function testQueriesShouldReturnPassthroughResponse(): void
    {
        $request = $this->newRequestMock([
            'page' => 1,
            'page_size' => 200,
        ]);
        $authorization = $this->setAuthorization();

        $appService = $this->createMock(KnowledgeBaseFragmentAppService::class);
        $appService->expects($this->once())
            ->method('queriesHttpPassthroughRaw')
            ->with(
                $authorization,
                ['page' => 1, 'page_size' => 200],
                'knowledge-001',
                'document-001',
                'gzip',
            )
            ->willReturn($this->newPassthroughResult());

        $factory = $this->newFactory();

        $api = $this->newApi($request, $appService, $factory);

        $response = $api->queries('knowledge-001', 'document-001');
        $this->assertSame('application/json; charset=utf-8', $response->getHeaderLine('Content-Type'));
        $this->assertSame('{"code":1000,"message":"ok","data":{}}', (string) $response->getBody());
    }

    public function testSimilarityShouldReturnPassthroughResponse(): void
    {
        $request = $this->newRequestMock([], [
            'query' => 'test query',
            'debug' => true,
        ]);
        $authorization = $this->setAuthorization();

        $appService = $this->createMock(KnowledgeBaseFragmentAppService::class);
        $appService->expects($this->once())
            ->method('similarityHttpPassthroughRaw')
            ->with(
                $authorization,
                'knowledge-001',
                'test query',
                'gzip',
                true,
            )
            ->willReturn($this->newPassthroughResult());

        $factory = $this->newFactory();

        $api = $this->newApi($request, $appService, $factory);

        $response = $api->similarity('knowledge-001');
        $this->assertSame('application/json; charset=utf-8', $response->getHeaderLine('Content-Type'));
        $this->assertSame('{"code":1000,"message":"ok","data":{}}', (string) $response->getBody());
    }

    private function newApi(
        RequestInterface $request,
        KnowledgeBaseFragmentAppService $appService,
        RpcHttpPassthroughResponseFactory $factory,
    ): KnowledgeBaseFragmentApi {
        return new KnowledgeBaseFragmentApi(
            $request,
            $this->createMock(KnowledgeBaseAppService::class),
            $this->createMock(KnowledgeBaseDocumentAppService::class),
            $appService,
            $this->createMock(ModelGatewayMapper::class),
            $this->createMock(FileAppService::class),
            $this->createMock(KnowledgeBaseStrategyInterface::class),
            $this->createMock(LLMAppService::class),
            $this->createMock(EmbeddingProviderPort::class),
            $factory,
        );
    }

    /**
     * @param array<string, mixed> $all
     * @param array<string, mixed> $inputs
     */
    private function newRequestMock(array $all, array $inputs = []): RequestInterface
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('all')->willReturn($all);
        $request->method('getHeaderLine')->with('Accept-Encoding')->willReturn('gzip');
        $request->method('getAttribute')
            ->with(Dispatched::class)
            ->willReturn((object) ['params' => []]);
        $request->method('input')
            ->willReturnCallback(static fn (string $key, mixed $default = null): mixed => $inputs[$key] ?? $default);

        return $request;
    }

    private function setAuthorization(): MagicUserAuthorization
    {
        $authorization = (new MagicUserAuthorization())
            ->setId('user-001')
            ->setOrganizationCode('org-001');
        RequestCoContext::setUserAuthorization($authorization);

        return $authorization;
    }

    private function newPassthroughResult(): RpcHttpPassthroughResult
    {
        return new RpcHttpPassthroughResult(
            statusCode: 200,
            contentType: 'application/json; charset=utf-8',
            contentEncoding: '',
            vary: '',
            bodyBase64: base64_encode('{"code":1000,"message":"ok","data":{}}'),
            bodyBytes: strlen('{"code":1000,"message":"ok","data":{}}'),
        );
    }

    private function newFactory(): RpcHttpPassthroughResponseFactory
    {
        return new RpcHttpPassthroughResponseFactory(new Response(new PsrResponse()));
    }
}
