/* =========================================================================
   BioDota: Сущности игрового мира (Бактерии, Башни, Нейтралы, Кормушки, Снаряды)
   ========================================================================= */

class Food {
  constructor(x, y, amount = 1.0) {
    this.x = x;
    this.y = y;
    this.amount = amount;
    this.radius = 4 * Math.sqrt(this.amount);
    this.pulse = Math.random() * Math.PI * 2;
  }
  update() { this.pulse += 0.05; }
  draw(c) {
    c.save();
    const r = this.radius + Math.sin(this.pulse) * 0.8;
    c.beginPath();
    c.arc(this.x, this.y, r, 0, Math.PI * 2);
    c.fillStyle = '#fbbf24';
    c.shadowColor = '#f59e0b';
    c.shadowBlur = 8;
    c.fill();
    c.restore();
  }
}

class CombatSpark {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 4;
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd;
    this.life = 1.0;
    this.decay = 0.04 + Math.random() * 0.03;
    this.color = color;
    this.size = 2.5 + Math.random() * 2.5;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }
  draw(c) {
    if (this.life <= 0) return;
    c.save();
    c.globalAlpha = Math.max(0, this.life);
    c.beginPath();
    c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    c.fillStyle = this.color;
    c.shadowColor = this.color;
    c.shadowBlur = 6;
    c.fill();
    c.restore();
  }
}

class PlasmaBolt {
  constructor(x, y, target, strain, damage = 1.15) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.strain = strain;
    this.speed = 13.5;
    this.dead = false;
    this.damage = damage;
  }
  update(dt) {
    if (!this.target || this.target.dead) { this.dead = true; return; }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 18) {
      const effectiveDmg = this.damage * (this.target.getEffectiveDefenseMult ? this.target.getEffectiveDefenseMult() : 1.0);
      this.target.energy -= effectiveDmg;
      if (this.target.damageTaken !== undefined) this.target.damageTaken += effectiveDmg;
      sparks.push(new CombatSpark(this.target.x, this.target.y, this.strain === 'alpha' ? '#34d399' : '#fb7185'));
      playTone('clash');
      if (this.target.energy <= 0) this.target.kill('Уничтожен Супер-Бактерией');
      this.dead = true;
      return;
    }
    this.x += (dx / dist) * this.speed * 60 * dt;
    this.y += (dy / dist) * this.speed * 60 * dt;
  }
  draw(c) {
    c.save();
    c.beginPath();
    c.arc(this.x, this.y, 6.5, 0, Math.PI * 2);
    c.fillStyle = this.strain === 'alpha' ? '#34d399' : '#f43f5e';
    c.shadowColor = this.strain === 'alpha' ? '#10b981' : '#e11d48';
    c.shadowBlur = 12;
    c.fill();
    c.restore();
  }
}

class SuperBacterium {
  constructor(x, y, strain, tier = 'mid') {
    this.x = x;
    this.y = y;
    this.strain = strain;
    this.tier = tier;

    let hpMultiplier = 1.0;
    let dmgMultiplier = 1.0;
    let baseRadius = 20;
    let baseRange = 150;

    if (tier === 'central') {
      hpMultiplier = 0.5; dmgMultiplier = 0.5; baseRadius = 18; baseRange = 140;
    } else if (tier === 'base') {
      hpMultiplier = 1.5; dmgMultiplier = 1.5; baseRadius = 23; baseRange = 165;
    }

    this.maxHp = 9.0 * hpMultiplier;
    this.hp = this.maxHp;
    this.damage = 1.15 * dmgMultiplier;
    this.range = baseRange;
    this.radius = baseRadius;
    this.attackCooldown = 0.40;
    this.attackTimer = Math.random() * this.attackCooldown;
    this.dead = false;
    this.pulse = Math.random() * Math.PI;
  }

  update(dt, enemies) {
    if (this.dead) return;
    this.pulse += dt * 3;
    this.attackTimer += dt;
    if (this.attackTimer >= this.attackCooldown) {
      let target = null;
      let minDist = this.range;
      for (let b of enemies) {
        if (b.dead) continue;
        const dist = Math.hypot(b.x - this.x, b.y - this.y);
        if (dist < minDist) { minDist = dist; target = b; }
      }
      if (target) {
        this.attackTimer = 0;
        projectiles.push(new PlasmaBolt(this.x, this.y, target, this.strain, this.damage));
        playTone('tower_fire');
      }
    }
  }

  draw(c) {
    if (this.dead) return;
    const isAlpha = this.strain === 'alpha';
    const color = isAlpha ? '#10b981' : '#f43f5e';
    const glow = isAlpha ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)';

    c.save();
    c.beginPath();
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    c.fillStyle = '#090e17';
    c.strokeStyle = color;
    c.lineWidth = 3.5;
    c.shadowColor = glow;
    c.shadowBlur = 16;
    c.fill();
    c.stroke();

    const coreScale = 1 + Math.sin(this.pulse) * 0.15;
    c.beginPath();
    c.arc(this.x, this.y, (this.radius * 0.4) * coreScale, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();

    const hpPct = Math.max(0, this.hp / this.maxHp);
    const barW = this.radius * 2.2;
    c.fillStyle = 'rgba(0, 0, 0, 0.85)';
    c.fillRect(this.x - barW / 2, this.y - this.radius - 10, barW, 4.5);
    c.fillStyle = isAlpha ? '#34d399' : '#fb7185';
    c.fillRect(this.x - barW / 2, this.y - this.radius - 10, barW * hpPct, 4.5);
    c.restore();
  }
}

class NeutralGuardian {
  constructor(homeX, homeY, name) {
    this.homeX = homeX;
    this.homeY = homeY;
    this.x = homeX;
    this.y = homeY;
    this.name = name;
    this.strain = 'neutral';
    this.maxEnergy = 1.6;
    this.energy = this.maxEnergy;
    this.damage = 0.32;
    this.defenseMult = 0.75;
    this.aggroRadius = 75;
    this.leashRadius = 45;
    this.length = 22;
    this.width = 15;
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 0.85;
    this.dead = false;
    this.respawnTimer = 0;
    this.respawnDelay = 9.0;
    this.kills = 0;
  }

