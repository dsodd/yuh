/**
 * S.T.A.L.K.E.R. Combat System
 * Handles PvE combat encounters between players and mutants
 * Enhanced with status effects, special abilities, and critical hit mechanics
 */

const config = require('../config');
const dataManager = require('./dataManager');

// Status effects definitions
const STATUS_EFFECTS = {
  BLEEDING: {
    name: 'Bleeding',
    icon: '🩸',
    damagePerRound: 3,
    duration: 3,
    description: 'You are bleeding, taking damage each round.'
  },
  RADIATION: {
    name: 'Radiation',
    icon: '☢️',
    radiationPerRound: 2,
    duration: 5,
    description: 'You are irradiated, gaining radiation each round.'
  },
  STUNNED: {
    name: 'Stunned',
    icon: '💫',
    missChance: 0.5,
    duration: 1,
    description: 'You are stunned, reducing your accuracy.'
  },
  ENRAGED: {
    name: 'Enraged',
    icon: '😡',
    damageBonus: 0.3,
    accuracyPenalty: 0.1,
    duration: 2,
    description: 'You are enraged, increasing damage but reducing accuracy.'
  }
};

// Mutant special abilities
const MUTANT_ABILITIES = {
  STEALTH: {
    name: 'Stealth',
    description: 'The mutant disappears temporarily, increasing evasion.',
    activationChance: 0.3,
    effect: (mutant, result) => {
      mutant.evasionBonus = 0.6;
      result.combatLog.push(`The ${mutant.name} uses Stealth and disappears from sight!`);
      return true;
    },
    deactivate: (mutant, result) => {
      mutant.evasionBonus = 0;
      result.combatLog.push(`The ${mutant.name} reappears!`);
    }
  },
  FRENZY: {
    name: 'Frenzy',
    description: 'The mutant enters a frenzy, attacking twice in one round.',
    activationChance: 0.25,
    effect: (mutant, result) => {
      mutant.extraAttack = true;
      result.combatLog.push(`The ${mutant.name} enters a frenzied state, moving with unnatural speed!`);
      return true;
    }
  },
  PSYCHIC: {
    name: 'Psychic Attack',
    description: 'The mutant launches a psychic attack, reducing player accuracy.',
    activationChance: 0.2,
    effect: (user, result) => {
      user.accuracyPenalty = 0.3;
      result.combatLog.push(`The ${mutant.name} emits a psychic wave, clouding your mind!`);
      return true;
    },
    deactivate: (user, result) => {
      user.accuracyPenalty = 0;
    }
  },
  RADIATION_AURA: {
    name: 'Radiation Aura',
    description: 'The mutant emits radiation, increasing player radiation level.',
    activationChance: 0.3,
    effect: (user, result) => {
      const radiationAdded = Math.floor(Math.random() * 5) + 3;
      user.radiation = Math.min(100, (user.radiation || 0) + radiationAdded);
      result.radiationGained = (result.radiationGained || 0) + radiationAdded;
      result.combatLog.push(`The ${mutant.name} emits a radiation burst! (+${radiationAdded} RAD)`);
      return true;
    }
  },
  REGENERATION: {
    name: 'Regeneration',
    description: 'The mutant regenerates health each round.',
    activationChance: 1.0, // Always active
    effect: (mutant, result, mutantMaxHealth) => {
      const healAmount = Math.floor(mutantMaxHealth * 0.05);
      mutant.health = Math.min(mutantMaxHealth, mutant.health + healAmount);
      result.combatLog.push(`The ${mutant.name} regenerates ${healAmount} health!`);
      return true;
    }
  }
};

