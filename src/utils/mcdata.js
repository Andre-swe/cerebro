import minecraftData from 'minecraft-data';
import settings from '../agent/settings.js';
import { createBot } from 'mineflayer';
import prismarine_items from 'prismarine-item';
import { pathfinder } from 'mineflayer-pathfinder';
import { plugin as pvp } from 'mineflayer-pvp';
import { plugin as collectblock } from 'mineflayer-collectblock';
import { plugin as autoEat } from 'mineflayer-auto-eat';
import plugin from 'mineflayer-armor-manager';
const armorManager = plugin;
let mc_version = settings.minecraft_version;
let mcdata = null;
let Item = null;

/**
 * @typedef {string} ItemName
 * @typedef {string} BlockName
*/

export const WOOD_TYPES = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'];
export const MATCHING_WOOD_BLOCKS = [
    'log',
    'planks',
    'sign',
    'boat',
    'fence_gate',
    'door',
    'fence',
    'slab',
    'stairs',
    'button',
    'pressure_plate',
    'trapdoor'
]
export const WOOL_COLORS = [
    'white',
    'orange',
    'magenta',
    'light_blue',
    'yellow',
    'lime',
    'pink',
    'gray',
    'light_gray',
    'cyan',
    'purple',
    'blue',
    'brown',
    'green',
    'red',
    'black'
]


export function initBot(username) {
    const options = {
        username: username,
        host: settings.host,
        port: settings.port,
        auth: settings.auth,
        version: mc_version,
    }
    if (!mc_version || mc_version === "auto") {
        delete options.version;
    }

    const bot = createBot(options);
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(pvp);
    bot.loadPlugin(collectblock);
    bot.loadPlugin(autoEat);
    bot.loadPlugin(armorManager); // auto equip armor
    bot.once('resourcePack', () => {
        bot.acceptResourcePack();
    });

    bot.once('login', () => {
        mc_version = bot.version;
        mcdata = minecraftData(mc_version);
        Item = prismarine_items(mc_version);
    });

    return bot;
}

export function isHuntable(mob) {
    if (!mob || !mob.name) return false;
    const animals = ['chicken', 'cow', 'llama', 'mooshroom', 'pig', 'rabbit', 'sheep'];
    return animals.includes(mob.name.toLowerCase()) && !mob.metadata[16]; // metadata 16 is not baby
}

export function isHostile(mob) {
    if (!mob || !mob.name) return false;
    return  (mob.type === 'mob' || mob.type === 'hostile') && mob.name !== 'iron_golem' && mob.name !== 'snow_golem';
}

// blocks that don't work with collectBlock, need to be manually collected
export function mustCollectManually(blockName) {
    // all crops (that aren't normal blocks), torches, buttons, levers, redstone,
    const full_names = ['wheat', 'carrots', 'potatoes', 'beetroots', 'nether_wart', 'cocoa', 'sugar_cane', 'kelp', 'short_grass', 'fern', 'tall_grass', 'bamboo',
        'poppy', 'dandelion', 'blue_orchid', 'allium', 'azure_bluet', 'oxeye_daisy', 'cornflower', 'lilac', 'wither_rose', 'lily_of_the_valley', 'wither_rose',
        'lever', 'redstone_wire', 'lantern']
    const partial_names = ['sapling', 'torch', 'button', 'carpet', 'pressure_plate', 'mushroom', 'tulip', 'bush', 'vines', 'fern']
    return full_names.includes(blockName.toLowerCase()) || partial_names.some(partial => blockName.toLowerCase().includes(partial));
}

export function getItemId(itemName) {
    let item = mcdata.itemsByName[itemName];
    if (item) {
        return item.id;
    }
    return null;
}

export function getItemName(itemId) {
    let item = mcdata.items[itemId]
    if (item) {
        return item.name;
    }
    return null;
}

export function getBlockId(blockName) {
    let block = mcdata.blocksByName[blockName];
    if (block) {
        return block.id;
    }
    return null;
}

export function getBlockName(blockId) {
    let block = mcdata.blocks[blockId]
    if (block) {
        return block.name;
    }
    return null;
}

export function getEntityId(entityName) {
    let entity = mcdata.entitiesByName[entityName];
    if (entity) {
        return entity.id;
    }
    return null;
}

