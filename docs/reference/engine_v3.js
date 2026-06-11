// ═══════════════════════════════════════════════════════════════════
// V3.1 引擎补丁 — 在现有 TIME_TICK 六阶段后追加 V3 子系统结算
// 挂载方式：在现有引擎的 runTimeTick 函数中，phase6_seeds(ctx) 之后、
//           Phase 6.5 HP边界处理之前，调用 v3_phases(ctx)
// 或：独立注册为 VARIABLE_UPDATE_ENDED 监听器（BMI/体型）
// ═══════════════════════════════════════════════════════════════════

// ─── V3 常量表 ───

// 家境系数（泛化后）
var V3_FAMILY_COEF = { 寒门: 0.5, 温饱: 0.75, 小资: 1.0, 富庶: 2.0, 豪门: 4.0 };

// 身高生长曲线参数（基于世界卫生组织标准简化）
var HEIGHT_GROWTH = {
  // 发育阶段 → 年增速基线(cm)，体质每+10额外+0.3cm/年
  '婴幼儿': 20, '儿童': 5.5, '青春期前': 5, '青春期': 8, '成熟': 0, '衰老': -0.2
};
var HEIGHT_BASE = { '男': 172, '女': 160 };

// BMI 阈值 → 体型标签
var BMI_TIERS = [
  { max: 16.5, label: '过瘦' },
  { max: 18.5, label: '偏瘦' },
  { max: 24,   label: '正常' },
  { max: 28,   label: '_split' }, // 偏壮 or 偏胖 by 体质
  { max: 99,   label: '肥胖' }
];

// 体型 → 属性修饰（修饰通道条目）
var BODY_TYPE_EFFECTS = {
  '过瘦':  [{ 通道: '魅力', op: '加', 强度: -3 }, { 通道: '精力上限', op: '加', 强度: -10 }],
  '偏瘦':  [],
  '正常':  [{ 通道: '魅力', op: '加', 强度: 1 }],
  '偏壮':  [{ 通道: '魅力', op: '加', 强度: 2 }, { 通道: 'HP上限', op: '加', 强度: 10 }],
  '偏胖':  [{ 通道: '魅力', op: '加', 强度: -2 }, { 通道: '精力上限', op: '加', 强度: -5 }],
  '肥胖':  [{ 通道: '魅力', op: '加', 强度: -5 }, { 通道: 'HP上限', op: '加', 强度: -10 }, { 通道: '精力上限', op: '加', 强度: -15 }]
};

// 发育阶段 → 年龄阈值
var DEV_STAGE_AGE = [
  { max: 2, stage: '婴幼儿' },
  { max: 9, stage: '儿童' },
  { max: 12, stage: '青春期前' },
  { max: 17, stage: '青春期' },
  { max: 55, stage: '成熟' },
  { max: 999, stage: '衰老' }
];

// 学业：技能等级 → 实力系数近似
// 学科实力系数 = 0.5*技能熟练度/100 + 0.3*智慧/100 + 0.2*智商映射
function calcAcademicPower(stat, subjectSkillName) {
  var skills = _.get(stat, '主角.技能', {}) || {};
  var skill = skills[subjectSkillName];
  var prof = skill ? num(_.get(skill, '熟练度', 0)) : 0;
  var wisdom = num(_.get(stat, '主角.属性.智慧', 10));
  var iq = num(_.get(stat, '主角.派生.智商', 100));
  var iqMap = _.clamp((iq - 70) / 130, 0, 1); // 70→0, 200→1
  return 0.5 * prof / 100 + 0.3 * wisdom / 100 + 0.2 * iqMap;
}

// 统一检定公式
// 成功度 = clamp(基线 + 熟练度×0.4 + 等级×3 + 检定属性/2 + 情境 - DC, 0, 100)
function unifiedCheck(stat, skillName, attrName, dc, situationBonus) {
  var skills = _.get(stat, '主角.技能', {}) || {};
  var skill = skills[skillName] || {};
  var prof = num(skill.熟练度, 0);
  var level = num(skill.等级, 0);
  var attr = num(_.get(stat, '主角.属性.' + attrName, 10));
  var baseline = 30;
  var score = _.clamp(baseline + prof * 0.4 + level * 3 + attr / 2 + (situationBonus || 0) - (dc || 50), 0, 100);
  // 五档
  var band;
  if (score >= 90) band = '大成功';
  else if (score >= 60) band = '成功';
  else if (score >= 40) band = '勉强';
  else if (score >= 15) band = '失败';
  else band = '大失败';
  return { score: Math.round(score), band: band };
}


