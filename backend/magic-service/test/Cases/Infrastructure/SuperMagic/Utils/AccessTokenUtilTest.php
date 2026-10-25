<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\SuperMagic\Utils;

use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Repository\Model\ResourceShareModel;
use App\Domain\SuperMagic\Common\Share\Repository\Persistence\ResourceShareRepository;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Infrastructure\SuperMagic\Utils\AccessTokenUtil;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\Model\Builder;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;

/** @internal */
class AccessTokenUtilTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    private array $values = [];

    private ?ResourceShareEntity $share;

    private int $shareLookupCount = 0;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->share = (new ResourceShareEntity())->setId(44)->setOrganizationCode('org')
            ->setShareType(ShareAccessType::Internet->value);
        $redis = $this->createMock(Redis::class);
        $redis->method('__call')->willReturnCallback(function ($method, $args) {
            return match ($method) {
                'get' => $this->values[$args[0]] ?? false,
                'set' => $this->values[$args[0]] = $args[1],
                'del' => $this->delete($args[0]),
                default => true,
            };
        });
        $shares = $this->createMock(ResourceShareDomainService::class);
        $shares->method('getValidShareById')->willReturnCallback(function (string $shareId) {
            ++$this->shareLookupCount;
            return $shareId === '44' ? $this->share : null;
        });
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnMap([[Redis::class, $redis], [ResourceShareDomainService::class, $shares]]);
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        (new ReflectionClass(ApplicationContext::class))->getProperty('container')->setValue(null, $this->previousContainer);
    }

    public function testTokensIssuedTogetherAreDistinctAndCryptographicallyRandom(): void
    {
        $tokens = [];
        for ($i = 0; $i < 20; ++$i) {
            $tokens[] = AccessTokenUtil::generate('44', 'org');
        }
        self::assertCount(20, array_unique($tokens));
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $tokens[0]);
    }

    public function testTokenGeneratedWithDefaultMetadataValidatesImmediately(): void
    {
        $token = AccessTokenUtil::generate('44', 'org');

        self::assertTrue(AccessTokenUtil::validate($token));
    }

    public function testDefaultGenerationPreservesMetadataAndUsesShareOrganization(): void
    {
        $token = AccessTokenUtil::generate('44', metadata: ['request_id' => 'request-1']);

        self::assertSame('org', AccessTokenUtil::getOrganizationCode($token));
        self::assertSame('request-1', AccessTokenUtil::getMetadata($token)['request_id'] ?? null);
        self::assertTrue(AccessTokenUtil::validate($token));
    }

    public function testDefaultGeneratedTokenIsInvalidatedBySecurityChange(): void
    {
        $token = AccessTokenUtil::generate('44', 'org');
        $this->share->setIsEnabled(false);

        self::assertFalse(AccessTokenUtil::validate($token));
    }

    public function testGenerateRejectsMismatchedOrganization(): void
    {
        $this->expectException(InvalidArgumentException::class);

        AccessTokenUtil::generate('44', 'another-org');
    }

    #[DataProvider('invalidShares')]
    public function testGenerateRejectsInvalidSharesWithoutWritingToken(string $change): void
    {
        match ($change) {
            'missing' => $this->share = null,
            'disabled' => $this->share->setIsEnabled(false),
            'type' => $this->share->setShareType(PHP_INT_MAX),
        };
        $this->expectException(InvalidArgumentException::class);

        try {
            AccessTokenUtil::generate('44', 'org');
        } finally {
            self::assertSame([], $this->values);
        }
    }

    public static function invalidShares(): array
    {
        return [['missing'], ['disabled'], ['type']];
    }

    public function testGenerateRejectsInvalidExplicitFingerprintWithoutReloadingShare(): void
    {
        $this->expectException(InvalidArgumentException::class);

        try {
            AccessTokenUtil::generate('44', 'org', metadata: ['share_security_fingerprint' => null]);
        } finally {
            self::assertSame(0, $this->shareLookupCount);
        }
    }

    public function testGenerateForShareUsesTheAuthorizedSnapshotWithoutReloadingShare(): void
    {
        $token = AccessTokenUtil::generateForShare($this->share);

        self::assertSame(0, $this->shareLookupCount);
        self::assertSame(
            AccessTokenUtil::shareSecurityFingerprint($this->share),
            AccessTokenUtil::getMetadata($token)['share_security_fingerprint'] ?? null
        );
    }

    #[DataProvider('securityChanges')]
    public function testSecurityChangesInvalidatePreviouslyIssuedTokens(string $change): void
    {
        $token = AccessTokenUtil::generateForShare($this->share);
        self::assertTrue(AccessTokenUtil::validate($token));
        match ($change) {
            'owner' => $this->share->setCreatedUid('new-owner'),
            'password' => $this->share->setPassword('new-encrypted-password'),
            'type' => $this->share->setShareType(ShareAccessType::PasswordProtected->value),
            'disabled' => $this->share->setIsEnabled(false),
            'range' => $this->share->setShareRange('designated'),
            'targets' => $this->share->setTargetIdsArray([['target_type' => 'User', 'target_id' => 'user']]),
            'extra' => $this->share->setExtra(['allow_download' => false]),
            'deleted' => $this->share = null,
        };
        self::assertFalse(AccessTokenUtil::validate($token));
        self::assertFalse(AccessTokenUtil::refresh($token));
    }

    public static function securityChanges(): array
    {
        return array_map(static fn ($change) => [$change], ['owner', 'password', 'type', 'disabled', 'range', 'targets', 'extra', 'deleted']);
    }

    public function testNewTokenWorksAfterChangingAnExistingPassword(): void
    {
        $this->share->setShareType(ShareAccessType::PasswordProtected->value)->setPassword('old-password');
        $oldToken = AccessTokenUtil::generateForShare($this->share);
        $this->share->setPassword('new-password');
        self::assertFalse(AccessTokenUtil::validate($oldToken));
        self::assertTrue(AccessTokenUtil::validate(AccessTokenUtil::generateForShare($this->share)));
    }

    public function testLegacyTokensFailClosed(): void
    {
        $this->values['super_magic_access_token:legacy'] = json_encode(['share_id' => '44', 'expires_at' => time() + 3600]);
        self::assertFalse(AccessTokenUtil::validate('legacy'));
    }

    public function testViewCountDoesNotInvalidateToken(): void
    {
        $token = AccessTokenUtil::generateForShare($this->share);
        $this->share->setViewCount(123)->setResourceName('Renamed');
        self::assertTrue(AccessTokenUtil::validate($token));
    }

    #[DataProvider('revertedSettings')]
    public function testRestoringSettingsCannotReviveOldTokenOrRestoreClientSuppliedVersion(string $setting): void
    {
        if ($setting === 'password') {
            $this->share->setShareType(ShareAccessType::PasswordProtected->value)->setPassword('original-password');
        }
        $persisted = [];
        $query = $this->createMock(Builder::class);
        $query->method('__call')->willReturnSelf();
        $query->method('where')->willReturnSelf();
        $query->method('update')->willReturnCallback(function (array $data) use (&$persisted) {
            $persisted[] = json_decode($data['extra'] ?? '{}', true);
            return 1;
        });
        AccessTokenTestShareModel::$query = $query;
        $repository = new ResourceShareRepository(new AccessTokenTestShareModel());
        $repository->save($this->share);
        $originalExtra = $this->share->getExtra();
        $token = AccessTokenUtil::generateForShare($this->share);
        if ($setting === 'password') {
            $this->share->setPassword('replacement-password');
        } else {
            $this->share->setIsEnabled(false);
        }
        $repository->save($this->share);
        // Replay the original payload, including its internal version, without using
        // the token while disabled: validation must still reject it after reenable.
        $this->share->setIsEnabled(true)->setExtra($originalExtra);
        if ($setting === 'password') {
            $this->share->setPassword('original-password');
        }
        $repository->save($this->share);
        self::assertFalse(AccessTokenUtil::validate($token));
        self::assertCount(3, array_unique(array_column($persisted, '_authorization_version')));
        self::assertTrue(AccessTokenUtil::validate(AccessTokenUtil::generateForShare($this->share)));
    }

    public static function revertedSettings(): array
    {
        return [['enabled'], ['password']];
    }

    private function delete(string $key): int
    {
        unset($this->values[$key]);
        return 1;
    }
}

/** @internal */
class AccessTokenTestShareModel extends ResourceShareModel
{
    public static Builder $query;

    public static function query()
    {
        return self::$query;
    }
}
