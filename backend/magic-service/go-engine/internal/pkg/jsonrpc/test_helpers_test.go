package jrpc_test

type testError string

func (e testError) Error() string { return string(e) }

const (
	errBoom          testError = "boom"
	errMissingName   testError = "missing name"
	errExpectedEmpty testError = "expected empty name"
)