// ═══════════════════════════════════════════════════════════════════
// V3 Phase A · 体征系统（身高生长 + 发育阶段推进）
// 挂载点：phase2_physiology 之后
// ═══════════════════════════════════════════════════════════════════
function v3_phaseA_physique(ctx) {
  var stat = ctx.stat;
  var age = num(_.get(stat, '主角.年龄', 0));
  var yearEq = ctx.yearEq || 1;
  var sex = String(_.get(stat, '主角.性别', '男'));

  // ── 发育阶段推进 ──
  var newDevStage = '成熟';
  for (var i = 0; i < DEV_STAGE_AGE.length; i++) {
    if (age <= DEV_STAGE_AGE[i].max) { newDevStage = DEV_STAGE_AGE[i].stage; break; }
  }
  _.set(stat, '主角.体征.发育阶段', newDevStage);

  // ── 成年身高初始化（首次）──
  var targetH = num(_.get(stat, '主角.体征._成年身高', 0));
  if (targetH <= 0) {
    var base = HEIGHT_BASE[sex] || 170;
    var conMod = (num(_.get(stat, '主角.属性.体质', 10)) - 10) * 0.5;
    var rand = (Math.random() - 0.5) * 10; // ±5
    targetH = Math.round(base + conMod + rand);
    _.set(stat, '主角.体征._成年身高', targetH);
  }

  // ── 身高生长 ──
  var curH = num(_.get(stat, '主角.体征.身高', 0));
  if (curH <= 0 && age > 0) {
    // 首次：据年龄估算当前身高
    if (age <= 2) curH = 50 + age * 20;
    else if (age <= 12) curH = 80 + (age - 2) * 5.5;
    else if (age <= 17) curH = 135 + (age - 12) * 8;
    else curH = targetH;
    curH = Math.min(curH, targetH);
    _.set(stat, '主角.体征.身高', Math.round(curH));
  }

  if (age < 20 && curH < targetH) {
    var growthRate = HEIGHT_GROWTH[newDevStage] || 0;
    var conBonus = (num(_.get(stat, '主角.属性.体质', 10)) - 10) * 0.03;
    var increment = (growthRate + conBonus) * yearEq;
    var newH = Math.min(curH + increment, targetH);
    _.set(stat, '主角.体征.身高', Math.round(newH * 10) / 10);

    // 发育进度
    if (targetH > 0) {
      var progress = _.clamp(Math.round(newH / targetH * 100), 0, 100);
      _.set(stat, '主角.体征._发育进度', progress);
    }
  } else if (newDevStage === '衰老') {
    // 衰老微缩
    var shrink = 0.2 * yearEq;
    _.set(stat, '主角.体征.身高', Math.round((curH - shrink) * 10) / 10);
  }

  // ── 健康体重区间 ──
  var h = num(_.get(stat, '主角.体征.身高', 0));
  if (h > 0) {
    var hm = h / 100;
    _.set(stat, '主角.体征.健康体重区间.下限', Math.round(18.5 * hm * hm));
    _.set(stat, '主角.体征.健康体重区间.上限', Math.round(24 * hm * hm));
  }
}