export function getAllItems(ignore) {
    if (!ignore) {
        ignore = [];
    }
    let items = []
    for (const itemId in mcdata.items) {
        const item = mcdata.items[itemId];
        if (!ignore.includes(item.name)) {
            items.push(item);
        }
    }
    return items;
}

export function getAllItemIds(ignore) {
    const items = getAllItems(ignore);
    let itemIds = [];
    for (const item of items) {
        itemIds.push(item.id);
    }
    return itemIds;
}

export function getAllBlocks(ignore) {
    if (!ignore) {
        ignore = [];
    }
    let blocks = []
    for (const blockId in mcdata.blocks) {
        const block = mcdata.blocks[blockId];
        if (!ignore.includes(block.name)) {
            blocks.push(block);
        }
    }
    return blocks;
}

export function getAllBlockIds(ignore) {
    const blocks = getAllBlocks(ignore);
    let blockIds = [];
    for (const block of blocks) {
        blockIds.push(block.id);
    }
    return blockIds;
}

export function getAllBiomes() {
    return mcdata.biomes;
}

export function getItemCraftingRecipes(itemName) {
    let itemId = getItemId(itemName);
    if (!mcdata.recipes[itemId]) {
        return null;
    }

    let recipes = [];
    for (let r of mcdata.recipes[itemId]) {
        let recipe = {};
        let ingredients = [];
        if (r.ingredients) {
            ingredients = r.ingredients;
        } else if (r.inShape) {
            ingredients = r.inShape.flat();
        }
        for (let ingredient of ingredients) {
            let ingredientName = getItemName(ingredient);
            if (ingredientName === null) continue;
            if (!recipe[ingredientName])
                recipe[ingredientName] = 0;
            recipe[ingredientName]++;
        }
        recipes.push([
            recipe,
            {craftedCount : r.result.count}
        ]);
    }
    // sort recipes by if their ingredients include common items
    const commonItems = ['oak_planks', 'oak_log', 'coal', 'cobblestone'];
    recipes.sort((a, b) => {
        let commonCountA = Object.keys(a[0]).filter(key => commonItems.includes(key)).reduce((acc, key) => acc + a[0][key], 0);
        let commonCountB = Object.keys(b[0]).filter(key => commonItems.includes(key)).reduce((acc, key) => acc + b[0][key], 0);
        return commonCountB - commonCountA;
    });

    return recipes;
}

export function isSmeltable(itemName) {
    const misc_smeltables = ['beef', 'chicken', 'cod', 'mutton', 'porkchop', 'rabbit', 'salmon', 'tropical_fish', 'potato', 'kelp', 'sand', 'cobblestone', 'clay_ball'];
    return itemName.includes('raw') || itemName.includes('log') || misc_smeltables.includes(itemName);
}

export function getSmeltingFuel(bot) {
    let fuel = bot.inventory.items().find(i => i.name === 'coal' || i.name === 'charcoal' || i.name === 'blaze_rod')
    if (fuel)
        return fuel;
    fuel = bot.inventory.items().find(i => i.name.includes('log') || i.name.includes('planks'))
    if (fuel)
        return fuel;
    return bot.inventory.items().find(i => i.name === 'coal_block' || i.name === 'lava_bucket');
}

export function getFuelSmeltOutput(fuelName) {
    if (fuelName === 'coal' || fuelName === 'charcoal')
        return 8;
    if (fuelName === 'blaze_rod')
        return 12;
    if (fuelName.includes('log') || fuelName.includes('planks'))
        return 1.5
    if (fuelName === 'coal_block')
        return 80;
    if (fuelName === 'lava_bucket')
        return 100;
    return 0;
}

export function getItemSmeltingIngredient(itemName) {
    return {    
        baked_potato: 'potato',
        steak: 'raw_beef',
        cooked_chicken: 'raw_chicken',
        cooked_cod: 'raw_cod',
        cooked_mutton: 'raw_mutton',
        cooked_porkchop: 'raw_porkchop',
        cooked_rabbit: 'raw_rabbit',
        cooked_salmon: 'raw_salmon',
        dried_kelp: 'kelp',
        iron_ingot: 'raw_iron',
        gold_ingot: 'raw_gold',
        copper_ingot: 'raw_copper',
        glass: 'sand'
    }[itemName];
}