  update(dt, allColony) {
    if (this.dead) {
      this.respawnTimer += dt;
      if (this.respawnTimer >= this.respawnDelay) {
        this.dead = false;
        this.energy = this.maxEnergy;
        this.x = this.homeX;
        this.y = this.homeY;
        this.respawnTimer = 0;
        for (let k = 0; k < 10; k++) sparks.push(new CombatSpark(this.homeX, this.homeY, '#c084fc'));
      }
      return;
    }

    let nearestTarget = null;
    let minDist = this.aggroRadius;
    for (let b of allColony) {
      if (b.dead || b.strain === 'neutral') continue;
      const d = Math.hypot(b.x - this.x, b.y - this.y);
      if (d < minDist) { minDist = d; nearestTarget = b; }
    }

    const distToHome = Math.hypot(this.x - this.homeX, this.y - this.homeY);

    if (nearestTarget && distToHome < this.leashRadius) {
      const targetAngle = Math.atan2(nearestTarget.y - this.y, nearestTarget.x - this.x);
      this.angle += Math.sin(targetAngle - this.angle) * 0.35;
      this.speed = 1.2 * CONFIG.mobility;

      if (minDist < (this.length + nearestTarget.length) * 0.45) {
        const dmg = this.damage * dt * 60;
        nearestTarget.energy -= dmg * nearestTarget.getEffectiveDefenseMult();
        nearestTarget.damageTaken += dmg;

        const returnDmg = 0.65 * nearestTarget.getEffectiveDamageMult() * this.defenseMult * dt * 60;
        this.energy -= returnDmg;

        if (Math.random() < 0.3) {
          sparks.push(new CombatSpark(this.x, this.y, '#e879f9'));
          playTone('clash');
        }

        if (nearestTarget.energy <= 0 && !nearestTarget.dead) {
          nearestTarget.kill('Убит Лесным Стражем');
          this.kills++;
          this.energy = Math.min(this.maxEnergy, this.energy + 0.4);
        }

        if (this.energy <= 0) {
          this.kill(nearestTarget);
          return;
        }
      }
    } else {
      if (distToHome > 8) {
        const homeAngle = Math.atan2(this.homeY - this.y, this.homeX - this.x);
        this.angle += Math.sin(homeAngle - this.angle) * 0.35;
        this.speed = 0.9 * CONFIG.mobility;
      } else {
        this.speed = 0.15;
        this.angle += (Math.random() - 0.5) * 0.2;
      }
      this.energy = Math.min(this.maxEnergy, this.energy + dt * 0.35);
    }

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
  }

  kill(killer) {
    this.dead = true;
    this.respawnTimer = 0;
    playTone('die');

    if (killer && !killer.dead) {
      killer.energy = Math.min(1.0, killer.energy + 0.28);
      killer.kills++;
      killer.mutations.damageBonus = (killer.mutations.damageBonus || 0) + 0.10;
      killer.mutations.defenseBonus = Math.min(0.55, (killer.mutations.defenseBonus || 0) + 0.08);
      killer.mutations.speedBonus = Math.min(0.45, (killer.mutations.speedBonus || 0) + 0.06);
      killer.mutations.lifespanBonus = (killer.mutations.lifespanBonus || 0) + 0.10;

      for (let k = 0; k < 8; k++) sparks.push(new CombatSpark(killer.x, killer.y, '#fbbf24'));
      const sName = killer.strain === 'alpha' ? 'Radiant' : 'Dire';
      showNotification(`🧬 Бактерия [${sName}] поглотила биомассу лагеря (+10% к урону)`);
    }

    for (let i = 0; i < 6; i++) {
      foods.push(new Food(this.x + (Math.random() - 0.5) * 35, this.y + (Math.random() - 0.5) * 35, 1.0));
    }
  }

  draw(c) {
    if (this.dead) {
      c.save();
      const pct = Math.min(1, this.respawnTimer / this.respawnDelay);
      c.beginPath();
      c.arc(this.homeX, this.homeY, 15, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      c.strokeStyle = 'rgba(192, 132, 252, 0.7)';
      c.lineWidth = 2.5;
      c.stroke();
      c.restore();
      return;
    }

    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.angle);

    c.beginPath();
    c.ellipse(0, 0, this.length * 0.62, this.width * 0.62, 0, 0, Math.PI * 2);
    c.fillStyle = '#220b38';
    c.strokeStyle = '#c084fc';
    c.lineWidth = 2.2;
    c.shadowColor = '#a855f7';
    c.shadowBlur = 4;
    c.fill();
    c.stroke();

    c.fillStyle = '#fbbf24';
    c.beginPath();
    c.arc(0, 0, 4.5, 0, Math.PI * 2);
    c.fill();

    const hpPct = Math.max(0, this.energy / this.maxEnergy);
    c.rotate(-this.angle);
    c.fillStyle = 'rgba(0, 0, 0, 0.85)';
    c.fillRect(-16, -this.width - 7, 32, 4);
    c.fillStyle = '#d8b4fe';
    c.fillRect(-16, -this.width - 7, 32 * hpPct, 4);
    c.restore();
  }
}

class AutomaticFeeder {
  constructor(x, y, strainType) {
    this.x = x;
    this.y = y;
    this.strainType = strainType;
    this.timer = Math.random() * CONFIG.feederInterval;
    this.pulseRings = [];
    this.radius = 48;
    this.maxHp = 175.0;
    this.hp = this.maxHp;
    this.dead = false;
  }

  update(dt) {
    if (this.dead) return;
    this.timer += dt;
    if (this.timer >= CONFIG.feederInterval) {
      this.timer = 0;
      this.dispenseBatch();
    }

    for (let i = this.pulseRings.length - 1; i >= 0; i--) {
      const ring = this.pulseRings[i];
      ring.r += 2.2;
      ring.alpha -= 0.022;
      if (ring.alpha <= 0) this.pulseRings.splice(i, 1);
    }
  }