// ═══════════════════════════════════════════════════════════════════
// V3 Phase B · BMI / 体型 / 体型效果（VARIABLE_UPDATE_ENDED 监听器）
// 独立于 TIME_TICK，每次变量更新后自动重算
// ═══════════════════════════════════════════════════════════════════
function v3_recalcBMI(stat) {
  var h = num(_.get(stat, '主角.体征.身高', 0));
  var w = num(_.get(stat, '主角.体征.体重', 0));
  if (h <= 0 || w <= 0) return;

  var hm = h / 100;
  var bmi = Math.round(w / (hm * hm) * 10) / 10;
  _.set(stat, '主角.体征._BMI', bmi);

  // 体型标签
  var label = '正常';
  for (var i = 0; i < BMI_TIERS.length; i++) {
    if (bmi < BMI_TIERS[i].max) {
      label = BMI_TIERS[i].label;
      break;
    }
  }
  if (label === '_split') {
    var con = num(_.get(stat, '主角.属性.体质', 10));
    label = con > 50 ? '偏壮' : '偏胖';
  }
  _.set(stat, '主角.体征.体型标签', label);

  // 体型效果（修饰通道）
  var effects = BODY_TYPE_EFFECTS[label] || [];
  _.set(stat, '主角.体征.体型效果', effects);
}


// ═══════════════════════════════════════════════════════════════════
// V3 Phase C · 情绪栈时效衰减
// 挂载点：phase4_decay 之后
// ═══════════════════════════════════════════════════════════════════
function v3_phaseC_emotionDecay(ctx) {
  var stat = ctx.stat;
  var stack = _.get(stat, '主角.情绪栈', []) || [];
  if (stack.length === 0) return;

  var kept = [];
  var totalNegPressure = 0;
  for (var i = 0; i < stack.length; i++) {
    var e = stack[i];
    var remain = num(e.剩余时效, 0) - 1;
    if (remain > 0) {
      e.剩余时效 = remain;
      kept.push(e);
      if (e.极性 === '负') totalNegPressure += Math.abs(num(e.数值, 0));
    }
    // 到期 → 自动移除（不入 kept）
  }
  _.set(stat, '主角.情绪栈', kept);

  // 负情绪累积 → 压力值微增
  if (totalNegPressure > 20) {
    var pressure = num(_.get(stat, '主角.心理.压力值', 0));
    var inc = Math.min(Math.floor(totalNegPressure / 20), 5);
    _.set(stat, '主角.心理.压力值', _.clamp(pressure + inc, 0, 100));
  }
}


// ═══════════════════════════════════════════════════════════════════
// V3 Phase D · 学业系统机械结算
// 挂载点：phase4_decay 之后
// 处理：学科技能衰减（休学/辍学/失学/受限期间）+ 学业概况派生
// ═══════════════════════════════════════════════════════════════════
function v3_phaseD_academicTick(ctx) {
  var stat = ctx.stat;
  var learnStatus = String(_.get(stat, '主角.学业.学籍.在学状态', ''));

  // 非在读状态：学科技能缓慢衰减（Phase4 遗忘）
  if (learnStatus && learnStatus !== '在读' && learnStatus !== '毕业') {
    var subjects = _.get(stat, '主角.学业.在修科目', {}) || {};
    var skills = _.get(stat, '主角.技能', {}) || {};
    var subKeys = Object.keys(subjects);
    for (var i = 0; i < subKeys.length; i++) {
      var sub = subjects[subKeys[i]];
      var linkedSkills = sub.关联技能 || [];
      for (var j = 0; j < linkedSkills.length; j++) {
        var sName = linkedSkills[j].技能名;
        if (sName && skills[sName]) {
          var prof = num(skills[sName].熟练度, 0);
          if (prof > 5) {
            skills[sName].熟练度 = Math.max(5, Math.round(prof * 0.98)); // 2% 缓慢衰减
          }
        }
      }
    }
  }

  // 学业概况.当前阶段 由学籍.学段 + 年龄派生
  var stage = String(_.get(stat, '主角.学业.学籍.学段', ''));
  var age = num(_.get(stat, '主角.年龄', 0));
  var derivedStage = '';
  if (!stage && learnStatus !== '在读') {
    if (age < 6) derivedStage = '早期教育';
    else derivedStage = '独立阶段';
  } else {
    // 粗略映射（AI可覆盖更精确值）
    derivedStage = String(_.get(stat, '主角.学业.学业概况.当前阶段', ''));
  }
  if (derivedStage) {
    _.set(stat, '主角.学业.学业概况.当前阶段', derivedStage);
  }

  // 资质证书到期回收
  var certs = _.get(stat, '主角.学业.资质证书', {}) || {};
  var certKeys = Object.keys(certs);
  var curP = num(_.get(stat, '世界.周期数', 0));
  for (var ck = 0; ck < certKeys.length; ck++) {
    var cert = certs[certKeys[ck]];
    var expiry = num(cert.有效期到期周期, -1);
    if (expiry > 0 && curP >= expiry) {
      delete certs[certKeys[ck]];
    }
  }
}


