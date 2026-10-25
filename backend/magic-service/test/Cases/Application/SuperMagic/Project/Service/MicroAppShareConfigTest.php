<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Project\Service;

use App\Application\SuperMagic\Project\DTO\Request\PublishMicroAppRequestDTO;
use App\Application\SuperMagic\Project\Service\MicroAppShareConfig;
use App\ErrorCode\ShareErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\SuperMagic\Common\Share\DTO\Request\CreateShareRequestDTO;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/**
 * @internal
 */
final class MicroAppShareConfigTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    private bool $containerOverridden = false;

    protected function tearDown(): void
    {
        if ($this->containerOverridden) {
            if ($this->previousContainer !== null) {
                ApplicationContext::setContainer($this->previousContainer);
            } elseif (ApplicationContext::hasContainer()) {
                $containerProperty = new ReflectionProperty(ApplicationContext::class, 'container');
                $containerProperty->setAccessible(true);
                $containerProperty->setValue(null, null);
            }
        }

        parent::tearDown();
    }

    public function testBuildExtraPreservesExistingValuesWhenExtraIsProvided(): void
    {
        $requestDTO = new PublishMicroAppRequestDTO();
        $requestDTO->setExtra([
            'pure_mode' => false,
            'allow_download_project_file' => true,
        ]);

        self::assertSame([
            'allow_copy_project_files' => true,
            'pure_mode' => false,
        ], (new MicroAppShareConfig())->buildExtra([
            'allow_copy_project_files' => true,
            '_authorization_version' => 'internal-version',
        ], $requestDTO));
    }

    public function testBuildExtraReturnsNullWhenExtraIsNotProvided(): void
    {
        self::assertNull((new MicroAppShareConfig())->buildExtra(
            ['pure_mode' => true],
            new PublishMicroAppRequestDTO()
        ));
    }

    public function testCreateShareRequestRejectsPersistenceMetadataAndNamesTheField(): void
    {
        $this->setExceptionContainer();

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ShareErrorCode::INVALID_EXTRA_FIELD->value);
        $this->expectExceptionMessage('extra字段包含不允许的配置项：_authorization_version');

        $requestDTO = new CreateShareRequestDTO();
        $requestDTO->extra = ['_authorization_version' => 'internal-version'];

        $validateExtra = new ReflectionMethod(CreateShareRequestDTO::class, 'validateExtra');
        $validateExtra->invoke($requestDTO);
    }

    public function testFormatResponseExtraUsesTheCommonShareExtraFormat(): void
    {
        $config = new MicroAppShareConfig();

        self::assertSame(['pure_mode' => true], $config->formatResponseExtra(['pure_mode' => '1']));
        self::assertSame(['pure_mode' => false], $config->formatResponseExtra(['pure_mode' => '0']));
        self::assertSame(['pure_mode' => false], $config->formatResponseExtra(null));
    }

    public function testPublishRequestTracksWhetherExpiryWasProvided(): void
    {
        $request = new PublishMicroAppRequestDTO();
        self::assertFalse($request->hasExpireDays());

        $request->setExpireDays(null);
        self::assertTrue($request->hasExpireDays());
        self::assertNull($request->getExpireDays());

        $request = new PublishMicroAppRequestDTO(['expire_days' => 30]);
        self::assertTrue($request->hasExpireDays());
        self::assertSame(30, $request->getExpireDays());
    }

    private function setExceptionContainer(): void
    {
        $this->containerOverridden = true;
        $this->previousContainer = ApplicationContext::hasContainer()
            ? ApplicationContext::getContainer()
            : null;

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id): mixed
            {
                return match ($id) {
                    ConfigInterface::class => new class implements ConfigInterface {
                        public function get(string $key, mixed $default = null): mixed
                        {
                            return $key === 'error_message' ? [
                                'exception_class' => BusinessException::class,
                                'error_code_mapper' => [ShareErrorCode::class => [51300, 51400]],
                            ] : $default;
                        }

                        public function has(string $keys): bool
                        {
                            return $keys === 'error_message';
                        }

                        public function set(string $key, mixed $value): void
                        {
                        }
                    },
                    TranslatorInterface::class => new class implements TranslatorInterface {
                        public function trans(string $key, array $replace = [], ?string $locale = null): string
                        {
                            $message = $key === 'share.invalid_extra_field'
                                ? 'extra字段包含不允许的配置项：:field'
                                : $key;
                            foreach ($replace as $name => $value) {
                                $message = str_replace(':' . $name, (string) $value, $message);
                            }
                            return $message;
                        }

                        public function transChoice(string $key, $number, array $replace = [], ?string $locale = null): string
                        {
                            return $this->trans($key, $replace, $locale);
                        }

                        public function getLocale(): string
                        {
                            return 'zh_CN';
                        }

                        public function setLocale(string $locale)
                        {
                            return $this;
                        }
                    },
                    default => throw new RuntimeException("Unexpected dependency: {$id}"),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [ConfigInterface::class, TranslatorInterface::class], true);
            }
        });
    }
}
