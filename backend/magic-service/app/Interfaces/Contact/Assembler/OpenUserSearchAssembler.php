<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Contact\Assembler;

use App\Domain\Contact\Entity\AccountEntity;

class OpenUserSearchAssembler
{
    /**
     * @param array{items?: array, has_more?: bool, page_token?: string} $result
     * @return array{items: array<int, array{user_id: string, nickname: string, real_name: string, phone: string, employee_no: string}>, has_more: bool, page_token: string}
     */
    public static function createPageResponse(array $result): array
    {
        $items = array_map(static function (mixed $item): array {
            $data = is_object($item) && method_exists($item, 'toArray') ? $item->toArray() : (array) $item;

            $account = new AccountEntity();
            $account->setPhone(isset($data['phone']) ? (string) $data['phone'] : null);
            $account->setCountryCode(isset($data['country_code']) ? (string) $data['country_code'] : null);

            return [
                'user_id' => (string) ($data['user_id'] ?? ''),
                'nickname' => (string) ($data['nickname'] ?? ''),
                'real_name' => (string) ($data['real_name'] ?? ''),
                'phone' => $account->getPhone(true),
                'employee_no' => (string) ($data['employee_no'] ?? ''),
            ];
        }, $result['items'] ?? []);

        return [
            'items' => $items,
            'has_more' => (bool) ($result['has_more'] ?? false),
            'page_token' => (string) ($result['page_token'] ?? ''),
        ];
    }
}