// ═══════════════════════════════════════════════════════════════════
// V3 Phase E · 职业 / 组织 / 信念 周期性结算
// 挂载点：phase4_decay 之后
// ═══════════════════════════════════════════════════════════════════
function v3_phaseE_orgTick(ctx) {
  var stat = ctx.stat;

  // 信念动摇度漂移（每周期微量，惰性系统几乎不消耗）
  var beliefs = _.get(stat, '主角.信念', {}) || {};
  var bKeys = Object.keys(beliefs);
  for (var i = 0; i < bKeys.length; i++) {
    var b = beliefs[bKeys[i]];
    var sway = num(b.动摇度, 0);
    if (sway > 0 && sway < 100) {
      // 自然回落趋势（信念不受挑战时缓慢稳固）
      b.动摇度 = _.clamp(sway - 1, 0, 100);
    }
  }

  // 组织实体：派系势力自然漂移（微量，主要由事件驱动）
  // 此处仅做凝聚力自然衰减（无维护则缓降）
  var orgs = _.get(stat, '组织实体', {}) || {};
  var orgKeys = Object.keys(orgs);
  for (var oi = 0; oi < orgKeys.length; oi++) {
    var org = orgs[orgKeys[oi]];
    var gov = org.治理;
    if (gov && num(gov.凝聚力, 0) > 0) {
      gov.凝聚力 = _.clamp(num(gov.凝聚力, 50) - 0.5, 0, 100);
    }
  }
}


// ═══════════════════════════════════════════════════════════════════
// V3 Phase F · 约束状态到期清除（扩展为record遍历）
// 替代旧引擎中 phase4 对单对象约束的处理
// ═══════════════════════════════════════════════════════════════════
function v3_phaseF_constraintExpiry(ctx) {
  var stat = ctx.stat;
  var curP = num(_.get(stat, '世界.周期数', 0));
  var constraints = _.get(stat, '约束状态', {}) || {};
  var cKeys = Object.keys(constraints);
  for (var i = 0; i < cKeys.length; i++) {
    var c = constraints[cKeys[i]];
    var expiry = num(c.到期周期, -1);
    if (expiry > 0 && curP >= expiry) {
      delete constraints[cKeys[i]];
      // 注入解除约束种子
      ctx.seeds.push({
        内容: '约束(' + c.类型 + ')已到期解除',
        类型: '约束解除',
        权重: 20,
        trigger_tag: '约束解除_' + c.类型,
        后果层级: '轻',
        来源模块: '约束状态'
      });
    }
  }

  // 约束与学籍联动：检查是否有与上学冲突的约束
  var hasBlockingConstraint = false;
  var remaining = _.get(stat, '约束状态', {}) || {};
  var rKeys = Object.keys(remaining);
  for (var ri = 0; ri < rKeys.length; ri++) {
    var rc = remaining[rKeys[ri]];
    var type = String(rc.类型 || '');
    if (['服刑', '软禁', '监护', '隔离', '流放', '通缉'].indexOf(type) >= 0) {
      hasBlockingConstraint = true;
      break;
    }
  }
  var curLearnStatus = String(_.get(stat, '主角.学业.学籍.在学状态', ''));
  if (hasBlockingConstraint && curLearnStatus === '在读') {
    _.set(stat, '主角.学业.学籍.在学状态', '受限');
  } else if (!hasBlockingConstraint && curLearnStatus === '受限') {
    // 约束解除 → 可触发复学
    _.set(stat, '主角.学业.学籍.在学状态', '在读');
    ctx.seeds.push({
      内容: '约束解除，可以复学了',
      类型: '复学',
      权重: 15,
      trigger_tag: '复学',
      后果层级: '轻',
      来源模块: '学业'
    });
  }
}


