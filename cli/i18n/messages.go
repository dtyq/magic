//go:generate ./gen.sh
package i18n

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"strings"

	"go.yaml.in/yaml/v3"
	"golang.org/x/text/language"
	"golang.org/x/text/message"

	"github.com/klauspost/compress/zstd"
)

// the content is from messages.yml, donot change it here.
var messagesYAMLZstdBase64 string = `
KLUv/QRo5YQAmm4UGDrgWjfwk8iluwZmmGEGH0wlUNemIYYt/lqangykRdvpiLZXv328WMjtMW4k
ahW6SbBhGU+7GjHGIcY4cgFxAX0BL63ylEC3MRLYiI6JkbV7o5vUOlJ0rzj0XXGq/OVFRTF4/3i9
vMTE8NRkc7z0CfrywsDbndJm3KN/0FJesVmTFVbkxU89sY9qDspi7nZHdBqP+C3/0S9GJj9Q7sdW
jHZzFgJHKDZKknV2z9SPlaOpGWpI44uLWDJPppk0xtAT9dycw1bDYr5I/6f4i0K5c7XlEe2qqhuG
lWQyIWfNEmu+jS725WIrmX9k9ZuCsV7PWtdHSaaLNN+CTSx4NvY+8Y21htEM7bpydIfWIk1321UL
G+th2xm11bZQlWQasWYZo1lX/D5/BkcWFmWZ3adZzj+3Jo5PEw6KdcFYGKXGdgpsb7DrhLqivaMz
lm+sKsMwycTK+TvhjLOcT3XPZiuEqtZY5JEZxGLqTqIwMqCXWMydcqsH6xeB5OSRaZWLiTyyr/et
buYeqZjoF7NoBJ+tFTEVbVtOwa4sy3893SeunaCWSzOksDuD19hWawCGru6KEpkLQDUVV0pzaW3g
4uqqurRBAYFrbWvb5e5iI49OSRTvZM055VZP+YXEGAn5gZYzP9eM3jkbW1kEFVt7Iqzoi4XJYjel
zNO1oCec3bAgCufdzCdKxU+5796axJtY1msbOKHaQw/+wZ5mbM/QpaQM9WQ7N2dThx7jHPT0k34x
L8ms+sW9pNx2jFsw/oiyOnM6meUgP8qtpyRZauavpGvnHE++mLf7pH0gaf4v99uOYrhOYvA35ebb
0QiMh8UZmMRlfaPVHGMdVHTPsoDvzRvdWLhk4n7kGyRTSub/DP8UUKwPDrQLhtJWj3S3wKKmUs0v
Hm9QnyjzT5bLVIvOYZvWeYvKQliPGcq2Gkb315Wwqbv12E4n0g1bMVwu3/AHFTX5yq44U1QGkRZE
WLwiLFrUI9bTll1lHfrcG+emsQUFLplLE2iLl2ZXAs1j6mZptZWlUOEv3cCg+zmDCdhkMZHD3SJx
qg58tjUYeDifKfcTdEHnfaOpQzDsc2Dvvn7I9TjX71yvRBwq6mAvBHup1/sguZ7o7rweyPVZrue5
Psn1Oq9fgn0O9sbXN8He6PU0sCeCgWBfdKter4Q9Euw3Lko2CoAOGPKZbW7fvXkaXU1xrrmKg0DN
IZTsQ2Ra/tcHnuodlfNuaY6aqmJCRuG+FM1sk0QEjHWskJTmH/BL8YKgiFAxUc4NMF5amo3CptIX
B3/NKJ68EzJdDQ3JEDWPLk9Is4txxqMa4kwjNU9JAYmzDZP864l5lmIn4nwrIot6bIJ+R//GbfZq
mnSshv4r43ZNmdv8yxLi5LbX1ol21Vg4ka0e6J4wMOD5aVr1/u/WXBo+rPA+k5PBVJcr4ZXwUli5
6eL2oEVjtpZFzwNXzZFJVPN9csBgHBSKd8ef2xkimTi9OMJBomIHCx0Kxge2tJXFUBUJ9DWDK3Ud
9cg+JznLSaYhssHQdN3wADr9HaXMOzK5DLYhVg2dTVyVprSDgxYTzfIU2HrCt/l12dp27Sgsm205
GgCu3sI77zYTzW4a7xrNSGFXli6D7ZO2tdYsW4PJujagaZjKZSz6ZKWtmuUnnOPsNFqto4CmCfRM
v2Ivrg1oNjY20yc30X3LDPYKRztHW5XPItrd09o+4RE0zfLSW7e11WTrPePsetJbnW6TNaXQ/dQ2
mMpTzWE1zbKcECxn13TtqKzVXNW22ioyk7UoC02j2oCmVw2Y5ujbwMauLYxrmWZ5r+mWx/Ta6o6P
EpUDFK/cXU3uI3c9Mc1wdmHvczqKcf4U0dcNf28oqwdMMm2OzKOkcmnp9Pog2FMVYX2gml8s4sXa
6Ai+atLtCHc4n/f7kMXXJ3fUUERfBk5COh6/q0QUzkky8mt0/dOULKWEw/lGHiCM85QEeyvYL73e
lwxyvVKuiPh6rZfvklnka+biptc7wX6IyfXKrHnpeqeluSiE/e5931dm+a908pUvxrmeyPU919u4
3ub1ONgzXb3D14h3hHp9hM+oE9pFjjmJZkRGkiSNAUNxEBwYldGmQ2WSP/MjkawaSEMIySAogkAU
4oghhhhDBMYRIiJUQlTYBpXZJt+nQ09cOsp/KxiawKR1pt8QZSI0mPWUyzcfPcBQL2/uKlupD55W
RxXKIjG+yRK1IcwFufCNwVDbueRl8BI6bFXXDzX/4sx3FIM/eJmy/EuW33/7Jy/bttOSNwxY0stJ
U49pmEXipQjcUQ9uAorJ+rBR1FugCIMgTDPXIiuBoorWBMPRnDWEeKxmdnTaDEEGXd0eqnZkXEbz
ZmSwwkZmRmWm/EwkET4P8DMz0zWEPa9klvyWa7jdWbVvG5P0ATRc6tn4VhlHHgWlHzYRz/jIQGb6
X1DjHwIpOJmjU61KsfJbpAAiMI0S9vKHWyWu6rZSLM7BGRLjMxI6UzDekKBEMFOFO4uoclhVPKfd
lqPK8uHxkAlupDM8D20gh2Plo0P12aPBPx65Su+xn5u2shqtx5tyHpRhOoopTY77ky/KQI6CIM08
OeDUepCBIKvn5Ab5X4sdIcfqKSFH5XlkPiEhrOV9gQ8EQ1ij9Hyv1UOPV8Vshg+tO6uIHAlEp2Z1
24Yej39DxPhJHxKRs2mC4bICa4GwBKVYvFC1BVZbEYnXALqbBKot4UUsnNgbZI6dshWIvb3HFdWA
cqCqN+r+h+Bsj4VTDnq0cLxmw0hE4eVKS+JJPuAn9JG3SdRptx3vUqQkosh/KTmxIj1a6VwEQ6I+
7SC9z0RZcbz7Gk1K1Ff6P0RzcOKA2HpkHdbG07GvE2ySHE5PugB+4j2NEZv51tWU2GLKIpSeWFF4
R571M61a11CF5Hi7ml8Ij3RLXGWB4CvKU5GpFZAcrq5gZdsKg+1s/TfaUsVI5lc9aW3IWeTWpsV6
QvRbbCiw36Z6QqHMydYNXDQHAAIYixocRA/hRnDqdOjxXtUHf32Pl7axR931CTUB5WVMv2FJuNL6
A1OE+1Mt2rihnvEW1Mp6DujIFvglkY/Trzx6r46u1kntBFLbGRIjZyGBPw7yChln2qEFvar3FCjn
RXqF7jMJJqf+fz6qJROoyE413cAaqTuboBabKZGaNA8QHwITRZvs1OR4o11MEBcsu2kHt/KWznd2
5pH06CRoYNQ/r0o4JbHdWVTk1FOM/67eQSRyUOksK7JPDAMO+YBuTNZDr2q8kO84YR21TQjjWKub
eiYtY5Gkpl4X2lR8oq5AsjCxtgPXvNrc1otLNAhRvxJTppYMZCmue/i/d4AxPJFKK10jndZNgEyJ
loAEHQU+po82DaQQJrgkLUlN48gkWwQsWtJ4/dJ/bw77SODXd6J3lwbjaO6sKErGNZrchKauCxqb
IHERYE5rTETTrcOh9ehEP6IRFpdjJjk7TdHV5p1hv5opxsPjlSeRF3r/ZRMlddbqSjQ9hxQSNa03
8Yg1DBhByJGOglYFga77J0M3gVoCB/Qcfc2eou4n/mcxcb8kDQBKSkJxP9GXD7bN75F9BB8Scjoe
sDcA2A++cwWN0FQnqx3rA9LgDME60VfQWJSR8z0WmvUzOj8vybUFsJhV+FA4whWAhDqp4xD1HIvx
KdJuv6fEoZjHQbmGXvV6nPcBEziqKKXSG6lpDgIpMhROCDTOFVgbpAoxTfX2mysgvCNbsuaAxIJ+
1fwj1PQuuTwevRlseUTTHSeLnZm01ILQ1UyQOvAyow4V2jd7pSQiSZn1ATL4QdXI4IP0At4rmG0V
aUeOK8A4FJPS8glqm7rL8FmFLiQ+h5+WZNN5iTU/GzGk2DypiyUuX41kRZ/kXwzyEpRx79ZUaJnT
zeV+aV72KJQtL5spXI9GJsZI65ACiOC8ZHZa4tz5mqth84DILIxq3KcRiZzepmqs2m9ZrQh5yQqv
8NntIrWPYgj/vPUlTnx+eY/uSLNvKbypp//u6SDczRl5O3lT97gr+hAmCpv2TF9Cux5Whfo1/qDE
z13Bkm+tNHvLanEq2aXziQicPI2I5xyAhxTDBH3IuItZanw+Cj/z5jswyiXyOrdBQC5FE59fFGqo
AvGnASOwaeuvw81as4O7nVdWvc+I214PVKUSR+wfiqA0qq0h57z2NLP2DaiHprqPXSn2sbHuvRnY
iiaOoK7LiRjifKbpqopQIHV7zuP52uv4CwNLvXC/42OvePdUmq9ptIJy8ubRMC/KPguJDG+/Vi5Z
w+Iq6ogi7musbDSfRWicapeFJaLxc0x6kCIatMvCNj0kNXPVFjEahsvRUtEq72d3FAfJJBjnIcOH
qRQbZcP6UUg+oWD6OZIL9EkW7YIJqnPGdXgBMpzEYfZU0jv74mWm4X3Q5Ql6R2igV3WBm2riocsh
G8hPBm1tqOQDMtzIQBsjGFa8rCgqXWnejYi8XeRDqTXGDap4kq8WuznN1fvdgOGbweG6KoaP39Bn
ZkiBgaMmFsvw3QA4Z1DpgBbQXc5DUdyweX8HVFkH8kScO/MsMJ0un9Pg7dc8/IgAAc/AbGxidYEv
GFoX5cfcZJBDyuGKC/M17uagVVsA62XtXsdXuqTpmBx8BTttTOHfN4wHJVOhCP4rFY3sfxJTTIwp
1xJ45rpL0b0V39FD/OD+kitN2iLiqd6j6V8tjUbA4iDfvX+XMuzgmMeogOfMa/CEbxqB/i+ptMoH
sjFx4lnF50nW4fQCTGs5Py3ovSI1aGotTkvxAnnOpRkMF7k7lQHluCaVNyegXDy3NEAaVXTHZ9SO
H6dUu2pT3jPOi/KHgGOSiBf9amjhUjqZr3oai4E2QcRnudgvVpEc1tZJZXSs2O6BsMhPv/iCjdDD
K+ojm3THhOjOxU1Dbi5CXV1FJuy14JonBGG0tNe3I/Ek8ZGYjCXbfAsvdAYrRtyDBJuWoYbwOAGf
cV7dJ76W+sdYysbk9mppJMnf+KQETCqARU7h3Xbln2zuvB3QF9VvZYR5wC3aD3L2IVN2Y/HouP6k
cRn5yK4UwBNn1o4A1JR4HDB4jAVZFoXSGvZP/MmXNlXDPKS8KiBD3UJFP5WuCUc3f4gaa1fWGP/V
j9ihQ9NAjG0wVxnc24bkR8WKEUbXptMbLk7AU7XlbGdb14Yl8RpqNy0s6c/0hidFSnfPvYNGW7ku
pjEczG5dEgAtLpPnByJZs88ChBlp0/+Z0gKeMxt8dNww2MgAi44gvygMjTgpuebMsZlgpU2M8YW5
grqNeLOYW45kuvCKutWBF1XZe3YjqMsthEOCUrxmj7rkN73GHhSzU+IfhrEKyp0+XqQ4e6skx3Sz
/UJvRBxa5gt98X/2LJOTlz4uy0TWIAiQ2gFnAZWGC/7w/100hWNZZ1v1isNYCCavoRfc0tBV+TGp
S2y3BtizPd/LQ6Uvb6I2cgyF7bxvVqxFMosiGCcrQQqIGKpbZ1+x3Skkz+wGr5C+DCWwCAtFEiKb
95CcZlZnEsZ7W+DU0ZrEEqcVXE5QgKxZzy9b7KSRayN69WAS18iDl9NAt13+eLVBuaD/89htJuZG
ElY29jRGK3u5CvWLJFLwdMarahvGxzvRYDkWh9Optir1vQMvjkBjOZZ9U9wOGqCVESjanKB7AFL3
c0VE2v8MEYO79Y+E2aFQjhKWaWRnBTgl7+sWIiJFwdkVPEYdoU231zqebnYyDuQ=
`