// Weapon type special effects
const WEAPON_EFFECTS = {
  RIFLE: {
    criticalChance: 0.15,
    criticalMultiplier: 1.5,
    special: (result, damage) => {
      // Rifles have a chance to cause bleeding
      if (Math.random() < 0.2) {
        result.statusEffects.push({
          type: 'BLEEDING',
          ...STATUS_EFFECTS.BLEEDING
        });
        result.combatLog.push(`${STATUS_EFFECTS.BLEEDING.icon} Your shot causes the mutant to bleed!`);
      }
      return damage;
    }
  },
  SHOTGUN: {
    criticalChance: 0.2,
    criticalMultiplier: 2.0,
    special: (result, damage) => {
      // Shotguns have a chance to stun
      if (Math.random() < 0.15) {
        result.mutantStatusEffects.push({
          type: 'STUNNED',
          ...STATUS_EFFECTS.STUNNED
        });
        result.combatLog.push(`💥 Your shotgun blast staggers the mutant!`);
      }
      return damage;
    }
  },
  PISTOL: {
    criticalChance: 0.1,
    criticalMultiplier: 1.3,
    special: (result, damage) => {
      // Pistols have a chance for rapid follow-up shot
      if (Math.random() < 0.25) {
        const extraDamage = Math.floor(damage * 0.5);
        result.combatLog.push(`🔫 You quickly fire a follow-up shot for ${extraDamage} additional damage!`);
        return damage + extraDamage;
      }
      return damage;
    }
  },
  SMG: {
    criticalChance: 0.1,
    criticalMultiplier: 1.2,
    special: (result, damage) => {
      // SMGs have a chance for burst fire (multiple hits)
      if (Math.random() < 0.3) {
        const hitCount = Math.floor(Math.random() * 2) + 2; // 2-3 hits
        const burstDamage = Math.floor(damage * (hitCount * 0.4));
        result.combatLog.push(`🔫 Your SMG unleashes a ${hitCount}-round burst for ${burstDamage} total damage!`);
        return burstDamage;
      }
      return damage;
    }
  },
  SNIPER: {
    criticalChance: 0.3,
    criticalMultiplier: 2.5,
    special: (result, damage) => {
      // Sniper rifles have higher crit chance but lower base hit rate
      return damage; // Already factored in with the high crit stats
    }
  },
  MELEE: {
    criticalChance: 0.15,
    criticalMultiplier: 1.7,
    special: (result, damage) => {
      // Melee weapons have a chance to stun
      if (Math.random() < 0.25) {
        result.mutantStatusEffects.push({
          type: 'STUNNED',
          ...STATUS_EFFECTS.STUNNED
        });
        result.combatLog.push(`⚔️ Your powerful strike staggers the mutant!`);
      }
      return damage;
    }
  }
};

/**
 * Simulates combat between a player and a mutant with enhanced mechanics
 * @param {Object} user - User object with stats
 * @param {Object} mutant - Mutant object with stats 
 * @param {Object} weapon - User's equipped weapon
 * @returns {Object} Combat results
 */