// ═══════════════════════════════════════════════════════════════════
// V3 Phase G · 子嗣工作记忆归并（每 8 周期）
// ═══════════════════════════════════════════════════════════════════
function v3_phaseG_subsidiaryMemory(ctx) {
  var stat = ctx.stat;
  var curP = num(_.get(stat, '世界.周期数', 0));
  var MERGE_INTERVAL = 8;

  var children = _.get(stat, '主角.子嗣', {}) || {};
  var cKeys = Object.keys(children);
  for (var i = 0; i < cKeys.length; i++) {
    var child = children[cKeys[i]];
    if (String(child.存活状态) !== '在世') continue;

    var workMem = child.子嗣工作记忆 || [];
    if (workMem.length === 0) continue;

    // 找最老的工作记忆
    var oldest = workMem[0];
    var oldestAge = curP - num(oldest.周期, curP);
    if (oldestAge >= MERGE_INTERVAL && workMem.length > 3) {
      // 取前半归并
      var toMerge = workMem.splice(0, Math.ceil(workMem.length / 2));
      var summaries = [];
      for (var j = 0; j < toMerge.length; j++) {
        summaries.push(toMerge[j].摘要 || '');
      }
      var archive = {
        记忆id: 'ca_' + cKeys[i] + '_' + curP,
        摘要: summaries.join('；'),
        重要度: '普通',
        对象: '',
        永久: 0
      };
      // 如果有命运级 → 标记永久
      for (var j = 0; j < toMerge.length; j++) {
        if (toMerge[j].重要度 === '命运') { archive.永久 = 1; archive.重要度 = '命运'; break; }
        if (toMerge[j].重要度 === '重要') archive.重要度 = '重要';
      }
      child.子嗣长期归档 = child.子嗣长期归档 || [];
      child.子嗣长期归档.push(archive);
    }
  }
}


// ═══════════════════════════════════════════════════════════════════
// V3 Phase H · NPC 人生阶段推进（泛化7阶）
// 替代旧引擎中的6阶推进
// ═══════════════════════════════════════════════════════════════════
function v3_npcLifeStage(age) {
  age = num(age, 0);
  if (age <= 2) return '婴幼儿';
  if (age <= 5) return '学龄前';
  if (age <= 17) return '青少年';
  if (age <= 29) return '青年';
  if (age <= 44) return '成年';
  if (age <= 64) return '中年';
  return '老年';
}

function v3_phaseH_npcStageSync(ctx) {
  var stat = ctx.stat;
  var npcs = _.get(stat, 'NPC', {}) || {};
  var nKeys = Object.keys(npcs);
  for (var i = 0; i < nKeys.length; i++) {
    var npc = npcs[nKeys[i]];
    var npcAge = num(npc.年龄, 0);
    npc.人生阶段 = v3_npcLifeStage(npcAge);
  }

  // 子嗣人生阶段同步
  var children = _.get(stat, '主角.子嗣', {}) || {};
  var cKeys = Object.keys(children);
  for (var ci = 0; ci < cKeys.length; ci++) {
    var child = children[cKeys[ci]];
    child.人生阶段 = v3_npcLifeStage(num(child.年龄, 0));
  }
}


// ═══════════════════════════════════════════════════════════════════
// V3 主入口：在 runTimeTick 的 phase6_seeds 之后调用
// ═══════════════════════════════════════════════════════════════════
function v3_phases(ctx) {
  v3_phaseA_physique(ctx);      // 体征：身高生长 + 发育阶段
  v3_phaseC_emotionDecay(ctx);  // 情绪栈时效衰减
  v3_phaseD_academicTick(ctx);  // 学业：技能衰减 + 概况派生 + 证书到期
  v3_phaseE_orgTick(ctx);       // 组织/信念周期漂移
  v3_phaseF_constraintExpiry(ctx); // 约束状态到期 + 学籍联动
  v3_phaseG_subsidiaryMemory(ctx); // 子嗣记忆归并
  v3_phaseH_npcStageSync(ctx);  // NPC/子嗣人生阶段推进(泛化7阶)

  // BMI/体型在最后重算（依赖身高可能已更新）
  v3_recalcBMI(ctx.stat);
}