  dispenseBatch() {
    if (this.dead) return;
    this.pulseRings.push({ r: this.radius, alpha: 0.9 });
    for (let i = 0; i < CONFIG.feederBatchSize; i++) {
      if (foods.length >= 750) break;
      const angle = Math.random() * Math.PI * 2;
      const dist = this.radius + 12 + Math.random() * 70;
      const fx = Math.min(VIRTUAL_WIDTH - 40, Math.max(40, this.x + Math.cos(angle) * dist));
      const fy = Math.min(VIRTUAL_HEIGHT - 40, Math.max(40, this.y + Math.sin(angle) * dist));
      foods.push(new Food(fx, fy));
    }
  }

  draw(c) {
    const isAlpha = this.strainType === 'alpha';
    const mainColor = isAlpha ? '#10b981' : '#f43f5e';
    const glowColor = isAlpha ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)';

    for (let ring of this.pulseRings) {
      c.save();
      c.beginPath();
      c.arc(this.x, this.y, ring.r, 0, Math.PI * 2);
      c.strokeStyle = mainColor;
      c.globalAlpha = ring.alpha;
      c.lineWidth = 2.5;
      c.setLineDash([6, 6]);
      c.stroke();
      c.restore();
    }

    c.save();
    c.beginPath();
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    c.fillStyle = 'rgba(10, 15, 23, 0.96)';
    c.strokeStyle = mainColor;
    c.lineWidth = 4;
    c.shadowColor = glowColor;
    c.shadowBlur = 24;
    c.fill();
    c.stroke();

    const progress = (this.timer / CONFIG.feederInterval);
    c.beginPath();
    c.arc(this.x, this.y, this.radius - 6, -Math.PI / 2, (-Math.PI / 2) + progress * Math.PI * 2);
    c.strokeStyle = mainColor;
    c.lineWidth = 5;
    c.stroke();

    c.beginPath();
    c.arc(this.x, this.y, 14, 0, Math.PI * 2);
    c.fillStyle = isAlpha ? '#34d399' : '#fb7185';
    c.fill();

    const hpPct = Math.max(0, this.hp / this.maxHp);
    const barW = 82;
    const barH = 5;
    c.fillStyle = 'rgba(0, 0, 0, 0.85)';
    c.fillRect(this.x - barW / 2, this.y + this.radius + 6, barW, barH);
    c.fillStyle = isAlpha ? '#34d399' : '#fb7185';
    c.fillRect(this.x - barW / 2, this.y + this.radius + 6, barW * hpPct, barH);
    c.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    c.lineWidth = 1;
    c.strokeRect(this.x - barW / 2, this.y + this.radius + 6, barW, barH);

    const activeSpec = isAlpha ? SPECIES_CONFIG[currentAlphaSpecies] : SPECIES_CONFIG[currentBetaSpecies];
    const labelY = this.y - this.radius - 22;
    const textLabel = activeSpec.name;
    
    c.font = 'bold 18px "Inter", sans-serif';
    const textWidth = c.measureText(textLabel).width;
    
    c.fillStyle = 'rgba(10, 15, 24, 0.95)';
    c.strokeStyle = mainColor;
    c.lineWidth = 1.8;
    const padX = 14, padY = 7;
    c.beginPath();
    c.roundRect(this.x - textWidth / 2 - padX, labelY - 14 - padY, textWidth + padX * 2, 28 + padY, 8);
    c.fill();
    c.stroke();

    c.fillStyle = isAlpha ? '#6ee7b7' : '#fda4af';
    c.textAlign = 'center';
    c.fillText(textLabel, this.x, labelY + 4);

    if (!simStarted) {
      c.font = '14px "JetBrains Mono", monospace';
      c.fillStyle = '#67e8f9';
      c.fillText('👆 [Клик: сменить вид]', this.x, this.y + this.radius + 26);
    } else {
      c.font = '14px "JetBrains Mono", monospace';
      c.fillStyle = '#64748b';
      c.fillText('🔒 [Зафиксировано]', this.x, this.y + this.radius + 26);
    }
    c.restore();
  }
}

class AntibioticZone {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.maxRadius = 45 + Math.random() * 15;
    this.life = 1.0;
    this.decayRate = 0.0022;
  }
  update(dt) {
    if (this.radius < this.maxRadius) this.radius += 55 * dt;
    this.life -= this.decayRate * 60 * dt;
  }
  draw(c) {
    if (this.life <= 0) return;
    c.save();
    c.beginPath();
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    c.fillStyle = `rgba(168, 85, 247, ${this.life * 0.15})`;
    c.fill();
    c.strokeStyle = `rgba(192, 132, 252, ${this.life * 0.4})`;
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]);
    c.stroke();
    c.restore();
  }
}

