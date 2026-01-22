/**
 * WorkerBot - Lightweight Minecraft bot without LLM capabilities.
 *
 * Workers are designed for the 100-agent hierarchy system:
 * - No LLM calls (cost: $0 per command)
 * - Receive commands from their assigned leader via Socket.io
 * - Execute commands using the skills library
 * - Report status back to leader
 *
 * Memory footprint: ~16 MB (vs ~25 MB for full agent)
 */

import { initModes } from './modes.js';
import { initBot } from '../utils/mcdata.js';
import { ActionManager } from './action_manager.js';
import * as skills from './library/skills.js';
import { serverProxy } from './mindserver_proxy.js';
import settings from './settings.js';
import { log, validateNameFormat, handleDisconnection } from './connection_handler.js';

export class WorkerBot {
    constructor() {
        this.bot = null;
        this.name = '';
        this.leaderName = null;
        this.actions = null;
        this.status = 'idle'; // idle, executing, error
        this.currentCommand = null;
        this.lastStatusUpdate = 0;
        this._disconnectHandled = false;
    }

    async start(leaderName, init_message=null, count_id=0) {
        this.count_id = count_id;
        this.leaderName = leaderName;

        // Workers use a simplified profile
        this.name = (settings.profile?.name || '').trim();
        console.log(`[Worker] Initializing worker ${this.name} (leader: ${leaderName})...`);

        // Validate Name Format
        const nameCheck = validateNameFormat(this.name);
        if (!nameCheck.success) {
            log(this.name, nameCheck.msg);
            process.exit(1);
            return;
        }

        // Initialize minimal components (no LLM, no history, no prompter)
        this.actions = new ActionManager(this);

        console.log(`[Worker] ${this.name} logging into minecraft...`);
        this.bot = initBot(this.name);

        // Connection Handler
        const onDisconnect = (event, reason) => {
            if (this._disconnectHandled) return;
            this._disconnectHandled = true;
            const { type } = handleDisconnection(this.name, reason);
            process.exit(1);
        };

        // Bind events
        this.bot.once('kicked', (reason) => onDisconnect('Kicked', reason));
        this.bot.once('end', (reason) => onDisconnect('Disconnected', reason));
        this.bot.on('error', (err) => {
            if (String(err).includes('Duplicate') || String(err).includes('ECONNREFUSED')) {
                onDisconnect('Error', err);
            } else {
                log(this.name, `[Worker] Connection Error: ${String(err)}`);
            }
        });

        this.bot.on('login', () => {
            console.log(`[Worker] ${this.name} logged in!`);

            // Initialize modes AFTER bot is fully connected
            initModes(this);

            serverProxy.loginWorker(this.leaderName);

            // Set skin if specified
            if (settings.profile?.skin) {
                this.bot.chat(`/skin set URL ${settings.profile.skin.model} ${settings.profile.skin.path}`);
            }
        });

        const spawnTimeoutDuration = settings.spawn_timeout || 30;
        const spawnTimeout = setTimeout(() => {
            const msg = `Worker has not spawned after ${spawnTimeoutDuration} seconds. Exiting.`;
            log(this.name, msg);
            process.exit(1);
        }, spawnTimeoutDuration * 1000);

        this.bot.once('spawn', async () => {
            try {
                clearTimeout(spawnTimeout);
                await new Promise((resolve) => setTimeout(resolve, 1000));

                console.log(`[Worker] ${this.name} spawned.`);
                this.clearBotLogs();
                this._setupWorkerEvents();
                this.startEvents();

                // Notify leader that worker is ready
                this.reportStatus('ready', 'Worker spawned and ready for commands');

                // Brief acknowledgment if init_message provided
                if (init_message) {
                    this.bot.chat(`[Worker ${this.name}] Ready!`);
                }

            } catch (error) {
                console.error('[Worker] Error in spawn event:', error);
                process.exit(0);
            }
        });
    }

