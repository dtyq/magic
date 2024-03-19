<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject\AIImage;

enum Radio: string
{
    // 1:1
    case OneToOne = '1:1';

    // 2:3
    case TwoToThree = '2:3';

    // 4:3
    case FourToThree = '4:3';

    // 3:2
    case ThreeToTwo = '3:2';

    // 3:4
    case ThreeToFour = '3:4';

    // 16:9
    case SixteenToNine = '16:9';

    // 9:16
    case NineToSixteen = '9:16';
}
