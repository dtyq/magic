<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Support;

use App\Domain\Provider\DTO\Item\BillingType;
use App\Domain\Provider\DTO\Item\TokenPricing\BillingObject;
use Dtyq\BillingManager\Infrastructure\Util\Billing\AbstractBillingUsageDto;
use Dtyq\BillingManager\Infrastructure\Util\VideoCalculate\VideoUsageDto;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Throwable;

final class BillingTypeTemplateResolver
{
    private const string CONFIG_KEY = 'provider_model_pricing_templates';

    public function __construct(private readonly ConfigInterface $config)
    {
    }

    /**
     * @return BillingObject[]
     */
    public function resolveBillingObjects(BillingType $billingType, AbstractBillingUsageDto $usage): array
    {
        if ($billingType === BillingType::Tokens) {
            return BillingObject::textObjects();
        }

        if ($billingType === BillingType::Times) {
            return BillingObject::oldImageCount();
        }

        $config = $this->config->get(self::CONFIG_KEY, []);
        $template = $this->findTemplateByBillingType($config, $billingType);
        if ($template === null) {
            return [];
        }

        $billingObjects = [];
        foreach ($template['items'] ?? [] as $item) {
            if (! is_array($item)) {
                continue;
            }

            $billingObject = BillingObject::tryFrom((string) ($item['billing_object'] ?? ''));
            if (! $billingObject instanceof BillingObject) {
                continue;
            }

            $billingObjects[$billingObject->value] = $billingObject;
        }

        $billingObjects = array_values($billingObjects);
        if ($usage instanceof VideoUsageDto) {
            return $this->filterVideoBillingObjects($billingObjects, $billingType, $usage);
        }

        return $billingObjects;
    }

    /**
     * @param array{resolution: string, modifier: array<int, string>, billing_unit: string, is_cost: bool} $videoPricing
     * @param array{resolution: string, modifier: array<int, string>} $usagePricing
     */
    public static function videoObjectMatchesUsage(array $videoPricing, array $usagePricing): bool
    {
        if ($videoPricing['resolution'] !== $usagePricing['resolution']) {
            return false;
        }

        return array_diff($videoPricing['modifier'], $usagePricing['modifier']) === [];
    }

    private function findTemplateByBillingType(array $config, BillingType $billingType): ?array
    {
        foreach ($config['templates'] ?? [] as $template) {
            if (! is_array($template)) {
                continue;
            }

            if (($template['billing_type'] ?? null) === $billingType->value) {
                return $template;
            }
        }

        return null;
    }

    /**
     * @param BillingObject[] $billingObjects
     * @return BillingObject[]
     */
    private function filterVideoBillingObjects(array $billingObjects, BillingType $billingType, VideoUsageDto $usage): array
    {
        $usagePricing = BillingObject::resolveVideoUsagePricing($usage);
        $staticObjects = [];
        $bestObject = null;
        $bestPricing = null;
        $bestMatchedCount = -1;
        $conflictObjects = [];

        foreach ($billingObjects as $billingObject) {
            $videoPricing = $billingObject->toVideoPricing();
            if ($videoPricing === null) {
                $staticObjects[] = $billingObject;
                continue;
            }

            if ($videoPricing['is_cost'] || ! self::videoObjectMatchesUsage($videoPricing, $usagePricing)) {
                continue;
            }

            $matchedCount = self::videoModifierMatchedCount($videoPricing['modifier']);
            if ($matchedCount > $bestMatchedCount) {
                $bestObject = $billingObject;
                $bestPricing = $videoPricing;
                $bestMatchedCount = $matchedCount;
                $conflictObjects = [$billingObject->value];
                continue;
            }

            if ($matchedCount === $bestMatchedCount) {
                $conflictObjects[] = $billingObject->value;
            }
        }

        if ($bestObject === null || $bestPricing === null) {
            return $staticObjects;
        }

        if (count($conflictObjects) > 1) {
            $this->warningVideoModifierConflict($billingType, $usagePricing, $conflictObjects, $bestObject->value);
        }

        $result = $staticObjects;
        $result[] = $bestObject;

        foreach ($billingObjects as $billingObject) {
            $videoPricing = $billingObject->toVideoPricing();
            if ($videoPricing !== null && $videoPricing['is_cost'] && self::sameVideoPriceGroup($videoPricing, $bestPricing)) {
                $result[] = $billingObject;
            }
        }

        return $result;
    }

    /**
     * @param array<int, string> $modifiers
     */
    private static function videoModifierMatchedCount(array $modifiers): int
    {
        return $modifiers === ['base'] ? 0 : count($modifiers);
    }

    /**
     * @param array{resolution: string, modifier: array<int, string>, billing_unit: string, is_cost: bool} $left
     * @param array{resolution: string, modifier: array<int, string>, billing_unit: string, is_cost: bool} $right
     */
    private static function sameVideoPriceGroup(array $left, array $right): bool
    {
        return $left['resolution'] === $right['resolution']
            && $left['modifier'] === $right['modifier']
            && $left['billing_unit'] === $right['billing_unit'];
    }

    /**
     * @param array{resolution: string, modifier: array<int, string>} $usagePricing
     * @param array<int, string> $candidates
     */
    private function warningVideoModifierConflict(
        BillingType $billingType,
        array $usagePricing,
        array $candidates,
        string $selected
    ): void {
        try {
            $logger = ApplicationContext::getContainer()?->get(LoggerFactory::class)?->get(self::class);
            $logger?->warning('video billing object modifier conflict', [
                'billing_type' => $billingType->value,
                'usage_pricing' => $usagePricing,
                'candidates' => $candidates,
                'selected' => $selected,
            ]);
        } catch (Throwable) {
        }
    }
}