export function getItemBlockSources(itemName) {
    let itemId = getItemId(itemName);
    let sources = [];
    for (let block of getAllBlocks()) {
        if (block.drops.includes(itemId)) {
            sources.push(block.name);
        }
    }
    return sources;
}

export function getItemAnimalSource(itemName) {
    return {    
        raw_beef: 'cow',
        raw_chicken: 'chicken',
        raw_cod: 'cod',
        raw_mutton: 'sheep',
        raw_porkchop: 'pig',
        raw_rabbit: 'rabbit',
        raw_salmon: 'salmon',
        leather: 'cow',
        wool: 'sheep'
    }[itemName];
}

export function getBlockTool(blockName) {
    let block = mcdata.blocksByName[blockName];
    if (!block || !block.harvestTools) {
        return null;
    }
    return getItemName(Object.keys(block.harvestTools)[0]);  // Double check first tool is always simplest
}

export function makeItem(name, amount=1) {
    return new Item(getItemId(name), amount);
}

/**
 * Returns the number of ingredients required to use the recipe once.
 * 
 * @param {Recipe} recipe
 * @returns {Object<mc.ItemName, number>} an object describing the number of each ingredient.
 */
export function ingredientsFromPrismarineRecipe(recipe) {
    let requiredIngedients = {};
    if (recipe.inShape)
        for (const ingredient of recipe.inShape.flat()) {
            if(ingredient.id<0) continue; //prismarine-recipe uses id -1 as an empty crafting slot
            const ingredientName = getItemName(ingredient.id);
            requiredIngedients[ingredientName] ??=0;
            requiredIngedients[ingredientName] += ingredient.count;
        }
    if (recipe.ingredients)
        for (const ingredient of recipe.ingredients) {
            if(ingredient.id<0) continue;
            const ingredientName = getItemName(ingredient.id);
            requiredIngedients[ingredientName] ??=0;
            requiredIngedients[ingredientName] -= ingredient.count;
            //Yes, the `-=` is intended.
            //prismarine-recipe uses positive numbers for the shaped ingredients but negative for unshaped.
            //Why this is the case is beyond my understanding.
        }
    return requiredIngedients;
}

/**
 * Calculates the number of times an action, such as a crafing recipe, can be completed before running out of resources.
 * @template T - doesn't have to be an item. This could be any resource.
 * @param {Object.<T, number>} availableItems - The resources available; e.g, `{'cobble_stone': 7, 'stick': 10}`
 * @param {Object.<T, number>} requiredItems - The resources required to complete the action once; e.g, `{'cobble_stone': 3, 'stick': 2}`
 * @param {boolean} discrete - Is the action discrete?
 * @returns {{num: number, limitingResource: (T | null)}} the number of times the action can be completed and the limmiting resource; e.g `{num: 2, limitingResource: 'cobble_stone'}`
 */
export function calculateLimitingResource(availableItems, requiredItems, discrete=true) {
    let limitingResource = null;
    let num = Infinity;
    for (const itemType in requiredItems) {
        if (availableItems[itemType] < requiredItems[itemType] * num) {
            limitingResource = itemType;
            num = availableItems[itemType] / requiredItems[itemType];
        }
    }
    if(discrete) num = Math.floor(num);
    return {num, limitingResource}
}

let loopingItems = new Set();

export function initializeLoopingItems() {

    loopingItems = new Set(['coal',
        'wheat',
        'bone_meal',
        'diamond',
        'emerald',
        'raw_iron',
        'raw_gold',
        'redstone',
        'blue_wool',
        'packed_mud',
        'raw_copper',
        'iron_ingot',
        'dried_kelp',
        'gold_ingot',
        'slime_ball',
        'black_wool',
        'quartz_slab',
        'copper_ingot',
        'lapis_lazuli',
        'honey_bottle',
        'rib_armor_trim_smithing_template',
        'eye_armor_trim_smithing_template',
        'vex_armor_trim_smithing_template',
        'dune_armor_trim_smithing_template',
        'host_armor_trim_smithing_template',
        'tide_armor_trim_smithing_template',
        'wild_armor_trim_smithing_template',
        'ward_armor_trim_smithing_template',
        'coast_armor_trim_smithing_template',
        'spire_armor_trim_smithing_template',
        'snout_armor_trim_smithing_template',
        'shaper_armor_trim_smithing_template',
        'netherite_upgrade_smithing_template',
        'raiser_armor_trim_smithing_template',
        'sentry_armor_trim_smithing_template',
        'silence_armor_trim_smithing_template',
        'wayfinder_armor_trim_smithing_template']);
}


