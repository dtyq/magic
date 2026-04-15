package external_test

type testError string

func (e testError) Error() string { return string(e) }

const (
	errBoom              testError = "boom"
	errFail              testError = "fail"
	errUnexpectedRequest testError = "unexpected request"
)