class Bacterium {
  constructor(x, y, parent = null, forcedStrain = null, forcedSpecies = null) {
    this.x = x;
    this.y = y;
    this.id = Math.random().toString(36).substring(2, 9);
    
    if (forcedStrain) this.strain = forcedStrain;
    else if (parent) this.strain = parent.strain;
    else this.strain = Math.random() < 0.5 ? 'alpha' : 'beta';

    if (forcedSpecies) this.speciesId = forcedSpecies;
    else if (parent) this.speciesId = parent.speciesId;
    else this.speciesId = (this.strain === 'alpha') ? currentAlphaSpecies : currentBetaSpecies;
    
    this.spec = SPECIES_CONFIG[this.speciesId] || SPECIES_CONFIG.warrior;

    this.damageDealt = 0;
    this.damageTaken = 0;
    this.foodEaten = 0;
    
    const timeBonus = Math.min(1.2, (typeof simulationTime !== 'undefined' ? simulationTime : 0) * 0.0015);
    this.timeEvoBonus = timeBonus;

    this.mutations = parent ? { ...parent.mutations } : {
      damageBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      lifespanBonus: 0
    };

    const baseLen = (20 + Math.random() * 6);
    if (this.spec.shape === 'sphere') {
      this.length = parent ? parent.length * (0.97 + Math.random() * 0.06) : (baseLen * 1.15);
      this.width = this.length * 0.82;
    } else if (this.spec.shape === 'slender') {
      this.length = parent ? parent.length * (0.97 + Math.random() * 0.06) : (baseLen * 1.35);
      this.width = this.length * 0.32;
    } else {
      this.length = parent ? parent.length * (0.96 + Math.random() * 0.08) : baseLen;
      this.width = this.length * 0.46;
    }

    this.generation = parent ? parent.generation + 1 : 1;
    if (this.generation > highestGeneration) highestGeneration = this.generation;

    this.age = 0;
    const effLifespanMult = this.spec.lifespanMult * (1 + this.mutations.lifespanBonus) * (1 + this.timeEvoBonus * 0.5);
    this.lifespan = CONFIG.lifespanSeconds * effLifespanMult * (0.85 + Math.random() * 0.3);

    this.energy = parent ? 0.48 : (0.55 + Math.random() * 0.25);
    this.kills = parent ? Math.floor(parent.kills * 0.5) : 0;
    
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 1.0;
    this.vx = 0;
    this.vy = 0;

    this.groupSize = 1;
    this.currentBehavior = 'forage';

    this.isFeederGuard = false;
    this.guardPole = 0;

    this.tumbleTimer = Math.floor(15 + Math.random() * 40);
    this.isTumbling = false;
    this.inCombat = false;
    this.flagellaPhase = Math.random() * Math.PI * 2;

    this.isDividing = false;
    this.divisionProgress = 0;

    this.baseHue = (this.strain === 'alpha') ? 155 : 345;
    if (parent) {
      const mutate = Math.random() < CONFIG.mutationRate;
      this.hue = mutate ? (parent.hue + (Math.random() - 0.5) * 18 + 360) % 360 : parent.hue;
    } else {
      this.hue = this.baseHue + (Math.random() - 0.5) * 15;
    }

    this.dead = false;
    this.deathReason = "";
    this.opacity = 1.0;
  }

  getEffectiveDamageMult() {
    return this.spec.damageMult * (1 + this.mutations.damageBonus) * (1 + (this.timeEvoBonus || 0));
  }

  getEffectiveDefenseMult() {
    const baseDef = this.spec.defenseMult * (1 - this.mutations.defenseBonus);
    const timeDefBuff = 1 / (1 + (this.timeEvoBonus || 0) * 0.4);
    return Math.max(0.08, baseDef * timeDefBuff);
  }

