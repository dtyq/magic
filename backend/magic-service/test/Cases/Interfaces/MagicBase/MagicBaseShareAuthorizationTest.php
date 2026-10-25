<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\MagicBase;

use App\Application\MagicBase\Support\MagicBaseAccessControl;
use App\Application\MagicBase\Support\MagicBaseRuntimeProjectAccessContext;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\ErrorCode\MagicBaseErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\Utils\AccessTokenUtil;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\MagicBase\Facade\MagicBaseApi;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/** @internal */
class MagicBaseShareAuthorizationTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    private ResourceShareDomainService $shares;

    private ResourceShareEntity $share;

    private MagicBaseApi $api;

    private string $token = 'test-share-token';

    private false|string $tokenData;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->clearContext();
        $this->shares = $this->createMock(ResourceShareDomainService::class);
        $this->tokenData = json_encode(['share_id' => '44', 'scope' => 'read', 'expires_at' => time() + 3600]);
        $redis = $this->createMock(Redis::class);
        $redis->method('__call')->willReturnCallback(fn ($name) => $name === 'get' ? $this->tokenData : 1);
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static fn ($key, $default = null) => match ($key) {
            'error_message' => ['error_code_mapper' => [MagicBaseErrorCode::class => [48000, 48999]]],
            'app_env' => 'testing',
            default => $default,
        });
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnArgument(0);
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnMap([[Redis::class, $redis], [ResourceShareDomainService::class, $this->shares], [ConfigInterface::class, $config], [TranslatorInterface::class, $translator]]);
        ApplicationContext::setContainer($container);

        $request = $this->createMock(RequestInterface::class);
        $request->method('header')->willReturnCallback(fn ($name, $default = null) => $name === 'token' ? $this->token : $default);
        $this->api = new class($request) extends MagicBaseApi {
            protected function checkAndGetAuthorization(): Authenticatable
            {
                throw new RuntimeException('No login session');
            }

            protected function getAuthorization(): Authenticatable
            {
                return RequestCoContext::getUserAuthorization() ?? throw new RuntimeException('Login required');
            }
        };
        $access = (new ReflectionClass(MagicBaseAccessControl::class))->newInstanceWithoutConstructor();
        $apps = $this->createMock(MicroAppRepositoryInterface::class);
        $apps->expects(self::once())->method('findByProjectIdWithTrashed')->with(11)->willReturn(null);
        (new ReflectionProperty(MagicBaseAccessControl::class, 'microAppRepository'))->setValue($access, $apps);
        (new ReflectionProperty(MagicBaseApi::class, 'accessControl'))->setValue($this->api, $access);
        (new ReflectionProperty(MagicBaseApi::class, 'resourceShareDomainService'))->setValue($this->api, $this->shares);
        $this->share = (new ResourceShareEntity())->setId(44)->setProjectId('11')->setResourceType(ResourceType::Project->value)
            ->setShareType(ShareAccessType::Internet->value)->setOrganizationCode('data-org')->setCreatedUid('owner')->setIsEnabled(true);
        $this->bindTokenToCurrentShare();
    }

    protected function tearDown(): void
    {
        $this->clearContext();
        (new ReflectionClass(ApplicationContext::class))->getProperty('container')->setValue(null, $this->previousContainer);
    }

    #[DataProvider('publicShareTypes')]
    public function testPublicShareKeepsAnonymousIdentitySeparateFromDataOrganization(int $shareType): void
    {
        $this->share->setShareType($shareType);
        $this->bindTokenToCurrentShare();
        $this->shares->method('getValidShareById')->with('44')->willReturn($this->share);
        $authorization = $this->resolve();
        self::assertSame('', $authorization->getId());
        self::assertSame('data-org', $authorization->getOrganizationCode());
        self::assertSame(['user_id' => '', 'organization_code' => ''], MagicBaseRuntimeProjectAccessContext::getShareActor(11));
        self::assertFalse(MagicBaseRuntimeProjectAccessContext::hasShareAccess(12));
    }

    public static function publicShareTypes(): array
    {
        // Password shares require a token already issued after password verification.
        return [[ShareAccessType::Internet->value], [ShareAccessType::PasswordProtected->value]];
    }

    public function testAuthenticatedRequestsWithoutShareTokensKeepTheirOwnIdentity(): void
    {
        $this->token = '';
        $authorization = (new MagicUserAuthorization())->setId('reader')->setOrganizationCode('user-org');
        RequestCoContext::setUserAuthorization($authorization);
        $this->shares->expects(self::never())->method('getValidShareById');
        self::assertSame($authorization, $this->resolve());
        self::assertFalse(MagicBaseRuntimeProjectAccessContext::hasShareAccess(11));
    }

    #[DataProvider('deniedShares')]
    public function testRejectsInvalidShareContext(string $scenario): void
    {
        match ($scenario) {
            'missing-token' => $this->token = '',
            'invalid-token' => $this->tokenData = false,
            'expired-token' => $this->tokenData = json_encode(['share_id' => '44', 'expires_at' => time() - 1]),
            'other-project' => $this->share->setProjectId('12'),
            'other-resource' => $this->share->setResourceType(-1),
            'disabled' => $this->share->setIsEnabled(false),
            'unknown-type' => $this->share->setShareType(-1),
            'team-anonymous' => $this->share->setShareType(ShareAccessType::TeamShare->value),
            default => null,
        };
        $this->shares->method('getValidShareById')->willReturn($scenario === 'revoked' ? null : $this->share);
        $denied = false;
        try {
            $this->resolve();
        } catch (BusinessException|RuntimeException $error) {
            $denied = true;
        }
        self::assertTrue($denied, 'Access must be denied');
        self::assertFalse(MagicBaseRuntimeProjectAccessContext::hasShareAccess(11));
    }

    public static function deniedShares(): array
    {
        return array_map(static fn ($case) => [$case], ['missing-token', 'invalid-token', 'expired-token', 'revoked', 'other-project', 'other-resource', 'disabled', 'unknown-type', 'team-anonymous']);
    }

    public function testTeamShareRechecksTheRealUsersAccess(): void
    {
        RequestCoContext::setUserAuthorization((new MagicUserAuthorization())->setId('reader')->setOrganizationCode('other-org'));
        $this->share->setShareType(ShareAccessType::TeamShare->value)->setShareCode('team-share');
        $this->bindTokenToCurrentShare();
        $this->shares->method('getValidShareById')->willReturn($this->share);
        $this->shares->expects(self::once())->method('validateShareAccess')->with($this->share, 'reader', 'other-org', 'team-share')->willThrowException(new RuntimeException('Team denied'));
        $this->expectExceptionMessage('Team denied');
        $this->resolve();
    }

    public function testPublicTokenCannotAccessShareAfterPasswordIsAdded(): void
    {
        $this->share->setShareType(ShareAccessType::PasswordProtected->value)->setPassword('encrypted-password');
        $this->shares->method('getValidShareById')->willReturn($this->share);
        $this->expectException(BusinessException::class);
        $this->resolve();
    }

    private function bindTokenToCurrentShare(): void
    {
        $this->tokenData = json_encode([
            'share_id' => '44', 'scope' => 'read', 'expires_at' => time() + 3600,
            'metadata' => ['share_security_fingerprint' => AccessTokenUtil::shareSecurityFingerprint($this->share)],
        ]);
    }

    private function resolve(): MagicUserAuthorization
    {
        return (new ReflectionMethod(MagicBaseApi::class, 'resolveRuntimeAuthorization'))->invoke($this->api, 11);
    }

    private function clearContext(): void
    {
        foreach (['magic-user-authorization', 'magicbase.share_access_project_ids', 'magicbase.share_access_actors'] as $key) {
            Context::destroy($key);
        }
    }
}
