<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Chat;

use App\Interfaces\Chat\DTO\Request\UpdateUserInfoRequestDTO;
use Closure;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class UpdateUserInfoRequestDTOTest extends TestCase
{
    public function testTimezoneRuleAcceptsValidIanaTimezone(): void
    {
        $errors = $this->validateTimezone('Asia/Shanghai');

        $this->assertSame([], $errors);
    }

    public function testTimezoneRuleAcceptsExplicitNullTimezone(): void
    {
        $errors = $this->validateTimezone(null);

        $this->assertSame([], $errors);
    }

    public function testTimezoneRuleRejectsInvalidIanaTimezone(): void
    {
        $errors = $this->validateTimezone('Asia/Beijing');

        $this->assertSame(['timezone 必须是合法的 IANA 时区标识符'], $errors);
    }

    public function testTimezoneRuleRejectsNonRegionTimezoneAlias(): void
    {
        $errors = $this->validateTimezone('UTC');

        $this->assertSame(['timezone 必须是合法的 IANA 时区标识符'], $errors);
    }

    /**
     * @return array<int, string>
     */
    private function validateTimezone(mixed $value): array
    {
        $rules = UpdateUserInfoRequestDTO::getHyperfValidationRules();
        $timezoneRules = $rules['timezone'];
        $this->assertIsArray($timezoneRules);

        $validator = null;
        foreach ($timezoneRules as $rule) {
            if ($rule instanceof Closure) {
                $validator = $rule;
                break;
            }
        }

        $this->assertInstanceOf(Closure::class, $validator);

        $errors = [];
        $validator('timezone', $value, static function (string $message) use (&$errors): void {
            $errors[] = $message;
        });

        return $errors;
    }
}