/**
 * Gets a detailed plan for crafting an item considering current inventory
 */
export function getDetailedCraftingPlan(targetItem, count = 1, current_inventory = {}) {
    initializeLoopingItems();
    if (!targetItem || count <= 0 || !getItemId(targetItem)) {
        return "Invalid input. Please provide a valid item name and positive count.";
    }

    if (isBaseItem(targetItem)) {
        const available = current_inventory[targetItem] || 0;
        if (available >= count) return "You have all required items already in your inventory!";
        return `${targetItem} is a base item, you need to find ${count - available} more in the world`;
    }

    const inventory = { ...current_inventory };
    const leftovers = {};
    const plan = craftItem(targetItem, count, inventory, leftovers);
    return formatPlan(targetItem, plan);
}

function isBaseItem(item) {
    return loopingItems.has(item) || getItemCraftingRecipes(item) === null;
}

function craftItem(item, count, inventory, leftovers, crafted = { required: {}, steps: [], leftovers: {} }) {
    // Check available inventory and leftovers first
    const availableInv = inventory[item] || 0;
    const availableLeft = leftovers[item] || 0;
    const totalAvailable = availableInv + availableLeft;

    if (totalAvailable >= count) {
        // Use leftovers first, then inventory
        const useFromLeft = Math.min(availableLeft, count);
        leftovers[item] = availableLeft - useFromLeft;
        
        const remainingNeeded = count - useFromLeft;
        if (remainingNeeded > 0) {
            inventory[item] = availableInv - remainingNeeded;
        }
        return crafted;
    }

    // Use whatever is available
    const stillNeeded = count - totalAvailable;
    if (availableLeft > 0) leftovers[item] = 0;
    if (availableInv > 0) inventory[item] = 0;

    if (isBaseItem(item)) {
        crafted.required[item] = (crafted.required[item] || 0) + stillNeeded;
        return crafted;
    }

    const recipe = getItemCraftingRecipes(item)?.[0];
    if (!recipe) {
        crafted.required[item] = stillNeeded;
        return crafted;
    }

    const [ingredients, result] = recipe;
    const craftedPerRecipe = result.craftedCount;
    const batchCount = Math.ceil(stillNeeded / craftedPerRecipe);
    const totalProduced = batchCount * craftedPerRecipe;

    // Add excess to leftovers
    if (totalProduced > stillNeeded) {
        leftovers[item] = (leftovers[item] || 0) + (totalProduced - stillNeeded);
    }

    // Process each ingredient
    for (const [ingredientName, ingredientCount] of Object.entries(ingredients)) {
        const totalIngredientNeeded = ingredientCount * batchCount;
        craftItem(ingredientName, totalIngredientNeeded, inventory, leftovers, crafted);
    }

    // Add crafting step
    const stepIngredients = Object.entries(ingredients)
        .map(([name, amount]) => `${amount * batchCount} ${name}`)
        .join(' + ');
    crafted.steps.push(`Craft ${stepIngredients} -> ${totalProduced} ${item}`);

    return crafted;
}

function formatPlan(targetItem, { required, steps, leftovers }) {
    const lines = [];

    if (Object.keys(required).length > 0) {
        lines.push('You are missing the following items:');
        Object.entries(required).forEach(([item, count]) => 
            lines.push(`- ${count} ${item}`));
        lines.push('\nOnce you have these items, here\'s your crafting plan:');
    } else {
        lines.push('You have all items required to craft this item!');
        lines.push('Here\'s your crafting plan:');
    }

    lines.push('');
    lines.push(...steps);

    if (Object.keys(required).some(item => item.includes('oak')) && !targetItem.includes('oak')) {
        lines.push('Note: Any varient of wood can be used for this recipe.');
    }

    if (Object.keys(leftovers).length > 0) {
        lines.push('\nYou will have leftover:');
        Object.entries(leftovers).forEach(([item, count]) =>
            lines.push(`- ${count} ${item}`));
    }

    return lines.join('\n');
}