var localPrinter *message.Printer
var supportedLanguages []language.Tag

func init() {
	messagesYAMLZstd, err := base64.StdEncoding.DecodeString(messagesYAMLZstdBase64)
	if err != nil {
		panic(fmt.Errorf("Error decoding messages YAML: %v", err))
	}
	messagesYAMLReader, err := zstd.NewReader(bytes.NewReader(messagesYAMLZstd))
	if err != nil {
		panic(fmt.Errorf("Error decoding messages YAML: %v", err))
	}
	defer messagesYAMLReader.Close()
	messagesYAML, err := io.ReadAll(messagesYAMLReader)
	if err != nil {
		panic(fmt.Errorf("Error reading messages YAML: %v", err))
	}
	readTranslations(string(messagesYAML))
	SetLocalLanguage(getSystemLanguage())
}

func readTranslations(translationsYAML string) {
	var translations map[string]map[string]string

	err := yaml.Unmarshal([]byte(translationsYAML), &translations)
	if err != nil {
		panic(fmt.Errorf("Error unmarshalling translations messages: %v", err))
	}

	for langID, messages := range translations {
		tag, err := language.Parse(langID)
		if err != nil {
			continue
		}
		supportedLanguages = append(supportedLanguages, tag)
		for key, value := range messages {
			message.SetString(language.MustParse(langID), key, value)
		}
	}
}

func getSystemLanguage() language.Tag {
	lang := os.Getenv("LC_ALL")
	if lang == "" || lang == "C" || lang == "POSIX" {
		lang = os.Getenv("LC_MESSAGES")
	}
	if lang == "" || lang == "C" || lang == "POSIX" {
		lang = os.Getenv("LANG")
	}
	if lang == "" || lang == "C" || lang == "POSIX" {
		return language.English
	}
	// "zh_CN.UTF-8" -> "zh_CN"
	lang, _, _ = strings.Cut(lang, ".")
	// "fr_FR@euro" -> "fr_FR"
	lang, _, _ = strings.Cut(lang, "@")

	//  do fallback
	tag, err := language.Parse(lang)
	if err != nil {
		return language.English
	}
	return tag
}

func L(key string, args ...interface{}) string {
	return localPrinter.Sprintf(key, args...)
}

func SetLocalLanguage(lang language.Tag) {
	matcher := language.NewMatcher(supportedLanguages)
	matched, _, _ := matcher.Match(lang)
	// base, _ := matched.Base()
	// fmt.Printf("matched: %#+v base: %s\n", matched, base.String())
	localPrinter = message.NewPrinter(matched)
}
