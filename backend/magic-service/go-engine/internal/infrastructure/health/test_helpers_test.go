package health_test

type testError string

func (e testError) Error() string { return string(e) }

const (
	errFail testError = "fail"
	errBoom testError = "boom"
)