function simulateCombat(user, mutant, weapon) {
  // Initialize combat result with enhanced properties
  const result = {
    victory: false,
    damageTaken: 0,
    damageDealt: 0,
    radiationGained: 0,
    combatLog: [],
    statusEffects: [], // Effects on the player
    mutantStatusEffects: [], // Effects on the mutant
    loot: [],
    rubles: 0
  };
  
  // Make copies to avoid modifying the original objects
  const playerHealth = user.health;
  const mutantMaxHealth = mutant.health;
  let mutantHealth = mutantMaxHealth;
  
  // Set up mutant's special abilities (if available)
  const mutantType = mutant.type || 'generic';
  const specialAbilities = [];
  
  // Assign abilities based on mutant type
  if (mutantType.includes('bloodsucker')) {
    specialAbilities.push(MUTANT_ABILITIES.STEALTH);
  } else if (mutantType.includes('pseudogiant') || mutantType.includes('boar')) {
    specialAbilities.push(MUTANT_ABILITIES.FRENZY);
  } else if (mutantType.includes('controller') || mutantType.includes('poltergeist')) {
    specialAbilities.push(MUTANT_ABILITIES.PSYCHIC);
  } else if (mutantType.includes('snork') || mutantType.includes('chimera')) {
    specialAbilities.push(MUTANT_ABILITIES.FRENZY);
  } else if (mutantType.includes('burner') || mutantType.includes('pyrogeist')) {
    specialAbilities.push(MUTANT_ABILITIES.RADIATION_AURA);
  }
  
  // 25% chance to add regeneration to tougher mutants
  if (mutant.health > 100 && Math.random() < 0.25) {
    specialAbilities.push(MUTANT_ABILITIES.REGENERATION);
  }
  
  // Determine weapon type and its special effects
  let weaponType = weapon ? (weapon.type || 'PISTOL').toUpperCase() : 'MELEE';
  if (!WEAPON_EFFECTS[weaponType]) {
    weaponType = 'PISTOL'; // Default if type not found
  }
  
  // Get armor protection if player has armor equipped
  let armorProtection = 0;
  if (user.equipped && user.equipped.armor) {
    const items = dataManager.getItems();
    const armor = items[user.equipped.armor];
    if (armor) {
      armorProtection = armor.protection || 0;
    }
  }
  
  // Apply faction and artifact bonuses
  let combatBonus = 0;
  let weaponBonus = 0;
  
  if (user.bonuses) {
    combatBonus = user.bonuses.combatBonus || 0;
    weaponBonus = user.bonuses.weaponBonus || 0;
  }
  
  // Get base weapon stats or use defaults
  const weaponDamage = weapon ? weapon.damage : 5;
  const weaponAccuracy = weapon ? weapon.accuracy : 60;
  const weaponEffects = WEAPON_EFFECTS[weaponType];
  
  // Combat log introduction
  result.combatLog.push(`You encountered a ${mutant.name} in the zone.`);
  result.combatLog.push(`You're armed with ${weapon ? weapon.name : 'your fists'}.`);
  
  // If the mutant has special abilities, introduce them
  if (specialAbilities.length > 0) {
    const abilityNames = specialAbilities.map(a => a.name);
    if (abilityNames.length === 1) {
      result.combatLog.push(`This ${mutant.name} appears to have a special ability: ${abilityNames[0]}.`);
    } else {
      result.combatLog.push(`This ${mutant.name} appears to have special abilities: ${abilityNames.join(', ')}.`);
    }
  }
  
  // Simulate combat rounds (max 12 rounds before escape)
  const maxRounds = 12;
  let currentRound = 1;
  
  // Track active special abilities and status effects
  const activeAbilities = [];
  
  while (currentRound <= maxRounds && mutantHealth > 0 && user.health > 0) {
    result.combatLog.push(`\n[Round ${currentRound}]`);
    
    // Process active status effects on player
    for (let i = result.statusEffects.length - 1; i >= 0; i--) {
      const effect = result.statusEffects[i];
      
      // Apply effect
      if (effect.type === 'BLEEDING') {
        const bleedDamage = effect.damagePerRound;
        user.health = Math.max(1, user.health - bleedDamage);
        result.damageTaken += bleedDamage;
        result.combatLog.push(`${effect.icon} ${effect.name}: You take ${bleedDamage} bleeding damage.`);
      } else if (effect.type === 'RADIATION') {
        const radDamage = effect.radiationPerRound;
        user.radiation = Math.min(100, user.radiation + radDamage);
        result.radiationGained += radDamage;
        result.combatLog.push(`${effect.icon} ${effect.name}: You gain ${radDamage} radiation.`);
      }
      
      // Decrease duration
      effect.duration--;
      if (effect.duration <= 0) {
        result.combatLog.push(`${effect.name} has worn off.`);
        result.statusEffects.splice(i, 1);
      }
    }
    
    // Process active status effects on mutant
    for (let i = result.mutantStatusEffects.length - 1; i >= 0; i--) {
      const effect = result.mutantStatusEffects[i];
      
      // Apply effect (most are passive and affect later calculations)
      
      // Decrease duration
      effect.duration--;
      if (effect.duration <= 0) {
        result.combatLog.push(`The mutant is no longer ${effect.name.toLowerCase()}.`);
        result.mutantStatusEffects.splice(i, 1);
      }
    }
    
    // Process active mutant abilities
    for (let i = activeAbilities.length - 1; i >= 0; i--) {
      const ability = activeAbilities[i];
      
      // Check for abilities that need to deactivate
      if (ability.deactivate && Math.random() < 0.4) {  // 40% chance to deactivate each round
        ability.deactivate(user, result);
        activeAbilities.splice(i, 1);
      }
    }
    
    // Mutant may activate special abilities
    for (const ability of specialAbilities) {
      // Skip if ability is already active
      if (activeAbilities.some(a => a.name === ability.name)) continue;
      
      // Check activation chance
      if (Math.random() < ability.activationChance) {
        // Special case for regeneration
        if (ability.name === 'Regeneration') {
          ability.effect(mutant, result, mutantMaxHealth);
        } else if (ability.effect(mutant, result)) {
          activeAbilities.push(ability);
        }
      }
    }
    
    // Player attacks first
    // Calculate hit chance - account for status effects and abilities
    let accuracyPenalty = 0;
    for (const effect of result.statusEffects) {
      if (effect.type === 'STUNNED') accuracyPenalty += effect.missChance;
      if (effect.type === 'ENRAGED') accuracyPenalty += effect.accuracyPenalty;
    }
    
    const stealthActive = activeAbilities.some(a => a.name === 'Stealth');
    const mutantEvasionBonus = stealthActive ? 0.3 : 0;
    
    const playerHitChance = Math.max(0.1, Math.min(0.9, (weaponAccuracy / 100) - accuracyPenalty - mutantEvasionBonus + (combatBonus / 100)));
    const playerHits = Math.random() < playerHitChance;
    
    if (playerHits) {
      // Check for critical hit
      const critChance = weaponEffects.criticalChance || 0.1;
      const isCritical = Math.random() < critChance;
      const critMultiplier = isCritical ? (weaponEffects.criticalMultiplier || 1.5) : 1;
      
      // Base damage calculation
      let damage = Math.floor((weaponDamage + weaponBonus) * critMultiplier);
      
      // Apply randomness (±20%)
      const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
      damage = Math.floor(damage * randomFactor);
      
      // Apply weapon special effects
      if (weaponEffects.special) {
        damage = weaponEffects.special(result, damage);
      }
      
      // Check if mutant is stunned (takes extra damage)
      for (const effect of result.mutantStatusEffects) {
        if (effect.type === 'STUNNED') {
          damage = Math.floor(damage * 1.25);
          result.combatLog.push(`Your attack deals extra damage to the stunned mutant!`);
          break;
        }
      }
      
      // Apply damage to mutant
      mutantHealth = Math.max(0, mutantHealth - damage);
      result.damageDealt += damage;
      
      // Log the attack
      if (isCritical) {
        result.combatLog.push(`💥 CRITICAL HIT! You strike the ${mutant.name} for ${damage} damage!`);
      } else {
        result.combatLog.push(`You hit the ${mutant.name} for ${damage} damage.`);
      }
      
      // Check if mutant is defeated
      if (mutantHealth <= 0) {
        result.combatLog.push(`The ${mutant.name} collapses to the ground, lifeless.`);
        result.victory = true;
        break;
      }
    } else {
      // Player misses
      if (stealthActive) {
        result.combatLog.push(`You can't see the ${mutant.name} clearly and miss your attack.`);
      } else {
        result.combatLog.push(`You miss the ${mutant.name}.`);
      }
    }
    
    // Mutant's turn to attack
    let attackCount = 1;
    // Check if mutant has frenzy ability active for extra attack
    if (activeAbilities.some(a => a.name === 'Frenzy')) {
      attackCount = 2;
    }
    
    // Process each mutant attack
    for (let i = 0; i < attackCount; i++) {
      if (i > 0) {
        result.combatLog.push(`The frenzied ${mutant.name} attacks again!`);
      }
      
      // Check if mutant is stunned (may skip attack)
      const isStunned = result.mutantStatusEffects.some(e => e.type === 'STUNNED');
      if (isStunned && Math.random() < 0.5) {
        result.combatLog.push(`The stunned ${mutant.name} struggles to attack.`);
        continue;
      }
      
      const mutantHitChance = Math.min(0.9, Math.max(0.2, mutant.accuracy / 100));
      const mutantHits = Math.random() < mutantHitChance;
      
      if (mutantHits) {
        // Calculate mutant damage with randomness
        const baseDamage = mutant.damage;
        const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
        let damage = Math.floor(baseDamage * randomFactor);
        
        // Apply armor protection
        if (armorProtection > 0) {
          const reduction = damage * (armorProtection / 100);
          damage = Math.max(1, Math.floor(damage - reduction)); // Minimum 1 damage
          result.combatLog.push(`The ${mutant.name} attacks you for ${damage} damage (reduced by armor).`);
        } else {
          result.combatLog.push(`The ${mutant.name} attacks you for ${damage} damage.`);
        }
        
        // Chance to apply status effects from mutant attacks
        if (mutantType.includes('bloodsucker') && Math.random() < 0.3) {
          result.statusEffects.push({
            type: 'BLEEDING',
            ...STATUS_EFFECTS.BLEEDING
          });
          result.combatLog.push(`${STATUS_EFFECTS.BLEEDING.icon} The ${mutant.name}'s attack causes you to bleed!`);
        } else if (mutantType.includes('controller') && Math.random() < 0.4) {
          result.statusEffects.push({
            type: 'STUNNED',
            ...STATUS_EFFECTS.STUNNED
          });
          result.combatLog.push(`${STATUS_EFFECTS.STUNNED.icon} The ${mutant.name}'s psychic attack stuns you!`);
        }
        
        // Apply damage to player
        user.health = Math.max(0, user.health - damage);
        result.damageTaken += damage;
        
        // Check if player is defeated
        if (user.health <= 0) {
          result.combatLog.push(`You're critically wounded and need to retreat.`);
          // In this game, players don't die but escape with 1 HP
          user.health = 1;
          result.damageTaken = playerHealth - 1;
          break;
        }
      } else {
        result.combatLog.push(`The ${mutant.name} misses you.`);
      }
    }
    
    // Check if combat should end after mutant attack
    if (user.health <= 0) break;
    
    // Update round counter
    currentRound++;
    
    // Chance to flee before max rounds (if health is low)
    const healthPercentage = (user.health / config.maxHealth) * 100;
    if (!result.victory && currentRound < maxRounds && healthPercentage < 25 && Math.random() < 0.6) {
      result.combatLog.push(`\nYour health is critical! You decide to retreat from the ${mutant.name}.`);
      break;
    }
  }
  
  // If max rounds reached without victory, player escapes
  if (currentRound > maxRounds && !result.victory) {
    result.combatLog.push(`\nAfter an extended fight, you decide to retreat from the ${mutant.name}.`);
  }
  
  // Final combat summary
  if (result.victory) {
    result.combatLog.push(`\nYou defeated the ${mutant.name}!`);
    if (result.radiationGained > 0) {
      result.combatLog.push(`You gained ${result.radiationGained} radiation during the fight.`);
    }
  } else {
    result.combatLog.push(`\nYou escaped from the ${mutant.name}, but took ${result.damageTaken} damage.`);
    if (result.radiationGained > 0) {
      result.combatLog.push(`You also gained ${result.radiationGained} radiation during the encounter.`);
    }
  }
  
  // Apply any lingering status effects to user
  user.statusEffects = result.statusEffects.filter(e => e.duration > 0);
  
  return result;
}