  update(dt, foods, antibiotics, allColony, activeSuperBacteria, neutrals) {
    if (this.dead) {
      this.opacity -= 1.8 * dt;
      return;
    }

    this.age += dt;
    const metabolicBurn = CONFIG.baseEnergyCostPerSecond * this.spec.energyBurnMult * dt;
    this.energy -= metabolicBurn;

    if (this.age >= this.lifespan) { this.kill("Старость"); return; }
    if (this.energy <= 0) { this.kill("Истощение"); return; }

    for (let ab of antibiotics) {
      if (ab.life <= 0) continue;
      if (Math.hypot(this.x - ab.x, this.y - ab.y) < ab.radius) {
        this.kill("Осквернение"); playTone('die'); return;
      }
    }

    for (let sb of activeSuperBacteria) {
      if (sb.dead || sb.strain === this.strain) continue;
      const distToSb = Math.hypot(sb.x - this.x, sb.y - this.y);
      if (distToSb < sb.radius + this.length * 0.75) {
        const dmg = 0.65 * CONFIG.combatDamageMultiplier * this.getEffectiveDamageMult() * dt;
        sb.hp -= dmg;
        this.damageDealt += dmg;
        if (Math.random() < 0.25) sparks.push(new CombatSpark(this.x, this.y, '#f59e0b'));
        if (sb.hp <= 0 && !sb.dead) {
          sb.dead = true;
          showNotification(`💥 Супер-бактерия фракции ${sb.strain === 'alpha' ? 'Radiant' : 'Dire'} РАЗРУШЕНА!`);
          for (let k = 0; k < 20; k++) sparks.push(new CombatSpark(sb.x, sb.y, '#f59e0b'));
        }
      }
    }

    const enemyFeeder = feeders.find(f => f.strainType !== this.strain && !f.dead);
    if (enemyFeeder) {
      const distToFeeder = Math.hypot(enemyFeeder.x - this.x, enemyFeeder.y - this.y);
      if (distToFeeder < enemyFeeder.radius + this.length * 0.8) {
        const biteDmg = 0.6 * CONFIG.combatDamageMultiplier * this.getEffectiveDamageMult() * dt;
        enemyFeeder.hp -= biteDmg;
        this.energy = Math.min(1.0, this.energy + biteDmg * 0.35);
        this.damageDealt += biteDmg;
        if (Math.random() < 0.25) {
          sparks.push(new CombatSpark(this.x, this.y, '#f59e0b'));
          playTone('eat');
        }
        if (enemyFeeder.hp <= 0 && !enemyFeeder.dead) {
          enemyFeeder.dead = true;
          enemyFeeder.hp = 0;
          for (let k = 0; k < 35; k++) {
            sparks.push(new CombatSpark(enemyFeeder.x, enemyFeeder.y, this.strain === 'alpha' ? '#34d399' : '#f43f5e'));
          }
          showNotification(`🏆 Кормушка ${enemyFeeder.strainType === 'alpha' ? 'Radiant' : 'Dire'} ПОЛНОСТЬЮ СЪЕДЕНА!`);
          triggerMatchVictory(this.strain, 'feeder_eaten');
          return;
        }
      }
    }

    let allyCount = 0;
    let groupCenterX = 0;
    let groupCenterY = 0;
    let groupPower = this.energy * this.getEffectiveDamageMult() * 2.2;
    const allySearchRadius = 260;

    for (let other of allColony) {
      if (other === this || other.dead || other.strain !== this.strain) continue;
      const d = Math.hypot(other.x - this.x, other.y - this.y);
      if (d < allySearchRadius) {
        allyCount++;
        groupCenterX += other.x;
        groupCenterY += other.y;
        groupPower += other.energy * other.getEffectiveDamageMult() * 2.2;
      }
    }
    this.groupSize = allyCount + 1;
    this.groupPower = groupPower;
    const isSolo = (this.groupSize < 2);

    this.inCombat = false;
    let nearestEnemy = null;
    let minEnemyDist = 650;
    let threatEnemy = null;
    let minThreatDist = 240;

    for (let other of allColony) {
      if (other === this || other.dead || other.strain === this.strain) continue;
      const d = Math.hypot(other.x - this.x, other.y - this.y);
      if (d < minEnemyDist) { minEnemyDist = d; nearestEnemy = other; }
      if (d < minThreatDist) { minThreatDist = d; threatEnemy = other; }

      const contactDist = (this.length + other.length) * 0.45;
      if (d < contactDist) {
        this.inCombat = true;
        other.inCombat = true;

        const myDealtDamage = 0.65 * CONFIG.combatDamageMultiplier * this.getEffectiveDamageMult() * other.getEffectiveDefenseMult() * dt;
        const enemyDealtDamage = 0.65 * CONFIG.combatDamageMultiplier * other.getEffectiveDamageMult() * this.getEffectiveDefenseMult() * dt;

        other.energy -= myDealtDamage;
        this.energy -= enemyDealtDamage;
        this.damageDealt += myDealtDamage;
        this.damageTaken += enemyDealtDamage;
        other.damageDealt += enemyDealtDamage;
        other.damageTaken += myDealtDamage;

        if (Math.random() < 0.35) {
          sparks.push(new CombatSpark((this.x + other.x) / 2, (this.y + other.y) / 2, this.strain === 'alpha' ? '#34d399' : '#fb7185'));
          playTone('clash');
        }

        if (other.energy <= 0 && !other.dead) {
          other.kill(`Убит штаммом ${this.strain === 'alpha' ? 'Radiant' : 'Dire'}`);
          this.kills++;
          this.energy = Math.min(1.0, this.energy + 0.45);
          playTone('eat');
        }
        if (this.energy <= 0) {
          this.kill(`Убит штаммом ${other.strain === 'alpha' ? 'Radiant' : 'Dire'}`);
          other.kills++;
          other.energy = Math.min(1.0, other.energy + 0.45);
          playTone('die');
          return;
        }
      }
    }

    let nearestEnemyTower = null;
    let minTowerDist = 950;
    let canAssaultTower = false;
    for (let sb of activeSuperBacteria) {
      if (sb.dead || sb.strain === this.strain) continue;
      const d = Math.hypot(sb.x - this.x, sb.y - this.y);
      if (d < minTowerDist) { minTowerDist = d; nearestEnemyTower = sb; }
    }
    if (nearestEnemyTower) {
      canAssaultTower = (this.groupPower >= nearestEnemyTower.hp * 0.5);
    }

    let nearestNeutral = null;
    let minNeutralDist = 650;
    let canAssaultNeutral = false;
    for (let n of neutrals) {
      if (n.dead) continue;
      const d = Math.hypot(n.x - this.x, n.y - this.y);
      if (d < minNeutralDist) { minNeutralDist = d; nearestNeutral = n; }
    }
    if (nearestNeutral) {
      canAssaultNeutral = (this.groupPower >= nearestNeutral.energy * 0.25) || (nearestNeutral.energy < 0.95);
    }

    let nearestFood = null;
    let minFoodDist = 700;
    for (let f of foods) {
      const dist = Math.hypot(f.x - this.x, f.y - this.y);
      if (dist < minFoodDist) { minFoodDist = dist; nearestFood = f; }
    }

    const threshold = Math.min(0.95, Math.max(0.45, CONFIG.reproductionEnergyThreshold + this.spec.reproThresholdBonus));
    if (!this.isDividing && this.energy >= threshold && allColony.length < CONFIG.maxBacteria) {
      this.isDividing = true;
      this.divisionProgress = 0;
    }

    if (this.isDividing) {
      this.divisionProgress += 1.5 * dt;
      if (this.divisionProgress >= 1.0) {
        this.split();
        return;
      }
    }

    let targetAngle = null;
    let speedTacticalMult = 1.0;
    const myFeeder = feeders.find(f => f.strainType === this.strain && !f.dead);

    if (this.isFeederGuard && myFeeder) {
      const poleAngle = (this.guardPole === 0) ? (-Math.PI / 4) : (3 * Math.PI / 4);
      const poleX = myFeeder.x + Math.cos(poleAngle) * 78;
      const poleY = myFeeder.y + Math.sin(poleAngle) * 78;

      let invaderNearFeeder = null;
      let minInvaderDist = 180;
      for (let other of allColony) {
        if (other.dead || other.strain === this.strain) continue;
        const dToFeeder = Math.hypot(other.x - myFeeder.x, other.y - myFeeder.y);
        if (dToFeeder < minInvaderDist) {
          minInvaderDist = dToFeeder;
          invaderNearFeeder = other;
        }
      }

      if (invaderNearFeeder) {
        this.currentBehavior = 'guard_defense';
        targetAngle = Math.atan2(invaderNearFeeder.y - this.y, invaderNearFeeder.x - this.x);
        speedTacticalMult = 1.25;
      } else {
        let feederFood = null;
        let minFDist = 160;
        for (let f of foods) {
          const df = Math.hypot(f.x - myFeeder.x, f.y - myFeeder.y);
          if (df < minFDist) {
            const distToMe = Math.hypot(f.x - this.x, f.y - this.y);
            if (distToMe < minFDist) {
              minFDist = distToMe;
              feederFood = f;
            }
          }
        }

        if (feederFood) {
          this.currentBehavior = (this.guardPole === 0 ? 'guard_feed_pole0' : 'guard_feed_pole1');
          targetAngle = Math.atan2(feederFood.y - this.y, feederFood.x - this.x);
          speedTacticalMult = 1.15;
        } else {
          const distToPole = Math.hypot(this.x - poleX, this.y - poleY);
          targetAngle = Math.atan2(poleY - this.y, poleX - this.x);
          this.currentBehavior = (this.guardPole === 0 ? 'guard_patrol_pole0' : 'guard_patrol_pole1');
          speedTacticalMult = distToPole > 24 ? 1.0 : 0.45;
        }

        const otherGuard = allColony.find(b => b !== this && b.strain === this.strain && !b.dead && b.isFeederGuard);
        if (otherGuard) {
          const dGuards = Math.hypot(this.x - otherGuard.x, this.y - otherGuard.y);
          if (dGuards < 85 && dGuards > 1) {
            targetAngle = Math.atan2(this.y - otherGuard.y, this.x - otherGuard.x);
            speedTacticalMult = 1.2;
          }
        }
      }
    } else if (isSolo) {
      if (threatEnemy) {
        this.currentBehavior = 'flee';
        targetAngle = Math.atan2(this.y - threatEnemy.y, this.x - threatEnemy.x);
        speedTacticalMult = 1.25;
      } else if (nearestNeutral && minNeutralDist < 300 && (this.energy > 0.65 && (this.spec.id === 'warrior' || this.energy > nearestNeutral.energy * 0.6))) {
        this.currentBehavior = 'attack_neutral';
        targetAngle = Math.atan2(nearestNeutral.y - this.y, nearestNeutral.x - this.x);
        speedTacticalMult = 1.25;
      } else if (nearestNeutral && minNeutralDist < nearestNeutral.aggroRadius + 20) {
        this.currentBehavior = 'flee_neutral';
        targetAngle = Math.atan2(this.y - nearestNeutral.y, this.x - nearestNeutral.x);
        speedTacticalMult = 1.15;
      } else if (nearestFood) {
        this.currentBehavior = 'forage';
        targetAngle = Math.atan2(nearestFood.y - this.y, nearestFood.x - this.x);
      } else if (allyCount > 0) {
        this.currentBehavior = 'seek_allies';
        targetAngle = Math.atan2((groupCenterY / allyCount) - this.y, (groupCenterX / allyCount) - this.x);
      } else {
        this.currentBehavior = 'roam_safe';
      }
    } else if (this.groupSize >= 15) {
      speedTacticalMult = 1.35;
      if (this.energy < 0.32 && nearestFood && minFoodDist < 160) {
        this.currentBehavior = 'forage_group';
        targetAngle = Math.atan2(nearestFood.y - this.y, nearestFood.x - this.x);
      } else if (nearestEnemy && minEnemyDist < 260) {
        this.currentBehavior = 'swarm_attack_enemy';
        targetAngle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
      } else if (nearestEnemyTower && minTowerDist < 320) {
        this.currentBehavior = 'swarm_assault_tower';
        targetAngle = Math.atan2(nearestEnemyTower.y - this.y, nearestEnemyTower.x - this.x);
      } else if (enemyFeeder && !enemyFeeder.dead) {
        this.currentBehavior = 'swarm_invasion';
        const isAlpha = (this.strain === 'alpha');
        if (isAlpha) {
          if (this.y < 320 && this.x < 1650) targetAngle = Math.atan2(110 - this.y, 1730 - this.x);
          else if (this.y > 760 && this.x < 1650) targetAngle = Math.atan2(970 - this.y, 1730 - this.x);
          else targetAngle = Math.atan2(enemyFeeder.y - this.y, enemyFeeder.x - this.x);
        } else {
          if (this.y < 320 && this.x > 260) targetAngle = Math.atan2(110 - this.y, 190 - this.x);
          else if (this.y > 760 && this.x > 260) targetAngle = Math.atan2(970 - this.y, 190 - this.x);
          else targetAngle = Math.atan2(enemyFeeder.y - this.y, enemyFeeder.x - this.x);
        }
      } else if (nearestEnemy) {
        this.currentBehavior = 'swarm_attack_enemy';
        targetAngle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
      } else {
        const enemyBaseX = (this.strain === 'alpha') ? (VIRTUAL_WIDTH - 190) : 190;
        const enemyBaseY = (this.strain === 'alpha') ? (VIRTUAL_HEIGHT - 190) : 190;
        targetAngle = Math.atan2(enemyBaseY - this.y, enemyBaseX - this.x);
      }
    } else {
      if (nearestNeutral && minNeutralDist < 480 && canAssaultNeutral) {
        this.currentBehavior = 'attack_neutral';
        targetAngle = Math.atan2(nearestNeutral.y - this.y, nearestNeutral.x - this.x);
        speedTacticalMult = 1.25;
      } else if (nearestFood && (minFoodDist < 420 || this.energy < 0.70)) {
        this.currentBehavior = 'forage_group';
        targetAngle = Math.atan2(nearestFood.y - this.y, nearestFood.x - this.x);
      } else {
        if (nearestEnemy && minEnemyDist < 580) {
          this.currentBehavior = 'attack_enemy';
          targetAngle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
          speedTacticalMult = 1.15;
        } else if (nearestNeutral && minNeutralDist < 550 && canAssaultNeutral) {
          this.currentBehavior = 'attack_neutral';
          targetAngle = Math.atan2(nearestNeutral.y - this.y, nearestNeutral.x - this.x);
          speedTacticalMult = 1.25;
        } else if (nearestNeutral && minNeutralDist < 240 && !canAssaultNeutral) {
          this.currentBehavior = 'flee_neutral';
          targetAngle = Math.atan2(this.y - nearestNeutral.y, this.x - nearestNeutral.x);
          speedTacticalMult = 1.15;
        } else if (nearestEnemyTower && canAssaultTower) {
          this.currentBehavior = 'attack_tower';
          targetAngle = Math.atan2(nearestEnemyTower.y - this.y, nearestEnemyTower.x - this.x);
          speedTacticalMult = 1.1;
        } else if (nearestEnemyTower && !canAssaultTower && minTowerDist < nearestEnemyTower.range + 70) {
          this.currentBehavior = 'flee_tower';
          targetAngle = Math.atan2(this.y - nearestEnemyTower.y, this.x - nearestEnemyTower.x);
          speedTacticalMult = 1.15;
        } else if (nearestEnemy) {
          this.currentBehavior = 'attack_enemy';
          targetAngle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
        } else {
          this.currentBehavior = 'push_base';
          const targetDest = enemyFeeder ? enemyFeeder : ((this.strain === 'alpha') ? { x: VIRTUAL_WIDTH - 190, y: VIRTUAL_HEIGHT - 190 } : { x: 190, y: 190 });
          targetAngle = Math.atan2(targetDest.y - this.y, targetDest.x - this.x);
        }
      }
    }

    if (targetAngle !== null) {
      let diff = targetAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steerSpeed = (this.currentBehavior === 'flee' || this.currentBehavior === 'flee_neutral') 
        ? 0.38 : (this.currentBehavior.startsWith('forage') ? 0.34 : 0.24);
      this.angle += diff * steerSpeed;
    } else {
      this.tumbleTimer--;
      if (this.tumbleTimer <= 0) {
        this.angle += (Math.random() - 0.5) * 0.4;
        this.tumbleTimer = Math.floor(25 + Math.random() * 30);
      }
    }

    const terrainSpeed = getTerrainSpeedModifier(this.x, this.y);
    const effSpeedMult = this.spec.speedBonus * (1 + this.mutations.speedBonus) * (1 + (this.timeEvoBonus || 0) * 0.3) * speedTacticalMult;
    this.speed = (this.inCombat ? 1.35 : 1.1) * CONFIG.mobility * effSpeedMult * terrainSpeed;
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;

    this.x += this.vx * 60 * dt;
    this.y += this.vy * 60 * dt;
    this.flagellaPhase += 0.45 * (this.speed / CONFIG.mobility);

    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      if (Math.hypot(f.x - this.x, f.y - this.y) < this.length * 0.75 + f.radius) {
        this.energy = Math.min(1.0, this.energy + CONFIG.foodNutritionalValue * f.amount);
        this.foodEaten++;
        foods.splice(i, 1);
        playTone('eat');
        break;
      }
    }

