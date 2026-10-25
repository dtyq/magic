<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Notification;

use App\Application\Notification\Service\NotificationTemplateAppService;
use App\Application\Notification\Strategy\DefaultNotificationCatalogStrategy;
use App\Domain\Notification\Entity\NotificationTemplateEntity;
use App\Domain\Notification\Repository\Facade\NotificationTemplateRepositoryInterface;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;

/** @internal */
final class NotificationTemplateAppServiceTest extends TestCase
{
    public function testCatalogContainsOnlyCurrentPublicTemplatesAndVersions(): void
    {
        $repository = $this->createMock(NotificationTemplateRepositoryInterface::class);
        $repository->expects(self::once())
            ->method('listCatalog')
            ->with('en-US')
            ->willReturn(array_merge(
                array_map(
                    fn (string $type): NotificationTemplateEntity => $this->template($type),
                    (new DefaultNotificationCatalogStrategy())->notificationTypes()
                ),
                [$this->template('unknown_type')]
            ));

        $service = new NotificationTemplateAppService(
            $repository,
            new DefaultNotificationCatalogStrategy(),
            $this->config(),
        );

        $catalog = $service->catalog('en_US')->toArray();

        self::assertSame('en-US', $catalog['locale']);
        self::assertStringStartsWith('sha256:', $catalog['catalog_version']);
        self::assertCount(6, $catalog['templates']);
        self::assertArrayHasKey('task_finished:1', $catalog['templates']);
        self::assertSame('Task completed', $catalog['templates']['task_finished:1']['title_template']);
        self::assertArrayNotHasKey('unknown_type:1', $catalog['templates']);
    }

    public function testUnsupportedLocaleUsesConfiguredDefault(): void
    {
        $repository = $this->createMock(NotificationTemplateRepositoryInterface::class);
        $repository->expects(self::once())
            ->method('listCatalog')
            ->with('zh-CN')
            ->willReturn([]);

        $service = new NotificationTemplateAppService(
            $repository,
            new DefaultNotificationCatalogStrategy(),
            $this->config(),
        );

        $catalog = $service->catalog('ja-JP')->toArray();

        self::assertSame('zh-CN', $catalog['locale']);
        self::assertSame([], $catalog['templates']);
    }

    private function config(): ConfigInterface
    {
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnMap([
            ['notification.locales.default', 'zh-CN', 'zh-CN'],
            ['notification.locales.supported', ['zh-CN', 'en-US'], ['zh-CN', 'en-US']],
        ]);
        return $config;
    }

    private function template(string $type): NotificationTemplateEntity
    {
        $title = $type === 'task_finished' ? 'Task completed' : ucfirst(str_replace('_', ' ', $type));
        return NotificationTemplateEntity::fromArray([
            'id' => '100000000000000001',
            'template_type' => $type,
            'version' => 1,
            'locale' => 'en-US',
            'title_template' => $title,
            'body_template' => '{{resource_name}}',
            'status' => 'active',
            'updated_at' => '2026-09-30 12:00:00',
        ]);
    }
}
