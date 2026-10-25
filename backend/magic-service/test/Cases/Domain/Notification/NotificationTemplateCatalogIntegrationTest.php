<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Notification;

use App\Application\Notification\Service\NotificationTemplateAppService;
use App\Application\Notification\Strategy\DefaultNotificationCatalogStrategy;
use App\Domain\Notification\Repository\Persistence\NotificationTemplateRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;
use PHPUnit\Framework\TestCase;

/** @internal */
final class NotificationTemplateCatalogIntegrationTest extends TestCase
{
    /** @var list<string> */
    private array $templateIds = [];

    protected function setUp(): void
    {
        parent::setUp();

        if (! Schema::hasTable('magic_notification_templates')) {
            self::markTestSkipped('notification template table is not migrated');
        }

        if (Db::table('magic_notification_templates')->count() < 18) {
            self::markTestSkipped('public bilingual notification templates are not seeded');
        }
    }

    protected function tearDown(): void
    {
        if ($this->templateIds !== []) {
            Db::table('magic_notification_templates')->whereIn('id', $this->templateIds)->delete();
        }

        parent::tearDown();
    }

    public function testChineseAndEnglishCatalogsExposeTheSamePublicTemplateVersions(): void
    {
        $service = $this->service();
        $zh = $service->catalog('zh-CN')->toArray();
        $en = $service->catalog('en-US')->toArray();

        self::assertSame('zh-CN', $zh['locale']);
        self::assertSame('en-US', $en['locale']);
        self::assertCount(9, $zh['templates']);
        self::assertSame(array_keys($zh['templates']), array_keys($en['templates']));
        self::assertSame('任务执行成功', $zh['templates']['task_finished:1']['title_template']);
        self::assertSame('Task completed', $en['templates']['task_finished:1']['title_template']);
    }

    public function testArchivedHistoryVersionRemainsAvailableInBothLocales(): void
    {
        $version = random_int(900000, 999999);
        $this->insertTemplate('zh-CN', $version, '历史任务标题', '历史任务正文 {{workspace_name}}');
        $this->insertTemplate('en-US', $version, 'Historical task title', 'Historical task body {{workspace_name}}');

        $service = $this->service();
        $zh = $service->catalog('zh-CN')->toArray();
        $en = $service->catalog('en-US')->toArray();
        $key = 'task_finished:' . $version;

        self::assertSame('历史任务标题', $zh['templates'][$key]['title_template']);
        self::assertSame('Historical task title', $en['templates'][$key]['title_template']);
        self::assertStringContainsString($key, implode(',', array_keys($zh['templates'])));
    }

    public function testCatalogKeepsPlaceholdersForFrontendMissingFieldFallback(): void
    {
        $template = $this->service()->catalog('zh-CN')->toArray()['templates']['task_finished:1'];

        // The backend returns the template expression unchanged. The frontend
        // renderer replaces only absent/null payload values with "-".
        self::assertStringContainsString('{{workspace_name}}', $template['body_template']);
        self::assertStringNotContainsString('-', $template['body_template']);
    }

    private function service(): NotificationTemplateAppService
    {
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnMap([
            ['notification.locales.default', 'zh-CN', 'zh-CN'],
            ['notification.locales.supported', ['zh-CN', 'en-US'], ['zh-CN', 'en-US']],
        ]);

        return new NotificationTemplateAppService(
            new NotificationTemplateRepository(),
            new DefaultNotificationCatalogStrategy(),
            $config,
        );
    }

    private function insertTemplate(string $locale, int $version, string $title, string $body): void
    {
        $id = (string) IdGenerator::getSnowId();
        $this->templateIds[] = $id;
        Db::table('magic_notification_templates')->insert([
            'id' => $id,
            'template_type' => 'task_finished',
            'version' => $version,
            'locale' => $locale,
            'title_template' => $title,
            'body_template' => $body,
            'status' => 'archived',
            'created_at' => '2026-10-09 10:00:00',
            'updated_at' => '2026-10-09 10:00:00',
        ]);
    }
}
