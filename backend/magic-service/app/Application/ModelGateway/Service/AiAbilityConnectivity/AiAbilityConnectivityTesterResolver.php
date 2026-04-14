<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\AiAbilityConnectivity;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use Hyperf\Context\ApplicationContext;
use RuntimeException;

class AiAbilityConnectivityTesterResolver
{
    /**
     * @var array<class-string<AiAbilityConnectivityTesterInterface>>
     */
    private const array TESTER_CLASSES = [
        WebSearchConnectivityTester::class,
        ImageSearchConnectivityTester::class,
        WebScrapeConnectivityTester::class,
    ];

    public function resolve(AiAbilityCode $aiAbilityCode): AiAbilityConnectivityTesterInterface
    {
        $container = ApplicationContext::getContainer();

        foreach (self::TESTER_CLASSES as $testerClass) {
            $tester = $container->get($testerClass);
            if ($tester instanceof AiAbilityConnectivityTesterInterface && $tester->supports($aiAbilityCode)) {
                return $tester;
            }
        }

        throw new RuntimeException(sprintf('Connectivity tester is not implemented for ai_ability: %s', $aiAbilityCode->value));
    }
}
