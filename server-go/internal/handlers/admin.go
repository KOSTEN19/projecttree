package handlers

import (
	"bufio"
	"net/http"
	"os"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"project-drevo/internal/db"
	"project-drevo/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type cpuTimes struct {
	idle  uint64
	total uint64
}

var serverStartedAt = time.Now()

func AdminOverview(c *gin.Context) {
	ctx := reqCtx(c)

	usersCount, _ := db.Users.CountDocuments(ctx, bson.M{})
	personsCount, _ := db.Persons.CountDocuments(ctx, bson.M{})
	relCount, _ := db.Relationships.CountDocuments(ctx, bson.M{})

	cursor, err := db.Persons.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "updatedAt", Value: -1}}).SetLimit(300))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}
	defer cursor.Close(ctx)

	type personAdminItem struct {
		ID        string    `json:"id"`
		UserID    string    `json:"userId"`
		FullName  string    `json:"fullName"`
		BirthDate string    `json:"birthDate"`
		BirthCity string    `json:"birthCity"`
		UpdatedAt time.Time `json:"updatedAt"`
	}

	items := make([]personAdminItem, 0, 300)
	for cursor.Next(ctx) {
		var p models.Person
		if err := cursor.Decode(&p); err != nil {
			continue
		}
		fullName := strings.TrimSpace(strings.Join([]string{p.LastName, p.FirstName, p.MiddleName}, " "))
		items = append(items, personAdminItem{
			ID:        p.ID.Hex(),
			UserID:    p.UserID.Hex(),
			FullName:  fullName,
			BirthDate: p.BirthDate,
			BirthCity: p.BirthCity,
			UpdatedAt: p.UpdatedAt,
		})
	}

	hosts := readScannerHosts(getEnvOr("SCANNERS_LOG_PATH", "/var/log/nginx/scanners.log"))

	cpuPercent := currentCPUPercent()
	mem := runtime.MemStats{}
	runtime.ReadMemStats(&mem)
	var st syscall.Statfs_t
	_ = syscall.Statfs("/", &st)
	diskTotal := st.Blocks * uint64(st.Bsize)
	diskFree := st.Bavail * uint64(st.Bsize)
	diskUsed := diskTotal - diskFree

	c.JSON(http.StatusOK, gin.H{
		"system": gin.H{
			"cpuPercent": cpuPercent,
			"goRoutines": runtime.NumGoroutine(),
			"memBytes": gin.H{
				"alloc": mem.Alloc,
				"sys":   mem.Sys,
			},
			"diskBytes": gin.H{
				"total": diskTotal,
				"used":  diskUsed,
				"free":  diskFree,
			},
			"uptimeSec": int64(time.Since(serverStartedAt).Seconds()),
		},
		"blockedHosts": hosts,
		"family": gin.H{
			"usersCount":         usersCount,
			"personsCount":       personsCount,
			"relationshipsCount": relCount,
			"persons":            items,
		},
	})
}

func readScannerHosts(path string) []gin.H {
	f, err := os.Open(path)
	if err != nil {
		return []gin.H{}
	}
	defer f.Close()

	counts := map[string]int{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, " ", 2)
		if len(parts) < 1 {
			continue
		}
		host := strings.TrimSpace(parts[0])
		if host == "" {
			continue
		}
		counts[host]++
	}

	type kv struct {
		host  string
		count int
	}
	arr := make([]kv, 0, len(counts))
	for h, c := range counts {
		arr = append(arr, kv{host: h, count: c})
	}
	sort.Slice(arr, func(i, j int) bool { return arr[i].count > arr[j].count })
	if len(arr) > 200 {
		arr = arr[:200]
	}

	out := make([]gin.H, 0, len(arr))
	for _, it := range arr {
		out = append(out, gin.H{"host": it.host, "hits": it.count})
	}
	return out
}

func currentCPUPercent() float64 {
	a, err := readCPUTimes()
	if err != nil {
		return 0
	}
	time.Sleep(120 * time.Millisecond)
	b, err := readCPUTimes()
	if err != nil {
		return 0
	}
	dTotal := b.total - a.total
	if dTotal == 0 {
		return 0
	}
	dIdle := b.idle - a.idle
	usage := (1.0 - float64(dIdle)/float64(dTotal)) * 100.0
	if usage < 0 {
		return 0
	}
	if usage > 100 {
		return 100
	}
	return usage
}

func readCPUTimes() (cpuTimes, error) {
	b, err := os.ReadFile("/proc/stat")
	if err != nil {
		return cpuTimes{}, err
	}
	lines := strings.Split(string(b), "\n")
	for _, ln := range lines {
		if !strings.HasPrefix(ln, "cpu ") {
			continue
		}
		fields := strings.Fields(ln)
		if len(fields) < 5 {
			break
		}
		var vals []uint64
		for _, f := range fields[1:] {
			v, err := strconv.ParseUint(f, 10, 64)
			if err != nil {
				v = 0
			}
			vals = append(vals, v)
		}
		var total uint64
		for _, v := range vals {
			total += v
		}
		idle := vals[3]
		if len(vals) > 4 {
			idle += vals[4]
		}
		return cpuTimes{idle: idle, total: total}, nil
	}
	return cpuTimes{}, os.ErrNotExist
}

func getEnvOr(name, fallback string) string {
	v := strings.TrimSpace(os.Getenv(name))
	if v == "" {
		return fallback
	}
	return v
}