// ========== TOOL TIER & PROGRESSION SYSTEM ==========

/**
 * Tool material tiers from weakest to strongest
 * Each tier unlocks mining capabilities for the next tier's materials
 */
export const TOOL_TIERS = {
    hand: { level: 0, name: 'Hand' },
    wooden: { level: 1, name: 'Wooden' },
    stone: { level: 2, name: 'Stone' },
    iron: { level: 3, name: 'Iron' },
    diamond: { level: 4, name: 'Diamond' },
    netherite: { level: 5, name: 'Netherite' }
};

/**
 * Blocks and their required mining level
 * Level 0 = hand, 1 = wood, 2 = stone, 3 = iron, 4 = diamond
 */
export const MINING_LEVELS = {
    // Level 0 - Hand mineable
    'dirt': 0, 'grass_block': 0, 'sand': 0, 'gravel': 0, 'clay': 0,
    'soul_sand': 0, 'soul_soil': 0, 'netherrack': 0,

    // Level 1 - Wood pickaxe
    'stone': 1, 'cobblestone': 1, 'coal_ore': 1, 'deepslate_coal_ore': 1,
    'copper_ore': 1, 'deepslate_copper_ore': 1, 'nether_quartz_ore': 1,

    // Level 2 - Stone pickaxe
    'iron_ore': 2, 'deepslate_iron_ore': 2, 'raw_iron_block': 2,
    'lapis_ore': 2, 'deepslate_lapis_ore': 2,

    // Level 3 - Iron pickaxe
    'gold_ore': 3, 'deepslate_gold_ore': 3, 'nether_gold_ore': 3,
    'diamond_ore': 3, 'deepslate_diamond_ore': 3,
    'redstone_ore': 3, 'deepslate_redstone_ore': 3,
    'emerald_ore': 3, 'deepslate_emerald_ore': 3,

    // Level 4 - Diamond pickaxe
    'obsidian': 4, 'crying_obsidian': 4, 'respawn_anchor': 4,
    'ancient_debris': 4
};

/**
 * Get the mining level required for a block
 */
export function getMiningLevel(blockName) {
    return MINING_LEVELS[blockName] ?? 0;
}

/**
 * Get tool tier from item name
 */
export function getToolTier(itemName) {
    if (!itemName) return TOOL_TIERS.hand;
    const name = itemName.toLowerCase();
    if (name.includes('netherite')) return TOOL_TIERS.netherite;
    if (name.includes('diamond')) return TOOL_TIERS.diamond;
    if (name.includes('iron')) return TOOL_TIERS.iron;
    if (name.includes('stone')) return TOOL_TIERS.stone;
    if (name.includes('wooden') || name.includes('wood')) return TOOL_TIERS.wooden;
    return TOOL_TIERS.hand;
}

/**
 * Check if a tool can mine a specific block
 */
export function canMineBlock(toolName, blockName) {
    const toolTier = getToolTier(toolName);
    const requiredLevel = getMiningLevel(blockName);
    return toolTier.level >= requiredLevel;
}

/**
 * Get the minimum tool needed to mine a block
 */
export function getMinimumToolForBlock(blockName) {
    const level = getMiningLevel(blockName);
    for (const [tierName, tier] of Object.entries(TOOL_TIERS)) {
        if (tier.level === level) {
            return tierName === 'hand' ? null : `${tierName}_pickaxe`;
        }
    }
    return null;
}

// ========== MINECRAFT PROGRESSION STAGES ==========

