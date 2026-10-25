<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Interfaces\SlidesTemplate;

use App\Interfaces\SlidesTemplate\DTO\Request\SaveSlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\SaveUserSlidesTemplateRequest;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
class SaveSlidesTemplateRequestTest extends TestCase
{
    private static bool $hadOriginalContainer = false;

    private static ?ContainerInterface $originalContainer = null;

    public static function setUpBeforeClass(): void
    {
        self::$hadOriginalContainer = ApplicationContext::hasContainer();
        self::$originalContainer = self::$hadOriginalContainer ? ApplicationContext::getContainer() : null;

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id)
            {
                if ($id === TranslatorInterface::class) {
                    return new class implements TranslatorInterface {
                        public function trans(string $key, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function transChoice(string $key, $number, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function getLocale(): string
                        {
                            return 'zh_CN';
                        }

                        public function setLocale(string $locale)
                        {
                            return $this;
                        }
                    };
                }
                throw new RuntimeException('Unexpected container dependency: ' . $id);
            }

            public function has(string $id): bool
            {
                return $id === TranslatorInterface::class;
            }
        });
    }

    public static function tearDownAfterClass(): void
    {
        $property = (new ReflectionClass(ApplicationContext::class))->getProperty('container');
        $property->setAccessible(true);
        $property->setValue(null, self::$hadOriginalContainer ? self::$originalContainer : null);

        self::$hadOriginalContainer = false;
        self::$originalContainer = null;
    }

    public function testCategoryCodeOnlyRequiresNullableStringWithMaxLength(): void
    {
        /** @var SaveSlidesTemplateRequest $request */
        $request = (new ReflectionClass(SaveSlidesTemplateRequest::class))->newInstanceWithoutConstructor();
        $rules = $request->rules();

        $this->assertArrayHasKey('category_code', $rules);
        $this->assertArrayNotHasKey('category_id', $rules);
        $this->assertSame('nullable|string|max:64', $rules['category_code']);
        $this->assertArrayNotHasKey('category_code.regex', $request->messages());
    }

    public function testUsageCountFieldsAreNotAcceptedFromAdminRequest(): void
    {
        /** @var SaveSlidesTemplateRequest $request */
        $request = (new ReflectionClass(SaveSlidesTemplateRequest::class))->newInstanceWithoutConstructor();
        $rules = $request->rules();

        $this->assertArrayNotHasKey('base_usage_count', $rules);
        $this->assertArrayNotHasKey('actual_usage_count', $rules);
        $this->assertArrayNotHasKey('total_usage_count', $rules);
    }

    public function testTemplateCodeAllowsSlidesTemplatePrefixes(): void
    {
        /** @var SaveSlidesTemplateRequest $request */
        $request = (new ReflectionClass(SaveSlidesTemplateRequest::class))->newInstanceWithoutConstructor();
        $rules = $request->rules();

        $this->assertIsArray($rules['code']);
        $regexRule = array_values(array_filter(
            $rules['code'],
            static fn (mixed $rule): bool => is_string($rule) && str_starts_with($rule, 'regex:')
        ))[0] ?? '';
        $regex = substr($regexRule, strlen('regex:'));

        $this->assertSame(1, preg_match($regex, 'PPT-business-minimal'));
        $this->assertSame(1, preg_match($regex, 'SLIDE-business-minimal'));
        $this->assertSame(0, preg_match($regex, 'SLD-business-minimal'));
        $this->assertSame(0, preg_match($regex, 'PDF-business-minimal'));
        $this->assertSame(0, preg_match($regex, 'PPTX-business-minimal'));
    }

    public function testPersonalSaveStatusRejectsExplicitNull(): void
    {
        /** @var SaveUserSlidesTemplateRequest $request */
        $request = (new ReflectionClass(SaveUserSlidesTemplateRequest::class))->newInstanceWithoutConstructor();
        $statusRules = explode('|', $request->rules()['status']);

        $this->assertContains('sometimes', $statusRules);
        $this->assertContains('integer', $statusRules);
        $this->assertContains('in:0,1', $statusRules);
        $this->assertNotContains('nullable', $statusRules);
    }

    public function testPersonalSaveRejectsServerOwnedFields(): void
    {
        /** @var SaveUserSlidesTemplateRequest $request */
        $request = (new ReflectionClass(SaveUserSlidesTemplateRequest::class))->newInstanceWithoutConstructor();
        $rules = $request->rules();

        self::assertSame('missing', $rules['sort']);
        foreach (['owner_type', 'owner_id', 'organization_code', 'created_uid', 'updated_uid', 'source_type'] as $field) {
            self::assertSame('missing', $rules[$field]);
        }
    }
}
