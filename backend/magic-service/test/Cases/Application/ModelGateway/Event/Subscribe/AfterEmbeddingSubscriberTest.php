<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Event\Subscribe;

use App\Application\ModelGateway\Event\ModelUsageEvent;
use App\Application\ModelGateway\Event\Subscribe\AfterEmbeddingSubscriber;
use GuzzleHttp\Psr7\Response as PsrResponse;
use Hyperf\Context\ApplicationContext;
use Hyperf\Odin\Api\Request\EmbeddingRequest;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Hyperf\Odin\Constants\ModelType;
use Hyperf\Odin\Event\AfterEmbeddingsEvent;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use RuntimeException;

/**
 * @internal
 */
class AfterEmbeddingSubscriberTest extends TestCase
{
    private ContainerInterface $originalContainer;

    private RecordingAfterEmbeddingEventDispatcher $eventDispatcher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->originalContainer = ApplicationContext::hasContainer()
            ? ApplicationContext::getContainer()
            : new class implements ContainerInterface {
                public function get(string $id): mixed
                {
                    throw new RuntimeException(sprintf('test container entry not found: %s', $id));
                }

                public function has(string $id): bool
                {
                    return false;
                }
            };
        $this->eventDispatcher = new RecordingAfterEmbeddingEventDispatcher();
        ApplicationContext::setContainer(new AfterEmbeddingEventDispatcherContainer(
            $this->eventDispatcher,
            $this->originalContainer,
        ));
    }

    protected function tearDown(): void
    {
        ApplicationContext::setContainer($this->originalContainer);

        parent::tearDown();
    }

    public function testProcessShouldFallbackToOrganizationCodeAndPreserveUserId(): void
    {
        $subscriber = new AfterEmbeddingSubscriber();
        $subscriber->process($this->createAfterEmbeddingsEvent([
            'organization_code' => 'ORG001',
            'user_id' => 'USER001',
            'business_id' => 'KB001',
        ]));

        $usageEvent = $this->assertSingleModelUsageEvent();
        $this->assertSame(ModelType::EMBEDDING, $usageEvent->getModelType());
        $this->assertSame('ORG001', $usageEvent->getOrganizationCode());
        $this->assertSame('USER001', $usageEvent->getUserId());
        $this->assertSame('ORG001', $usageEvent->getBusinessParam('organization_code'));
        $this->assertSame('ORG001', $usageEvent->getBusinessParam('organization_id'));
        $this->assertSame('USER001', $usageEvent->getBusinessParam('user_id'));
        $this->assertSame('KB001', $usageEvent->getBusinessParam('business_id'));
    }

    public function testProcessShouldPreferOrganizationIdAndPreserveUserId(): void
    {
        $subscriber = new AfterEmbeddingSubscriber();
        $subscriber->process($this->createAfterEmbeddingsEvent([
            'organization_code' => 'ORG_OLD',
            'organization_id' => 'ORG002',
            'user_id' => 'USER002',
        ]));

        $usageEvent = $this->assertSingleModelUsageEvent();
        $this->assertSame('ORG002', $usageEvent->getOrganizationCode());
        $this->assertSame('USER002', $usageEvent->getUserId());
        $this->assertSame('ORG002', $usageEvent->getBusinessParam('organization_code'));
        $this->assertSame('ORG002', $usageEvent->getBusinessParam('organization_id'));
        $this->assertSame('USER002', $usageEvent->getBusinessParam('user_id'));
    }

    private function createAfterEmbeddingsEvent(array $businessParams): AfterEmbeddingsEvent
    {
        $request = new EmbeddingRequest('hello', 'text-embedding-3-large');
        $request->setBusinessParams($businessParams);

        $response = new EmbeddingResponse(new PsrResponse(
            200,
            ['Content-Type' => 'application/json'],
            '{"object":"list","data":[],"model":"text-embedding-3-large","usage":{"prompt_tokens":3,"total_tokens":3}}'
        ));

        return new AfterEmbeddingsEvent($request, $response, 0.1);
    }

    private function assertSingleModelUsageEvent(): ModelUsageEvent
    {
        $this->assertCount(1, $this->eventDispatcher->events);
        $event = $this->eventDispatcher->events[0];
        $this->assertInstanceOf(ModelUsageEvent::class, $event);

        return $event;
    }
}

final class RecordingAfterEmbeddingEventDispatcher implements EventDispatcherInterface
{
    /** @var list<object> */
    public array $events = [];

    public function dispatch(object $event): object
    {
        $this->events[] = $event;

        return $event;
    }
}

final readonly class AfterEmbeddingEventDispatcherContainer implements ContainerInterface
{
    public function __construct(
        private EventDispatcherInterface $eventDispatcher,
        private ContainerInterface $fallbackContainer,
    ) {
    }

    public function get(string $id): mixed
    {
        if ($id === EventDispatcherInterface::class) {
            return $this->eventDispatcher;
        }

        return $this->fallbackContainer->get($id);
    }

    public function has(string $id): bool
    {
        return $id === EventDispatcherInterface::class || $this->fallbackContainer->has($id);
    }
}
