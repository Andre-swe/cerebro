// Reconnection manager for workers that crash/disconnect
import * as Mindcraft from './mindcraft.js';

class ReconnectManager {
    constructor() {
        this.disconnectedWorkers = new Map(); // workerName -> { leader, settings, attempts }
        this.maxAttempts = 3;
        this.reconnectDelay = 15000; // 15 seconds
        this.checkInterval = null;
    }

    start() {
        if (this.checkInterval) return;
        this.checkInterval = setInterval(() => this.processReconnects(), this.reconnectDelay);
        console.log('[ReconnectManager] Started monitoring for disconnected workers');
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    trackDisconnect(workerName, leaderName, settings) {
        const existing = this.disconnectedWorkers.get(workerName);
        const attempts = existing ? existing.attempts + 1 : 1;
        
        if (attempts > this.maxAttempts) {
            console.log(`[ReconnectManager] ${workerName} exceeded max reconnect attempts (${this.maxAttempts})`);
            this.disconnectedWorkers.delete(workerName);
            return;
        }

        this.disconnectedWorkers.set(workerName, {
            leader: leaderName,
            settings,
            attempts,
            disconnectedAt: Date.now()
        });
        console.log(`[ReconnectManager] Tracking ${workerName} for reconnect (attempt ${attempts}/${this.maxAttempts})`);
    }

    async processReconnects() {
        if (this.disconnectedWorkers.size === 0) return;

        const now = Date.now();
        const toReconnect = [];

        for (const [name, data] of this.disconnectedWorkers.entries()) {
            // Wait at least reconnectDelay before attempting
            if (now - data.disconnectedAt >= this.reconnectDelay) {
                toReconnect.push({ name, ...data });
            }
        }

        for (const worker of toReconnect) {
            console.log(`[ReconnectManager] Attempting to reconnect ${worker.name}...`);
            this.disconnectedWorkers.delete(worker.name);
            
            try {
                await Mindcraft.createWorker(worker.name, worker.leader, worker.settings);
                console.log(`[ReconnectManager] ${worker.name} reconnected successfully`);
            } catch (err) {
                console.error(`[ReconnectManager] Failed to reconnect ${worker.name}: ${err.message}`);
                // Re-track for another attempt
                this.trackDisconnect(worker.name, worker.leader, worker.settings);
            }
        }
    }

    clearWorker(workerName) {
        this.disconnectedWorkers.delete(workerName);
    }

    getStatus() {
        return {
            pending: this.disconnectedWorkers.size,
            workers: Array.from(this.disconnectedWorkers.entries()).map(([name, data]) => ({
                name,
                leader: data.leader,
                attempts: data.attempts,
                waitingFor: Math.max(0, this.reconnectDelay - (Date.now() - data.disconnectedAt))
            }))
        };
    }
}

export const reconnectManager = new ReconnectManager();
export default reconnectManager;