export const PROGRESSION_STAGES = [
    {
        id: 'start',
        name: 'Fresh Start',
        description: 'Just spawned, need basic tools',
        goals: ['Get wood', 'Craft crafting table', 'Craft wooden pickaxe'],
        requiredItems: [],
        unlocksItems: ['crafting_table', 'wooden_pickaxe', 'wooden_axe', 'wooden_sword']
    },
    {
        id: 'stone_age',
        name: 'Stone Age',
        description: 'Upgrade to stone tools',
        goals: ['Mine cobblestone', 'Craft stone pickaxe', 'Craft stone sword', 'Build basic shelter'],
        requiredItems: ['wooden_pickaxe'],
        unlocksItems: ['stone_pickaxe', 'stone_axe', 'stone_sword', 'furnace']
    },
    {
        id: 'iron_age',
        name: 'Iron Age',
        description: 'Find and smelt iron for better tools',
        goals: ['Find iron ore', 'Smelt iron ingots', 'Craft iron pickaxe', 'Craft iron armor'],
        requiredItems: ['stone_pickaxe', 'furnace'],
        unlocksItems: ['iron_pickaxe', 'iron_sword', 'iron_helmet', 'iron_chestplate', 'bucket', 'shield']
    },
    {
        id: 'diamond_age',
        name: 'Diamond Age',
        description: 'Mine diamonds for top-tier overworld gear',
        goals: ['Mine at Y=-59 to Y=16', 'Find diamonds', 'Craft diamond pickaxe', 'Craft diamond armor'],
        requiredItems: ['iron_pickaxe'],
        unlocksItems: ['diamond_pickaxe', 'diamond_sword', 'diamond_helmet', 'diamond_chestplate', 'enchanting_table']
    },
    {
        id: 'nether',
        name: 'Nether Expedition',
        description: 'Build portal and explore the Nether',
        goals: ['Collect obsidian (10 blocks)', 'Build nether portal', 'Find fortress', 'Get blaze rods', 'Get nether wart'],
        requiredItems: ['diamond_pickaxe', 'bucket'],
        unlocksItems: ['blaze_rod', 'nether_wart', 'ender_pearl']
    },
    {
        id: 'brewing',
        name: 'Potion Brewing',
        description: 'Create potions for buffs',
        goals: ['Craft brewing stand', 'Brew potions of strength', 'Brew potions of speed'],
        requiredItems: ['blaze_rod', 'nether_wart'],
        unlocksItems: ['brewing_stand', 'potion']
    },
    {
        id: 'end_prep',
        name: 'End Preparation',
        description: 'Prepare to fight the Ender Dragon',
        goals: ['Collect ender pearls (12+)', 'Craft eyes of ender', 'Find stronghold', 'Activate end portal'],
        requiredItems: ['blaze_rod', 'ender_pearl'],
        unlocksItems: ['ender_eye']
    },
    {
        id: 'end_game',
        name: 'The End',
        description: 'Defeat the Ender Dragon',
        goals: ['Enter the End', 'Destroy end crystals', 'Kill Ender Dragon', 'Collect dragon egg'],
        requiredItems: ['ender_eye', 'diamond_sword', 'diamond_armor'],
        unlocksItems: ['dragon_egg', 'elytra']
    }
];

/**
 * Determine current progression stage based on inventory
 */
export function getCurrentProgressionStage(inventory) {
    // inventory is an object like { 'diamond_pickaxe': 1, 'iron_ingot': 5, ... }
    const hasItem = (item) => (inventory[item] || 0) > 0;
    const hasAny = (items) => items.some(hasItem);

    // Check from end-game backwards
    if (hasItem('dragon_egg') || hasItem('elytra')) return 'end_game';
    if (hasItem('ender_eye') && hasAny(['diamond_sword', 'diamond_axe'])) return 'end_prep';
    if (hasItem('brewing_stand') || hasItem('blaze_powder')) return 'brewing';
    if (hasItem('blaze_rod') || hasItem('nether_wart')) return 'nether';
    if (hasAny(['diamond_pickaxe', 'diamond_sword', 'diamond_helmet'])) return 'diamond_age';
    if (hasAny(['iron_pickaxe', 'iron_sword', 'iron_helmet', 'iron_ingot'])) return 'iron_age';
    if (hasAny(['stone_pickaxe', 'stone_sword', 'cobblestone'])) return 'stone_age';
    return 'start';
}

/**
 * Get next progression stage and what's needed
 */
export function getNextProgressionStage(currentStageId) {
    const stageIndex = PROGRESSION_STAGES.findIndex(s => s.id === currentStageId);
    if (stageIndex === -1 || stageIndex >= PROGRESSION_STAGES.length - 1) {
        return null;
    }
    return PROGRESSION_STAGES[stageIndex + 1];
}

