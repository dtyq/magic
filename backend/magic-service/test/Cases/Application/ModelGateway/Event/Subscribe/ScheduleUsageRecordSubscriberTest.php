<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Event\Subscribe;

use App\Application\ModelGateway\Event\ModelUsageEvent;
use App\Application\ModelGateway\Event\Subscribe\ScheduleUsageRecordSubscriber;
use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Domain\ModelGateway\Entity\MsgLogEntity;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\ModelGateway\Event\ImageGeneratedEvent;
use App\Domain\ModelGateway\Service\MsgLogDomainService;
use DateTime;
use Hyperf\Odin\Api\Response\Usage;
use Hyperf\Odin\Constants\ModelType;
use HyperfTest\Cases\BaseTest;
use Psr\Container\ContainerInterface;

/**
 * 模型调用日志订阅器测试。
 * @internal
 */
class ScheduleUsageRecordSubscriberTest extends BaseTest
{
    /**
     * 验证成功的文本调用会写入完整日志字段。
     */
    public function testSuccessfulModelUsageCreatesLog(): void
    {
        $event = new ModelUsageEvent(
            modelType: ModelType::CHAT,
            modelId: 'chat-model-id',
            modelVersion: 'chat-model-version',
            usage: new Usage(promptTokens: 11, completionTokens: 7, totalTokens: 18),
            organizationCode: 'org-test',
            userId: 'user-test',
            appId: 'app-test',
            serviceProviderModelId: 'provider-model-test',
            businessParams: [
                'business_id' => 'business-test',
                'source_id' => 'source-test',
                'user_name' => '测试用户',
                'access_token_id' => 'token-test',
                'service_provider_id' => 'provider-test',
                'service_provider_model_id' => 'provider-model-test',
            ],
        );

        $subscriber = $this->createSubscriber(function (MsgLogEntity $entity): void {
            self::assertSame('chat-model-id', $entity->getModel());
            self::assertSame('chat-model-version', $entity->getModelVersion());
            self::assertSame(18, $entity->getUseToken());
            self::assertSame(11, $entity->getPromptTokens());
            self::assertSame(7, $entity->getCompletionTokens());
            self::assertSame('business-test', $entity->getBusinessId());
            self::assertSame('source-test', $entity->getSourceId());
            self::assertSame('provider-test', $entity->getProviderId());
            self::assertSame('provider-model-test', $entity->getProviderModelId());
        });

        $subscriber->process($event);
    }

    /**
     * 验证明确失败的文本调用不会写入日志。
     */
    public function testFailedModelUsageDoesNotCreateLog(): void
    {
        $event = new ModelUsageEvent(
            modelType: ModelType::CHAT,
            modelId: 'chat-model-id',
            modelVersion: 'chat-model-version',
            usage: new Usage(promptTokens: 0, completionTokens: 0, totalTokens: 0),
            organizationCode: 'org-test',
            userId: 'user-test',
            businessParams: ['is_success' => false],
        );

        $subscriber = $this->createSubscriber(null, false);
        $subscriber->process($event);
    }

    /**
     * 验证成功的图片调用会按一次请求写入一条日志。
     */
    public function testSuccessfulImageGeneratedCreatesLog(): void
    {
        $event = new ImageGeneratedEvent();
        $event->setOrganizationCode('org-test');
        $event->setUserId('user-test');
        $event->setModel('image-model-version');
        $event->setImageCount(2);
        $event->setCreatedAt(new DateTime());
        $event->setSourceType(ImageGenerateSourceEnum::API);
        $event->setProviderModelId('provider-model-test');
        $event->setBusinessParams([
            'status' => 'SUCCESS',
            'model_id' => 'image-model-id',
            'model_version' => 'image-model-version',
            'business_id' => 'business-test',
            'source_id' => SourceId::IMAGE_GENERATE,
            'service_provider_id' => 'provider-test',
            'provider_model_id' => 'provider-model-test',
        ]);

        $subscriber = $this->createSubscriber(function (MsgLogEntity $entity): void {
            self::assertSame('image-model-id', $entity->getModel());
            self::assertSame('image-model-version', $entity->getModelVersion());
            self::assertSame(0, $entity->getUseToken());
            self::assertSame('business-test', $entity->getBusinessId());
            self::assertSame(SourceId::IMAGE_GENERATE, $entity->getSourceId());
            self::assertSame('provider-test', $entity->getProviderId());
            self::assertSame('provider-model-test', $entity->getProviderModelId());
        });

        $subscriber->process($event);
    }

    /**
     * 验证失败状态或缺少成功状态的图片事件不会写入日志。
     */
    public function testNonSuccessfulImageGeneratedDoesNotCreateLog(): void
    {
        $event = new ImageGeneratedEvent();
        $event->setOrganizationCode('org-test');
        $event->setUserId('user-test');
        $event->setModel('image-model-version');
        $event->setImageCount(0);
        $event->setCreatedAt(new DateTime());
        $event->setSourceType(ImageGenerateSourceEnum::API);
        $event->setBusinessParams(['status' => 'FAIL']);

        $subscriber = $this->createSubscriber(null, false);
        $subscriber->process($event);
    }

    /**
     * 创建使用 Mock 持久化服务的订阅器。
     */
    private function createSubscriber(?callable $assertion, bool $expectsCreate = true): ScheduleUsageRecordSubscriber
    {
        $domainService = $this->createMock(MsgLogDomainService::class);
        $expectation = $domainService->expects($expectsCreate ? $this->once() : $this->never())->method('create');
        if ($expectsCreate) {
            $expectation->willReturnCallback(static function ($dataIsolation, MsgLogEntity $entity) use ($assertion): MsgLogEntity {
                if ($assertion !== null) {
                    $assertion($entity);
                }
                return $entity;
            });
        }

        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->with(MsgLogDomainService::class)->willReturn($domainService);

        return new ScheduleUsageRecordSubscriber($container);
    }
}
