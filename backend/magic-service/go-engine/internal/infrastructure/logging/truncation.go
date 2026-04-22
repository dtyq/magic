package logging

import (
	"fmt"
	"log/slog"
	"reflect"
	"unicode/utf8"
)

const (
	defaultLogValueLimit = 2048
	truncationSuffix     = "...(truncated)"
)

func truncateString(value string, maxRunes int) string {
	if maxRunes <= 0 || utf8.RuneCountInString(value) <= maxRunes {
		return value
	}

	suffixRunes := utf8.RuneCountInString(truncationSuffix)
	if maxRunes <= suffixRunes {
		return string([]rune(truncationSuffix)[:maxRunes])
	}

	runes := []rune(value)
	return string(runes[:maxRunes-suffixRunes]) + truncationSuffix
}

func truncateValue(value any, maxRunes int) any {
	if value == nil {
		return nil
	}

	switch x := value.(type) {
	case string:
		return truncateString(x, maxRunes)
	case []byte:
		return truncateString(string(x), maxRunes)
	case error:
		return truncateString(x.Error(), maxRunes)
	case fmt.Stringer:
		return truncateString(x.String(), maxRunes)
	case []string:
		cloned := make([]string, len(x))
		for i := range x {
			cloned[i] = truncateString(x[i], maxRunes)
		}
		return cloned
	case []any:
		cloned := make([]any, len(x))
		for i := range x {
			cloned[i] = truncateValue(x[i], maxRunes)
		}
		return cloned
	case map[string]string:
		cloned := make(map[string]string, len(x))
		for key, item := range x {
			cloned[key] = truncateString(item, maxRunes)
		}
		return cloned
	case map[string]any:
		cloned := make(map[string]any, len(x))
		for key, item := range x {
			cloned[key] = truncateValue(item, maxRunes)
		}
		return cloned
	}

	return truncateReflectValue(reflect.ValueOf(value), maxRunes)
}

func truncateReflectValue(value reflect.Value, maxRunes int) any {
	if !value.IsValid() {
		return nil
	}

	switch value.Kind() {
	case reflect.Interface, reflect.Pointer:
		if value.IsNil() {
			return value.Interface()
		}
		return truncateValue(value.Elem().Interface(), maxRunes)
	case reflect.Slice, reflect.Array:
		if value.Kind() == reflect.Slice && value.IsNil() {
			return value.Interface()
		}

		cloned := make([]any, value.Len())
		for i := range value.Len() {
			cloned[i] = truncateValue(value.Index(i).Interface(), maxRunes)
		}
		return cloned
	case reflect.Map:
		if value.IsNil() {
			return value.Interface()
		}

		cloned := make(map[string]any, value.Len())
		iter := value.MapRange()
		for iter.Next() {
			key := fmt.Sprint(truncateValue(iter.Key().Interface(), maxRunes))
			cloned[key] = truncateValue(iter.Value().Interface(), maxRunes)
		}
		return cloned
	default:
		return value.Interface()
	}
}

func truncateAttr(attr slog.Attr, maxRunes int) slog.Attr {
	attr.Value = attr.Value.Resolve()
	if attr.Equal(slog.Attr{}) {
		return attr
	}

	if attr.Value.Kind() == slog.KindGroup {
		group := attr.Value.Group()
		truncatedGroup := make([]slog.Attr, 0, len(group))
		for _, groupAttr := range group {
			truncatedGroup = append(truncatedGroup, truncateAttr(groupAttr, maxRunes))
		}
		attr.Value = slog.GroupValue(truncatedGroup...)
		return attr
	}

	switch attr.Value.Kind() {
	case slog.KindString:
		attr.Value = slog.StringValue(truncateString(attr.Value.String(), maxRunes))
	case slog.KindBool, slog.KindDuration, slog.KindFloat64, slog.KindInt64, slog.KindTime, slog.KindUint64:
		return attr
	case slog.KindGroup:
		return attr
	case slog.KindLogValuer:
		return truncateAttr(slog.Attr{Key: attr.Key, Value: attr.Value.Resolve()}, maxRunes)
	case slog.KindAny:
		attr.Value = slog.AnyValue(truncateValue(attr.Value.Any(), maxRunes))
	}

	return attr
}
