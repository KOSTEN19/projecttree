package textutil

import (
	"html"
	"regexp"
	"strings"
	"unicode"
)

var tagPattern = regexp.MustCompile(`<[^>]*>`)

// SanitizeForAI убирает теги, HTML-сущности, управляющие символы; сжимает пробелы; обрезает по maxRunes (0 = без лимита).
func SanitizeForAI(s string, maxRunes int) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	s = tagPattern.ReplaceAllString(s, " ")
	s = html.UnescapeString(s)
	var b strings.Builder
	for _, r := range s {
		if unicode.IsControl(r) && r != '\n' && r != '\t' {
			continue
		}
		if r == '\n' || r == '\t' {
			b.WriteRune(' ')
			continue
		}
		b.WriteRune(r)
	}
	s = strings.TrimSpace(b.String())
	s = collapseSpaces(s)
	if maxRunes > 0 {
		runes := []rune(s)
		if len(runes) > maxRunes {
			s = string(runes[:maxRunes]) + "…"
		}
	}
	return strings.TrimSpace(s)
}

func collapseSpaces(s string) string {
	var b strings.Builder
	prevSpace := false
	for _, r := range s {
		if unicode.IsSpace(r) {
			if !prevSpace {
				b.WriteRune(' ')
				prevSpace = true
			}
			continue
		}
		prevSpace = false
		b.WriteRune(r)
	}
	return strings.TrimSpace(b.String())
}