    const pad = 24 + this.length;
    if (this.x < pad) { this.x = pad; this.angle = Math.PI - this.angle + (Math.random() - 0.5) * 0.4; }
    else if (this.x > VIRTUAL_WIDTH - pad) { this.x = VIRTUAL_WIDTH - pad; this.angle = Math.PI - this.angle + (Math.random() - 0.5) * 0.4; }
    if (this.y < pad) { this.y = pad; this.angle = -this.angle + (Math.random() - 0.5) * 0.4; }
    else if (this.y > VIRTUAL_HEIGHT - pad) { this.y = VIRTUAL_HEIGHT - pad; this.angle = -this.angle + (Math.random() - 0.5) * 0.4; }
  }

  kill(reason) {
    this.dead = true;
    this.deathReason = reason;

    if (this.spec.id === 'toxic') {
      for (let k = 0; k < 14; k++) sparks.push(new CombatSpark(this.x, this.y, '#a855f7'));
      const burstDmg = this.spec.deathBurstDamage || 0.22;
      for (let other of colony) {
        if (other.dead || other.strain === this.strain) continue;
        if (Math.hypot(other.x - this.x, other.y - this.y) < 65) {
          other.energy -= burstDmg * other.getEffectiveDefenseMult();
        }
      }
    }

    if (Math.random() < 0.6 && foods.length < 450) {
      foods.push(new Food(this.x, this.y, 0.7));
    }
  }

  split() {
    this.isDividing = false;
    this.divisionProgress = 0;
    this.energy = CONFIG.divisionEnergyLoss;

    const offset = this.length * 0.5;
    const daughterX = Math.min(VIRTUAL_WIDTH - 40, Math.max(40, this.x - Math.sin(this.angle) * offset));
    const daughterY = Math.min(VIRTUAL_HEIGHT - 40, Math.max(40, this.y + Math.cos(this.angle) * offset));
    this.x += Math.sin(this.angle) * offset;
    this.y -= Math.cos(this.angle) * offset;

    const daughter = new Bacterium(daughterX, daughterY, this, this.strain, this.speciesId);
    daughter.angle = this.angle + Math.PI * 0.5 + (Math.random() - 0.5) * 0.4;
    this.angle -= Math.PI * 0.5;
    daughter.isFeederGuard = false;

    if (this.damageTaken > 0.35) daughter.mutations.defenseBonus = Math.min(0.60, (this.mutations.defenseBonus || 0) + 0.08);
    if (this.damageDealt > 0.40) daughter.mutations.damageBonus = Math.min(1.5, (this.mutations.damageBonus || 0) + 0.1);
    if (this.foodEaten >= 3) daughter.mutations.speedBonus = Math.min(0.6, (this.mutations.speedBonus || 0) + 0.06);
    if (this.age > this.lifespan * 0.5) daughter.mutations.lifespanBonus = Math.min(0.8, (this.mutations.lifespanBonus || 0) + 0.08);

    colony.push(daughter);
    playTone('divide');
  }

  draw(c) {
    if (this.opacity <= 0) return;
    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.angle);
    c.globalAlpha = Math.max(0, this.opacity);

    let sat = 85;
    let lum = 46 + this.energy * 16;
    let hue = this.hue;

    if (this.dead) { hue = 0; sat = 30; lum = 35; }
    else if (this.age / this.lifespan > 0.8) lum -= 12;

    const isSelected = (selectedBacterium === this);

    if (isSelected) {
      c.beginPath();
      c.arc(0, 0, this.length * 1.4, 0, Math.PI * 2);
      c.strokeStyle = '#38bdf8';
      c.lineWidth = 2.5;
      c.setLineDash([4, 4]);
      c.stroke();
      c.setLineDash([]);
    }

    if (this.isFeederGuard && !this.dead) {
      c.beginPath();
      c.arc(0, 0, this.length * 1.05, 0, Math.PI * 2);
      c.strokeStyle = '#fbbf24';
      c.lineWidth = 1.6;
      c.setLineDash([2, 4]);
      c.stroke();
      c.setLineDash([]);
    }

    if (this.groupSize >= 15 && !this.dead) {
      c.beginPath();
      c.arc(0, 0, this.length * 0.95, 0, Math.PI * 2);
      c.strokeStyle = this.strain === 'alpha' ? 'rgba(52, 211, 153, 0.7)' : 'rgba(244, 63, 94, 0.7)';
      c.lineWidth = 1.3;
      c.setLineDash([3, 3]);
      c.stroke();
      c.setLineDash([]);
    }

    if (this.inCombat && !this.dead) {
      c.beginPath();
      c.arc(0, 0, this.length * 1.15, 0, Math.PI * 2);
      c.strokeStyle = '#f59e0b';
      c.lineWidth = 2;
      c.stroke();
    }

    if (!this.dead) {
      c.beginPath();
      c.moveTo(-this.length * 0.55, 0);
      const flagellaSteps = (this.spec.shape === 'slender') ? 4 : 3;
      for (let step = 1; step <= flagellaSteps; step++) {
        const wave = Math.sin(this.flagellaPhase + step * 1.5) * 4.5;
        c.lineTo(-this.length * 0.55 - step * 6.5, wave);
      }
      c.strokeStyle = `hsla(${hue}, ${sat}%, ${lum}%, 0.45)`;
      c.lineWidth = (this.spec.shape === 'slender') ? 2.5 : 1.6;
      c.stroke();
    }

    const hl = (this.length / 2) * (1 + (this.isDividing ? 0.3 : 0));
    const hw = this.width / 2;

    if (this.spec.shape === 'sphere') {
      c.beginPath();
      c.ellipse(0, 0, hl * 0.85, hw, 0, 0, Math.PI * 2);
    } else if (this.isDividing) {
      const pinch = this.divisionProgress * (hw * 0.7);
      c.beginPath();
      c.moveTo(-hl, 0);
      c.bezierCurveTo(-hl, -hw, -hl * 0.3, -hw, 0, -hw + pinch);
      c.bezierCurveTo(hl * 0.3, -hw, hl, -hw, hl, 0);
      c.bezierCurveTo(hl, hw, hl * 0.3, hw, 0, hw - pinch);
      c.bezierCurveTo(-hl * 0.3, hw, -hl, hw, -hl, 0);
      c.closePath();
    } else {
      c.beginPath();
      c.ellipse(-hl * 0.4, 0, hl * 0.5, hw, 0, Math.PI * 0.5, Math.PI * 1.5);
      c.lineTo(hl * 0.4, -hw);
      c.ellipse(hl * 0.4, 0, hl * 0.5, hw, 0, -Math.PI * 0.5, Math.PI * 0.5);
      c.lineTo(-hl * 0.4, hw);
      c.closePath();
    }

    const grad = c.createRadialGradient(0, 0, 1, 0, 0, hl);
    grad.addColorStop(0, `hsla(${hue}, ${sat}%, ${lum + 22}%, 0.98)`);
    grad.addColorStop(0.7, `hsla(${hue}, ${sat}%, ${lum}%, 0.9)`);
    grad.addColorStop(1, `hsla(${hue}, ${sat + 10}%, ${lum - 14}%, 0.95)`);

    c.fillStyle = grad;
    c.shadowColor = `hsla(${hue}, 85%, 50%, 0.6)`;
    c.shadowBlur = isSelected ? 18 : 8;
    c.fill();
    c.shadowBlur = 0;

    c.beginPath();
    c.ellipse(0, 0, hl * 0.38, hw * 0.35, Math.sin(this.age * 2) * 0.2, 0, Math.PI * 2);
    const hasMutations = (this.mutations.damageBonus > 0 || this.mutations.defenseBonus > 0 || this.mutations.speedBonus > 0);
    c.fillStyle = hasMutations ? '#fde047' : `hsla(${hue + 25}, 90%, 85%, 0.5)`;
    c.fill();

    if (this.spec.id === 'toxic') {
      c.beginPath();
      c.arc(0, 0, 3.5, 0, Math.PI * 2);
      c.fillStyle = '#c084fc';
      c.fill();
    }
    c.restore();
  }
}

