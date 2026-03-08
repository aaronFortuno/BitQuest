import fs from 'fs';
import path from 'path';

interface RouteStats {
  count: number;
  totalMs: number;
}

class ServerMonitor {
  private activeRequests = 0;
  private broadcastCount = 0;
  private activePropagations = 0;
  private routeStats = new Map<string, RouteStats>();
  private intervalId: NodeJS.Timeout | null = null;
  private logStream: fs.WriteStream | null = null;
  private startTime = Date.now();
  // Snapshot for rate calculation
  private lastSnapshotTime = Date.now();
  private lastSnapshotReqs = 0;
  private totalReqs = 0;

  start() {
    if (this.intervalId) return;

    const logPath = path.join(process.cwd(), 'server-monitor.log');
    this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
    this.log('MONITOR STARTED');

    this.intervalId = setInterval(() => this.tick(), 5000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logStream?.end();
  }

  // Call at start of each HTTP request
  requestIn(routeKey: string) {
    this.activeRequests++;
    this.totalReqs++;
    const stats = this.routeStats.get(routeKey) || { count: 0, totalMs: 0 };
    stats.count++;
    this.routeStats.set(routeKey, stats);
  }

  // Call at end of each HTTP request
  requestOut(routeKey: string, durationMs: number) {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    const stats = this.routeStats.get(routeKey);
    if (stats) {
      stats.totalMs += durationMs;
    }
  }

  incrementBroadcasts() {
    this.broadcastCount++;
  }

  propagationStart() {
    this.activePropagations++;
  }

  propagationEnd() {
    this.activePropagations = Math.max(0, this.activePropagations - 1);
  }

  private tick() {
    const mem = process.memoryUsage();
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);

    const now = Date.now();
    const elapsed = (now - this.lastSnapshotTime) / 1000;
    const reqsSinceSnapshot = this.totalReqs - this.lastSnapshotReqs;
    const reqRate = elapsed > 0 ? (reqsSinceSnapshot / elapsed).toFixed(1) : '0';
    this.lastSnapshotTime = now;
    this.lastSnapshotReqs = this.totalReqs;

    // Get socket client count if available
    let socketClients = '?';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getIO } = require('./io');
      const io = getIO();
      if (io?.engine) {
        socketClients = String(io.engine.clientsCount);
      }
    } catch { /* ignore */ }

    const uptime = Math.round((now - this.startTime) / 1000);

    const line1 = `MONITOR | uptime: ${uptime}s | heap: ${heapMB}MB | rss: ${rssMB}MB | activeReqs: ${this.activeRequests} | socketClients: ${socketClients} | broadcasts: ${this.broadcastCount} | propagations: ${this.activePropagations} | reqRate: ${reqRate}/s`;

    // Top routes by count
    const sorted = [...this.routeStats.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const routeParts = sorted.map(([route, s]) => {
      const avg = s.count > 0 ? Math.round(s.totalMs / s.count) : 0;
      return `${route}: ${s.count} (avg ${avg}ms)`;
    });

    const line2 = routeParts.length > 0
      ? `TOP ROUTES | ${routeParts.join(' | ')}`
      : 'TOP ROUTES | (none yet)';

    this.log(line1);
    this.log(line2);

    // Reset per-interval counters
    this.broadcastCount = 0;
    this.routeStats.clear();
  }

  private log(msg: string) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}`;
    console.log(line);
    this.logStream?.write(line + '\n');
  }
}

// Singleton
export const monitor = new ServerMonitor();
