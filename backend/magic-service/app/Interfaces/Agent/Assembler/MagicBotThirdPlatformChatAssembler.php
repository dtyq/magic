<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Agent\Assembler;

use App\Domain\Agent\Entity\MagicBotThirdPlatformChatEntity;
use App\Domain\Agent\Entity\ValueObject\ThirdPlatformChat\ThirdPlatformChatType;
use App\Infrastructure\Core\PageDTO;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Agent\DTO\MagicBotThirdPlatformChatDTO;

class MagicBotThirdPlatformChatAssembler
{
    public function createDO(MagicBotThirdPlatformChatDTO $DTO): MagicBotThirdPlatformChatEntity
    {
        $DO = new MagicBotThirdPlatformChatEntity();
        $DO->setId($DTO->getId());
        $DO->setBotId($DTO->getBotId());
        $DO->setKey($DTO->getKey());
        $DO->setType(ThirdPlatformChatType::from($DTO->getType()));
        $DO->setEnabled($DTO->isEnabled());
        $DO->setOptions($DTO->getOptions());
        $DO->setIdentification($DTO->getIdentification());
        return $DO;
    }

    public function createDTO(MagicBotThirdPlatformChatEntity $DO, bool $desensitize = false): MagicBotThirdPlatformChatDTO
    {
        $DTO = new MagicBotThirdPlatformChatDTO();
        $DTO->setId($DO->getId());
        $DTO->setBotId($DO->getBotId());
        $DTO->setKey($DO->getKey());
        $DTO->setType($DO->getType()->value);
        $DTO->setEnabled($DO->isEnabled());
        if ($desensitize) {
            $DTO->setOptions(array_map(function ($value) {
                if (is_string($value)) {
                    // 保留前后 3 位，中间用 * 代替，如果不足 6 位，则直接 ***
                    $length = strlen($value);
                    if ($length <= 6) {
                        return '***';
                    }
                    $start = substr($value, 0, 3);
                    $end = substr($value, -3);
                    return $start . '***' . $end;
                }
                return $value;
            }, $DO->getOptions()));
        } else {
            $DTO->setOptions($DO->getOptions());
        }

        $DTO->setIdentification($DO->getIdentification());
        return $DTO;
    }

    public function createPageDTO(int $total, array $list, Page $page, bool $desensitize = false): PageDTO
    {
        $pageDTO = new PageDTO();
        $pageDTO->setTotal($total);
        $pageDTO->setList(array_map(fn (MagicBotThirdPlatformChatEntity $DO) => $this->createDTO($DO, $desensitize), $list));
        $pageDTO->setPage($page->getPage());
        return $pageDTO;
    }
}