    _setupWorkerEvents() {
        // Set up auto-eat with basic settings
        this.bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: 14,
            bannedFood: ["rotten_flesh", "spider_eye", "poisonous_potato", "pufferfish", "chicken"]
        };

        // Listen for commands from leader via serverProxy
        serverProxy.onWorkerCommand((command, args, commandId) => {
            this.executeCommand(command, args, commandId);
        });
    }

    /**
     * Execute a command received from the leader.
     */
    async executeCommand(command, args, commandId) {
        if (this.status === 'executing') {
            this.reportStatus('busy', `Already executing: ${this.currentCommand}`);
            return;
        }

        this.status = 'executing';
        this.currentCommand = command;
        const startTime = Date.now();

        console.log(`[Worker] ${this.name} executing: ${command}(${JSON.stringify(args)})`);
        this.reportStatus('executing', `Started: ${command}`);

        try {
            const result = await this._executeSkill(command, args);
            const duration = Date.now() - startTime;

            this.status = 'idle';
            this.currentCommand = null;
            this.reportStatus('completed', `${command} completed in ${duration}ms`, {
                commandId,
                result,
                duration
            });

            console.log(`[Worker] ${this.name} completed: ${command} (${duration}ms)`);

        } catch (error) {
            this.status = 'error';
            this.currentCommand = null;
            this.reportStatus('error', `${command} failed: ${error.message}`, {
                commandId,
                error: error.message
            });

            console.error(`[Worker] ${this.name} error executing ${command}:`, error.message);
        }
    }

    /**
     * Map command names to skills library functions.
     */
    async _executeSkill(command, args) {
        const skillMap = {
            // Movement
            'goToPlayer': () => skills.goToPlayer(this.bot, args.player_name, args.closeness || 3),
            'goToPosition': () => skills.goToPosition(this.bot, args.x, args.y, args.z, args.closeness || 2),
            'goToNearestBlock': () => skills.goToNearestBlock(this.bot, args.type, args.closeness || 4, args.range || 64),
            'followPlayer': () => skills.followPlayer(this.bot, args.player_name, args.distance || 4),
            'moveAway': () => skills.moveAway(this.bot, args.distance || 5),
            'goToSurface': () => skills.goToSurface(this.bot),

            // Collection/Mining
            'collectBlock': () => skills.collectBlock(this.bot, args.type, args.num || 1),
            'attackNearest': () => skills.attackNearest(this.bot, args.type, args.kill || true),

            // Inventory
            'giveToPlayer': () => skills.giveToPlayer(this.bot, args.item_name, args.player_name, args.num || 1),
            'equip': () => skills.equip(this.bot, args.item_name),
            'discard': () => skills.discard(this.bot, args.item_name, args.num || 1),
            'putInChest': () => skills.putInChest(this.bot, args.item_name, args.num || 1),
            'takeFromChest': () => skills.takeFromChest(this.bot, args.item_name, args.num || 1),

            // Crafting
            'craftRecipe': () => skills.craftRecipe(this.bot, args.recipe_name, args.num || 1),
            'smeltItem': () => skills.smeltItem(this.bot, args.item_name, args.num || 1),

            // Building
            'placeBlock': () => skills.placeBlock(this.bot, args.type, args.x, args.y, args.z),

            // Combat
            'attackEntity': () => skills.attackEntity(this.bot, args.entity, args.kill || true),

            // Utility
            'stay': () => skills.stay(this.bot, args.seconds || 5),
            'consume': () => skills.consume(this.bot, args.item_name),
            'goToBed': () => skills.goToBed(this.bot),
            'digDown': () => skills.digDown(this.bot, args.distance || 1),

            // Special worker commands
            'stop': () => {
                this.actions.stop();
                this.bot.pathfinder.stop();
                return 'Stopped';
            },
            'getPosition': () => {
                const pos = this.bot.entity.position;
                return { x: pos.x, y: pos.y, z: pos.z };
            },
            'getInventory': () => {
                return this.bot.inventory.items().map(item => ({
                    name: item.name,
                    count: item.count
                }));
            },
            'getHealth': () => {
                return {
                    health: this.bot.health,
                    food: this.bot.food
                };
            }
        };

        if (skillMap[command]) {
            return await skillMap[command]();
        } else {
            throw new Error(`Unknown command: ${command}`);
        }
    }

    /**
     * Report status to leader via serverProxy.
     */
    reportStatus(status, message, details = {}) {
        this.lastStatusUpdate = Date.now();
        serverProxy.reportWorkerStatus({
            worker: this.name,
            leader: this.leaderName,
            status,
            message,
            position: this.bot?.entity?.position ? {
                x: Math.floor(this.bot.entity.position.x),
                y: Math.floor(this.bot.entity.position.y),
                z: Math.floor(this.bot.entity.position.z)
            } : null,
            health: this.bot?.health || 0,
            food: this.bot?.food || 0,
            ...details,
            timestamp: Date.now()
        });
    }

    clearBotLogs() {
        this.bot.output = '';
        this.bot.interrupt_code = false;
    }

    requestInterrupt() {
        this.bot.interrupt_code = true;
        this.bot.stopDigging();
        this.bot.pathfinder.stop();
    }

    isIdle() {
        return this.status === 'idle' && !this.actions.executing;
    }

    /**
     * Open chat method required by modes.js
     * Workers just directly chat without LLM processing
     */
    openChat(message) {
        this.bot.chat(message);
    }

    startEvents() {
        // Custom events
        this.bot.on('time', () => {
            if (this.bot.time.timeOfDay == 0) this.bot.emit('sunrise');
            else if (this.bot.time.timeOfDay == 6000) this.bot.emit('noon');
            else if (this.bot.time.timeOfDay == 12000) this.bot.emit('sunset');
            else if (this.bot.time.timeOfDay == 18000) this.bot.emit('midnight');
        });

        let prev_health = this.bot.health;
        this.bot.lastDamageTime = 0;
        this.bot.lastDamageTaken = 0;
        this.bot.on('health', () => {
            if (this.bot.health < prev_health) {
                this.bot.lastDamageTime = Date.now();
                this.bot.lastDamageTaken = prev_health - this.bot.health;
                // Report damage to leader
                this.reportStatus('damaged', `Took ${this.bot.lastDamageTaken.toFixed(1)} damage`);
            }
            prev_health = this.bot.health;
        });

        this.bot.on('error', (err) => {
            console.error('[Worker] Error event:', err);
        });

        this.bot.on('death', () => {
            this.actions.cancelResume();
            this.actions.stop();
            this.status = 'idle';
            this.currentCommand = null;
            this.reportStatus('died', 'Worker died and respawned');
        });

        this.bot.on('idle', () => {
            this.bot.clearControlStates();
            this.bot.pathfinder.stop();
            this.bot.modes.unPauseAll();
        });

        // Periodic status updates to leader (every 5 seconds)
        const STATUS_INTERVAL = 5000;
        setInterval(() => {
            if (Date.now() - this.lastStatusUpdate > STATUS_INTERVAL) {
                this.reportStatus(this.status, this.currentCommand || 'idle');
            }
        }, STATUS_INTERVAL);

        // Update loop
        const INTERVAL = 300;
        let last = Date.now();
        setTimeout(async () => {
            while (true) {
                let start = Date.now();
                await this.update(start - last);
                let remaining = INTERVAL - (Date.now() - start);
                if (remaining > 0) {
                    await new Promise((resolve) => setTimeout(resolve, remaining));
                }
                last = start;
            }
        }, INTERVAL);

        this.bot.emit('idle');
    }

    async update(delta) {
        await this.bot.modes.update();
    }

    cleanKill(msg = 'Killing worker process...', code = 1) {
        console.log(`[Worker] ${this.name}: ${msg}`);
        this.reportStatus('shutdown', msg);
        process.exit(code);
    }
}
