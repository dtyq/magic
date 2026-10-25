<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\ConnectivityTest;

/**
 * 构建 LLM 普通与多模态连通性测试消息。
 */
final class LLMConnectivityTestMessageBuilder
{
    private const string IMAGE_DATA_URI_PREFIX = 'data:image/jpeg;base64,';

    private const string IMAGE_BASE64 = '/9j/2wBDAAQDAwQDAwQEAwQFBAQFBgoHBgYGBg0JCggKDw0QEA8NDw4RExgUERIXEg4PFRwVFxkZGxsbEBQdHx0aHxgaGxr/2wBDAQQFBQYFBgwHBwwaEQ8R'
        . 'GhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhr/wAARCAD3AUoDASIAAhEBAxEB/8QAHQAAAAYDAQAAAAAAAAAAAAAA'
        . 'AgMEBQYHAAEICf/EAEQQAAIBAwIEBAQEBQIEBAUFAAECAwAEEQUhBhIxQQcTUWEUIjJxI4GRoQgVQrHBUtFicoLwJDPh8TRDU3OSFiVEhML/xAAbAQACAwEB'
        . 'AQAAAAAAAAAAAAADBAECBQYAB//EADURAAEEAQMBBQcDBAIDAAAAAAEAAgMRBBIhMUEFEyJRoRQyYXGBkdGxwfAGI+HxQlIVM6L/2gAMAwEAAhEDEQA/AOL7'
        . 'nABJ/wC+tNb/AFNmnW52Bppk+o+lBZwju5RkeO3rRmaJiowUo4brRi3atOR+2KL7kUN+tF5O4z3qWq55QFIVqOkk51K7n70nbbOdzWKC3yqCSe2aKAl3Gigb'
        . 'g4NbznanJNHuSnMeQbZ5c0gniaFmWQYcVaiqCh1RQO5B9cUJRisUEk53oWP2rxPRSN91sMQNiRQxKR1orGa2AQKori0oSb1z7UYJh7nFJMbda2NuvSqUEYV5'
        . 'JWLhTQhMmDg0kB7/ALUKo0hEaAlPxIGwB+9YLgn6QaTVsHHSq6QrhKhO2+SfyoBkZs5Jx96ArbHas5vaq1SIChqxB3JoYOdj3HpRQ9c9azONtq8psI7Gdh19'
        . 'zWwv6igI+FO+SKFz5zvt9sVCs0Wt8pPXBH2rfbFYCetZVVYtCEnSjk3+1Jx8pzn8qNRgTud6ghWYd0eAMD0oWPyosP8AvWwx9aDRR9kYD2OxoYPXHeiObA2N'
        . 'GIeYY2G1QQvBKgQ2460ph/Lf2pJH03pZCBkd6DVmla05W0YY9B+lO9vYxyf0A9KbrPfHpipBZIcDIBFaUEIPKXkkpKrLSocjKftT9aaTbHHMi/pmkloANhgU'
        . '82p9s1uQQtHRZcshIThZaPaqAeRRn/hFOgsLYDZBj7Cm2O58seuKH/Mo/wDWf1/9a2GmNgqllv1OK5inGxPrTNMMNTzcD5T1/Kmif6jmuZYru2KyI7jHeje1'
        . 'J4zjqenpSg0q8bp+H3UBxsfbvRYz3o1uhorO4J/avNRDyi3796NsJAl1Gz9AfSimPXbFAHbG3vRAl3DcqbLKgTPMMdc5qKanKJ7lip+UbbiixdTGPk81gMdK'
        . 'LAz03phosJQk2txKTnFGOhUEscAbEk4xU88IPCPibxh4l/kfBlkJpECvd3cxK29nGSRzyuAcZ3woyzYOBsSPRDgP+E/wr8GtKXVuLraLi/V41HPe6vAskfPg'
        . 'bQ2u6LuuRnncEn56WnkZC10kjg1o5JRWO2DW7krywjIkLeXmQr15FLY/QVoTR9CwB99v716ceJnjjr1pDJa8L2x0LT4QETkRQ+O2T0XtsK5f4l8Sdc1m4d9U'
        . '1F71mBU/EKsuQeo+YGuXj7fZO8iGIlo6k16UT96W7F2bO5up7gPVc1AhhlcEeoNYMb96svVNN0bVSzXOnRW8x/8AnWaiEj/pHyn9KhuqcL3VmHls3F/bruSo'
        . 'w6/df9q24cuKbbg/H8peTHli35Hw/CaFHpms7GiBuNgaGQcb07SVEoQlJOc9fah42pOG+9KIlL/LUFpCs2Rq1kjp+9CBO9KksSy9DRc1uYs1VXDwigN9xQWJ'
        . '70ohgMg6Z+1AlgZf9q8AV4vb0KLVs++aOU423olIGOd/2oxUZR3xXi0leZMG8lHDt1oWKI5uUnHSs+Jx1P7UItKaEzD1R4XGeprQDAjbP50WJ8980ISc3rUB'
        . 'rlBkj80pjJPXYnpmhlM/+9JkDDpSqKJ5NsYFULSiNnZ1WuQ+lCRCpwPWlJtGCk5OSO9FQRGQjm6e1V0uK8Zo0qt4yQAxwPvTlBEuBkgelInsjDHzAAZGaJtJ'
        . 'XeTG7DNUELibU+0sGylFnyIRzN0qQWtzbqu7DaonFBIEyFI/KkF1dXEUwUA4+9acL9I3Sb5WkmlYp1aCLOG3/SjE4khjG2Sag1mtxPFljt7GlC2chJ+bHpvm'
        . 'mfaiOEtYUruOLFAPKBim48XT5OG2pmFicfPJn2FZ/Ll/11ByXqtjyUMmHyn7UzXA3NPUoOCO9M9wMZqjEm9EL3+1Kv1pKhAbelIbI69qXkG6dg91aO6nNENn'
        . 'Pv7VJuFuB+I+ObiW24S0S+1dosGd7eL8KAYJ5pZWwkYwCcswGN6kNp4b6Lpc6nxA450XSwvO0un6ITrd+QpwFUwZtVJ/45xjuDjFQwcqz5GgqtyDgkg79Ce9'
        . 'KdK0nUNc1GHTdCsLvVNQnOIbSzgaaaQ9cKigk/pVkcW8acHSi203gjw4sdI0S2wDf6pM93qV2AcebIwIRWYbmNQVBJA2Aw+cG+KvEXAWlXNj4e39vw1aXrB7'
        . 'iTTrSJZp8dOad1aXA7KGAGTgDJyu7I0Cy0jy4/YlEZjvmFt5+v4RcP8ACX4tfy03t5wxFpwKc8cN7qltDM4/+2XJU+zYNQ6Lwh4uW+ltdV0+LRFgfknutSuo'
        . '4oYz6hgSZPtGGNSPVePeItdkZ9Y17UdQd88zT3byc33yaZWu3c5Z2J+9Z7c7MBN6a6bHb1Rx2cP+RXcnhH4qeGHgR4cWXDfCU02vanvPqV6IDbrdXJHzSEtg'
        . 'hRgKq4JCqM75JknCXjhw/wAW6nrOrcZXcCPZWy/y20LHkCnm8wgd22XfrivPj4mQIRGSMdMGlWicQ+ejoJSzKcMpPTFY+VDlZJEkkmoN4FbX5kdSORd0tWHC'
        . 'xWMLW7OPXr9Fb/ih4gDibV7iS0QW9nz4jjGBgflVSXV0Xdt6Hc3RlyT1FNckmdhgegr2NjiMLSLQ1ulqNMuc7/nQUlKfScY6GiOY5y2CaCWHpj7U/pSTmonU'
        . 'dJg1BmljCwXP+oDZz7/71HZrOS3do5UZHHUGpSsmCM5rcsMV9FyT74+lx1Wm4ch0eztwsrIxQ/xN2KhZiGehyDSiAcrknINLLmxe1kKyDIxkNjZhRJXlO21a'
        . 'xeHNBHCzI2kEtKdLYgodhmiL5FxkCjLQnl/9KFdx5jOw6elQo6pJZMuTkd6MuoxgHlpHbErKQcYPrS+beMH1A71LnU21aNtupJYlAA2Ge9adV9KFGp5jvsR6'
        . '5rUi7b+tGYbCBIKJSOZRjakDKAT99qcJR6DYUgbc/nVOqJHwlaptnHtQ4VyxBJ2oca/KTWoRhjXmOvZTKzTRS2MDcY+1OVmFDZxmm6PGfanG02NDdwvM+KdX'
        . 'VBAflH003WIHnfn/AJpfKwERz0x2pu0//wA7c7A/5oYKOG2209ajIEtyPYU1aWpaYH32pTq0v4eNvzrWixjmDfpUgqCKCfySEOM7LtUb1R83QG/WpDIQUY7V'
        . 'F7/Ju9q80qGjYp/0z/4elg3G2350j04YtxSsVPVDQsbdRmiSTk7/AL0aNqRuV52+9WBVVDpPpP3pnuc5PenmUYDYFNV0MM2aZjKWcLSNOv5UcuQgwOY9FHqf'
        . 'SiASMb70/cJwNd8TaNbQ2pvp57yKG3gBI82ZjyxjYg45yucds0J4tyZgPhU/4puNWseALbhO1cpoNoUlkiITM84JeaZuUBmDMQACc8sSbnG1cQxyzgRi4GN1'
        . 'WNELKCOoCg4ABbr3J/OrP1xdR0aGWS8u7dRbPMnmqXlyCx5WV325sE577L8u+arqPjXU7fT0sHu5nhhVViVZWjSLl5sfImM/Uw3zsTQ2AkHZOP0xuBtFyWsc'
        . 'UcxjkV/LK5Z3UMd8YCZ9j0PpnrWtChlnLQWiyyzTyYjgiQuzH0VRvmkc+szag4a8l52VFUDlAVQMAYA27Dt2qR8F8SXvCt2uo6UYDLLGY545Y8rKhbJUkYZe'
        . 'g3Ug/cbUGcObE6hZTMMjA8OBtSfTPDXiO9n8j4W3spAASLu8RGAPqBzEfYip1p/8N3Fuox5t9a4ZibGQr3VwP3EWKRcP8a6Pq92Xnm/k19LID5c7/hN6BZdh'
        . '/wDly/nVuWGu3+lqokyy4BBPceoPf71887R7S7Sx3ANaB8x+hulssDZB4Tao3irwV424a025vFtLHVobdis7abd+cYfRnQhWC++CKrXQ7C4tJyZ1KcqEHfqx'
        . 'O5xXT+vcbXtldrf6XKYbmMEEN9Lr/pYdxVc65faZxbdSXUESWGoNvNb9Pm7lfUVo4HauTJDUzBvyR+FJxTrD+QFBGZsb9M+lJWVlEhU8xO4B7U7Xdq1sxWQD'
        . 'b+oU2y/LnODttvWvG4HcJkEEbos55cE79z6UE53yPtRZlG69fzrfPnfqO29HqlRzbQgcbk1tSF2BI3796LzntvWVFJZzEpZUnjMcwyPX0pmvLZoZOUj7Ed6c'
        . 'VZubf6cbUN1SZfKnyQTsw35TRI3mPbos+SEE2Buk9jBlDjt1oyeDKHanHS7Tl2lwduo7il1xYjy25QB3NaQdYtYxFOKgRQxznO+5pe3zQDI3HSg6lAIZ/TJo'
        . 'xU/AIzn/ADUu3YiMFSIqFeYgdO1bkjIz7Ubbptlzgdc9sVLOHeANW4qlU2UK2tqQWN5cqyx4HXkAHNIf+UY9WFWEjWNtxpS3FmypjHCwuPkP5t9VALiIhSR6'
        . 'dab4Y3u7lYrRGuJTuEiQyE7+ig117wv4KcK6HFBNrGnPxFfEgmbUZAlvGQCSFhBCHbrzl+24qaald3Ol2y2eh2XwNs0YlS2s8W6BMEnKQHGcAfKy4AIyR0pC'
        . 'TtKFh239F1eL/SuW+u9eG/8A0fSh6rieTTb6zQi7sL23xt+LaSJ9+q0iQmORgwKtno2396ufj+a6umW4WyuEQN8szO8iSDPMCC6jlG53+4yRVW3Gpkh1ZnZM'
        . '/SxyD74O37UXHyNe9ev+FXtHsFuONIlv6f5SePsO3SnG1O+1NAvI1YcyYH/B/t0/tTpZSJKA8TB07kU242FyroXxGnJ0l/8AIbc4xSHTziQknNLJW/BPpgUh'
        . 'syAxOTv6Chgov/FGaq/M6qKdtHj5Uz7UxXBMl2o9KkenpyQema8hu32SuT6DueoqL3RDXfvUlkJCfnUYm3vGxtUK7QNJUjstrZdvf70eGHeibba3GKH9qJ1S'
        . 'yMzud8j2pGWXJyTn7UoJwp7HFJDnJ2zXiQFdrbUVlGxppusZbfFOzndqarnvjGKajSTkhHbbO9OWi6nPomq6bqlm3Lc2F3FdQnGcMjhhsevSmzoSRRyEcuB+'
        . '9Vk2KPBRBCmtxfPq1w41B2vpWV7hVhuC0cSDJJKxfSVUZO+AME4xTD8EI0WIBDgcuVxysPX86TaRq99oGq2mqaNO1rqFnIJYJVOMMOx9QRkEHYgkGpnxDHp1'
        . '/enUtJtEtLDUY1uobUHmW358lo1P+lW5gPtWfNI5jhfB/VaeO1rzpI3pQ8aMkXNcSk2lqriN5ihZQxBITYfUQCce1L59NktVtuWKWGK4QyWzSIVE6ZI5kY7M'
        . 'Mg7rkVMeD5rA3S6fr9kt/o8zILi18wwiVA4blDruhyNmG4zXSvC/CXCzWcvD8EbLwRqRMg0nU5WvbewnOcTQyN+JHnJD4Oc4YHqKw87tlmGQ2QEnpxRHz8/g'
        . 'dviEdkNOLQAAuMuYo3LID07ipPw7xjrGgr5elajLHbnc28n4kR/6GyB+WKsXxJ/h/vOGbm4l4YMl9Zpl3smcSSqnUNDINpkxv/qA9d6qA2fJGZEyiDuaYiyc'
        . 'XtCK2EOHkf3HQ/wInsz4nWNlYg45/mvJHqdpDG8hC+ZbsVBP/KcgUG50bQ71ed2u45Qcho5xkH16VWUtxJP5YiJZAeYOBjJ7fcVJbK/kdMSbEYyB+9LPwe4G'
        . 'qI6fknGTSE6SVNbjhXTbjSBc6fxlHLcRqBLaalZGJ1b0WRGPOPflqudThnsZT5pRgP64n5kP2P8A7U+GXzO+aRzENkEZ9c9DRIXOafFv9KV6cBubTAtwrfej'
        . 'lkGNjnNBudNWTMlm3lSA4KH6Sf8AFIo5mjdo5VZJB1B61pBoePCobMRs5OqPlTy4NCBxuaRxyZGc70eH5hkH96EW0jmiEbn12zQg3vv+9E5O+TmthuXYVWks'
        . '9oTnYXogkVZMlG7gdKenlBQlfmBGxHcVFVbbBOCO9Wp4M6dpPF+tJw5r6I3mypKrN3hBHmqPcDf8zR4NRdoHVZGVGGtMnkq0u9Iu9RxNbRN5RP1lSFP2pFBZ'
        . 'XLy/CwxNLOckIgycAbn7D1r1B/iM4d4UsPBLUIYLOysjZxRnSfho1VlYMNkx1BXIPrn1xXPvgx4HwLo63+tWyXur6kh+JfnEkUCYyIEOMZAxznOObpnAp2SN'
        . 'zTpG5PCv2XC3NfqkOljfeP4+J/z8Fzlw9wuljLFd6rD8Wi/MEZTyjHoNsnr16dwKvfSr83w80S2rwpgFFGCpJ+V3BHLg5I5QGxyjJ2pR4heFN9wqrXz2txPY'
        . 'yzqPinUlQdwqHP0j5iB3IAznFV9Za/e6NJEtwsUtlDnPND5jopO/KdhkgBd9vuQDWZLA9u8i+t9neyRRacYAN/X5+ZV4aXftb2DtOwnEMPm2omAiQSFd3ZB9'
        . 'Q+oEdMDO4FIOKPMmNwl27XsvwxjmmhtWjmKvyMSUG+QPlJyQQBvsRUR//XsUfxDWLTS26RuPNiVQr4YdebfByQFGSB260l1LjvUJbGF9CmWEWReSBriePnYs'
        . 'OsYUjJMafNgYzkb8wrInutLU9FA5sokoftfTpf06k2dwo34gRxeZLJdZN2k8cbNLIWV05EZTuMoy8rA8p+fn5sCuedXhEczEHckkjGMelWvxzxGspS2uVjW/'
        . 'RQlzJG6q3OpwWaMKAdiVA64AJycmqjuW82WRsgcxJ2GB17elamA1zW2VzHbbmFoYOU1vv19aMtbuSzmWSHG2zKejD3rJE265x6USftW2DYXz+RhvdTVLmO6s'
        . 'xLCTyuMYPY9CPy/2pFG4QDtn3ps0S8KmS1kJYSDKH/jH+4/sKUSylCPYbUOqdSUOzUotiJbtifXpUut15YVGO1RLRhzzMfWpeo5VAFVOyoN90C4OI9/vUcxm'
        . '7YjcE1Ibg4iOSBsaj0fzXTb53/zVequPcKksI/BXPfFbI65oMWREvTpW8nOelX5KWWn+liabWlHM2WA39qcHJ5T0ApiklPmP1+o9qhyKxNj99s/amu6A7VOk'
        . '0Jw6wRr5krbewpdc+EGsXlo1zbypzjfkMZ/TOaYhfruknKwt5VT9Se9O1poF9OARAwXGW7kD7U/aLwJqwv3N5Z8iRuN2YDOD6VdvDvD9nKEd8IEBQry+o3zV'
        . 'pXsrlEx2OJ2VU+HnhqOKvEThHQdTEqafq2sW9peYblbyS3NJysOhKKwB7E11T/GXwBpOgz8JXegWkOm28enjTksoIQkcUURYpjH/ADY/L3qF8K2MGj+JPCRs'
        . '+UPHqKSxEbbqjn/FWP8AxFcW6d4lvw7pVrJ5Gq2KtJdIR9IbZcHvnBrku0s2nNbdUQf1tbePilmQ13RcexwtE+VJz6+lXP4bcaNZNHb6hmWEnZgfpqutQ0dr'
        . 'K4eOReh2YjGaHpkrWsgK+tZmbHHnQFrt10DsUFuy7Ss9EseK9IHwMqxzqMxkf0tXNHjb4eWkel3t5/LDba9Z6hHJdSROwW5tXRlY+WDylg/I3MBk5OalvBHH'
        . 'cmnBOSYoyjrnapLxhxVYcWadJDflEuDGU5/UH/FcF2f7Z2Nmgtstvf5fz8oTY3Pb3b1yNZWcLw80OCqjkI3GCO2+DRwg5T8oII9Kk89jLDNJDeBQ6swXlYnK'
        . '52O/tTdPZ+WScbV9P9oD3FWENbJuXmG3UetBYBv96UyREZ9NqTlcA5ogN7q5jBFJNJHsCNyDsBSe7so7tAsuzL9LjqtLsbHmAP2FF8m5Of8A1ozXFu6RfHWy'
        . 'jhWS0l8uf/pYdG+1KI3A3HXvTlcQJcxskq5Xt7H1FNSWlwl0ttEj3DyHEYjUkv8AlTzXiQb8oTNQOkbpUrBun963sO2NqkOn+HnEt3Esv8veGI5wzqeg6nHo'
        . 'O53FETaBDaEx3V7I0qjLpFbEFT0x83X70t3kd0HWtU9m5pbqMZHz2TMDjfNKNM1+94Z1Sz1fR5fJ1CylE0DYyC2/ykdwQSpHcE0eYNJBYNJqikADPLCwJ77E'
        . 'D+9NtzahZS0UplT+gSIEbHYkAkfvTDAAbBWbNhz0dTCu2fGjVNAvvBXgzVtK1Ca91HjNYZLZWflEEaKHnwoB3VuWIgnYud9qtD+HbXdM4p0extrl0+Otjlrf'
        . 'Iw5Axz477A5zvlifSuWfDzgLU9b8GdO1GWe4uJYLq7fSrUgNGsLTgFQME/NLE7bbbemaDwpxDqnBur2tzZia11Cym5opGby3jcLgqVPMGU5O3QjI3zTIyj7X'
        . 'qdxVLcwexmf+DMUbvG4l3yNbA/SvX6+k94dG1CWXQ9QaxupprYyyafKUdngJ5SxjO5TO2cYzXAfjP4WnQNWuxwpFNNpnnRpBZFi/IrMQoB9OYkYJ6/arA4f8'
        . 'e9L1LiNda4qQW2vmxFoQJQbJYyPna32HI7BV5udiMK3L9WKZuPeKo+KLa4ttPlt4VhPM8vNzNMoOTLgfLzDnRRt/VtgjcuTJHLGRe6X7A7Oyuzpjq4cBflfm'
        . 'uULu9uLO5KNGsLQvIDEVI5uYkMp9RkYxR97xZd3ikzS3DOLcW/nSMJXaENkIzEAkKehPQYUYAqUcX6TZXHxsyuEmiuvKVy6jCD229RjYZ3wTVb6nZPaytEsg'
        . 'dGHUZUHvuD0rEj0u2XY5XeRbjogX+pyTQyRXcsjSKQIlwCqKfqGTuPpH6GmEEknO+f3o5zj6cY70STnONq1Y2ho2XGZEhkdZRTpnI5ST69qTsny59KVqgOxO'
        . 'M984oCRZl5G2ztijA0sl7NSRqxikSVOqMD+9Lr6TErAdCcDFI5Y8Fh0oyUl5IOm6g/tRRusjIbpBUn0GI5yakuetMuhx8qAjtTzzUF3KXZwiLs4ib7Uw2vzX'
        . 'Bz3NPd6cRMQegpksd59+5qo5ROGKSrsi/as5tzmtDIUbdhQc1cJcrUxwn5Go68p5269TT9cvyxZ6Yzios7rzt9zUHdFjGy6DstFt49Ud/lAVickbdatLSdc0'
        . 'oWfw7BFkTr71zTPxpcPzGME7debeibHiieS9SSeZl5DnHNWdBNJHuE1kY8b+quPiXUdNiu5Z0RSMnAVCc/tVZah4hx6Xc5UB1kYkIGCn9+1Sq91CyutFiLzq'
        . 'ByDmJPQY6/c1Qd5Z+fcTzEMediRznJx2rQb/AHfeKz2nujsrd8OeP/5h4z8ATXjKYZOILOB0JyqJI/lb+3z5q8/G3w/uOGuLZ2iLSROmUbG4XJwPyrimK3lt'
        . 'yJLORorqNhJC6nBWRTlSPsQK9W9bOm+MvhrwvxfYRDytSso7n5CGMJdPnjPqVfKn3BrnO3sUtxhPFy07/I7LTwc5zMoB/BFLhHVYXdSJATynbNR/yyjnIxg1'
        . '0Lxh4ZzQRu6R8wZflKjuKprUtEmtZCJI2BG1c7i5TSNDtiu7gkjlGya7a8eI/KxFKpdWkKFS52H2pI9qVPQ5op4TynI3pzSxxteczTujLfUFv5fhbtgszH8C'
        . 'T1P+k/ftQpLQsrBl+dTggimW6tfMDD+2xyKsvwqg0njprvh3XHlt+LAol0uQSBU1BFB54gP/AKuPmA/qwRRZWmNhkYLA5A/VKSvbGNTuFXFzbeWG229qSNF1'
        . '71c2r+FjSJ5miXLXB6NFNHysp7gkbCq61Thy80mUpewNHjv9QxnrtUQZkco8JUMfG/3Sou8HKBjcUQ0ZHuPtTuiRSyFI5Edx1VWBP6daM/lE93bag8Ecx+Gt'
        . 'zM7IoIUBhu2SMDHN0yc42xmtKN+p2lX9mM5DWjdNFpZfH3KxLKsC5HmSEZ5Rnc47n2rp3wo0HQNKsjb6dbSrPIC01yCi3FwMfTz7nl2+ldv3J5t02zcxfIeV'
        . 'iNyBnvk/tipjoevnTxFZ3D+XyyDyTyP87A5Ck8wAI/1NgY67VojGeRqPurYwo8PHBirxnr1XRuvx28jFkSLmdeTyopEaXmx25wAMY371QXHnCEL+fqEDBCXJ'
        . 'MQyQf+rAHX0H51cOiala6hJGmrvC00oX/wANp6mNpMEYDSksxUA5+XC+hONnLUbXSrguNPtNKEsfyswie5k6HcySZx+Q9sdKUmxyDqjG66THlZE3u5Gk39vr'
        . '19Pr5cY3NsqOw5CD980jeN0Q+WAQxGc1fvGuiwyI8l9LPGyNyECNRHGSPlwEUdt8f23qm9TtPgrmRA2VU9WGKtFMTsRulMzBDRqHHwXdHh5p7SeC3A0GjWtv'
        . '51vpdsZcx5bmYO7Ngb9X69ATk1HvEPgiy1m3klihgj1KG1QvdQxsseQ2eWQE8pTflBTlO/T0TeCnH1nL4ZaJb3rrDcW1q8MbMWxMqnkdFA/q5UXOcDtkZzUv'
        . 'nv0vdEleBYjclclJ08rmAVQrRIMM31EEA9Vzkb4ZdKxzqPK5jHimxXAAHTex87+PUV+Fx5xAs1jeFbmKVZXYkKqDlkQEj5d9xsRkdCuNsUgs+ONW0uFbWK58'
        . '6xJPNBJGCMYxnHY4Ox7EAjBxXTHGvCVtqTeXfW4uA1uQbhYkTkOAObORlyxj3BJ23HrztxDwXLY2wvLVF+HcFCrMXIbfZSwGcbDP5jNJl7WOp33XTsAnYTH9'
        . 'kjbiP4op8SUmAUmN50B5m5+bDYHbJ/L22qO6jdI8czSufxCWRQeYZzkk/wBtqR/PAXxs437dO4pBK/MgB2Ync0zHEAbCzcnJcGkEJE+CzY9aIbYE96WiNm5g'
        . 'oLEenpQXt+U4HXv/AN/rWi11bLkpRaIiiO3MCMb70W4Mbhl3wQdqcTC0WRlssxwB/v8A99KJdCU3yeYZANeDrSZCQ3i8s8gHc5xQIYy08C77L/8A6NLr63DX'
        . 'RUMA3KAcnvikx/8AD63DGMgciK47fNk/5FMQ+Jqys4UPqpjpahIT2zS+k1ouIVHX1pQG9d/zoZNkrPAoJJfnEbdMY7006cAZB/zU5ai34TgYFN+lj8Rc++1V'
        . 'HKs73FIATjFaxWzQebrV0ApPetiI4GdqirJlmPM259KkuoPiJ+vSoqSvMdj1ryK3YKRTXESZAOabZ7gq/OoxRTy5zvSW4lwOv50QxjhAEhKdl1WQwcrNk4pD'
        . 'Lcls5OO/TrSBZ2I5VBYn03o1bSeTHOQint1OKiOMNXnuLlhnx3zXcH8CHjDBLp2qeF2v3AWSN5NQ0LzG2eNjzXEC9hysTKAMkiST/TXFiWMaREkAH1pNp+tX'
        . 'fDGu2OsaNL5N/YTrPA3MRkjqv2IyD7GpnhMsL2Dkg8oFixa9h7nhSx1HzJLdRFMx2A+knGKqfjHwUjYyz+UI3bq0Yyp/baob4a+P1xbWFlqVxL8dw/dwiYPK'
        . '4V4B0ZSx2ypBBz6U8eIX8aOiWEUll4daM/ENwUwb6/5ra0UkbFUx5suD1GEHoxr5vj4TM0OYfC5vN9Cuojiz4pB3ILweo/PH3VUcQ+FN1YuXWE8pyV5N8j7V'
        . 'X2qcM3VmT5lu/L68hFTqTivjfxEiFzrfGk+lafORIlhp0AsIuUnPKqp87Dru7Nn3pBceGmmsA17e3VzPKAx824JIzvk5OfTbH960I+yJYGmSWWmj4X67LqoG'
        . 'ZMlNeBZUC0zhTV+JtVXSeG9JvdY1J1D/AA1pCZGVCeXnc7KiZIHO5Vc96syDwDh4GjtNW8Uo9R1DVlmU6fw3w5P+MJgCytcXYxyAFSGS35nGVYMRkV2j4M8C'
        . 'cPcB8C6facKWaQrcxrPdXBbnlupSN5JH6sfQdFGAMAAUPj7SIdQ0mWK40mz1KOPLxR3DMpDHOWDKcg47j1NdEzEjx4BK11kjkj9v9rlR2mcjL7iRtMujRAJ+'
        . 'p6fKtuq4W1Ti6/4je5vJYoZFeVfxkQvGpZQxwSN2ww3JPrTFb69JbNG1xIMJJkqke7qDuPqyO36VI+Opjpt3JZXFqulQAlo4o1UIVGRtgDOyjcjJxjpVeXFx'
        . 'a8/JFc8sTHJwOgx6DruelYLNAH9sCl9EliDW0W0P2+n7K4bXjjh7V9LK6xpmnalBCMOuowW8nzHBGFK5G+dwQP8ALG+u8IWNtJaaDp8uki5uIpJ0sl+L5sHJ'
        . 'jVbiTZWCkBCxG+OjEVROoXrRSt5BUumC2Dt7Y6fp2pvOvS5YzMC/MJMlC2GHTGT+/tWxE+UgbBY4hZA8vicQf50O33C6A1LhXgcaXc6lwbdS6vYKPxNBvFaH'
        . 'U42ZjzK8JA/BGwMqMyg8+WGABWup2TtaF7hfLidQMJ9AwOVTv9Z67nqc1ALfWriG7S5t7iaC5jk8xJo5GV0f/UGHzA575z96s4eJa8ZWFtYcRwWlrqdvF5cF'
        . '9FGIkuAMcqyKByo5PV1wpHVQxLHeiymSN0SivLyWcMWeJ2uN2q+T1/18t0TonHw0kCDUlAeNTyzFebmAxsVPQn16e1S6HxQ1C9jXzfINpGoJLXDKMZxuQOme'
        . 'uc/nsKpbXOf4mVZ4wJVkIIAO2Dg7n7flRFlqktkwaHmGR67jbG3ptWRkannwldlh5IiFSi1eXEWqWdzY2rxS29zPOCH8osxfPXDHIBGQPT33qn+JpViklSOD'
        . 'D8xLkknB2yNycb5/U1t+LJx5snnuJpAuWbB7nm7dxjIHXG9Ri4u/PlYOuCD/AJpaKE6tRR83tJgi7tvJVqeGf8z1vh3VdO0rzp7/AE1zfiOHBdYGwHcDIJCv'
        . 'yAgED8QHbepZoXHt3aubXVS7ythRcSTuqxEAfM8eDggjopU777b1UXBvGF/wLxFp3EGhtEb2xk5hHMvNHMhBWSGQd0dCyMOuGyCCBXWOp+H3C/i3w1a8aeDZ'
        . 'eA3Vson0aZ1CW9wg5Xtlf6kdPlAUjlIZSvytsDKiLWumb9fh/j9EhidqR4srcXJ9w+67pt0d5fA+SUWPGNpNzSyqkU3ltJAtwFzKGwSyLlj0A5tgd9xuKbOK'
        . 'ZY5LER6dyvDajLwW0HnKd+ZsxgbkemVBzjsKrK0g1Czkubax80eSFV45FGYj0YY3ZWONx039qW63xG0NtGkssyRmFl8tgyYIOVAGSCdiMbbYINZLcku2O5XS'
        . 'Hs5sbtbCoDxfoNnpYMYb4m5iWOPKjJT5BgHOATv9OAQBuKrK4XDnbOD09KmXEusteJDG8oJQZKxgAK2/1Hqx36knrjNQyXcEA9Wz0rexQ4N8S5ntKroIlcOw'
        . 'J25RvjrihqxKqC2cDG/p96Bz+Xg7HHsKJaf6R9OOg9K0WglcpKQNkrdv6wM9s7Dv7fvQJZhG6xjf59wO++aSm5EbMTue/akiXA8wvn6BkfftV2xkpF72jkpb'
        . 'LceZfuVPNlzgn/vpik1ndQzcQXFxLNEIVkPIXP1Y2GP0zSITR80nnKZMoQuH5cN2J2OR122+9axbSjE0TA9mSTB/fINOxtDG0sLLc6d3h6KybQCeMfDkTADr'
        . 'Geb+1GhWyRjcbEdDVYfBNE3m6XdOzD+kfhyD7YOD+ufalMPF2tQnEl/LOqk/LcfiY9eu9D7lx3aQUoZAw1ICPVTXU43ETDlNJtLiZXAYYqf+DXA+oeKul69q'
        . 'N8TY2GmGKCOS3IzcXMgLKgVyQQFQsQozuPWk2q8PJw/fNbNPHcOu5QAxyKO2VYY3+9L6g1xadimu7L4w5u4TGA2/pWcjDpkUuIikjfyXDFd3UjlZfuOopu+I'
        . 'CswPUUYNJFpQuF0kGqK5ifC83Xv1piFnNgfhsfyqY20kVyxjbB3/AFpxGkx46foKu2PV1VHSADhVa07hOYowHuKTF2lffcdOlPt1FH5IyQTjpnJpBFa5AwB/'
        . 'eih43QaIQLciIbjlI6+9L7drjU5/hdKtp7245c+XChYgZwWPYDONztvQrTRnv5o4Q6Qh2xzyEhUHUscdgATVh2t/pvB3C+n3qae8Eepq8loqSfi3KRu0XmyM'
        . 'ehLo+wAChQFGSSU55+6bbRqPQLQxcczuomh1KadL8Prp0B4gujHLu3wNoRzY9Xk3A/IfnUp0rg/T5r20sdB0uC51Jwx8uNSSEU/NJJIxJIG2+2SQAN6hNzxr'
        . 'fvFIocQo5yUiXGc/fcn7nNdL+DXD1pw7wsbmb8bWtSBOozkZZAp+WBD/AEqM743Zm+2MoNysl9TPoeQXV4GHil39uOwOSd/8KN6lwi1pYJBPItyFRpjBEeSG'
        . 'KT/VjcM2AN/XGKpvV5Xtb1xch0C7jA3Jzkda641rQ4rjTWV4PNVFEoVXKqSCR9LHfHL36ZGM9ao7jPgNhvEjecoJZQmWBB+o9ipzjK7evWtE4zIWgMFBdHE5'
        . 'sg0tHCjHB/GV/HeQaeVe7Nw6w20QRSSzH5UG2+Wx7Z61by3L28wSZ1kb6pJNsM3U4I2x2Htimr+GvwsuNY1viHW7yMsuiWrW1oc5DXk6soYN0PJCJG9QXjPp'
        . 'TjrtpJpaTxiLknTYoRjlI2xXL9qTF+mB3unf5/65WphPjMzwBuygfqL/AJ9V0V4SeL8MGmroupyiMoVW1YgAYPUVc2qXdtqNgwGG5lzksMbb151DU5LFi3Oo'
        . 'kTZSuflPUd6tXgTx65IUtOJWLsByrccmw2wA2/vgGjYWbJHH3EvA4Kwe1f6dinl9qxdnXZHx8wrE454H03i/TH+NSQNLIF8yOHHkkZKkb8zlsY22AJ29eQuL'
        . '+CtZ4YkCSgz22C0UvKwYDm3ypAYYzg+hNdY3PFEvEUsHk3XmW0SyPbk3CRBAEIyucADfrnOWA96hPFFrBoRc6zYWcJlhjjguZl+IaMO2TyqObDnnwcd+hPWm'
        . 'jG2Q6gKHmmYXSwxmJzgT0HX+fz4njzVRJHcupfLKQSe+ft+dMcr53q0/EHQtK867vdHuhGkaxiRJCG+bHK2GB+Y5GSQuPmG9VPOCjsDTsFEUOiVnJDQStiTB'
        . '3pVBJtvTaTuaNhkw21MuZYSsORpep7odqvFKDSzMsWqBC1ozk4ucD/yiegYAEqT1xy9eWozqdu9jNJHOrIUJAyuM4oq3naJ0eN2R1YMrKcFSOhB7Gkeq6reP'
        . 'cSLe3Etyx3zM5fIxtud6XjjJfstPJy2xw6nJLNdHP3oEU2SSOuabnm5mJz9sUOKYAHfetER0FyAzS+SyU8+ceXHTrvUt8LPF/ifwb4m/nfCF0pjnCx39hPvb'
        . '3kQOQsi9iN+Vx8y5ODgkGFWENxqN1FaWiGa5lYIiKQMknbJOw+5OK6w8Kv4S7GTToNZ8QZP5w7EH+WW90ba2i2yRNMBzucdkwMjqaCHNiO/KbnDsuLixxZ4v'
        . '58Wni+8ZeEPFy9TXNMij0/V0QJdWUqctwi5A3C/LKM4AdcdsqucCBcey2beYI7q0DdTGz/OM9sdavfiThqz0vhh9K0G3sdC0dV8x7fT444o5jj6iURWYjHVs'
        . 'k1zLxAtjZzzW9raSL5ZyJHZSWAGSwAPy9sZJzmuXngiflGRg0r6d2FJLD2c1kniLdtroDpz1+Sri+SRmPlIzgHsM0z3LXEO8trcKPXyzj/vapXPdxq7ciB43'
        . 'G4LYbvnft1pTHqsc0DB3hM0sXIQ0Ycu3MpULzfKu+5xykb5LdDsRPLRxaxM7HEriRJR9FXEl7zE4P3or4gkHB+9OuqW0PnFJRyuZeUsQMruR9iKZnk5U8sRr'
        . 'nPVTuT9612U4WAvnuSZIpC17uPmtGbmO3SgPICCEOcUU/m83Kw5B6ChRRHm2GaOGgbrLMj3nStiMkZxv3oQXfpS5IfwwSKKlj5CQBQw+02cYsFpMBymjmijv'
        . 'dp38ub+mU9Cewb29+3uKJO3tWc2Dg0QEjcJV7WvaWuRMMlxZzK0Ty21xbyc6MjFWjkG4YEHYggbj2rq19S0rxs4Wj1PSprg8Q6XZ2y6rHcRCLluHBDGMqSGj'
        . 'ZlYg7YJ3A2rl6SH420klTHn2igv6tHnAPuVJH5H2q8P4SdV0/T+NOKjxDqNrpmknhid557ucRRoy3EJQknYnJwBuSWwATXp294zUOR+UjC448ug8H+BRGFzb'
        . '3ur2N4wSKxTlgldyskNx5TPgDujGMoV6ZdTjIpOZxd24nACuG5XA6A/+1N/EvEsOoa5qo0MyXyahqRli5I2zId1jCg/N0JwMA5PTalCWVzp8Atr9Ql2rEzRq'
        . 'QQjDblJ9Rjf3yKq0aF55D9/JbtZjDc9SAOualKXw5B83Yd6iPlESAkb+tOyBSinPYdjQX7FFjaHBNa2PmSeXGp26Ad6lWh+H2o34Di0dIzjDMuM/lXTGm+FW'
        . 'jafbwyi3j2A+YjqaUalHBp6+Tp1rJdSgZEcKcxx7+gqxaHDxupRpcw+EWqSTgG50DT9Ru1LNe/BPFaKEyRI7IpONyTyFwAN8n2qoOI7yW70zRBLKXOn272WC'
        . 'Qd/NeTOR685O/vj0rofX9avtTiks0tJ7SXKlJyCphkRgyP8AdWVTj2qD6np2h+IU12L2aPhjjPmK6rps4KwTyYz5sYVSQh2YOoZhkcyup8woO0RyAt3b+nPK'
        . '2Mdr3xFp2d0Hnxx8duFVfCEMd/xNp8d0yiONjKeY4Usoyin7vyir50bjIadcvZyMxjd+dfnIZST8xx0+/eqcvvDziHhy+VRp11dpLF5sJhjEpkiHV0aMskyg'
        . '/wBcTMB35TtR8euw39kslxKTe82PPx8iKBgc4xuffbHfJOKFO17nh0Z2XVdjywxQFsnvE2R6BdEDxR+KMkPmB5FjCKPlHMfXcdB1wDnPtS1tUstfjZrmVWW2'
        . '+ZVLM3Im2+cdAOnqSenfmma9mtnhiMrGJ41lDITuGAyQe42x/wBmpjw9rk2oX1hYIW8qadVDbBhHvz5PfK8wPse2NzSZJjYQ5buOyOd2qMLvzwT4dtOG+Bre'
        . 'zlRfiLpf5leBR1lmwyrjtyxpCnr8p9ar3xX8MLqaJ9Ssj8ReMWaUKnIJDkkYHQEA498VI+DOOFvY0uoXIEzhuXG3L/p/LoKtSa8t9YslNu6yQCTlLAgEbf71'
        . 'lCOPNiGrnouPdLl9kZ5mO+o7+Xx9V5zau0luQknMjgMRlck9dvbFQ24vpIyDgqc7EHpgV1z4x+EtvqHPe6ZGLK+z+IpGz4HUgDf8hXJXEOiXWlXz217CY5Fc'
        . 'lsb777j1FZ7G6X6JF9AhmjyYRLCtWPG+p6M7/C3DKo6qcNjqMDIONif1p/PidHq8Jt9TQCOUKHJO6kLy8wII3xsM9O25qs5l5TIJM82d6bpJPU1rMhbVNWfP'
        . 'PRtwVt3+vHWbS5PmWnxMtuWaCdy3kqH5pMMAuWIRWAJO2yjJqntS5FupRDMLmMN8suCOceuDvRsOoy2cyyxNgr2JOGGeh9R7U2yzEkk43J9qehi07rncucOu'
        . 'kEt6EfnW0fH3pOXwdq2r7705SxxLunSObbtSPWjmGGZd8HkYj0PT+1BWTA96y5fzbK4jO/4fMPuN6oxul4KZyJu9xns+HqN0yeZmlFnDPe3UVtZxNNPM4VER'
        . 'eYkn2FIg3XAqVcH6m/DeoR6nDHG90qt5YlUMq5BGcd+taD6aN1ymI108gbe3VWTw3wenDs5t77Md6MGdy6qVyPf07e+Nu9d6eBl7Y61wZbXcTqfMkNnco0JA'
        . 'S4TBKlyPmLBlfbsd9815xw8RX1/qRvLyaW5uJZOZ3c8zMx67++TV3eHPibqXCF63xUjDSJuSW8h5+Z+ZBhJgo+bmXIBx2Ptmstj4Y5C93qvpckDsvAGPEQKr'
        . 'b+fddv8AGHB8c0cjL5RZUZlIw55l+YDkxjGw7VzB4n8A213FzRlGuwpZpHTllyebBJG2MY27k9sVZFp4y6bf3sYGqS3Wmy2xLsbX5kdmXlDcxzt06D86bdYh'
        . '0zWeeRby6aM/TmLYb+gPtik8x+Pkf+sWfkm+xYczAIbOTXyP2O3ouKNd0q50y5aK4TlPZl6MOm1ME00itzy/OQRjmGRt/wCldj33AekaimNSWZoTlWPk4OOo'
        . 'Gc9fv7VQXi1wjpXD92p4fSZbeUZVJJA5UAb7+7Zx2xVYtTANQWjm4/fBz472VOXkxdcN26U0sSc53pyvlKltsU2ODk1twgUvlWe5xkNo2NvM+UnfG2etHwpv'
        . 'SAEqQe9OdmpnRpPlHIAWy2M74AA7n7e9WeKGyXxnhzqKeILORrIzCGQwhwhk5DyhiCQuemcAnHtSS5tmVQ2KkOi6YJ4ZBfzx2EGOZJbmURJn1+brtnoCa1qc'
        . '+gQhUjvpr04+cWtuQFPpzyEZ77hT0rOa52ugF1Uz8ZsPjeAa46qFyqBknoKMh026uYvOjhK246zyEJH/APk2AT7Den2G9IiJ0nSLaFSApuJoxcOfcNJ8inp9'
        . 'KjHrW7a0t9QulbW9Su9RmDDNtp8fxEuPeRvkTb05selaDT0XHzPuyNgmOKaPT5OZGFw4VlO2IyCCCDncggnsPvS7TuHdS1lLdY4PhbJ2HI3IEDY6soJBcgf1'
        . 'ZwO5AqW6Zo5jmiFtpljowZ4ws10ReXJJbAIZ/wAJT7hBjGe1Tzhfh+3m1lbdoGvHs7hrm8mnkLmYRyDkXLercvX1G1EcSxqUaO9dZ4TPpOgWvCE91bWNj5Oq'
        . '2yeVLfzPzzKZEVwYx9KHkbqOnNtk/MGe9s/LccqYUdBjbFTLUmjudd125EqSm51S4fzF+liCEJH/AFK2/fGaZ7iRCcY7DFDBAFnlS5jnO24UUmQKmW2we9HJ'
        . 'MORfn7U4XNmJdl39s0FdPUADB2HrUOcTwqaHBWFe+Nmo2qBZQ5dflMY7e/SpN4c+MFneSXcGqiSCZmDrM6HlIx0z6j/NUhBqEdxIZLpQTmproGt6Zp0TBkjI'
        . 'O5wB1rKGY6OrFlbJxtYNOoKwtb43sL29uri3VlgUkYePBfHfHuarDi3V9K4mmsf5jI+n31syraarbEie2XmzvjHOoJyFyCNypG+dazxVBcSN8PGpHbaoZczx'
        . 'zMS0anI32xmvMmfeoq/dtDdI3Vk6f4ra/wAA6nFw94mWVnxFpRl+J5zGGhuiRyi4KkBWfGV5yoceoIzV/aF4WeCvj5Zvc6FeXOga5yDzYJpy5+nqsjHmddv6'
        . '2bHp0qp+CeFbHxx8L5uG7iTyeKeGpsWVzjmLpMieQfXDLEY2HTIB+qqCdOI+ANfkgWe60XWNPbDBJChG/VSDup/Q061kWoiv2+yH30lbuN+fP3vn1K6d47/g'
        . 'p4/ika+4Z1WDiS1jjHkpJKARGOiJjAx6AKBVZ8AcI32gcetpPH8Y4WuEsr6OOTVGFtGs/wAO4j+eTC7sRj17VLOBf4x+MdFCQcQ2suorEw5pLGTkYjAGTDkK'
        . 'TgZyB/vVkav/ABhaXxJYiK2vdMN4i4bT+ItOJil78jH098Z+9Anx9Tdtx/Oq1cHtOeF2nUPUen+lXuh8fycNX4sbswxRxuVZlcMOY4IHMDhhtsfer44V8UHM'
        . 'EQhnUhzlgZDyuD0wfXAya57v/HzgO8upYeKPB7RLCRUC+bw/ffCEt3YBPkI9M5pLofHvhpPOxa44q0WMzZEXlwX6LH2A+hi2fttWQMCdm0ZC6WXtfEyxU8ZB'
        . '68H7Lsi81vT9egkFzM3xHNzFFb6h96pTjrhGzvI5i1tGyAEnlGWycYAOx9t/U4oXD2ocBXwhn0/xKto0Xflu9MuLaVSO+edx+m1TR+GdN1SNZdM474f1EyIw'
        . 'jU3iqO2OoJ267+uaibCyZB4mj6IGN2hh4lhhcB5EELjHi7hZrGeQW7GQLsQc5z6dKr64Ro2YOCpB6GuseLfDK7mS6ks7vTbubnLoqXMZVtycl8qBn0wTXP8A'
        . 'xbwlqttdFbu1WBsAu5ZWAP8A0k4FGxRNH4ZR9UXKz8Wdtsdv8j+FX0smNgdxSN5BT7Jwzes2BNa7nG7nr+lJRw1euTiS2+/mH/atthZXK5KeVzjsmgvQlcnO'
        . 'cU7pwjqLkASWm/rMBTjp/hzqt+zBL3Socf8A1LrGf2NWMkYHvJUF98FRnzMd6xpcRS5Ofkb+1TqPwh1V25W1fRUbGcCd3/stJ7jwvnhVlm1/TBkdUWVtvX6a'
        . 'oJYr979VcmYg039FXMEYYgt0G9OsL5OT0FO17wYuntvq0Nxg4zFA3+aSjTLeI5kupGx2EOKM+Zj+D6FKYsb4OR6j8pXZ3jIfwyVHscf2qdcPXT3Etq8JiEiS'
        . 'heaaASqvmKVIZH+UgrzdfQbjaoTZ/wArQ5kXUJ8DJESBf8GpDbcQ6FaKnk6HqEzp0aW8YY+wAFIkeLgrq4M+NjPGVcml6JBoQWO1MxgIzK7PzFypwcgbbZzj'
        . '0PfrVhabqMVpKtrLMSrEBlV8coYltySMYC9Nt+vWucX8Vb6TDW2kxIEPy+ZJsB12BON/tTTeeI2uXXmyLJa2xk+srNu2+d8bn1qe6bVNbS0Gf1Exg8RLvour'
        . '9Y1EQCOWK7jWMqpErRtGGPMQCWOVBwCN8b+u9Uhx7rGnXlu0dxc2ZnChk8qYOWBY7EdVI/fbAwc1T95rVxfq3x+sIQDkIqvIMnr9R2NN4a1f/wDk3E22DyRB'
        . 'f7ZqDCShu/qfw6WR/UkfsEZfxebISpQAnqWxTabS3X/4i4PTOI0z+5p1t4bcczR2EtwR/VJJyD9TS+FZ4ctbabaR7j5mQy8v54wPzplhcwbBcfkzNyXlxI38'
        . 'rKYYLeyYjyLee7fbCOxIz/01IbLTNYCPIkVnocEaczSXEkdtt7Z+ZvyyaedP06+1VWS61aWJjtHDbQrGWUDJPMdgPzo08I2EMofMl9IQeaSdSyAj3OST/k7V'
        . 'UvvZx/dBawjdjT6D8lRrl05stcX9zrFwUUiOxjYgZ3wzuBj8gd6AZ5LbIsrK3sAQeV5//EzAZ7bcoP5Cnu95kKqnIsQYAAqApH2HamXVLgPOFDHOADgYH22o'
        . 'jAw/FCcZh8PklmhafaajdO+uSS3pCMyJLIyoz9hhfc9M+21S231aztZlitIkjtxEoACiNFwASSqnGd/U/mTiq+hufJU8g+U5+nbJ6Ue91IGKBmJ5MZB6bkn+'
        . 'wplrqBA2SpZuCd1P7DUYrzUDdl2e6FwJiXfAHKAQFGPXbGOlT/hS+h4esr29k8iR47G41CUlR9UNnJMsYb085rdDjqzkdqqjguBrq7uBBGWuWhCQnOyOzqA5'
        . '+2akvitfxafq1zYaZk2ccUGnwANkSQw8nmPnuHePPpggdqCXNJNlFo6Q1vVM+npc20FvBJlmjiVCc7lv6j+ZyaczDysA43/xURtNekScF1kIPU0O/wCI55JP'
        . 'wlYDH1etKuBJ5WiJGgcKTmLZmGPlBJOPWteQg69ftUXtuIZhA3PzBsb+po0cQMRvzD/prwB6le1RnomfzRRkd1y9AKta64e0TTYPLuXQOowcdarLiOawguf/'
        . 'ANvYMucHBrLhmErtIaunyuw5cWIyF4NdEQ918uxpKs+c5OB/ek6yrJ0OPYml1hpk9+/LDj3JNNEBgtywBG+6pPvBXiFf+HnE2kcQ6UzsbV1hvrZW2urbzOfk'
        . 'PuN8HsVWunfFzhng7xf4G4e4v0zUFtJ7m5Wwj1JYfw7Yys4iN0ekcJlCRs5yEeZc4BzXOEXh693pl0sZLXgjLwjOxcb8v57j8xSrwX8bLvwk1m3MC3M2i3Sl'
        . 'NTtOZXU8xIMkasCMlCAyMCCQfXAPjTRZTSGn3SqZET46dW5+31UH1PR9Q0K9vLHWrSSw1CzYCaCRCrjBxkeoBHWpRwZxZBbXMMOt21jqlrzgGDULRLmJxncY'
        . 'YZU4zgqQRXXnGfhtoPjxwPFqfDuoxR3nyNaaoluZijDGQ6L85VlBDLksMkgHHKeOeO/DzWfDzVvhNaRXifBgvIA/kS9vlLKCN84BAOMZAO1FZIa3VQ1lltdF'
        . '01w54K+DXidbf+Fi1XhDUFOXj0vUCI2J2yYpxIoG4PysBj0xUE49/g51fQnuJeGOIYNVCkssWoWPwrMo7LLC0kZP35ftVY8K8cXehzW8jXEqPC+Y5kzzpj7H'
        . 'ce1X9o/jnp2t2UNtrRit52VRHcJI3lM42OR0UnbfcE0WKUPG4QcvDMLtUbtiuRtR0nVOG7+e01UT6ddQnDAz/L9w2cEe9LLDiPXbcf8AgtYuUiPYPzBv1Fd8'
        . 'eGXBPBnFnDfE3EXEcdpc6xpxm+AuL+FLmG0xEoWQRSAo7cz4wwP9OMHeuRuOeHrDQr22m1jR7eyg1FpHsp4LYRRXISQo5TlOAA4Ix29N684jXoq0hHO+juR9'
        . 'VCLjjTiMt+Pew3Hu1sgOPvjNJLjjHWJhiZYG2xsuMinHU9I0mRXeyMkQGSAkpUjtuOlR6bSr1Ukmt0kurZMBnCfMCe3oT7DeiMY142r7KX5ErTZJ/VAk1W4l'
        . 'JPJyseyttRJv7jPzRjOPU0FfxV/B5ZATj5DuPuKJY5LbEHPeriFo6IXtL/NKBe3A6QIQPejxqt0pzHbFcY35s/nSJcgn0o8ZEfUgg1Uxs8lZs0nmlg4g1ZiF'
        . 'zsMEYbH57YrBrGr5JMhYNjmZ3JH96QquD1/alERTq2BntVSxo6Ke9l6lDbWdTi+V1QOTkHBJz67mjE1zVojs6LgbZ5SfvWllUMcjcbnakcjEF2BGOvf96roj'
        . 'O2hR7RON9ZTpqHFWt6uka3l7cuYuYB2nOBkb/KABTMzSOS0k8pP3omW8ZCeTJ5uwHU1oGZ2UTKY1bsDvTLYWRjwtAS5yZZD43EoRSIDLsfu74rBJaLkko3oM'
        . 'k5o1ba36qqrjqW3rarEoYojyKp+YqNh+vSvAjilW3E8oMd9ApwsDkdikQFOdvKJ1542PJ3PcfcdqFpqWlwTHEoeRtgr7En2xsPuaXXMNokyrpJk5TbxmVpAN'
        . '5CMkD7Cqd5Z06VIFDVdpzt4YltohEVcuRluXABJ9/wDFPsVpaXLNFFISs8QSReboRuMnbfPaonpmoyWskiGKN9ivzDOfanOyulW1uIpfw2Y5BwDv/v2/WkiH'
        . 'g0VrMdGW2E+W7LY3kNqUiZQvKh5gvMexZl3O1D1y9itooklYyzYDbYCgjYHHX9Tn1ApgjvLO2tpby7uY7fyIycgHJbOFVVHUn0GPUkUx3OpC6dJ0b8N0BHMC'
        . 'Gx227dN6C2IvNpl04YNNoOqatcz6hHCVxB5ZeR8HPfA/XH600TMXiZQeRiMZ9DR0lxhXdiSqgtgDOcUkEjOqmRQjkc3LnOM9B98YrRY3bhZUkm5F3aM81LeN'
        . 'B9KRID7nHf8AMmjopWJ5yOVmHTqR3pGGWRTj51yV+YbHHpR8bhVZiwbsTnv3ommkEPs/BWN4a89xLJYQhU+OuLdZp2+Xy4lfcZJwMlwSewXPrTNxlrkPEXFG'
        . 'q6hp5P8ALnuZE08FeXFsrER7dsj5sf8AFRRujpXD8FlG7C7v43aZVIxFGxGzb/UVCjl7BjmmYbHA2wKTleCKHVORRuuyjFdunp3oYkb/ALNJ89+u9DU49/Sh'
        . 'Ao9fFGh2rXM/+qs279a3tRGgFCNhL9fXWru7lZ3kmUscYpkXRNQB/GglH/MuKedN4xl03lDxiYL+9KtR4/N+Avwixr3JbNKt7+MaWNC7KV+DM/XNKb8kzJbC'
        . 'NCj45wac9HGoQyg2UEkgz2UmpBw3qPDfMkuoiMyA5IYHrUn1DxG0LT1xYWwk5RjPLgd6jQ6VpBr6plz4Y9Jq2/BKuG4ryYCTU43jRSO5BFV34n6NYWfEEmoa'
        . 'NKBaXoEjRKufJn38xfYE4cdvmI7Us1DxTuLgPHbW4jRtqjEt6dWLiUY5v2NK42NLiyl5Gx5Rsibs/tDG7qH3rsfP8fzopf4V+KGoeGnFOm30Wr3q6TBIZpre'
        . 'yUyRXCuoDxSQM6BlcDlJzmNgHTJXDd1WUXB/j7wis2l8t/b3MbF4wBzpgAkFMj5h7YPXHSvNSPSpjNNbu3kmBwHYjm5Qd8kDfGN8jPt6U9cF+Ieu+Ht3cXHD'
        . '2o3FitzG8Uohl5COZSokRv6JFzlXAyCB9q2C1sgpcW9joyX8H4+Y2P8AlWnxX4TanwVxVrkdtoetfyrS5Wa3uJrdpILu2BUC4gm5QrhWdA0eS68w3bDhad+P'
        . 'mtZ5vh5MROxypHynfsD0ruXwr8aNJ470K10TX+IBrOqRFHnuprVrUzkqMNNASU84DKNIhKthWDZLVBPGv+HC2uTPrPBvLBdyAymHkKLN1JGOhI33XO1C0CKQ'
        . 'uRmZUk2KInjg2PNU54Z+Meo8ES3kUQS+0++Ty57SRuUrsQGU9CcHof1BGaefHzxK0vxK4L4MXTLa/Nxo2mpa3Vu8WIbSRSQ0iEHAEmEYncnoTlRVJanYXWk3'
        . '0lpqMElrOhwVYYz9j3odpqctpIHV5FYDCuj8pGev7bYpoNa46uuyxj4SaHSk3R30wTllYseUAHm/f3qwODZBqfB/FYuy4gsLSMRbkDz5JMLj3IU/kKiMiWd4'
        . 'xd0Ns7bl4AMfcp0/TFXX4LcB8P8AE62eg8Vao1vZT3XxjwRsYhdEgKnOw3wqk4UHPzHevZEgjZZQI43E/Jc+y8sU7uJVQ8xyObc+m1PycNcQ3MC3UWhatcQS'
        . 'AFZ00+Xkb35uUCvZTgbw44I4NsIDwRw5o2loIwBcWllGkj7dWcDmJ+5JqGeNPG2nQaS9hAsN7KMlzz7LsdtutRPMY49Qq/JLRAOfS8o14N4icZ/k14oP+tQn'
        . '9zSqPgDiYp5jaXyAdS06D/NXFxjqbJLM9o/KhbKjpUHOu6iyESTFLdiELHct9hWaMyV44A+61RCxvCi7cCcQAEtYoP8A+wtJH4e1OIESW0akHoZ1qVNd3NzI'
        . 'VtppXkbYDHLmk8/C+pc+J2QSHfkLZI/SoblkGnEeqv3RrYKKzaTqMYYm0cgDIKsGH7Gm6USqCWikTBxkocCpU2gyIcNe2kbE4wZOUj9qFHw7czyCO3vbSZz/'
        . 'AEx3QJG/U043JaOUq6InhOvhhougnR9f1zibT49UaPFrp8czERRvjLyMARzHcADtkn0qvbqRDcXLQxLGplYxxpsqjPQelTZ7LiHSrNrWPULM6a8nMwco8YJ/'
        . 'qORkHaoJdufiJcyLIxYlnAwCcncUzA9sji4Ou/RKvYWAAhFCRyTkMPtS20vmt7R7doBIrSCQE9jjG470gHTrn962GIXGcijlocKKhjnxnU1OFzdfEXs89tCl'
        . 'lHIFAjj7YUAn8yCfzo61uuRWjU7Hdu+TTUHz1OO2/ej0kz6j1zUBoHCgkvslO8V4UYEgB8dMbDfbNL7V1klBmlB5up2zUfj+g46dck9aM+MkhdBDFz8wySQc'
        . 'AdDv67Uu/wAWwTcQ0i07amsDWziRA/4gJEoONhucZ9T+9MjXDG4EQQlcBnfoAMbAftR11cPKTzHoNu2BnakUjNyEI/I2PlO5x60SNukUqSuLt0cW27iiS4JP'
        . 'IfnU7+1Fq6KORXLMoHv+vv7UEMqKAu3Ukcuwz367/wDoKMAl7R6ghcAcv+nG2B7U5aJaQXN0I7mTybK1jM1w69VRew/4mJCj3amVJPLHKhJx1PqT/mnLTY3Z'
        . 'JMviHILKOjMM4z6/+v2oEpph3TGOG6wSLpL5Z2uHaR15Ob6YwchF3IX9+vetYz09KKzgnP71nO3YZpDSei0S+zyjRsK0BnpQQx61sN6g4+1SAV6wjRk0Zt/p'
        . 'J/OiFfrjr9sULm/5v1q4tDJCQwckgxy/rRwgjXcgCm6NJQduYe3alsVuzKfMfJqXt0/8lv4splFGPcea21wiEgHP2FFGZZzj5iKM+EjBO5H50JYlj+kb1ALR'
        . 'wi6chxp1aUkdWUkKpYUKJ5ozlAwNLBRi7jtUmTaiFQYLS/W1xB+CD513MVedixQYXJ3xSFfkm5iwRtypaMOrMOxB2Oem+3sachQQqxzeYNlZSkhUkEL6+49R'
        . 'VY5KKLlYpkj2N773+qb7LUrnTbxLuwma0uY25leI8pU/YbY9uldB8DfxDXmtT6Na8R8Uahw3JpweKTybL4yx1NGKkR3Vv5kZBwCBIhLpnK4I5hzxcwrHcsJG'
        . 'KpykqygNk9vTb3/vSc3EkqxxuxaNMhVI+nJyadYAd1zWRqaTGdgF2nxlwfw14l27yYiS5+ZkYMOdQTnOQMN9xsetcy8ZeGWscIzuWha7tM/JIhBOPypDwr4i'
        . '61wpLGtpdPLAm6ws2So/4c/2q7tF8UtJ41074a/YQXBGHjZAVJ7Z/b2oXdvj3aqh8cmx5XNQk2PL17inq14nvLMW7wHyp41AVx122zipZxzwdbJeS3FqyQox'
        . 'yrDAVvf2/Oq8urC6sJmhuo2Up15d8f7VfwSinJfxxE0rd0f+JTxF0WNY7DXIolToTahvbfemnVvHHjvWA/xevrKDuR8Kij8sVWHmcoOSce3WtyrJFIUmV45A'
        . 'N1cEH9DU9zF/1CGCaJUgn481yeZvibqGR27NEv8Aakg4l1FiQ9whP/2htTJzAPztGjsOnNnb9DQQwHU7e9e9nh/6j7KBK8dU+DizVbUjkvvLP9OIlB/tQJ+K'
        . 'NZnz52pTtzbnGB/amdJSBthvuoYfvQS7HJJySc5J61Ix4udI+wUGZ/FpYb+4fdpnc9ck1oXk5/8AmEH1FJMkqeXGe2RtQgxA3IJ/4RtRNDfJD1k9Uqe9uGUq'
        . '07sp6jm60n2znuaL5842rA+/rVg2uAou0aOhwTvWlJ7dOu9Az9j+VYHIG3SppRaMU4YY7DajA+Btik+c7mt7+/67VFKQaSxJvf0xRonKfKcYOM/70g3weRuQ'
        . '+oGa2hCrgFjgf1b5oTowUZkpbsEa0jmSRmccucJGvQDP96KaRSSqnJXGfQUEvzM2Awjz8pbZj+VBLD6Senb/ADRaCBrQgzKfk5V3yTjv7D/NaJBxg7dqATkk'
        . 'MAR79KMhjaZwoPMe9SaAtVaCTQR1vCZnAwD3PoBUijijijVAcIo7jGT3NN8Qis4uuT3pNPdmXm3wvris9+qY7cLTj0wt35SlH55GwNqPX0pusnLu2M8vbanR'
        . 'U+Xf+1Q+mClDHaitYFb5eoowKcbjb2rMdzn86DqReiAFxnArdDCb9Ca1yez1ayqokAZ7VjOF6Cg5yaCCWHaqgea7IvrYIXNkbVofNsK0Af6jkUNRttXtgobZ'
        . '5Wxheu9CH6VgAAy1aHz7AfYVXlGHhRi4zvTjYW1tI2biTkAIxSVYViRmm9KDDe20eWfnY9higuDnCmp2J8URBkI+pReuaetskpt8yw/UFXqnv9vao8AkczCQ'
        . 'SmLAB2CtgjIO4Ip6n1FXPMgcMOgNNbxGWRuRVjLbEZOPyx0rTxQ8NpwXF9tOxpJdcDh8vx+PsiYfMIk8pA/KhL5jD8q/6uhx9+1AVzG6vGzLIpyrKdxQldre'
        . 'RHjzzr3cA7/5BFEdM4/anQFzmoqZaD4i6tozoRcyKUBEciMQygqVYY6EMrEEEEEEjG9OK6lZanaLArxNHyfIJF5jGSMEA9QcADuNhjvVeE7ZoUUjoS0bFG9Q'
        . 'ao9gKKyQjndPWq6akEs3w5H4Q5pFSTmMQyME9wMkbn1HtSPWNZ1LXtQl1DX9RvNVv5AqyXV5cPPK4Ucqgu5JIAAA9AMUv4f4nk0K9ub0afpmo3b2zwxS39qb'
        . 'j4dmUqJUUsFLgE4LhwNjjIFMXKoG7EBFwNsk14ChSqTbrqlsxsULnkCDbIcEn8utADEZ2B+65FbGCM9vXFZzqFIK5PY5x/ipVeeSsZ+Z8gKoA2CjAoIXH/vW'
        . 'EZOACT7CtDlAPygH1zVgqrBjl+pmPfIwAKzmzQQfz371vYA/Nzb9MYqwChZvvnlx2IrB+lB5gBkmsyMAg1NKloea2H3oANYD2NRSkWUZnJ7VvOM0WGx0IrfN'
        . '+VRSsjM4OOp+9aVmI+YDPoP8mi/1rXNzZB323qKUHZG8w3xg+uN6AST2HLnJ961nIIGFA/72oxY+ZSzHAGNgOtTsAo52Wooy+3Qdz6UtJEK8sOOXG5pPmQry'
        . 'RJyKOuR+9CjspJM82Tml3EHclNxsI4C3Jdgryj5qDFBLO3zfST0pdDpyr1H50tjhEY9qXMrW+6jCEn30C3t1hTHtSnnwNhQeXPetkEKc0sXXymAAOEITenp7'
        . 'Vnn7mi8ZrWCOor1BTaN+Ibfb/FZ5/sP/AMqLAzkGtcregr1BetFLnm33oQ2zWVlWK6wCkJF5++KECoGKysqiMNgChJ8x36UuheCNQWUkisrKG4XsmoXUDtaQ'
        . 'zuXcsjEjsDSFrwnKFQp+1ZWU9DI8bWuZ7SxYiA8CifJE5z9Iye9K7WHA5n6GsrKe5C5cNAcUG7tYrn6SVYjAJ3z96a7qB4X/ABAis2+EGAPtWVlVYSF546pM'
        . 'QcHIANCiyVOOlZWUU8IIO6ERnbPWsKDA5Sx9Sx61lZVKROVplLHLEtgdT2FAUqwPltufasrK8qHZYQMbMTtvtitLjPz82P8AhwDWVlWCh3C0xUMSoIXtk5NA'
        . '67461lZVghra57HANYTtk7+prKypIpQtVlZWV5etbB5c1m5JzWVlQvAreT+1bGSQM7YrKyvKwHVLLWy8wB5DhW+kDvTilovYAAVlZWZI9xJW1FE2NgoI5bVB'
        . 'gHB/KlIjWPpvWVlKEkoyzbGeXrQucelZWVVVOy0HDHBFYHUBgM1lZVgFUmkHO2Qa0TWVlTWypaz96Bk+36VlZV1Fr//Z';

