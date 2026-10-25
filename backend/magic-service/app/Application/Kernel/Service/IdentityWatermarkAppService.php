<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Kernel\DTO\PlatformSettings;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\Kernel\Service\PlatformSettingsDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Redis\Redis;

class IdentityWatermarkAppService
{
    private const string CACHE_PREFIX = 'magic:identity_watermark:organization:';

    private const int CACHE_TTL = 300;

    public function __construct(
        private readonly MagicUserSettingDomainService $magicUserSettingDomainService,
        private readonly PlatformSettingsDomainService $platformSettingsDomainService,
        private readonly LockerInterface $locker,
        private readonly Redis $redis,
    ) {
    }

    /**
     * Get the watermark configured by an organization.
     *
     * Returns the normalized default value when the organization never saved one.
     *
     * @return array{enabled: bool, fields: string[], depth: string}
     */
    public function getWatermark(string $organizationCode): array
    {
        return $this->getOrganization($organizationCode)['watermark'];
    }

    /**
     * Resolve the effective watermark of an organization.
     *
     * An organization watermark only takes effect when it is explicitly
     * configured and enabled; otherwise the platform watermark is used.
     *
     * @return array{platform_watermark: array{enabled: bool, fields: string[], depth: string}, organization: array{configured: bool, watermark: array{enabled: bool, fields: string[], depth: string}}, effective_watermark: array{enabled: bool, fields: string[], depth: string}}
     */
    public function getEffective(string $organizationCode): array
    {
        $platformWatermark = $this->getPlatformWatermark();
        $organization = $this->getOrganization($organizationCode);
        $effective = ($organization['configured'] && $organization['watermark']['enabled'])
            ? $organization['watermark']
            : $platformWatermark;

        return [
            'platform_watermark' => $platformWatermark,
            'organization' => $organization,
            'effective_watermark' => $effective,
        ];
    }

    /**
     * Merge and persist the organization watermark.
     *
     * The mutex lock wraps the whole read-merge-write cycle so that concurrent
     * partial updates cannot overwrite each other.
     *
     * @param array{watermark?: array<string, mixed>} $payload
     */
    public function saveOrganization(string $organizationCode, array $payload, ?string $userId = null): void
    {
        if ($organizationCode === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed);
        }

        $lockName = sprintf('identity_watermark:save:%s', $organizationCode);
        $lockOwner = uniqid('identity_watermark_', true);
        if (! $this->locker->mutexLock($lockName, $lockOwner, 10)) {
            ExceptionBuilder::throw(GenericErrorCode::TooManyRequests);
        }

        try {
            $existing = $this->getOrganizationSetting($organizationCode);
            $existingValue = $existing?->getValue() ?? [];
            $existingWatermark = $this->normalizeWatermark((array) ($existingValue['watermark'] ?? $existingValue));
            $incomingWatermark = is_array($payload['watermark'] ?? null) ? $payload['watermark'] : [];
            $watermark = $this->normalizeWatermark(array_replace($existingWatermark, $incomingWatermark));

            $entity = new MagicUserSettingEntity();
            $entity->setKey(UserSettingKey::IdentityWatermark->value);
            $entity->setValue(['watermark' => $watermark]);
            $entity->setCreator((string) $userId);
            $entity->setModifier((string) $userId);
            $this->magicUserSettingDomainService->saveByOrganizationCode($organizationCode, $entity);
            $this->redis->del(self::CACHE_PREFIX . $organizationCode);
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * @return array{configured: bool, watermark: array{enabled: bool, fields: string[], depth: string}}
     */
    private function getOrganization(string $organizationCode): array
    {
        $default = [
            'configured' => false,
            'watermark' => $this->normalizeWatermark([]),
        ];
        if ($organizationCode === '') {
            return $default;
        }

        $cacheKey = self::CACHE_PREFIX . $organizationCode;
        $cached = $this->redis->get($cacheKey);
        if ($cached !== false) {
            $decoded = json_decode((string) $cached, true);
            if (is_array($decoded) && isset($decoded['configured'], $decoded['watermark'])) {
                return [
                    'configured' => (bool) $decoded['configured'],
                    'watermark' => $this->normalizeWatermark((array) $decoded['watermark']),
                ];
            }
        }

        $entity = $this->getOrganizationSetting($organizationCode);
        $value = $entity?->getValue() ?? [];
        $result = [
            'configured' => $entity !== null,
            'watermark' => $this->normalizeWatermark((array) ($value['watermark'] ?? $value)),
        ];
        $this->redis->setex($cacheKey, self::CACHE_TTL, (string) json_encode($result, JSON_UNESCAPED_UNICODE));
        return $result;
    }

    /**
     * @return array{enabled: bool, fields: string[], depth: string}
     */
    private function getPlatformWatermark(): array
    {
        $settings = $this->platformSettingsDomainService->get()->toArray();
        return $this->normalizeWatermark((array) ($settings['watermark'] ?? []));
    }

    private function getOrganizationSetting(string $organizationCode): ?MagicUserSettingEntity
    {
        return $this->magicUserSettingDomainService->getByOrganizationCode(
            $organizationCode,
            UserSettingKey::IdentityWatermark->value
        );
    }

    /**
     * @return array{enabled: bool, fields: string[], depth: string}
     */
    private function normalizeWatermark(array $watermark): array
    {
        $settings = PlatformSettings::fromArray(['watermark' => $watermark])->toArray();
        return (array) $settings['watermark'];
    }
}
