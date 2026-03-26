package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const jwtIssuer = "project-drevo"

var (
	jwtSecret         []byte
	processInstanceID string // пусто, если привязка к процессу отключена
	accessTTL         time.Duration
	bindProcess       bool
)

func InitJWT(secret string, bindToProcess bool, ttl time.Duration) error {
	if len(secret) < 32 {
		return fmt.Errorf("jwt: secret too short")
	}
	jwtSecret = []byte(secret)
	bindProcess = bindToProcess
	accessTTL = ttl
	processInstanceID = ""
	if !bindToProcess {
		return nil
	}
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Errorf("jwt: process instance id: %w", err)
	}
	processInstanceID = hex.EncodeToString(buf)
	return nil
}

type accessClaims struct {
	ProcessID string `json:"pid,omitempty"`
	jwt.RegisteredClaims
}

func GenerateToken(userID string) (string, error) {
	now := time.Now()
	jti := make([]byte, 8)
	if _, err := rand.Read(jti); err != nil {
		return "", err
	}

	claims := accessClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    jwtIssuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(accessTTL)),
			ID:        hex.EncodeToString(jti),
		},
	}
	if bindProcess && processInstanceID != "" {
		claims.ProcessID = processInstanceID
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		var claims accessClaims
		token, err := jwt.ParseWithClaims(tokenStr, &claims, func(t *jwt.Token) (any, error) {
			if t.Method != jwt.SigningMethodHS256 {
				return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
			}
			return jwtSecret, nil
		})
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
			return
		}
		if !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
			return
		}

		if claims.Issuer != "" && claims.Issuer != jwtIssuer {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
			return
		}

		if bindProcess {
			if claims.ProcessID == "" || claims.ProcessID != processInstanceID {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
				return
			}
		}

		userID := strings.TrimSpace(claims.Subject)
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
			return
		}

		c.Set("userId", userID)
		c.Next()
	}
}

func GetUserID(c *gin.Context) string {
	v, _ := c.Get("userId")
	s, _ := v.(string)
	return s
}
