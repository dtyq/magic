package ctxmeta_test

import (
	"errors"
	"testing"

	"magic/internal/constants"
	"magic/internal/pkg/ctxmeta"
)

func TestBusinessParams_ToMap(t *testing.T) {
	t.Parallel()
	bp := ctxmeta.BusinessParams{
		OrganizationCode: "org",
		UserID:           "user",
		BusinessID:       "biz",
	}
	m := bp.ToMap()
	if m[constants.OrgIDField] != "org" {
		t.Fatalf("expected org code, got %q", m[constants.OrgIDField])
	}
	if m[constants.LegacyOrgIDField] != "org" {
		t.Fatalf("expected legacy org id, got %q", m[constants.LegacyOrgIDField])
	}
	if m[constants.UserIDField] != "user" {
		t.Fatalf("expected user id, got %q", m[constants.UserIDField])
	}
	if m[constants.BusinessIDField] != "biz" {
		t.Fatalf("expected business id, got %q", m[constants.BusinessIDField])
	}
}

func TestBusinessParams_IsEmpty(t *testing.T) {
	t.Parallel()
	if !(ctxmeta.BusinessParams{}).IsEmpty() {
		t.Fatalf("expected empty params to be empty")
	}
	if (ctxmeta.BusinessParams{OrganizationCode: "org"}).IsEmpty() {
		t.Fatalf("expected non-empty params to be non-empty")
	}
}

func TestBusinessParams_Validate(t *testing.T) {
	t.Parallel()
	if err := (ctxmeta.BusinessParams{}).Validate(); !errors.Is(err, ctxmeta.ErrOrganizationCodeRequired) {
		t.Fatalf("expected ErrOrganizationCodeRequired, got %v", err)
	}
	if err := (ctxmeta.BusinessParams{OrganizationCode: "org"}).Validate(); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	if err := (ctxmeta.BusinessParams{OrganizationID: "legacy-org"}).Validate(); err != nil {
		t.Fatalf("expected legacy field to be accepted, got %v", err)
	}
}

func TestBusinessParams_ValidateStrict(t *testing.T) {
	t.Parallel()
	if err := (ctxmeta.BusinessParams{}).ValidateStrict(); !errors.Is(err, ctxmeta.ErrOrganizationCodeRequired) {
		t.Fatalf("expected ErrOrganizationCodeRequired, got %v", err)
	}
	if err := (ctxmeta.BusinessParams{OrganizationCode: "org"}).ValidateStrict(); !errors.Is(err, ctxmeta.ErrUserIDRequired) {
		t.Fatalf("expected ErrUserIDRequired, got %v", err)
	}
	if err := (ctxmeta.BusinessParams{OrganizationCode: "org", UserID: "user"}).ValidateStrict(); !errors.Is(err, ctxmeta.ErrBusinessIDRequired) {
		t.Fatalf("expected ErrBusinessIDRequired, got %v", err)
	}
	if err := (ctxmeta.BusinessParams{OrganizationCode: "org", UserID: "user", BusinessID: "biz"}).ValidateStrict(); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}
