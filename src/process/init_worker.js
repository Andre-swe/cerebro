/**
 * Worker initialization script.
 *
 * Workers are lightweight bots that:
 * - Connect to Minecraft via Mineflayer
 * - Have no LLM capabilities (no API cost)
 * - Receive commands from their leader via Socket.io
 * - Execute commands using the skills library
 */

import { WorkerBot } from '../agent/worker_bot.js';
import { serverProxy } from '../agent/mindserver_proxy.js';
import yargs from 'yargs';

const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: node init_worker.js -n <worker_name> -p <port> -l <leader_name> -c <count_id>');
    process.exit(1);
}

const argv = yargs(args)
    .option('name', {
        alias: 'n',
        type: 'string',
        description: 'name of worker bot'
    })
    .option('leader', {
        alias: 'l',
        type: 'string',
        description: 'name of assigned leader bot'
    })
    .option('init_message', {
        alias: 'm',
        type: 'string',
        description: 'optional init message'
    })
    .option('count_id', {
        alias: 'c',
        type: 'number',
        default: 0,
        description: 'identifying count for multi-agent scenarios',
    })
    .option('port', {
        alias: 'p',
        type: 'number',
        description: 'port of mindserver'
    })
    .argv;

(async () => {
    try {
        console.log(`[Worker Init] Connecting to MindServer for worker: ${argv.name}`);
        await serverProxy.connectWorker(argv.name, argv.port, argv.leader);

        console.log(`[Worker Init] Starting worker bot (leader: ${argv.leader})`);
        const worker = new WorkerBot();
        serverProxy.setWorker(worker);
        await worker.start(argv.leader, argv.init_message, argv.count_id);

    } catch (error) {
        console.error('[Worker Init] Failed to start worker process:');
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
})();
