package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type nominatimItem struct {
	DisplayName string `json:"display_name"`
}

func GeoSuggest(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if len(q) < 3 {
		c.JSON(http.StatusOK, gin.H{"items": []string{}})
		return
	}

	limit := 8
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil {
			if n < 1 {
				n = 1
			}
			if n > 12 {
				n = 12
			}
			limit = n
		}
	}

	endpoint := fmt.Sprintf(
		"https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&accept-language=ru&limit=%d&q=%s",
		limit,
		url.QueryEscape(q),
	)

	req, err := http.NewRequestWithContext(reqCtx(c), http.MethodGet, endpoint, nil)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"items": []string{}})
		return
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "project-drevo/1.0 (contact: support@project-drevo.local)")

	client := &http.Client{Timeout: 4 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"items": []string{}})
		return
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode > 299 {
		c.JSON(http.StatusOK, gin.H{"items": []string{}})
		return
	}

	var payload []nominatimItem
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		c.JSON(http.StatusOK, gin.H{"items": []string{}})
		return
	}

	seen := make(map[string]struct{}, len(payload))
	items := make([]string, 0, len(payload))
	for _, it := range payload {
		s := strings.TrimSpace(it.DisplayName)
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		items = append(items, s)
	}

	c.JSON(http.StatusOK, gin.H{"items": items})
}
