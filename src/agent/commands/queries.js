import * as world from '../library/world.js';
import * as mc from '../../utils/mcdata.js';
import { getCommandDocs } from './index.js';
import convoManager from '../conversation.js';
import { checkLevelBlueprint, checkBlueprint } from '../tasks/construction_tasks.js';
import { load } from 'cheerio';

const pad = (str) => {
    return '\n' + str + '\n';
}

// queries are commands that just return strings and don't affect anything in the world
export const queryList = [
    {
        name: "!stats",
        description: "Get your bot's location, health, hunger, and time of day.", 
        perform: function (agent) {
            let bot = agent.bot;
            let res = 'STATS';
            let pos = bot.entity.position;
            // display position to 2 decimal places
            res += `\n- Position: x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`;
            // Gameplay
            res += `\n- Gamemode: ${bot.game.gameMode}`;
            res += `\n- Health: ${Math.round(bot.health)} / 20`;
            res += `\n- Hunger: ${Math.round(bot.food)} / 20`;
            res += `\n- Biome: ${world.getBiomeName(bot)}`;
            let weather = "Clear";
            if (bot.rainState > 0)
                weather = "Rain";
            if (bot.thunderState > 0)
                weather = "Thunderstorm";
            res += `\n- Weather: ${weather}`;
            // let block = bot.blockAt(pos);
            // res += `\n- Artficial light: ${block.skyLight}`;
            // res += `\n- Sky light: ${block.light}`;
            // light properties are bugged, they are not accurate


            if (bot.time.timeOfDay < 6000) {
                res += '\n- Time: Morning';
            } else if (bot.time.timeOfDay < 12000) {
                res += '\n- Time: Afternoon';
            } else {
                res += '\n- Time: Night';
            }

            // get the bot's current action
            let action = agent.actions.currentActionLabel;
            if (agent.isIdle())
                action = 'Idle';
            res += `\- Current Action: ${action}`;


            let players = world.getNearbyPlayerNames(bot);
            let bots = convoManager.getInGameAgents().filter(b => b !== agent.name);
            players = players.filter(p => !bots.includes(p));

            res += '\n- Nearby Human Players: ' + (players.length > 0 ? players.join(', ') : 'None.');
            res += '\n- Nearby Bot Players: ' + (bots.length > 0 ? bots.join(', ') : 'None.');

            res += '\n' + agent.bot.modes.getMiniDocs() + '\n';
            return pad(res);
        }
    },
    {
        name: "!inventory",
        description: "Get your bot's inventory.",
        perform: function (agent) {
            let bot = agent.bot;
            let inventory = world.getInventoryCounts(bot);
            let res = 'INVENTORY';
            for (const item in inventory) {
                if (inventory[item] && inventory[item] > 0)
                    res += `\n- ${item}: ${inventory[item]}`;
            }
            if (res === 'INVENTORY') {
                res += ': Nothing';
            }
            else if (agent.bot.game.gameMode === 'creative') {
                res += '\n(You have infinite items in creative mode. You do not need to gather resources!!)';
            }

            let helmet = bot.inventory.slots[5];
            let chestplate = bot.inventory.slots[6];
            let leggings = bot.inventory.slots[7];
            let boots = bot.inventory.slots[8];
            res += '\nWEARING: ';
            if (helmet)
                res += `\nHead: ${helmet.name}`;
            if (chestplate)
                res += `\nTorso: ${chestplate.name}`;
            if (leggings)
                res += `\nLegs: ${leggings.name}`;
            if (boots)
                res += `\nFeet: ${boots.name}`;
            if (!helmet && !chestplate && !leggings && !boots)
                res += 'Nothing';

            return pad(res);
        }
    },
    {
        name: "!nearbyBlocks",
        description: "Get the blocks near the bot.",
        perform: function (agent) {
            let bot = agent.bot;
            let res = 'NEARBY_BLOCKS';
            let blocks = world.getNearestBlocks(bot);
            let block_details = new Set();
            
            for (let block of blocks) {
                let details = block.name;
                if (block.name === 'water' || block.name === 'lava') {
                    details += block.metadata === 0 ? ' (source)' : ' (flowing)';
                }
                block_details.add(details);
            }
            for (let details of block_details) {
                res += `\n- ${details}`;
            }
            if (block_details.size === 0) {
                res += ': none';
            } 
            else {
                res += '\n- ' + world.getSurroundingBlocks(bot).join('\n- ');
                res += `\n- First Solid Block Above Head: ${world.getFirstBlockAboveHead(bot, null, 32)}`;
            }
            return pad(res);
        }
    },
    {
        name: "!craftable",
        description: "Get the craftable items with the bot's inventory.",
        perform: function (agent) {
            let craftable = world.getCraftableItems(agent.bot);
            let res = 'CRAFTABLE_ITEMS';
            for (const item of craftable) {
                res += `\n- ${item}`;
            }
            if (res == 'CRAFTABLE_ITEMS') {
                res += ': none';
            }
            return pad(res);
        }
    },
    {
        name: "!entities",
        description: "Get the nearby players and entities.",
        perform: function (agent) {
            let bot = agent.bot;
            let res = 'NEARBY_ENTITIES';
            let players = world.getNearbyPlayerNames(bot);
            let bots = convoManager.getInGameAgents().filter(b => b !== agent.name);
            players = players.filter(p => !bots.includes(p));

            for (const player of players) {
                res += `\n- Human player: ${player}`;
            }
            for (const bot of bots) {
                res += `\n- Bot player: ${bot}`;
            }

            let nearbyEntities = world.getNearbyEntities(bot);
            let entityCounts = {};
            let villagerIds = [];
            let babyVillagerIds = [];
            let villagerDetails = []; // Store detailed villager info including profession
            
            for (const entity of nearbyEntities) {
                if (entity.type === 'player' || entity.name === 'item')
                    continue;
                    
                if (!entityCounts[entity.name]) {
                    entityCounts[entity.name] = 0;
                }
                entityCounts[entity.name]++;
                
                if (entity.name === 'villager') {
                    if (entity.metadata && entity.metadata[16] === 1) {
                        babyVillagerIds.push(entity.id);
                    } else {
                        const profession = world.getVillagerProfession(entity);
                        villagerIds.push(entity.id);
                        villagerDetails.push({
                            id: entity.id,
                            profession: profession
                        });
                    }
                }
            }
            
            for (const [entityType, count] of Object.entries(entityCounts)) {
                if (entityType === 'villager') {
                    let villagerInfo = `${count} ${entityType}(s)`;
                    if (villagerDetails.length > 0) {
                        const detailStrings = villagerDetails.map(v => `(${v.id}:${v.profession})`);
                        villagerInfo += ` - Adults: ${detailStrings.join(', ')}`;
                    }
                    if (babyVillagerIds.length > 0) {
                        villagerInfo += ` - Baby IDs: ${babyVillagerIds.join(', ')} (babies cannot trade)`;
                    }
                    res += `\n- entities: ${villagerInfo}`;
                } else {
                    res += `\n- entities: ${count} ${entityType}(s)`;
                }
            }
            
            if (res == 'NEARBY_ENTITIES') {
                res += ': none';
            }
            return pad(res);
        }
    },
    {
        name: "!modes",
        description: "Get all available modes and their docs and see which are on/off.",
        perform: function (agent) {
            return agent.bot.modes.getDocs();
        }
    },
    {
        name: '!savedPlaces',
        description: 'List all saved locations.',
        perform: async function (agent) {
            return "Saved place names: " + agent.memory_bank.getKeys();
        }
    }, 
    {
        name: '!checkBlueprintLevel',
        description: 'Check if the level is complete and what blocks still need to be placed for the blueprint',
        params: {
            'levelNum': { type: 'int', description: 'The level number to check.', domain: [0, Number.MAX_SAFE_INTEGER] }
        },
        perform: function (agent, levelNum) {
            let res = checkLevelBlueprint(agent, levelNum);
            console.log(res);
            return pad(res);
        }
    }, 
    {
        name: '!checkBlueprint',
        description: 'Check what blocks still need to be placed for the blueprint',
        perform: function (agent) {
            let res = checkBlueprint(agent);
            return pad(res);
        }
    }, 
    {
        name: '!getBlueprint',
        description: 'Get the blueprint for the building',
        perform: function (agent) {
            let res = agent.task.blueprint.explain();
            return pad(res);
        }
    }, 
    {
        name: '!getBlueprintLevel',
        description: 'Get the blueprint for the building',
        params: {
            'levelNum': { type: 'int', description: 'The level number to check.', domain: [0, Number.MAX_SAFE_INTEGER] }
        },
        perform: function (agent, levelNum) {
            let res = agent.task.blueprint.explainLevel(levelNum);
            console.log(res);
            return pad(res);
        }
    },
    {
        name: '!getCraftingPlan',
        description: "Provides a comprehensive crafting plan for a specified item. This includes a breakdown of required ingredients, the exact quantities needed, and an analysis of missing ingredients or extra items needed based on the bot's current inventory.",
        params: {
            targetItem: { 
                type: 'string', 
                description: 'The item that we are trying to craft' 
            },
            quantity: { 
                type: 'int',
                description: 'The quantity of the item that we are trying to craft',
                optional: true,
                domain: [1, Infinity, '[)'], // Quantity must be at least 1,
                default: 1
            }
        },
        perform: function (agent, targetItem, quantity = 1) {
            let bot = agent.bot;

            // Fetch the bot's inventory
            const curr_inventory = world.getInventoryCounts(bot); 
            const target_item = targetItem;
            let existingCount = curr_inventory[target_item] || 0;
            let prefixMessage = '';
            if (existingCount > 0) {
                curr_inventory[target_item] -= existingCount;
                prefixMessage = `You already have ${existingCount} ${target_item} in your inventory. If you need to craft more,\n`;
            }

            // Generate crafting plan
            try {
                let craftingPlan = mc.getDetailedCraftingPlan(target_item, quantity, curr_inventory);
                craftingPlan = prefixMessage + craftingPlan;
                return pad(craftingPlan);
            } catch (error) {
                console.error("Error generating crafting plan:", error);
                return `An error occurred while generating the crafting plan: ${error.message}`;
            }
            
            
        },
    },
    {
        name: '!searchWiki',
        description: 'Search the Minecraft Wiki for the given query.',
        params: {
            'query': { type: 'string', description: 'The query to search for.' }
        },
        perform: async function (agent, query) {
            const url = `https://minecraft.wiki/w/${query}`
            try {
                const response = await fetch(url);
                if (response.status === 404) {
                  return `${query} was not found on the Minecraft Wiki. Try adjusting your search term.`;
                }
                const html = await response.text();
                const $ = load(html);
            
                const parserOutput = $("div.mw-parser-output");
                
                parserOutput.find("table.navbox").remove();

                const divContent = parserOutput.text();
            
                return divContent.trim();
              } catch (error) {
                console.error("Error fetching or parsing HTML:", error);
                return `The following error occurred: ${error}`
              }
        }
    },
    {
        name: '!help',
        description: 'Lists all available commands and their descriptions.',
        perform: async function (agent) {
            return getCommandDocs(agent);
        }
    },

    // ========== PROGRESSION & COLLABORATION QUERIES ==========
    {
        name: '!progressionStatus',
        description: 'Check your current Minecraft progression stage and what to do next.',
        perform: function (agent) {
            const inventory = world.getInventoryCounts(agent.bot);
            return mc.formatProgressionPlan(inventory);
        }
    },
    {
        name: '!canMine',
        description: 'Check if you can mine a specific block with your current tools.',
        params: {
            'block': { type: 'BlockName', description: 'The block to check.' }
        },
        perform: function (agent, blockName) {
            const inventory = world.getInventoryCounts(agent.bot);
            const pickaxes = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];
            let bestPickaxe = null;

            for (const pick of pickaxes) {
                if (inventory[pick] > 0) {
                    bestPickaxe = pick;
                    break;
                }
            }

            const requiredLevel = mc.getMiningLevel(blockName);
            const minTool = mc.getMinimumToolForBlock(blockName);

            if (requiredLevel === 0) {
                return `${blockName} can be mined by hand or any tool.`;
            }

            const canMine = bestPickaxe ? mc.canMineBlock(bestPickaxe, blockName) : false;

            if (canMine) {
                return `Yes! You can mine ${blockName} with your ${bestPickaxe}.`;
            } else {
                const neededTool = minTool || 'a better pickaxe';
                return `No. ${blockName} requires at least ${neededTool}. Your best pickaxe: ${bestPickaxe || 'none'}.`;
            }
        }
    },
    {
        name: '!toolTiers',
        description: 'Show the tool tier progression and what each tier can mine.',
        perform: function (agent) {
            let res = 'TOOL TIER PROGRESSION\n';
            res += '=====================\n\n';
            res += '1. WOODEN PICKAXE (craft from planks + sticks)\n';
            res += '   Can mine: Stone, Coal Ore, Copper Ore\n\n';
            res += '2. STONE PICKAXE (craft from cobblestone + sticks)\n';
            res += '   Can mine: Iron Ore, Lapis Ore\n\n';
            res += '3. IRON PICKAXE (craft from iron ingots + sticks)\n';
            res += '   Can mine: Gold Ore, Diamond Ore, Redstone Ore, Emerald Ore\n\n';
            res += '4. DIAMOND PICKAXE (craft from diamonds + sticks)\n';
            res += '   Can mine: Obsidian, Ancient Debris\n\n';
            res += '5. NETHERITE PICKAXE (upgrade diamond with netherite)\n';
            res += '   Best durability and speed\n\n';
            res += 'TIP: Always upgrade your pickaxe before mining higher-tier ores!';
            return res;
        }
    },
    {
        name: '!collaboratePlan',
        description: 'Generate a collaborative plan for multiple bots to work together on a task.',
        params: {
            'task': { type: 'string', description: 'Task type: resource_gathering, base_building, nether_expedition, end_raid, or trading_post' }
        },
        perform: function (agent, taskType) {
            // Get all online bots
            const allBots = convoManager.getInGameAgents();
            if (allBots.length < 2) {
                return 'Collaborative planning requires at least 2 bots online. Currently: ' + allBots.join(', ');
            }

            const inventories = {};  // In a real implementation, we'd gather these
            const plan = mc.generateCollaborativePlan(taskType, allBots, inventories);

            if (!plan) {
                const validTasks = Object.keys(mc.COLLABORATIVE_TASKS).join(', ');
                return `Unknown task type "${taskType}". Valid tasks: ${validTasks}`;
            }

            return mc.formatCollaborativePlan(plan);
        }
    },
    {
        name: '!assignRoles',
        description: 'Suggest role assignments for the current group of bots based on a goal.',
        params: {
            'goal': { type: 'string', description: 'The overall goal (e.g., "build a base", "get diamonds", "go to nether")' }
        },
        perform: function (agent, goal) {
            const allBots = convoManager.getInGameAgents();
            const goalLower = goal.toLowerCase();

            let res = `ROLE ASSIGNMENTS FOR: "${goal}"\n`;
            res += `================================\n`;
            res += `Bots available: ${allBots.join(', ')}\n\n`;

            // Suggest roles based on goal keywords
            if (goalLower.includes('base') || goalLower.includes('house') || goalLower.includes('build')) {
                res += 'Suggested roles:\n';
                allBots.forEach((bot, i) => {
                    if (i === 0) res += `  ${bot}: Lead Builder - coordinates structure placement\n`;
                    else if (i === 1) res += `  ${bot}: Material Gatherer - collects wood, stone, etc.\n`;
                    else if (i === 2) res += `  ${bot}: Interior Designer - places furniture, torches\n`;
                    else res += `  ${bot}: Support - helps with any task needed\n`;
                });
            } else if (goalLower.includes('diamond') || goalLower.includes('mine') || goalLower.includes('ore')) {
                res += 'Suggested roles:\n';
                allBots.forEach((bot, i) => {
                    if (i === 0) res += `  ${bot}: Lead Miner - mines at optimal Y level\n`;
                    else if (i === 1) res += `  ${bot}: Torch Placer - lights up tunnels for safety\n`;
                    else if (i === 2) res += `  ${bot}: Ore Collector - gathers dropped items\n`;
                    else res += `  ${bot}: Support Miner - expands mining area\n`;
                });
            } else if (goalLower.includes('nether') || goalLower.includes('portal')) {
                res += 'Suggested roles:\n';
                allBots.forEach((bot, i) => {
                    if (i === 0) res += `  ${bot}: Portal Builder - collects obsidian, builds frame\n`;
                    else if (i === 1) res += `  ${bot}: Scout - explores for fortress\n`;
                    else if (i === 2) res += `  ${bot}: Fighter - handles blazes and other mobs\n`;
                    else res += `  ${bot}: Collector - gathers blaze rods, wart\n`;
                });
            } else if (goalLower.includes('farm') || goalLower.includes('food')) {
                res += 'Suggested roles:\n';
                allBots.forEach((bot, i) => {
                    if (i === 0) res += `  ${bot}: Farmer - plants and harvests crops\n`;
                    else if (i === 1) res += `  ${bot}: Animal Handler - breeds animals\n`;
                    else if (i === 2) res += `  ${bot}: Cook - smelts food in furnaces\n`;
                    else res += `  ${bot}: Fence Builder - secures the farm\n`;
                });
            } else {
                res += 'General roles:\n';
                allBots.forEach((bot, i) => {
                    if (i === 0) res += `  ${bot}: Leader - coordinates and makes decisions\n`;
                    else res += `  ${bot}: Team Member - follows leader's direction\n`;
                });
            }

            res += '\nUse !startConversation to coordinate with other bots!';
            return res;
        }
    },
    {
        name: '!teamStatus',
        description: 'Check the status and inventory highlights of all online bots.',
        perform: function (agent) {
            const allBots = convoManager.getInGameAgents();
            let res = 'TEAM STATUS\n';
            res += '===========\n\n';

            // For current bot
            const myInventory = world.getInventoryCounts(agent.bot);
            const myStage = mc.getCurrentProgressionStage(myInventory);
            const myPos = agent.bot.entity.position;

            res += `${agent.name} (you):\n`;
            res += `  Position: ${Math.floor(myPos.x)}, ${Math.floor(myPos.y)}, ${Math.floor(myPos.z)}\n`;
            res += `  Stage: ${myStage}\n`;
            res += `  Key items: `;

            const keyItems = ['diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'diamond', 'iron_ingot', 'blaze_rod'];
            const haveItems = keyItems.filter(item => myInventory[item] > 0);
            res += haveItems.length > 0 ? haveItems.join(', ') : 'basic tools only';
            res += '\n\n';

            // List other bots
            const otherBots = allBots.filter(b => b !== agent.name);
            if (otherBots.length > 0) {
                res += 'Other team members:\n';
                otherBots.forEach(botName => {
                    res += `  - ${botName} (use !startConversation to coordinate)\n`;
                });
            } else {
                res += 'No other bots online.\n';
            }

            return res;
        }
    },
];
