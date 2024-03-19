<?php

/**
 * Created by PhpStorm
 * User: 丁少龙
 * Date: 2024/1/30
 * Time: 12:04.
 */
// app/Validator/PhoneNumberValidator.php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Validation\PhoneNumber;

use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use libphonenumber\PhoneNumberUtil;

class PhoneNumberValidator
{
    public function validate(string $stateCode, string $phoneNumber)
    {
        $phoneNumberUtil = PhoneNumberUtil::getInstance();
        $phoneNumberObject = $phoneNumberUtil->parse($stateCode . $phoneNumber);
        /* @phpstan-ignore-next-line */
        if (! $phoneNumberObject) {
            ExceptionBuilder::throw(UserErrorCode::PHONE_INVALID);
        }
        $isPossibleNumber = $phoneNumberUtil->isPossibleNumber($phoneNumberObject);
        if (! $isPossibleNumber) {
            ExceptionBuilder::throw(UserErrorCode::PHONE_INVALID);
        }
        $regionCode = $phoneNumberUtil->getRegionCodeForNumber($phoneNumberObject);
        $phoneNumberUtil->isValidNumberForRegion($phoneNumberObject, $regionCode);
        if (! ($phoneNumberObject->getCountryCode() && $phoneNumberObject->getNationalNumber())) {
            ExceptionBuilder::throw(UserErrorCode::PHONE_INVALID);
        }
    }
}
