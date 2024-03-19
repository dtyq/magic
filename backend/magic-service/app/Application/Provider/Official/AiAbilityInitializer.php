<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Official;

use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Throwable;

/**
 * Official AI Ability Initializer.
 * Initialize default AI abilities for new system setup.
 */
class AiAbilityInitializer
{
    /**
     * Initialize official AI abilities.
     *
     * @return array{success: bool, message: string, count: int}
     */
    public static function init(): array
    {
        $orgCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if (empty($orgCode)) {
            return [
                'success' => false,
                'message' => 'Official organization code not configured in service_provider.office_organization',
                'count' => 0,
            ];
        }

        try {
            $dataIsolation = ProviderDataIsolation::create($orgCode, 'system');
            $aiAbilityDomainService = di(AiAbilityDomainService::class);
            $count = $aiAbilityDomainService->initializeAbilities($dataIsolation);

            return [
                'success' => true,
                'message' => "Successfully initialized {$count} AI abilities.",
                'count' => $count,
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => 'Failed to initialize AI abilities: ' . $e->getMessage(),
                'count' => 0,
            ];
        }
    }
}
