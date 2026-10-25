<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppResolver;
use App\Application\SuperMagic\Task\Service\ReferencedProjectAccessKind;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMount;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountAuthorizer;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\ErrorCode\ShareErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
class ReferencedProjectMountAuthorizerTest extends TestCase
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
                return match ($id) {
                    ConfigInterface::class => new class implements ConfigInterface {
                        public function get(string $key, mixed $default = null): mixed
                        {
                            return match ($key) {
                                'error_message' => [
                                    'exception_class' => BusinessException::class,
                                    'error_code_mapper' => [
                                        ShareErrorCode::class => [51300, 51400],
                                    ],
                                ],
                                default => $default,
                            };
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
                    },
                    default => throw new RuntimeException('Unexpected container dependency: ' . $id),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [ConfigInterface::class, TranslatorInterface::class], true);
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

    public function testPublishedShareAllowsShareVisibleUser(): void
    {
        $share = (new ResourceShareEntity())->setShareType(ShareAccessType::TeamShare->value);
        $record = (new MicroAppEntity())->setId(3001)->setProjectId(4001);
        $authorizer = $this->createAuthorizer(
            published: [$record, $share],
            canAccessShare: true,
        );

        $authorizer->assertPublishedShareAccessible(
            $this->microAppMount(),
            $this->createDataIsolation(),
        );

        $this->addToAssertionCount(1);
    }

    public function testPublishedShareDeniesWhenShareIsInaccessible(): void
    {
        $share = (new ResourceShareEntity())->setShareType(ShareAccessType::TeamShare->value);
        $record = (new MicroAppEntity())->setId(3001)->setProjectId(4001);
        $authorizer = $this->createAuthorizer(
            published: [$record, $share],
            canAccessShare: false,
        );

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ShareErrorCode::PERMISSION_DENIED->value);

        $authorizer->assertPublishedShareAccessible(
            $this->microAppMount(),
            $this->createDataIsolation(),
        );
    }

    public function testPublishedShareDeniesWhenAppIsNotPublished(): void
    {
        $authorizer = $this->createAuthorizer(published: null, canAccessShare: true);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ShareErrorCode::NOT_FOUND->value);

        $authorizer->assertPublishedShareAccessible(
            $this->microAppMount(),
            $this->createDataIsolation(),
        );
    }

    public function testPublishedShareDeniesWhenProjectIdDoesNotBelongToApp(): void
    {
        $share = (new ResourceShareEntity())->setShareType(ShareAccessType::TeamShare->value);
        $record = (new MicroAppEntity())->setId(3001)->setProjectId(4001);
        $authorizer = $this->createAuthorizer(
            published: [$record, $share],
            canAccessShare: true,
        );

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ShareErrorCode::PERMISSION_DENIED->value);

        $authorizer->assertPublishedShareAccessible(
            $this->microAppMount(projectId: '9999'),
            $this->createDataIsolation(),
        );
    }

    public function testPublishedShareDeniesPasswordProtectedShare(): void
    {
        $share = (new ResourceShareEntity())->setShareType(ShareAccessType::PasswordProtected->value);
        $record = (new MicroAppEntity())->setId(3001)->setProjectId(4001);
        $authorizer = $this->createAuthorizer(
            published: [$record, $share],
            canAccessShare: true,
        );

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ShareErrorCode::PASSWORD_REQUIRED->value);

        $authorizer->assertPublishedShareAccessible(
            $this->microAppMount(),
            $this->createDataIsolation(),
        );
    }

    public function testPublishedShareDeniesWhenAppIdIsMissing(): void
    {
        $authorizer = $this->createAuthorizer(published: null, canAccessShare: true);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ShareErrorCode::PERMISSION_DENIED->value);

        $authorizer->assertPublishedShareAccessible(
            $this->microAppMount(appId: null),
            $this->createDataIsolation(),
        );
    }

    /**
     * @param null|array{0: MicroAppEntity, 1: ResourceShareEntity} $published
     */
    private function createAuthorizer(?array $published, bool $canAccessShare): ReferencedProjectMountAuthorizer
    {
        $resolver = $this->createMock(PublishedMicroAppResolver::class);
        $resolver->method('findPublished')->willReturn($published);
        $resolver->method('canAccessShare')->willReturn($canAccessShare);

        $publishedAccess = $this->createMock(PublishedMicroAppFileAccessService::class);
        $publishedAccess->method('canAccessProject')->willReturn($canAccessShare);
        return new ReferencedProjectMountAuthorizer($resolver, $publishedAccess);
    }

    private function microAppMount(string $projectId = '4001', ?string $appId = '3001'): ReferencedProjectMount
    {
        return new ReferencedProjectMount(
            projectId: $projectId,
            accessKind: ReferencedProjectAccessKind::PublishedShare,
            sourceType: 'micro_app',
            appId: $appId,
        );
    }

    private function createDataIsolation(): DataIsolation
    {
        $dataIsolation = $this->createMock(DataIsolation::class);
        $dataIsolation->method('getCurrentUserId')->willReturn('user-1');
        $dataIsolation->method('getCurrentOrganizationCode')->willReturn('org-1');

        return $dataIsolation;
    }
}