/**
 * Calculates whether a player would survive an emission
 * @param {Object} user - User object with stats
 * @param {boolean} hasShelter - Whether the user found shelter
 * @returns {Object} - Emission results
 */
function simulateEmission(user, hasShelter) {
  const result = {
    survived: true,
    damageTaken: 0,
    radiationGained: 0,
    log: []
  };
  
  if (hasShelter) {
    result.log.push("You found shelter just in time.");
    result.log.push("The emission passes overhead, but you remain safe inside.");
    
    // Small chance of minor radiation even in shelter
    if (Math.random() < 0.1) {
      const minorRadiation = Math.floor(Math.random() * 5) + 1;
      user.radiation += minorRadiation;
      result.radiationGained = minorRadiation;
      result.log.push(`Some radiation still seeped in. (+${minorRadiation} RAD)`);
    }
  } else {
    // Calculate damage based on emission strength and any protection
    const baseDamage = config.emissionDamage || 40;
    const radiationResistance = user.bonuses && user.bonuses.radiationResistance ? user.bonuses.radiationResistance : 0;
    
    // Apply damage
    const emissionDamage = Math.floor(baseDamage * (1 - (radiationResistance / 100)));
    user.health = Math.max(1, user.health - emissionDamage);
    
    // Apply radiation
    const radiationGain = Math.floor(Math.random() * 30) + 20; // 20-50 radiation
    user.radiation = Math.min(100, user.radiation + radiationGain);
    
    result.survived = true; // Players don't die, just get to 1 HP
    result.damageTaken = emissionDamage;
    result.radiationGained = radiationGain;
    
    result.log.push(`The emission catches you out in the open!`);
    result.log.push(`You're hit with ${emissionDamage} damage and gain ${radiationGain} radiation.`);
    
    if (user.health <= 10) {
      result.log.push(`You barely survive the emission. Find medical help immediately!`);
    } else {
      result.log.push(`You survive the emission, but are badly hurt.`);
    }
  }
  
  return result;
}

