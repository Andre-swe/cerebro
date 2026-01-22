/**
 * WorkerProcess - Spawns worker bot child processes.
 *
 * Workers spawn much faster than leaders since they don't need LLM setup.
 */

import { spawn } from 'child_process';
import { logoutWorker } from '../mindcraft/mindserver.js';

export class WorkerProcess {
    constructor(name, leaderName, port) {
        this.name = name;
        this.leaderName = leaderName;
        this.port = port;
        this.process = null;
        this.running = false;
    }

    start(init_message = null, count_id = 0) {
        this.count_id = count_id;
        this.running = true;

        let args = ['src/process/init_worker.js'];
        args.push('-n', this.name);
        args.push('-l', this.leaderName);
        args.push('-c', count_id);
        if (init_message) {
            args.push('-m', init_message);
        }
        args.push('-p', this.port);

        const workerProcess = spawn('node', args, {
            stdio: 'inherit',
            stderr: 'inherit',
            env: process.env,
        });

        let last_restart = Date.now();
        workerProcess.on('exit', (code, signal) => {
            console.log(`[Worker] ${this.name} exited with code ${code} and signal ${signal}`);
            this.running = false;
            logoutWorker(this.name);

            if (code > 1) {
                console.log(`[Worker] ${this.name} ending task`);
                return;
            }

            // Auto-restart on crash (workers are cheap to restart)
            if (code !== 0 && signal !== 'SIGINT') {
                if (Date.now() - last_restart < 5000) {
                    console.error(`[Worker] ${this.name} exited too quickly, not restarting`);
                    return;
                }
                console.log(`[Worker] Restarting ${this.name}...`);
                this.start('Worker restarted.', count_id);
                last_restart = Date.now();
            }
        });

        workerProcess.on('error', (err) => {
            console.error(`[Worker] ${this.name} process error:`, err);
        });

        this.process = workerProcess;
    }

    stop() {
        if (!this.running) return;
        this.process.kill('SIGINT');
    }

    forceRestart() {
        if (this.running && this.process && !this.process.killed) {
            const restartTimeout = setTimeout(() => {
                console.warn(`[Worker] ${this.name} did not stop in time.`);
            }, 3000);

            this.process.once('exit', () => {
                clearTimeout(restartTimeout);
                console.log(`[Worker] Stopped ${this.name}. Now restarting.`);
                this.start('Worker restarted.', this.count_id);
            });
            this.stop();
        } else {
            this.start('Worker restarted.', this.count_id);
        }
    }
}