/**
 * Get detailed progression plan from current stage
 */
export function getProgressionPlan(inventory) {
    const currentStageId = getCurrentProgressionStage(inventory);
    const currentStage = PROGRESSION_STAGES.find(s => s.id === currentStageId);
    const nextStage = getNextProgressionStage(currentStageId);

    return {
        current: currentStage,
        next: nextStage,
        allStages: PROGRESSION_STAGES
    };
}

/**
 * Format progression plan for display
 */
export function formatProgressionPlan(inventory) {
    const plan = getProgressionPlan(inventory);
    const lines = [];

    lines.push(`=== CURRENT STAGE: ${plan.current.name} ===`);
    lines.push(plan.current.description);
    lines.push('');
    lines.push('Current goals:');
    plan.current.goals.forEach(g => lines.push(`  - ${g}`));

    if (plan.next) {
        lines.push('');
        lines.push(`=== NEXT STAGE: ${plan.next.name} ===`);
        lines.push(plan.next.description);
        lines.push('');
        lines.push('You will need:');
        plan.next.requiredItems.forEach(item => lines.push(`  - ${item}`));
        lines.push('');
        lines.push('This unlocks:');
        plan.next.unlocksItems.slice(0, 5).forEach(item => lines.push(`  - ${item}`));
        if (plan.next.unlocksItems.length > 5) {
            lines.push(`  - ...and ${plan.next.unlocksItems.length - 5} more`);
        }
    } else {
        lines.push('');
        lines.push('🎉 You have reached the end game!');
    }

    return lines.join('\n');
}

// ========== COLLABORATIVE TASK PLANNING ==========

/**
 * Task types for multi-bot collaboration
 */
export const COLLABORATIVE_TASKS = {
    'resource_gathering': {
        name: 'Resource Gathering',
        description: 'Collect resources efficiently by splitting work',
        roles: ['miner', 'lumberjack', 'farmer', 'hunter'],
        scalable: true
    },
    'base_building': {
        name: 'Base Building',
        description: 'Construct a base with multiple bots',
        roles: ['builder', 'material_gatherer', 'decorator'],
        scalable: true
    },
    'nether_expedition': {
        name: 'Nether Expedition',
        description: 'Coordinate Nether exploration safely',
        roles: ['portal_builder', 'scout', 'fighter', 'collector'],
        scalable: false
    },
    'end_raid': {
        name: 'End Dragon Fight',
        description: 'Coordinate to defeat the Ender Dragon',
        roles: ['crystal_destroyer', 'dragon_fighter', 'support'],
        scalable: false
    },
    'trading_post': {
        name: 'Villager Trading',
        description: 'Set up and manage villager trading',
        roles: ['breeder', 'trader', 'transporter'],
        scalable: true
    }
};

/**
 * Generate a collaborative plan for multiple bots
 */
export function generateCollaborativePlan(taskType, botNames, currentInventories) {
    const task = COLLABORATIVE_TASKS[taskType];
    if (!task) return null;

    const numBots = botNames.length;
    const assignments = [];

    // Assign roles based on number of bots
    for (let i = 0; i < numBots; i++) {
        const roleIndex = i % task.roles.length;
        assignments.push({
            bot: botNames[i],
            role: task.roles[roleIndex],
            priority: i < task.roles.length ? 'primary' : 'support'
        });
    }

    return {
        task: task.name,
        description: task.description,
        assignments: assignments,
        coordination: `Bots should communicate progress and share resources. Use !startConversation to coordinate.`
    };
}

/**
 * Format collaborative plan for display
 */
export function formatCollaborativePlan(plan) {
    if (!plan) return 'Unknown task type';

    const lines = [];
    lines.push(`=== COLLABORATIVE TASK: ${plan.task} ===`);
    lines.push(plan.description);
    lines.push('');
    lines.push('Role Assignments:');
    plan.assignments.forEach(a => {
        lines.push(`  ${a.bot}: ${a.role} (${a.priority})`);
    });
    lines.push('');
    lines.push('Coordination: ' + plan.coordination);

    return lines.join('\n');
}
