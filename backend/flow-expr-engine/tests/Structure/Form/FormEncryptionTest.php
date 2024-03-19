<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Form;

use Dtyq\FlowExprEngine\Builder\FormBuilder;
use Dtyq\FlowExprEngine\Structure\Form\Form;
use Dtyq\FlowExprEngine\Test\BaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class FormEncryptionTest extends BaseTestCase
{
    public function testEncryption()
    {
        $builder = new FormBuilder();

        $form = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": "desc",
    "items": null,
    "value": null,
    "encryption": false,
    "encryption_value": null,
    "required": [
        "string_key"
    ],
    "properties": {
        "string_key": {
            "type": "string",
            "key": "string_key",
            "sort": 0,
            "title": "数据类型为string",
            "description": "desc",
            "items": null,
            "properties": null,
            "required": null,
            "encryption": true,
            "encryption_value": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "string_key_value",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        }
    }
}
JSON,
            true
        ));

        $this->assertInstanceOf(Form::class, $form);
        $this->assertEquals([
            'string_key' => 'string_key_value',
        ], $form->getKeyValue());

        $form1 = $builder->build($form->toArray());
        $this->assertEquals([
            'string_key' => 'string_key_value',
        ], $form1->getKeyValue());
    }

    public function testUpdate()
    {
        $builder = new FormBuilder();
        $form = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": "desc",
    "items": null,
    "value": null,
    "encryption": false,
    "encryption_value": null,
    "required": [
        "string_key"
    ],
    "properties": {
        "string_key": {
            "type": "string",
            "key": "string_key",
            "sort": 0,
            "title": "数据类型为string",
            "description": "desc",
            "items": null,
            "properties": null,
            "required": null,
            "encryption": true,
            "encryption_value": "lFvgK7FQXqw0h6DWOfm1O7TDwzicApuiZiKqNeLvFAbEUoa\/gdYVIuZSI1tACXUJ4ljmB2rkPWO0uVzkOQEyVkSuE\/jvrWsX6VkhFKz1TWZx5A6qc\/BgaGKvn4QeLWFZM8Gf43+QYROpbubCp69mke7zB6EXHd1PL1PuIEC36sdIl2rGECsW6zjxRTz5\/g96cikap5\/1y5WiefSzCXIjDS2bgwpbLl9LTQ7YQ+OBJoiKoMZCQRj2Sj2gcO+896MCnH+NNSq3F5R0F481KYm6UxR+4ab1uH8cWD3gPi0RnWpyKRqnn\/XLlaJ59LMJciMNql8rzbY7DZKimPv3pHrL8F\/W9bGi8I29r6bhXJ8vmV5\/YOPwnQlJ13s2t2gj1ZP3dnfzfoL8\/aoi4UzlWjqJtDUcKSuAsXX6M1tKlPWggpL2VdNPS5lO9uGeGQPK4F4Lp6Eyo8MPblIAxIp8O89ZYL3EWwfCIvQ7AuIeMZw0dALnNa7Tx5elu1bs\/Bzy6VZtjy4vRFkI2VVcroS34ZkGarTDwzicApuiZiKqNeLvFAZElzJk3CsPa2zO+N1XEWoCBvOHAbRRn1mrgdT9+8cl71ppV3lBW1naoiHWakRMUS1CjxCcDWnM6SmbvgJ1fld3hFJLIsOJeWJdTlazRv0Z5rbfZXIDbYY8CwjqGkJQmTSlQoVAFXHQx\/I+ZcHGXniT9A9CX20B1XHt+VbvzpxGRRbVHceAPw0AU6HFMs6gXLhadJw+whKtFGHD3zaxMafsAyJydBzzFjLRSs0jE6wp1oFOjflqth0VU0m\/UGeQxsd5f2pOBJS97JsvrEEJjF1yFtUdx4A\/DQBTocUyzqBcuFp0nD7CEq0UYcPfNrExp+wDInJ0HPMWMtFKzSMTrCnW2TTusVvNjAy7ojhRgJvTEbq+1kd1hdjIGrGzRMP9SzS8TU+66nSUxmfizVyri1HND+GPXuoCReAgvubahRUBrWugwRrGZ7IZnbc2DvNCv13ntLZWAbO7AaC5cSv1ktzmaLJxYAMy21s8mgDIuv1FweqBsLuBLkBJUxuMvYnl01+0w8M4nAKbomYiqjXi7xQGDjCVim8cOwvm\/T4A0CJWPn9bAkM982hXK6jte+M\/LHR21w1TmAcc1jsiUhv2VI1nfSahfG3RPPdCfSfmtHGdZrTDwzicApuiZiKqNeLvFAYOMJWKbxw7C+b9PgDQIlY++JPxQ2DGhhbOogWMBV+hZYs+xawHHnECi+7T3F4i8KMUfh+fo7WFD\/dgqSWF1+62YmyXNDxd+5HQdlDj39q9Qa6LetW1Vix6h3K0P5zqw94zwZ\/jf5BhE6lu5sKnr2aR8NTnYicx2Z\/wGwCUXJFraEYua1oT2dcsHFic3zFbPmBlv9otsME4rFjffI3PDFD79lXTT0uZTvbhnhkDyuBeC5QphJqN2+imv+fK6pVZi3rJJKVQUtNZxoF7DYY+vefM",
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "string_key_value111",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        }
    }
}
JSON,
            true
        ));

        $this->assertInstanceOf(Form::class, $form);
        $this->assertEquals([
            'string_key' => 'string_key_value111',
        ], $form->getKeyValue());
    }
}