// ═══════════════════════════════════════════════════════════════════
// VARIABLE_UPDATE_ENDED 监听器：每次变量更新后自动重算 BMI/体型
// 确保 AI 手动改体重后立即反映
// ═══════════════════════════════════════════════════════════════════
// 在现有引擎的事件监听区域注册：
// TavernHelper.on('VARIABLE_UPDATE_ENDED', function() {
//   var opt = { type: 'message', message_id: 'latest' };
//   var d = Mvu.getMvuData(opt);
//   if (d && d.stat_data) {
//     v3_recalcBMI(d.stat_data);
//     Mvu.setMvuData(d, opt);
//   }
// });


// ═══════════════════════════════════════════════════════════════════
// 战斗引擎（供事件结算调用 · 不在 TIME_TICK 内）
// ═══════════════════════════════════════════════════════════════════

// 个人战斗：1v1 或小队 vs 小队
function v3_personalCombat(stat, enemyPower, terrain) {
  var con = num(_.get(stat, '主角.属性.体质', 10));
  var skills = _.get(stat, '主角.技能', {}) || {};
  // 找最高战斗技能
  var bestCombatProf = 0;
  var sKeys = Object.keys(skills);
  for (var i = 0; i < sKeys.length; i++) {
    var sk = skills[sKeys[i]];
    if (sk.类别 === '战斗' && num(sk.熟练度, 0) > bestCombatProf) {
      bestCombatProf = num(sk.熟练度, 0);
    }
  }
  var hp = num(_.get(stat, '主角.派生.HP', 100));
  var myPower = con * 0.3 + bestCombatProf * 0.5 + hp * 0.2;
  // 装备加成（衣物防护通道）
  var armor = _.get(stat, '主角.衣物', {}) || {};
  var armorBonus = 0;
  var aKeys = Object.keys(armor);
  for (var ai = 0; ai < aKeys.length; ai++) {
    var slot = armor[aKeys[ai]];
    var effs = slot.效果 || [];
    for (var ei = 0; ei < effs.length; ei++) {
      if (effs[ei].通道 === '防护') armorBonus += num(effs[ei].强度, 0);
    }
  }
  myPower += armorBonus;
  var terrainMod = (terrain === '有利' ? 10 : (terrain === '不利' ? -10 : 0));
  myPower += terrainMod;

  var ratio = myPower / Math.max(enemyPower, 1);
  if (ratio >= 2.0) return { 结果: '大胜', 伤亡: '轻微' };
  if (ratio >= 1.3) return { 结果: '胜', 伤亡: '有伤' };
  if (ratio >= 0.8) return { 结果: '惨胜', 伤亡: '重伤' };
  if (ratio >= 0.5) return { 结果: '败', 伤亡: '重伤' };
  return { 结果: '溃', 伤亡: '危殆' };
}

// 军团战斗：快照式一次结算
function v3_armyCombat(attackerOrg, defenderOrg, terrain) {
  function armyPower(org) {
    var mil = org.军事 || {};
    var gov = org.治理 || {};
    return num(mil.兵力, 0) * (num(mil.士气, 50) / 100) * 1.0
      + (mil.战力 === '强' ? 30 : mil.战力 === '中' ? 15 : 5)
      + num(gov.凝聚力, 50) * 0.1;
  }
  var aPow = armyPower(attackerOrg);
  var dPow = armyPower(defenderOrg);
  var terrainMod = (terrain === '防守有利' ? 0.8 : 1.0); // 防守方地利
  aPow *= terrainMod;
  var ratio = aPow / Math.max(dPow, 1);
  if (ratio >= 2.0) return '大胜';
  if (ratio >= 1.3) return '胜';
  if (ratio >= 0.8) return '惨胜';
  if (ratio >= 0.5) return '败';
  return '溃';
}


// ═══════════════════════════════════════════════════════════════════
// 成绩结算辅助（供 EVENT_SETTLEMENT / AI 调用）
// ═══════════════════════════════════════════════════════════════════