class VictoryParticle {
  constructor(w, h, isRadiant) {
    this.w = w; this.h = h;
    this.reset(true, isRadiant);
  }
  reset(init = false, isRadiant = true) {
    this.x = this.w / 2 + (Math.random() - 0.5) * 60;
    this.y = this.h / 2 + (Math.random() - 0.5) * 60;
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.5 + Math.random() * 8.5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - (Math.random() * 2);
    this.size = 2.5 + Math.random() * 4.5;
    this.life = 0.6 + Math.random() * 0.8;
    this.maxLife = this.life;
    this.gravity = 0.08;
    const radiantPalette = ['#34d399', '#10b981', '#6ee7b7', '#fde047', '#fbbf24', '#ffffff'];
    const direPalette = ['#f43f5e', '#fb7185', '#e11d48', '#fda4af', '#f59e0b', '#ffffff'];
    const palette = isRadiant ? radiantPalette : direPalette;
    this.color = palette[Math.floor(Math.random() * palette.length)];
  }
  update(dt) {
    this.x += this.vx; this.y += this.vy;
    this.vy += this.gravity; this.vx *= 0.985;
    this.life -= dt;
  }
  draw(c) {
    if (this.life <= 0) return;
    c.save();
    const progress = Math.max(0, this.life / this.maxLife);
    c.globalAlpha = progress;
    c.beginPath();
    c.arc(this.x, this.y, this.size * progress, 0, Math.PI * 2);
    c.fillStyle = this.color;
    c.shadowColor = this.color;
    c.shadowBlur = 10;
    c.fill();
    c.restore();
  }
}