    /**
     * 构建普通文本连通性测试消息。
     */
    public static function buildTextMessages(): array
    {
        return [
            [
                'role' => 'user',
                'content' => 'Hello, please reply to me 1',
            ],
        ];
    }

    /**
     * 构建包含固定测试图片的多模态连通性测试消息。
     */
    public static function buildMultimodalMessages(): array
    {
        return [
            [
                'role' => 'user',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Briefly describe the main objects in this image.',
                    ],
                    [
                        'type' => 'image_url',
                        'image_url' => [
                            'url' => self::getMultimodalImageDataUri(),
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * 获取预先编码的多模态连通性测试图片。
     */
    public static function getMultimodalImageDataUri(): string
    {
        return self::IMAGE_DATA_URI_PREFIX . self::IMAGE_BASE64;
    }

    /**
     * 构建函数调用连通性测试使用的固定 tool。
     * 只用于验证供应商是否接受 tools 参数，不要求模型实际调用。
     *
     * @return array<int, array<string, mixed>>
     */
    public static function buildFunctionCallTools(): array
    {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_current_time',
                    'description' => 'Get the current time. This is a connectivity test tool and does not need to be called.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'timezone' => [
                                'type' => 'string',
                                'description' => 'Timezone name, e.g. Asia/Shanghai',
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }
}
