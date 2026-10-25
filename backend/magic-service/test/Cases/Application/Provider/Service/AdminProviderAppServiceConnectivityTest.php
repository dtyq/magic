<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\ModelGateway\Service\ConnectivityTest\LLMConnectivityTestMessageBuilder;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Odin\Contract\Api\Response\ResponseInterface;
use Mockery;
use Mockery\MockInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;
use RuntimeException;

/**
 * @internal
 */
class AdminProviderAppServiceConnectivityTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testSavedTextModelOnlyRunsStandardConnectivityTest(): void
    {
        $requests = $this->runConnectivityTest(false);

        $this->assertCount(1, $requests);
        $this->assertSame('你好', $requests[0]->getMessages()[0]['content']);
        $this->assertSame([], $requests[0]->getTools());
        $this->assertFalse($requests[0]->isEnableHighAvailability());
        $this->assertSame(-1, $requests[0]->getMaxTokens());
    }

    public function testSavedMultimodalModelRunsImageConnectivityTestAfterStandardTest(): void
    {
        $requests = $this->runConnectivityTest(true);

        $this->assertCount(2, $requests);
        $this->assertSame('你好', $requests[0]->getMessages()[0]['content']);
        $this->assertSame([], $requests[0]->getTools());
        $this->assertSame('image_url', $requests[1]->getMessages()[0]['content'][1]['type']);
        $this->assertStringStartsWith(
            'data:image/jpeg;base64,',
            $requests[1]->getMessages()[0]['content'][1]['image_url']['url']
        );
        $this->assertFalse($requests[1]->isEnableHighAvailability());
        $this->assertSame(64, $requests[1]->getMaxTokens());
    }

    public function testSavedFunctionCallModelIncludesConnectivityTestTool(): void
    {
        $requests = $this->runConnectivityTest(false, true);

        $this->assertCount(1, $requests);
        $this->assertSame('你好', $requests[0]->getMessages()[0]['content']);
        $this->assertSame(
            LLMConnectivityTestMessageBuilder::buildFunctionCallTools(),
            $requests[0]->getTools()
        );
    }

    /**
     * @return CompletionDTO[]
     */
    private function runConnectivityTest(bool $supportMultiModal, bool $supportFunction = false): array
    {
        $requests = [];
        /** @var MockInterface&ResponseInterface $response */
        $response = Mockery::mock(ResponseInterface::class);
        /** @var LLMAppService&MockInterface $llmAppService */
        $llmAppService = Mockery::mock(LLMAppService::class);
        $llmAppService->shouldReceive('chatCompletion')
            ->times($supportMultiModal ? 2 : 1)
            ->andReturnUsing(static function (CompletionDTO $request) use (&$requests, $response): ResponseInterface {
                $requests[] = $request;
                return $response;
            });
        ApplicationContext::setContainer($this->container($llmAppService));

        $providerModelEntity = (new ProviderModelEntity())
            ->setId(123)
            ->setConfig([
                'support_multi_modal' => $supportMultiModal,
                'support_function' => $supportFunction,
            ]);
        $authorization = (new MagicUserAuthorization())
            ->setId('user-1')
            ->setOrganizationCode('organization-1');

        $service = (new ReflectionClass(AdminProviderAppService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod($service, 'llmConnectivityTest');
        $method->setAccessible(true);
        $connectResponse = $method->invoke($service, $providerModelEntity, $authorization);

        $this->assertTrue($connectResponse->isStatus());
        return $requests;
    }

    private function container(LLMAppService $llmAppService): ContainerInterface
    {
        return new class($llmAppService) implements ContainerInterface {
            public function __construct(private readonly LLMAppService $llmAppService)
            {
            }

            public function get(string $id): mixed
            {
                return match ($id) {
                    LLMAppService::class => $this->llmAppService,
                    PhpSerializerPacker::class => new PhpSerializerPacker(),
                    default => throw new RuntimeException('Unsupported service: ' . $id),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [LLMAppService::class, PhpSerializerPacker::class], true);
            }
        };
    }
}