// 计算考试原始分基线
function v3_calcExamScore(stat, subjectSkill, maxScore, difficultyMod, momentumMod) {
  var power = calcAcademicPower(stat, subjectSkill);
  var raw = maxScore * _.clamp(power * (difficultyMod || 1.0) * (momentumMod || 1.0), 0, 1);
  return Math.round(raw);
}

// 成绩平滑（锚定上次 + 实力惯性 + 护栏）
function v3_smoothExamScore(newRaw, lastScore, maxScore, isFateLevel) {
  var alpha = 0.7; // 实力权重
  var smoothed = maxScore * (alpha * (newRaw / maxScore) + (1 - alpha) * (lastScore / maxScore));
  // 单步护栏 ±15
  if (!isFateLevel) {
    var maxStep = 15;
    if (smoothed - lastScore > maxStep) smoothed = lastScore + maxStep;
    if (lastScore - smoothed > maxStep) smoothed = lastScore - maxStep;
  }
  return _.clamp(Math.round(smoothed), 0, maxScore);
}

// 贸易成交价计算
function v3_tradePrice(basePrice, inflation, supplyDemand, eventMod) {
  return Math.round(basePrice * (1 + (inflation || 0)) * (1 + (supplyDemand || 0) / 100) * (eventMod || 1));
}

// 种田产量计算
function v3_cropYield(farmingProf, soilFertility, weatherMod, investmentMod) {
  var base = farmingProf * 0.5 + soilFertility * 0.3;
  return Math.round(base * (weatherMod || 1) * (investmentMod || 1));
}


// ═══════════════════════════════════════════════════════════════════
// 密谋进展推进（供引擎每周期调用）
// ═══════════════════════════════════════════════════════════════════
function v3_conspiracyTick(stat) {
  // 遍历所有秘密索引（主角 + NPC），推进密谋类进展
  var allSecrets = [];
  var playerSecrets = _.get(stat, '主角.秘密索引', {}) || {};
  var psKeys = Object.keys(playerSecrets);
  for (var i = 0; i < psKeys.length; i++) {
    allSecrets.push({ owner: '主角', key: psKeys[i], secret: playerSecrets[psKeys[i]] });
  }
  var npcs = _.get(stat, 'NPC', {}) || {};
  var nKeys = Object.keys(npcs);
  for (var ni = 0; ni < nKeys.length; ni++) {
    var npcSecrets = npcs[nKeys[ni]].秘密索引 || {};
    var nsKeys = Object.keys(npcSecrets);
    for (var si = 0; si < nsKeys.length; si++) {
      allSecrets.push({ owner: nKeys[ni], key: nsKeys[si], secret: npcSecrets[nsKeys[si]] });
    }
  }

  // 暴露程度自然爬升（严重度越高爬升越快）
  for (var ai = 0; ai < allSecrets.length; ai++) {
    var entry = allSecrets[ai];
    var s = entry.secret;
    if (num(s.进展, 0) <= 0) continue; // 未启动的不推进

    var clues = s.已暴露线索 || [];
    for (var ci = 0; ci < clues.length; ci++) {
      var clue = clues[ci];
      if (clue.状态 === '存在' && num(clue.暴露程度, 0) < 100) {
        var severity = num(s.严重度, 50);
        var crawlRate = severity * 0.005; // 严重度50 → 每周期+0.25
        clue.暴露程度 = _.clamp(num(clue.暴露程度, 0) + crawlRate, 0, 100);
      }
    }
  }
}


// ═══════════════════════════════════════════════════════════════════
// 导出 / 注册
// ═══════════════════════════════════════════════════════════════════
// 在现有引擎中，找到 runTimeTick 函数里 phase6_seeds(ctx) 调用之后，
// 添加一行：v3_phases(ctx);
//
// 在 VARIABLE_UPDATE_ENDED 监听器中添加 v3_recalcBMI 调用。
//
// 战斗/成绩/检定/贸易/种田函数供 AI/脚本在 EVENT_SETTLEMENT 时按需调用。
// 密谋推进 v3_conspiracyTick(stat) 在 phase4 或 phase6 末尾调用。
