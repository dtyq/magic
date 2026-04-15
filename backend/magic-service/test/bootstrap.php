<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Contact\Entity\ValueObject\AccountStatus;
use App\Domain\Contact\Entity\ValueObject\UserStatus;
use App\Domain\Contact\Repository\Persistence\Model\UserModel;
use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Domain\Token\Repository\Persistence\Model\MagicToken;
use Hyperf\Contract\ApplicationInterface;
use Hyperf\Di\ClassLoader;
use Hyperf\Di\ScanHandler\ProcScanHandler;

error_reporting(E_ALL ^ E_DEPRECATED);
date_default_timezone_set('Asia/Shanghai');

! defined('BASE_PATH') && define('BASE_PATH', dirname(__DIR__, 1));
! defined('SWOOLE_HOOK_FLAGS') && define('SWOOLE_HOOK_FLAGS', 0);
const UNIT_TEST = true;
! defined('UNIT_TESTING_ENV') && define('UNIT_TESTING_ENV', true);

require BASE_PATH . '/vendor/autoload.php';

ClassLoader::init(handler: new ProcScanHandler());

$container = require BASE_PATH . '/config/container.php';

$container->get(ApplicationInterface::class);

ensureTestingAuthContext($container);

function ensureTestingAuthContext($container): void
{
    $token = trim((string) getenv('TEST_TOKEN'));
    $organizationCode = trim((string) getenv('TEST_ORGANIZATION_CODE'));

    if ($token !== '' && isTestingTokenUsable($container, $token)) {
        $resolvedOrganizationCode = resolveTestingOrganizationCodeForToken($container, $token);
        if ($resolvedOrganizationCode !== '') {
            if ($organizationCode !== $resolvedOrganizationCode) {
                setTestingEnvVar('TEST_ORGANIZATION_CODE', $resolvedOrganizationCode);
            }
            setTestingEnvVar('TEST_TOKEN', $token);
            return;
        }
    }

    if ($token !== '' && $organizationCode !== '' && isTestingTokenUsable($container, $token)) {
        return;
    }

    $token = $token !== '' ? $token : generateTestingToken();
    $candidate = findTestingAuthCandidate($organizationCode);
    if ($candidate === null) {
        return;
    }

    ensureTestingUserToken($token, $candidate['user_id']);
    setTestingEnvVar('TEST_TOKEN', $token);
    setTestingEnvVar('TEST_ORGANIZATION_CODE', $candidate['organization_code']);
}

function isTestingTokenUsable($container, string $token): bool
{
    /** @var MagicTokenRepositoryInterface $tokenRepository */
    $tokenRepository = $container->get(MagicTokenRepositoryInterface::class);
    $shortToken = MagicTokenEntity::getShortToken($token);
    return $tokenRepository->getTokenEntityByToken($shortToken) !== null;
}

function resolveTestingOrganizationCodeForToken($container, string $token): string
{
    /** @var MagicTokenRepositoryInterface $tokenRepository */
    $tokenRepository = $container->get(MagicTokenRepositoryInterface::class);
    $shortToken = MagicTokenEntity::getShortToken($token);
    $tokenEntity = $tokenRepository->queryTokenEntity(MagicTokenType::User, $shortToken, false);
    if ($tokenEntity === null) {
        return '';
    }

    $organizationCode = UserModel::query()
        ->where('user_id', $tokenEntity->getTypeRelationValue())
        ->whereNull('deleted_at')
        ->value('organization_code');

    return is_string($organizationCode) ? $organizationCode : '';
}

/**
 * @return null|array{user_id: string, organization_code: string}
 */
function findTestingAuthCandidate(string $preferredOrganizationCode): ?array
{
    $buildQuery = static function () {
        return UserModel::query()
            ->select(['magic_contact_users.user_id', 'magic_contact_users.organization_code'])
            ->join('magic_contact_accounts', 'magic_contact_accounts.magic_id', '=', 'magic_contact_users.magic_id')
            ->whereNull('magic_contact_users.deleted_at')
            ->whereNull('magic_contact_accounts.deleted_at')
            ->where('magic_contact_users.status', UserStatus::Activated->value)
            ->where('magic_contact_accounts.status', AccountStatus::Normal->value)
            ->where('magic_contact_users.organization_code', '!=', '')
            ->orderBy('magic_contact_users.id');
    };

    if ($preferredOrganizationCode !== '') {
        $preferred = $buildQuery()
            ->where('magic_contact_users.organization_code', $preferredOrganizationCode)
            ->first();
        if ($preferred !== null) {
            return [
                'user_id' => (string) $preferred->user_id,
                'organization_code' => (string) $preferred->organization_code,
            ];
        }
    }

    $fallback = $buildQuery()->first();
    if ($fallback === null) {
        return null;
    }

    return [
        'user_id' => (string) $fallback->user_id,
        'organization_code' => (string) $fallback->organization_code,
    ];
}

function ensureTestingUserToken(string $token, string $userId): void
{
    $shortToken = MagicTokenEntity::getShortToken($token);
    $expiredAt = date('Y-m-d H:i:s', strtotime('+10 years'));
    $now = date('Y-m-d H:i:s');

    MagicToken::query()->upsert(
        [[
            'type' => MagicTokenType::User->value,
            'type_relation_value' => $userId,
            'token' => $shortToken,
            'expired_at' => $expiredAt,
            'created_at' => $now,
            'updated_at' => $now,
            'extra' => '',
        ]],
        ['token', 'type'],
        ['type_relation_value', 'expired_at', 'updated_at']
    );
}

function generateTestingToken(): string
{
    return sprintf(
        'magic-kb-%s-%s',
        date('YmdHis'),
        bin2hex(random_bytes(16))
    );
}

function setTestingEnvVar(string $name, string $value): void
{
    putenv(sprintf('%s=%s', $name, $value));
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
}
