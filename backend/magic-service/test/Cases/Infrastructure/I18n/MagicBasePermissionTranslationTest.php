<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\I18n;

use App\Domain\MagicBase\Exception\MagicBaseExceptionBuilder;
use App\ErrorCode\MagicBaseErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Support\Filesystem\Filesystem;
use Hyperf\Translation\FileLoader;
use Hyperf\Translation\Translator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionProperty;

/**
 * @internal
 */
class MagicBasePermissionTranslationTest extends TestCase
{
    #[DataProvider('permissionMessages')]
    public function testAccessDeniedTranslatesNestedMessageAndPreservesErrorCode(string $locale, string $key, string $message): void
    {
        $previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $translator = new Translator(new FileLoader(new Filesystem(), dirname(__DIR__, 4) . '/storage/languages'), $locale);
        $localeContextKey = $translator->getLocaleContextKey();
        $previousLocale = Context::get($localeContextKey);
        $translator->setLocale($locale);
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->with('error_message')->willReturn([
            'exception_class' => BusinessException::class,
            'error_code_mapper' => [MagicBaseErrorCode::class => [48000, 48999]],
        ]);
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnMap([
            [ConfigInterface::class, $config],
            [TranslatorInterface::class, $translator],
        ]);
        ApplicationContext::setContainer($container);
        try {
            MagicBaseExceptionBuilder::accessDenied('magicbase.' . $key);
            self::fail('Access denial must throw');
        } catch (BusinessException $exception) {
            self::assertSame(MagicBaseErrorCode::AccessDenied->value, $exception->getCode());
            self::assertSame($message, $exception->getMessage());
            self::assertStringNotContainsString(':message', $exception->getMessage());
            self::assertStringNotContainsString('magicbase.', $exception->getMessage());
        } finally {
            if ($previousContainer !== null) {
                ApplicationContext::setContainer($previousContainer);
            } else {
                (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, null);
            }
            if ($previousLocale !== null) {
                Context::set($localeContextKey, $previousLocale);
            } else {
                Context::destroy($localeContextKey);
            }
        }
    }

    public static function permissionMessages(): array
    {
        $messages = [
            'project_access_denied' => ['你没有访问该项目的权限。', 'You do not have permission to access this project.'],
            'project_edit_denied' => ['你没有编辑该项目的权限。', 'You do not have permission to edit this project.'],
            'project_manage_denied' => ['你没有管理该项目的权限。', 'You do not have permission to manage this project.'],
            'project_data_access_denied' => ['你没有访问该项目数据的权限。', 'You do not have permission to access data in this project.'],
            'table_read_denied' => ['你没有读取该数据表的权限。', 'You do not have permission to read this table.'],
            'row_insert_denied' => ['你没有新增记录的权限。', 'You do not have permission to add records.'],
            'row_read_denied' => ['你没有读取该记录的权限。', 'You do not have permission to read this record.'],
            'row_edit_denied' => ['你没有编辑该记录的权限。', 'You do not have permission to edit this record.'],
            'row_delete_denied' => ['你没有删除该记录的权限。', 'You do not have permission to delete this record.'],
            'column_edit_denied' => ['你没有编辑该字段的权限。', 'You do not have permission to edit this field.'],
        ];
        $cases = [];
        foreach ($messages as $key => [$chinese, $english]) {
            $cases['zh_CN.' . $key] = ['zh_CN', $key, $chinese];
            $cases['en_US.' . $key] = ['en_US', $key, $english];
        }
        return $cases;
    }
}
