<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Assembler;

use Dtyq\SuperMagic\Interfaces\Agent\DTO\MentionSkillDTO;

class MentionSkillAssembler
{
    /**
     * @param array<int, array{id: string, code: string, name: string, description: string, logo: ?string, mention_source: string}> $items
     * @return array<MentionSkillDTO>
     */
    public static function createListDTO(array $items): array
    {
        return array_map(
            static fn (array $item): MentionSkillDTO => new MentionSkillDTO($item),
            $items
        );
    }
}