/**
 * Simulate PVP combat between two players with enhanced features
 * @param {Object} challenger - The challenger user data
 * @param {Object} target - The target user data
 * @param {Object} challengerWeapon - The challenger's weapon
 * @param {Object} targetWeapon - The target's weapon
 * @returns {Object} Combat results
 */
function simulatePvpCombat(challenger, target, challengerWeapon, targetWeapon) {
  // Initialize result object
  const result = {
    victory: false, // Challenger wins?
    challengerDamageTaken: 0,
    targetDamageTaken: 0,
    combatLog: [],
    statusEffects: {
      challenger: [],
      target: []
    }
  };
  
  // Copy values to avoid modifying original objects
  let challengerHealth = challenger.health;
  let targetHealth = target.health;
  
  // Get armor values
  const items = dataManager.getItems();
  let challengerArmor = 0;
  let targetArmor = 0;
  
  if (challenger.equipped && challenger.equipped.armor) {
    const armor = items[challenger.equipped.armor];
    if (armor) challengerArmor = armor.protection || 0;
  }
  
  if (target.equipped && target.equipped.armor) {
    const armor = items[target.equipped.armor];
    if (armor) targetArmor = armor.protection || 0;
  }
  
  // Get weapon types and effects
  const getChallengerWeaponType = () => {
    return challengerWeapon ? (challengerWeapon.type || 'PISTOL').toUpperCase() : 'MELEE';
  };
  
  const getTargetWeaponType = () => {
    return targetWeapon ? (targetWeapon.type || 'PISTOL').toUpperCase() : 'MELEE';
  };
  
  const challengerWeaponType = getChallengerWeaponType();
  const targetWeaponType = getTargetWeaponType();
  
  // Get weapon effects
  const challengerWeaponEffects = WEAPON_EFFECTS[challengerWeaponType] || WEAPON_EFFECTS.PISTOL;
  const targetWeaponEffects = WEAPON_EFFECTS[targetWeaponType] || WEAPON_EFFECTS.PISTOL;
  
  // Combat start
  result.combatLog.push(`PVP Combat initiated between ${challenger.name} and ${target.name}!`);
  result.combatLog.push(`${challenger.name} is armed with ${challengerWeapon ? challengerWeapon.name : 'fists'}.`);
  result.combatLog.push(`${target.name} is armed with ${targetWeapon ? targetWeapon.name : 'fists'}.`);
  
  // Determine who goes first (based on weapon weight, lighter is faster)
  const challengerWeaponWeight = challengerWeapon ? challengerWeapon.weight || 2 : 0;
  const targetWeaponWeight = targetWeapon ? targetWeapon.weight || 2 : 0;
  
  // 50/50 chance if weights are equal, otherwise lighter weapon goes first
  const challengerGoesFirst = challengerWeaponWeight < targetWeaponWeight || 
                              (challengerWeaponWeight === targetWeaponWeight && Math.random() < 0.5);
  
  // Max rounds
  const maxRounds = 10;
  let currentRound = 1;
  
  // Combat loop
  while (currentRound <= maxRounds && challengerHealth > 0 && targetHealth > 0) {
    result.combatLog.push(`\n[Round ${currentRound}]`);
    
    // Process active status effects for challenger
    for (let i = result.statusEffects.challenger.length - 1; i >= 0; i--) {
      const effect = result.statusEffects.challenger[i];
      
      // Apply effect
      if (effect.type === 'BLEEDING') {
        const bleedDamage = effect.damagePerRound;
        challengerHealth = Math.max(1, challengerHealth - bleedDamage);
        result.challengerDamageTaken += bleedDamage;
        result.combatLog.push(`${effect.icon} ${challenger.name} takes ${bleedDamage} bleeding damage.`);
      }
      
      // Decrease duration
      effect.duration--;
      if (effect.duration <= 0) {
        result.combatLog.push(`${challenger.name}'s ${effect.name} has worn off.`);
        result.statusEffects.challenger.splice(i, 1);
      }
    }
    
    // Process active status effects for target
    for (let i = result.statusEffects.target.length - 1; i >= 0; i--) {
      const effect = result.statusEffects.target[i];
      
      // Apply effect
      if (effect.type === 'BLEEDING') {
        const bleedDamage = effect.damagePerRound;
        targetHealth = Math.max(1, targetHealth - bleedDamage);
        result.targetDamageTaken += bleedDamage;
        result.combatLog.push(`${effect.icon} ${target.name} takes ${bleedDamage} bleeding damage.`);
      }
      
      // Decrease duration
      effect.duration--;
      if (effect.duration <= 0) {
        result.combatLog.push(`${target.name}'s ${effect.name} has worn off.`);
        result.statusEffects.target.splice(i, 1);
      }
    }
    
    // First player's attack
    const firstAttacker = challengerGoesFirst ? challenger : target;
    const firstDefender = challengerGoesFirst ? target : challenger;
    const firstWeapon = challengerGoesFirst ? challengerWeapon : targetWeapon;
    const firstWeaponEffect = challengerGoesFirst ? challengerWeaponEffects : targetWeaponEffects;
    const defenderArmor = challengerGoesFirst ? targetArmor : challengerArmor;
    
    // Calculate hit chance
    const weaponAccuracy = firstWeapon ? firstWeapon.accuracy : 60;
    const hitChance = Math.min(0.9, Math.max(0.3, weaponAccuracy / 100));
    const hits = Math.random() < hitChance;
    
    if (hits) {
      // Check for critical
      const isCritical = Math.random() < (firstWeaponEffect.criticalChance || 0.1);
      const critMultiplier = isCritical ? (firstWeaponEffect.criticalMultiplier || 1.5) : 1.0;
      
      // Calculate damage
      const baseDamage = firstWeapon ? firstWeapon.damage : 5;
      const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
      let damage = Math.floor(baseDamage * randomFactor * critMultiplier);
      
      // Apply weapon special effects
      if (firstWeaponEffect.special) {
        // Create temp result object to capture status effects
        const tempResult = { 
          combatLog: [], 
          statusEffects: challengerGoesFirst ? result.statusEffects.target : result.statusEffects.challenger 
        };
        
        damage = firstWeaponEffect.special(tempResult, damage);
        
        // Add any combat log entries from the special effect
        result.combatLog.push(...tempResult.combatLog);
      }
      
      // Apply armor
      if (defenderArmor > 0) {
        const reduction = damage * (defenderArmor / 100);
        damage = Math.max(1, Math.floor(damage - reduction));
      }
      
      // Apply damage
      if (challengerGoesFirst) {
        targetHealth = Math.max(1, targetHealth - damage);
        result.targetDamageTaken += damage;
      } else {
        challengerHealth = Math.max(1, challengerHealth - damage);
        result.challengerDamageTaken += damage;
      }
      
      // Log the hit
      if (isCritical) {
        result.combatLog.push(`💥 CRITICAL! ${firstAttacker.name} strikes ${firstDefender.name} for ${damage} damage!`);
      } else {
        result.combatLog.push(`${firstAttacker.name} hits ${firstDefender.name} for ${damage} damage.`);
      }
      
      // Check if defender is down
      if ((challengerGoesFirst && targetHealth <= 0) || (!challengerGoesFirst && challengerHealth <= 0)) {
        result.combatLog.push(`${firstDefender.name} is critically wounded and surrenders!`);
        result.victory = challengerGoesFirst; // Challenger wins if they went first
        break;
      }
    } else {
      result.combatLog.push(`${firstAttacker.name} misses ${firstDefender.name}.`);
    }
    
    // Second player's attack
    const secondAttacker = challengerGoesFirst ? target : challenger;
    const secondDefender = challengerGoesFirst ? challenger : target;
    const secondWeapon = challengerGoesFirst ? targetWeapon : challengerWeapon;
    const secondWeaponEffect = challengerGoesFirst ? targetWeaponEffects : challengerWeaponEffects;
    const attackerArmor = challengerGoesFirst ? challengerArmor : targetArmor;
    
    // Calculate hit chance
    const secondWeaponAccuracy = secondWeapon ? secondWeapon.accuracy : 60;
    const secondHitChance = Math.min(0.9, Math.max(0.3, secondWeaponAccuracy / 100));
    const secondHits = Math.random() < secondHitChance;
    
    if (secondHits) {
      // Check for critical
      const isCritical = Math.random() < (secondWeaponEffect.criticalChance || 0.1);
      const critMultiplier = isCritical ? (secondWeaponEffect.criticalMultiplier || 1.5) : 1.0;
      
      // Calculate damage
      const baseDamage = secondWeapon ? secondWeapon.damage : 5;
      const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
      let damage = Math.floor(baseDamage * randomFactor * critMultiplier);
      
      // Apply weapon special effects
      if (secondWeaponEffect.special) {
        // Create temp result object to capture status effects
        const tempResult = { 
          combatLog: [], 
          statusEffects: challengerGoesFirst ? result.statusEffects.challenger : result.statusEffects.target
        };
        
        damage = secondWeaponEffect.special(tempResult, damage);
        
        // Add any combat log entries from the special effect
        result.combatLog.push(...tempResult.combatLog);
      }
      
      // Apply armor
      if (attackerArmor > 0) {
        const reduction = damage * (attackerArmor / 100);
        damage = Math.max(1, Math.floor(damage - reduction));
      }
      
      // Apply damage
      if (challengerGoesFirst) {
        challengerHealth = Math.max(1, challengerHealth - damage);
        result.challengerDamageTaken += damage;
      } else {
        targetHealth = Math.max(1, targetHealth - damage);
        result.targetDamageTaken += damage;
      }
      
      // Log the hit
      if (isCritical) {
        result.combatLog.push(`💥 CRITICAL! ${secondAttacker.name} strikes ${secondDefender.name} for ${damage} damage!`);
      } else {
        result.combatLog.push(`${secondAttacker.name} hits ${secondDefender.name} for ${damage} damage.`);
      }
      
      // Check if defender is down
      if ((challengerGoesFirst && challengerHealth <= 0) || (!challengerGoesFirst && targetHealth <= 0)) {
        result.combatLog.push(`${secondDefender.name} is critically wounded and surrenders!`);
        result.victory = !challengerGoesFirst; // Challenger wins if they went second
        break;
      }
    } else {
      result.combatLog.push(`${secondAttacker.name} misses ${secondDefender.name}.`);
    }
    
    // Update round counter
    currentRound++;
  }
  
  // If max rounds reached, determine winner by damage dealt
  if (currentRound > maxRounds) {
    if (challengerHealth < targetHealth) {
      result.victory = false;
      result.combatLog.push(`The duel ends with ${target.name} in better condition. ${target.name} wins!`);
    } else if (targetHealth < challengerHealth) {
      result.victory = true;
      result.combatLog.push(`The duel ends with ${challenger.name} in better condition. ${challenger.name} wins!`);
    } else {
      // It's a draw!
      result.victory = Math.random() < 0.5; // Random winner
      result.combatLog.push(`The duel ends in a draw! The audience declares ${result.victory ? challenger.name : target.name} the winner by a hair!`);
    }
  }
  
  // Final health values
  challenger.health = challengerHealth;
  target.health = targetHealth;
  
  return result;
}

module.exports = {
  simulateCombat,
  simulateEmission,
  simulatePvpCombat,
  STATUS_EFFECTS,
  MUTANT_ABILITIES,
  WEAPON_EFFECTS
};
