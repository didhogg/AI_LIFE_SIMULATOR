import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

// ═══════════════════════════════════════════════════════════════════
// AI文游人生模拟器 · V3.1 变量结构（Zod Schema）
// 基于 V3大改 spec 全量重构
// 约定：_ 前缀 = AI只读引擎写 · $ 前缀 = AI不可见 · 无前缀 = AI可读写
//       range 用 clamp · 动态键用 z.record · 派生由引擎/脚本推进
// ═══════════════════════════════════════════════════════════════════

// ─── 复用子 schema ───
var clamp0_100 = z.coerce.number().transform(function(v) { return _.clamp(v, 0, 100); });
var clampNeg100_100 = z.coerce.number().transform(function(v) { return _.clamp(v, -100, 100); });
var clamp0_200 = z.coerce.number().transform(function(v) { return _.clamp(v, 0, 200); });
var clamp0_1 = z.coerce.number().transform(function(v) { return _.clamp(v, 0, 1); });
var posInt = z.coerce.number().transform(function(v) { return Math.max(Math.floor(v), 0); });
var boolNum = z.coerce.number().transform(function(v) { return v ? 1 : 0; });

// ─── 通用嵌套币种金额 ───
var CurrencyAmount = z.object({
  主单位: z.string().prefault(''),
  主面额: z.coerce.number().prefault(0),
  子: z.array(z.object({ 单位: z.string().prefault(''), 值: z.coerce.number().prefault(0) })).prefault([]),
  显示: z.string().prefault(''),
});

// ─── 通用修饰效果 ───
var ModifierEffect = z.object({
  通道: z.string().prefault(''),
  op: z.enum(['乘', '加', '设上限', '设下限', '开关']).prefault('乘'),
  强度: z.coerce.number().prefault(1),
  叙事型: z.coerce.number().prefault(0),
});

// ─── 通用记忆条目（NPC记忆 / 子嗣记忆）───
var MemoryEntry = z.object({
  记忆id: z.string().prefault(''),
  摘要: z.string().prefault(''),
  发生周期: z.coerce.number().prefault(0),
  类型: z.enum(['互动', '承诺', '恩惠', '冲突', '背叛', '共同经历']).prefault('互动'),
  情绪色彩: z.string().prefault(''),
  重要度: z.coerce.number().transform(function(v) { return _.clamp(v, 1, 3); }).prefault(1),
  权重: clamp0_100.prefault(50),
  永久: z.coerce.number().prefault(0),
  上次唤起周期: z.coerce.number().prefault(0),
});

// ─── 工作记忆 / 长期归档 通用条目 ───
var ProtagMemoryEntry = z.object({
  日期: z.string().prefault(''),
  周期: z.coerce.number().prefault(0),
  标题: z.string().prefault(''),
  摘要: z.string().prefault(''),
  涉及人物: z.string().prefault(''),
  涉及地点: z.string().prefault(''),
  重要度: z.enum(['普通', '重要', '命运']).prefault('普通'),
  关联地点: z.array(z.string()).prefault([]),
  关联物品: z.array(z.string()).prefault([]),
  关联意象: z.array(z.string()).prefault([]),
  关联NPC: z.array(z.string()).prefault([]),
  情绪基调: z.string().prefault(''),
  思念权重: clamp0_100.prefault(0),
  权重: clamp0_100.prefault(50),
  上次浮现周期: z.coerce.number().prefault(-1),
  可浮现: z.coerce.number().prefault(1),
  因果: z.object({
    起因事件id: z.string().prefault(''),
    关联种子id: z.string().prefault(''),
    导致后果: z.string().prefault(''),
  }).prefault({}),
});

// ─── 长期归档扩展字段 ───
var ArchiveMemoryEntry = ProtagMemoryEntry.extend({
  归档周期: z.coerce.number().prefault(0),
  来源周期范围: z.string().prefault(''),
});

// ─── 所属组织条目（主角 + NPC 共用）───
var BelongsToOrg = z.object({
  组织键: z.string().prefault(''),
  职务: z.string().prefault(''),
  权力值: clamp0_100.prefault(0),
  派系: z.string().prefault(''),
  对组织立场: clampNeg100_100.prefault(0),
});

// ─── 秘密索引条目（V3大改 · 主角+NPC双向 · 谜底/线索分层）───
var SecretEntry = z.object({
  类型: z.enum(['私密', '外遇', '身世', '罪行', '暗杀', '政变', '构陷', '策反', '窃密']).prefault('私密'),
  发起方: z.string().prefault(''),
  目标: z.string().prefault(''),
  进展: clamp0_100.prefault(0),
  严重度: clamp0_100.prefault(0),
  已暴露线索: z.array(z.object({
    线索: z.string().prefault(''),
    暴露程度: clamp0_100.prefault(0),
    状态: z.enum(['存在', '已销毁', '已栽赃', '已掩盖']).prefault('存在'),
  })).prefault([]),
  知情圈: z.record(
    z.string().describe('NPC键或主角'),
    z.object({
      掩护基调: z.string().prefault(''),
      知情程度: clamp0_100.prefault(0),
      立场: z.enum(['死守', '动摇', '可能反水', '']).prefault(''),
    })
  ).prefault({}),
  $谜底: z.string().prefault(''),
});


// ═══════════════════════════════════════════════════════════════════
// 主 Schema
// ═══════════════════════════════════════════════════════════════════

export var Schema = z.object({

  _系统版本: z.string().prefault('3.1'),

  _tick: z.object({
    id: z.string().prefault(''),
    period: z.coerce.number().prefault(-1),
    difficulty: z.enum(['简单', '普通', '困难', '地狱']).prefault('普通'),
  }).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 系统元数据
  // ══════════════════════════════════════════════════════════
  系统: z.object({
    schema_version: posInt.prefault(2),
    migration_version: posInt.prefault(0),
    last_migration_cycle: z.coerce.number().prefault(0),
    card_version: z.string().prefault('3.1'),
    last_tick_id: z.string().prefault(''),
    tick_log: z.array(z.object({
      tick_id: z.string().prefault(''),
      周期数: z.coerce.number().prefault(0),
      message_id: z.string().prefault(''),
      结果摘要: z.string().prefault(''),
      难度快照: z.string().prefault('普通'),
    })).prefault([]),
    settled_event_ids: z.array(z.string()).prefault([]),
  }).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 叙事设置（V3大改 · 顶层只读 · 玩家自定义 AI 不改写）
  // ══════════════════════════════════════════════════════════
  _叙事设置: z.object({
    叙事风格: z.string().prefault('影视化分镜').describe('完全自定义：文学化/影视化分镜/简洁直白/第一人称沉浸/史诗群像编年/DND跑团旁白/轻小说/黑色幽默/冷峻纪实…亦可自写详细风格描述'),
    事件倾向: z.record(
      z.string().describe('流派键'),
      z.coerce.number().describe('权重0-100')
    ).prefault({}).describe('按玩家想玩的类型加权抽取事件包：历史战略权谋/经营管理种田/角色扮演冒险/情感浪漫/悬疑调查/黑暗危机/机遇爽文/江湖帮派/商战职场/日常生活流等'),
  }).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 流程/控制状态
  // ══════════════════════════════════════════════════════════
  流程状态: z.object({
    游戏模式: z.enum([
      'CHARACTER_CREATION', 'SCHEDULE', 'TIME_ADVANCE',
      'EVENT_SETTLEMENT', 'RP_MODE', 'SUMMARY'
    ]).prefault('CHARACTER_CREATION'),
    RP暂停点: z.coerce.number().prefault(-1),
    人称: z.enum(['第一人称', '第二人称', '第三人称']).prefault('第二人称'),
    难度: z.enum(['简单', '普通', '困难', '地狱']).prefault('普通'),
    写实程度: z.enum(['硬核写实', '轻度戏剧化', '幻想掺入', '离谱魔幻']).prefault('轻度戏剧化'),
    叙事风格: z.enum(['纪实', '文学', '幽默', '沉浸']).prefault('沉浸'),
    事件倾向: z.enum(['日常向', '波澜万丈', '职业导向', '情感导向', '戏剧人生']).prefault('日常向'),
    当前地点: z.string().prefault('待初始化'),
    空日程兜底: z.boolean().prefault(false),
  }).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 隐藏旗标 / 脚本专用（$ 前缀）
  // ══════════════════════════════════════════════════════════
  $运气: z.coerce.number().transform(function(v) { return _.clamp(v, 1, 100); }).prefault(50),
  $寿命预期: z.coerce.number().transform(function(v) { return _.clamp(v, 1, 200); }).prefault(75),
  $聆听心声触发: z.coerce.number().prefault(0),
  $浮现记忆ID: z.string().prefault(''),
  $涟漪候选: z.record(z.string(), z.array(z.string())).prefault({}),
  $RP本场暂存: z.object({
    活跃: z.coerce.number().prefault(0),
    起始周期: z.coerce.number().prefault(-1),
    轮次计数: z.coerce.number().prefault(0),
    暂停点索引: z.coerce.number().prefault(-1),
    本场摘要: z.string().prefault(''),
    场景锁: z.object({
      地点: z.string().prefault(''),
      在场NPC: z.array(z.string()).prefault([]),
      已锁定: z.coerce.number().prefault(0),
    }).prefault({}),
    本场新登场: z.array(z.object({
      类型: z.enum(['NPC', '地点', '物品']).prefault('NPC'),
      名称: z.string().prefault(''),
      摘要: z.string().prefault(''),
    })).prefault([]),
    影响草稿: z.array(z.object({
      对象: z.string().prefault(''),
      类型: z.string().prefault(''),
      描述: z.string().prefault(''),
    })).prefault([]),
  }).prefault({}),

  $隐藏记忆库: z.object({
    延时种子: z.record(
      z.string().describe('种子ID'),
      z.object({
        内容: z.string().prefault(''),
        类型: z.string().prefault('伏笔'),
        到期周期: z.coerce.number().prefault(0),
        权重: clamp0_100.prefault(10),
        已到期: z.coerce.number().prefault(0),
        已消化: z.coerce.number().prefault(0),
        seed_instance_id: z.string().prefault(''),
        trigger_tag: z.string().prefault(''),
        event_library_tag: z.string().prefault(''),
        source_namespace: z.string().prefault(''),
        source_pack_id: z.string().prefault(''),
        source_event_id: z.string().prefault(''),
        来源模块: z.string().prefault(''),
        涉及人物: z.string().prefault(''),
        涉及地点: z.string().prefault(''),
        涉及物品: z.string().prefault(''),
        紧急度: z.enum(['普通', '重要', '命运']).prefault('普通'),
        冷却键: z.string().prefault(''),
        幂等锚点: z.string().prefault(''),
        冲突组: z.string().prefault(''),
        可合并标签: z.string().prefault(''),
        后果层级: z.enum(['轻', '中', '重', '命运级']).prefault('中'),
        possible_years: z.object({
          mode: z.enum(['absolute', 'range', 'era', 'any']).prefault('any'),
          start: z.coerce.number().prefault(1900),
          end: z.coerce.number().prefault(2200),
          era_label: z.string().prefault(''),
          peak_years: z.array(z.coerce.number()).prefault([]),
          note: z.string().prefault(''),
        }).prefault({}),
        到期日期: z.string().prefault(''),
        源事件id: z.string().prefault(''),
        因果链id: z.string().prefault(''),
        因果深度: posInt.prefault(0),
        状态: z.enum(['待消费', '已消费', '延后', '作废']).prefault('待消费'),
      })
    ).prefault({}),
    彩蛋池: z.record(
      z.string().describe('彩蛋记忆ID'),
      z.object({
        原记忆id: z.string().prefault(''),
        摘要: z.string().prefault(''),
        模糊钥匙: z.string().prefault(''),
        关联地点: z.array(z.string()).prefault([]),
        关联物品: z.array(z.string()).prefault([]),
        关联意象: z.array(z.string()).prefault([]),
        关联NPC: z.array(z.string()).prefault([]),
        情绪基调: z.string().prefault(''),
        录入周期: z.coerce.number().prefault(0),
        录入日期: z.string().prefault(''),
        触发日期: z.string().prefault(''),
        来源: z.enum(['渐忘', '随机采样']).prefault('渐忘'),
        可浮现: z.coerce.number().prefault(1),
        已浮现: z.coerce.number().prefault(0),
        上次浮现周期: z.coerce.number().prefault(-1),
      })
    ).prefault({}),
  }).prefault({}),

  $meta: z.object({
    总回合数: z.coerce.number().prefault(0),
    上帝之手次数: z.coerce.number().prefault(0),
    聆听心声次数: z.coerce.number().prefault(0),
    历代角色数: z.coerce.number().prefault(1),
  }).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 世界
  // ══════════════════════════════════════════════════════════
  世界: z.object({
    当前日期: z.string().prefault('待初始化'),
    当前时间粒度: z.enum(['年', '季', '月', '周', '日']).prefault('月'),
    年代背景: z.string().prefault('待初始化'),
    国家地区: z.string().prefault('中国'),
    城市: z.string().prefault('待初始化'),
    周期数: posInt.prefault(0),
    季节: z.string().prefault('春'),
    气候: z.string().prefault(''),
    气候补充: z.string().prefault(''),
  }).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 主角
  // ══════════════════════════════════════════════════════════
  主角: z.object({
    姓名: z.string().prefault('待初始化'),
    死因: z.string().prefault(''),
    性别: z.string().prefault('待初始化'),
    年龄: z.coerce.number().prefault(0),
    生日: z.string().prefault('01-01'),
    出生日期: z.string().prefault(''),
    出生地: z.string().prefault(''),
    外貌描述: z.string().prefault(''),
    职业: z.string().prefault('无'),
    身份阶段: z.enum(['婴幼儿', '学龄', '青少年', '成年', '中年', '老年']).prefault('成年'),
    家境等级: z.enum(['寒门', '温饱', '小资', '富庶', '豪门']).prefault('小资').describe('泛化：寒门=赤贫/生存边缘 / 温饱=贫寒/刚够吃穿 / 小资=小康/衣食无忧 / 富庶=富裕/资产丰厚 / 豪门=巨富/顶级阶层'),
    家境描述: z.string().prefault(''),
    经济模式: z.enum(['依附', '半独立', '独立', '赡养']).prefault('依附'),
    是否有家庭账户: z.coerce.number().prefault(1),
    业力: z.coerce.number().prefault(0),
    角色ID: z.string().prefault(''),
    血缘: z.object({
      父角色ID: z.string().prefault(''),
      母角色ID: z.string().prefault(''),
    }).prefault({}),
    世代: z.coerce.number().transform(function(v) { return Math.max(v, 1); }).prefault(1),

    // ─── 性格（V3大改：MBTI 替代 OCEAN，性格轴保留兼容但降优先级）───
    性格轴: z.object({
      外向: clamp0_100.prefault(50),
      亲和: clamp0_100.prefault(50),
      尽责: clamp0_100.prefault(50),
      情绪稳定: clamp0_100.prefault(50),
      开放: clamp0_100.prefault(50),
    }).prefault({}),
    性格类型: z.string().prefault('').describe('MBTI 标签如 ENTJ/ISFP'),
    性格描述: z.string().prefault(''),

    // ─── 声望 ───
    人望: clampNeg100_100.prefault(0),
    知名度: clamp0_100.prefault(0),
    声望标签: z.string().prefault(''),

    行动点: z.object({
      当前: clamp0_100.prefault(15),
      上限: z.coerce.number().transform(function(v) { return _.clamp(v, 1, 100); }).prefault(15),
    }).prefault({}),

    属性: z.object({
      体质: clamp0_100.prefault(10),
      智慧: clamp0_100.prefault(10),
      魅力: z.coerce.number().transform(function(v) { return _.clamp(v, 0, 120); }).prefault(10),
      财富: clampNeg100_100.prefault(10),
      心理: clamp0_100.prefault(10),
      声望: clampNeg100_100.prefault(0),
    }).prefault({}),

    派生: z.object({
      HP: z.coerce.number().transform(function(v) { return Math.max(v, 0); }).prefault(100),
      HP上限: z.coerce.number().transform(function(v) { return Math.max(v, 1); }).prefault(100),
      精力: z.coerce.number().transform(function(v) { return _.clamp(v, 0, 1000); }).prefault(100),
      精力上限: z.coerce.number().transform(function(v) { return _.clamp(v, 1, 1000); }).prefault(100),
      颜值: clamp0_100.prefault(50),
      智商: clamp0_200.prefault(100),
    }).prefault({}),

    // ─── 技能（V3大改：扩充类别 + 施放面）───
    技能: z.record(
      z.string().describe('技能名'),
      z.object({
        熟练度: clamp0_100.prefault(0),
        等级: z.coerce.number().transform(function(v) { return _.clamp(v, 0, 10); }).prefault(0),
        类别: z.enum(['学科', '艺术', '体育', '语言', '职业', '兴趣', '战斗', '法术异能', '社交', '谋略', '生存', '手工', '经营', '通用']).prefault('通用'),
        来源: z.string().prefault(''),
        施放: z.object({
          精力消耗: z.coerce.number().prefault(0),
          检定属性: z.string().prefault(''),
          成本: z.string().prefault(''),
          冷却: z.coerce.number().prefault(0),
          失败后果: z.array(z.string()).prefault([]),
        }).prefault({}).describe('仅主动技能填，被动不填'),
      })
    ).prefault({}),

    // ─── 物品 ───
    物品: z.record(
      z.string().describe('物品名'),
      z.object({
        数量: z.coerce.number().transform(function(v) { return _.clamp(Math.floor(v), 0, 9999); }).prefault(1),
        重要级别: z.enum(['消耗品', '普通', '贵重', '传家宝', '命运物品']).prefault('普通'),
        类别: z.string().prefault(''),
        是否消耗品: z.coerce.number().prefault(0),
        获得周期: z.coerce.number().prefault(0),
        效果: ModifierEffect.prefault({}),
        描述: z.string().prefault(''),
        时效到期周期: z.coerce.number().prefault(-1),
        遗失保护: z.coerce.number().prefault(0),
        承载回忆: z.coerce.number().prefault(0),
        回忆锚点: z.array(z.string()).prefault([]),
      })
    ).prefault({}),

    // ─── 衣物（V3大改：古今通用装备槽）───
    衣物: z.record(
      z.string().describe('槽位:上衣/下装/外袍/鞋履/头冠/配饰等'),
      z.object({
        物品名: z.string().prefault(''),
        效果: z.array(z.object({
          通道: z.string().prefault('').describe('保暖/防护/仪态/魅力等'),
          op: z.enum(['加', '乘']).prefault('加'),
          强度: z.coerce.number().prefault(0),
        })).prefault([]),
        描述: z.string().prefault(''),
      })
    ).prefault({}).describe('惰性·仅天粒度推进或用户勾选时提醒AI更新'),

    // ─── 爱好 ───
    爱好: z.record(
      z.string().describe('爱好名'),
      z.object({
        极性: z.enum(['正面', '中立', '负面']).prefault('中立'),
        类别: z.string().prefault(''),
        投入度: clamp0_100.prefault(0),
        沉迷度: clamp0_100.prefault(0),
        状态: z.enum(['活跃', '搁置', '已戒除', '成瘾']).prefault('活跃'),
        效果: ModifierEffect.prefault({}),
        描述: z.string().prefault(''),
        获得周期: z.coerce.number().prefault(0),
        上次进行周期: z.coerce.number().prefault(0),
      })
    ).prefault({}),

    // ─── 心理 ───
    心理: z.object({
      情绪基调: z.enum(['平稳', '愉悦', '低落', '焦虑', '愤怒', '恐惧', '兴奋', '悲伤']).prefault('平稳'),
      压力值: clamp0_100.prefault(0),
      心理韧性: clamp0_100.prefault(50),
      活跃心理状态: z.string().prefault(''),
    }).prefault({}),

    // ─── 统一特质库（V3大改：吸收天赋/标签，删价值观类）───
    特质: z.record(
      z.string().describe('特质名'),
      z.object({
        类别: z.enum(['天赋', '性格', '后天', '身体', '压力']).prefault('后天'),
        来源: z.string().prefault('').describe('先天/后天/遗传/事件/信念等'),
        强度: z.coerce.number().prefault(0),
        可丢失: z.coerce.number().prefault(0),
        获得周期: z.coerce.number().prefault(0),
        稀有度: z.enum(['普通', '优秀', '稀有', '传说', '']).prefault(''),
        已觉醒: z.coerce.number().prefault(1).describe('隐藏天赋专用·初始0'),
        效果: z.object({
          属性修正: z.record(z.string(), z.coerce.number()).prefault({}).describe('如 {体质:+5, 智慧:-3}'),
          成长率或上限修正: z.string().prefault('').describe('如 智慧学习+20%'),
          检定修正: z.string().prefault('').describe('如 社交-15'),
          事件钩子: z.string().prefault(''),
        }).prefault({}),
        描述: z.string().prefault(''),
      })
    ).prefault({}).describe('统一特质库：吸收旧正面天赋/负面天赋/隐藏天赋/先天缺陷。继承导出仅天赋/部分身体类'),

    // ─── 兼容保留旧天赋字段（迁移期）───
    正面天赋: z.record(z.string(), z.object({
      稀有度: z.enum(['普通', '优秀', '稀有', '传说']).prefault('普通'),
      描述: z.string().prefault(''),
      效果: ModifierEffect.prefault({}),
    })).prefault({}),
    负面天赋: z.record(z.string(), z.object({
      描述: z.string().prefault(''),
      效果: ModifierEffect.prefault({}),
    })).prefault({}),
    隐藏天赋: z.record(z.string(), z.object({
      描述: z.string().prefault(''),
      已觉醒: z.coerce.number().prefault(0),
      效果: ModifierEffect.prefault({}),
    })).prefault({}),
    先天缺陷: z.record(z.string(), z.object({
      描述: z.string().prefault(''),
      效果: ModifierEffect.prefault({}),
    })).prefault({}),

    // ─── 情绪/Moodlet 时效栈（V3大改）───
    情绪栈: z.array(z.object({
      情绪名: z.string().prefault(''),
      极性: z.enum(['正', '负']).prefault('负'),
      数值: z.coerce.number().prefault(0),
      影响: z.array(z.object({
        对象: z.string().prefault('').describe('属性名或检定类型'),
        修正: z.coerce.number().prefault(0),
      })).prefault([]),
      剩余时效: z.coerce.number().prefault(0).describe('剩余周期数'),
      来源: z.string().prefault(''),
      可叠加: z.coerce.number().prefault(0),
    })).prefault([]).describe('到期自动移除·负情绪累积压低心理/触发压力崩溃'),

    // ─── 信念系统（V3大改 · 惰性 · 多重/混合信仰）───
    信念: z.record(
      z.string().describe('体系名'),
      z.object({
        类型: z.enum(['宗教', '哲学', '意识形态', '思潮', '价值观体系']).prefault('价值观体系'),
        虔诚或认同: clamp0_100.prefault(0),
        核心主张: z.array(z.string()).prefault([]),
        戒律或禁忌: z.array(z.string()).prefault([]),
        立场轴: z.string().prefault(''),
        皈依周期: z.coerce.number().prefault(0),
        动摇度: clamp0_100.prefault(0),
      })
    ).prefault({}).describe('惰性·仅涉宗教/意识形态/价值冲突时AI才insert'),

    // ─── 秘密索引（V3大改 · 主角可藏秘密/主动谋划）───
    秘密索引: z.record(
      z.string().describe('条目标识'),
      SecretEntry
    ).prefault({}),

    // ─── 受制于（把柄 = 派生视图，此处存被要挟记录）───
    受制于: z.array(z.object({
      持有方: z.string().prefault(''),
      强度: clamp0_100.prefault(0),
      关联秘密: z.string().prefault(''),
      关联线索: z.string().prefault(''),
      对方诉求: z.string().prefault(''),
    })).prefault([]),

    // ─── 状态标签 ───
    状态标签: z.record(
      z.string().describe('状态名'),
      z.object({
        类型: z.enum(['正面', '负面', '中性']).prefault('中性'),
        描述: z.string().prefault(''),
        到期周期: z.coerce.number().prefault(-1),
      })
    ).prefault({}),

    // ─── 疾病（V3大改：扩充受伤部位/疗程/后遗症）───
    疾病: z.record(
      z.string().describe('疾病名'),
      z.object({
        类型: z.enum(['急性', '慢性', '致命突发', '绝症']).prefault('急性'),
        已确诊: z.coerce.number().prefault(0),
        病程剩余: z.coerce.number().prefault(-1),
        受伤部位: z.string().prefault(''),
        疗程: z.string().prefault(''),
        后遗症: z.string().prefault(''),
        描述: z.string().prefault(''),
      })
    ).prefault({}),

    // ─── 居留身份（V3大改：单值→数组，支持多国籍/多签证）───
    居留身份: z.array(z.object({
      国籍: z.string().prefault(''),
      签证类型: z.string().prefault(''),
      到期周期: z.coerce.number().prefault(-1),
    })).prefault([]).describe('惰性·仅主角出国时填写'),

    // ─── 头衔爵位（V3大改：多标签叠加）───
    头衔爵位: z.array(z.string()).prefault([]),

    // ─── 所属组织（V3大改 · 与NPC完全对称 · 多重归属）───
    所属组织: z.array(BelongsToOrg).prefault([]).describe('惰性·仅涉政治/职场/阵营时更新'),

    // ─── 目标系统（V3大改：长期/短期 + 进度 + 前置）───
    目标: z.object({
      长期: z.array(z.object({
        描述: z.string().prefault(''),
        进度: clamp0_100.prefault(0),
        前置条件: z.array(z.string()).prefault([]),
        状态: z.enum(['进行中', '已完成', '已放弃']).prefault('进行中'),
      })).prefault([]),
      短期: z.array(z.object({
        描述: z.string().prefault(''),
        进度: clamp0_100.prefault(0),
        前置条件: z.array(z.string()).prefault([]),
        截止周期: z.coerce.number().prefault(0),
        状态: z.enum(['进行中', '已完成', '已放弃', '过期']).prefault('进行中'),
      })).prefault([]),
    }).prefault({}),

    // ─── 心愿单（保留兼容）───
    心愿单: z.object({
      长期: z.record(z.string(), z.object({ 内容: z.string().prefault(''), 状态: z.enum(['进行中', '已完成', '已放弃']).prefault('进行中') })).prefault({}),
      短期: z.record(z.string(), z.object({ 内容: z.string().prefault(''), 截止周期: z.coerce.number().prefault(0), 状态: z.enum(['进行中', '已完成', '已放弃', '过期']).prefault('进行中') })).prefault({}),
    }).prefault({}),

    成就: z.record(z.string(), z.object({ 解锁周期: z.coerce.number().prefault(0), 描述: z.string().prefault('') })).prefault({}),
    里程碑: z.record(z.string(), z.object({ 周期: z.coerce.number().prefault(0), 标题: z.string().prefault(''), 描述: z.string().prefault('') })).prefault({}),
    称号: z.string().prefault(''),

    峰值记录: z.object({
      最高体质: z.coerce.number().prefault(0),
      最高智慧: z.coerce.number().prefault(0),
      最高魅力: z.coerce.number().prefault(0),
      最高财富: z.coerce.number().prefault(0),
      最高心理: z.coerce.number().prefault(0),
      最高金钱: z.coerce.number().prefault(0),
      最高声望: z.coerce.number().prefault(0),
    }).prefault({}),

    // ══════════════════════════════════════════════════════════
    // 学业系统（V3大改 · 主角.学业）
    // ══════════════════════════════════════════════════════════
    学业: z.object({
      _制式库: z.record(
        z.string().describe('制式ID'),
        z.object({
          制式名: z.string().prefault(''),
          判定类型: z.enum(['分数型', '通过型', '等第型', '评审型', '推荐型']).prefault('分数型'),
          满分: z.coerce.number().prefault(100),
          及格线: z.coerce.number().prefault(60),
          关联属性: z.array(z.object({
            属性: z.string().prefault('智慧'),
            权重: clamp0_1.prefault(0.5),
          })).prefault([]),
          等级映射: z.record(z.string().describe('等级名'), z.object({
            下限: z.coerce.number().prefault(0),
            上限: z.coerce.number().prefault(100),
          })).prefault({}),
          GPA换算: z.record(z.string(), z.coerce.number()).prefault({}),
          偏差值参数: z.object({
            均值: z.coerce.number().prefault(50),
            标准差: z.coerce.number().prefault(10),
          }).prefault({}),
          分项: z.array(z.string()).prefault([]),
          排名制: z.coerce.number().prefault(0),
          描述: z.string().prefault(''),
        })
      ).prefault({}).describe('多制式并存·AI据学制/考试自动建'),

      学籍: z.object({
        在学状态: z.enum(['在读', '休学', '毕业', '辍学', '失学', '受限']).prefault('在读'),
        学段: z.string().prefault(''),
        学校: z.string().prefault(''),
        年级: z.string().prefault(''),
        专业: z.string().prefault(''),
        学校画像: z.object({
          层次: z.enum(['顶尖', '重点', '普通', '薄弱', '']).prefault(''),
          竞争烈度: z.enum(['激烈', '一般', '松散', '']).prefault(''),
          班级人数: z.coerce.number().prefault(0),
          _实力基线: z.coerce.number().prefault(50),
        }).prefault({}),
      }).prefault({}),

      在修科目: z.record(
        z.string().describe('科目名'),
        z.object({
          制式ID: z.string().prefault(''),
          关联技能: z.array(z.object({
            技能名: z.string().prefault(''),
            权重: clamp0_1.prefault(1),
          })).prefault([]),
          备注: z.string().prefault(''),
        })
      ).prefault({}),

      考试记录: z.record(
        z.string().describe('考试ID'),
        z.object({
          名称: z.string().prefault(''),
          类别: z.enum(['日常检验', '阶段结业', '阶级晋升', '功名获取', '资格认证', '专项技艺', '遴选面试', '其他']).prefault('阶段结业').describe('泛化：日常检验=随堂/周考 / 阶段结业=期中期末 / 阶级晋升=升学 / 功名获取=科举/公考 / 资格认证=职业证书 / 专项技艺=体育艺术武艺 / 遴选面试=面试殿试'),
          科目或项目: z.string().prefault(''),
          制式ID: z.string().prefault(''),
          周期: z.coerce.number().prefault(0),
          关联技能: z.array(z.object({
            技能名: z.string().prefault(''),
            权重: clamp0_1.prefault(1),
          })).prefault([]),
          原始分: z.any().prefault(null),
          换算值: z.any().prefault(null),
          是否通过: z.coerce.number().prefault(-1),
          评定: z.string().prefault(''),
          班级排名: z.coerce.number().prefault(0),
          年级排名: z.coerce.number().prefault(0),
          区域排名或百分位: z.string().prefault(''),
          证书产出: z.string().prefault(''),
          评价: z.string().prefault(''),
        })
      ).prefault({}),

      升学记录: z.record(
        z.string().describe('节点ID'),
        z.object({
          关卡: z.string().prefault(''),
          路径: z.enum(['常规', '特批', '直升', '跳级', '延期', '转籍', '其他']).prefault('常规').describe('泛化：常规=考核晋升 / 特批=保送推荐免试 / 直升=顺延 / 跳级=越级 / 延期=复读留级 / 转籍=转学转行'),
          结果: z.string().prefault(''),
          周期: z.coerce.number().prefault(0),
        })
      ).prefault({}),

      学历档案: z.record(
        z.string().describe('学历ID'),
        z.object({
          学段: z.string().prefault(''),
          学校: z.string().prefault(''),
          专业: z.string().prefault(''),
          入学周期: z.coerce.number().prefault(0),
          毕业周期: z.coerce.number().prefault(0),
          状态: z.enum(['毕业', '肄业', '结业', '在读']).prefault('在读'),
          学位: z.string().prefault(''),
          绩点或成绩: z.string().prefault(''),
          荣誉: z.array(z.string()).prefault([]),
          学历证书产出: z.coerce.number().prefault(0),
        })
      ).prefault({}),

      资质证书: z.record(
        z.string().describe('证书名'),
        z.object({
          类别: z.string().prefault(''),
          等级: z.string().prefault(''),
          获得周期: z.coerce.number().prefault(0),
          有效期到期周期: z.coerce.number().prefault(-1),
          颁发机构: z.string().prefault(''),
          描述: z.string().prefault(''),
        })
      ).prefault({}),

      学业概况: z.object({
        当前阶段: z.enum(['早期教育', '基础阶段', '高级阶段', '研究阶段', '独立阶段', '专项考核', '']).prefault('').describe('泛化：早期教育=学龄前 / 基础阶段=小学初中 / 高级阶段=高中大学 / 研究阶段=研究生 / 独立阶段=已毕业 / 专项考核=社会考试'),
        在校表现: z.object({
          主科均分或GPA: z.coerce.number().prefault(0),
          班级排名档: z.enum(['顶尖', '中上', '中游', '中下', '垫底', '']).prefault(''),
          年级位次百分比: clamp0_100.prefault(50),
          偏科度: z.enum(['均衡', '轻度偏科', '严重偏科', '']).prefault(''),
          强势科目: z.array(z.string()).prefault([]),
          弱势科目: z.array(z.string()).prefault([]),
        }).prefault({}),
        学业档位: z.enum(['极优', '上游', '中游', '下游', '濒危', '中止', '']).prefault('').describe('泛化：极优=学霸/首席 / 上游=优等生 / 中游=中规中矩 / 下游=后进 / 濒危=挂科边缘 / 中止=辍学脱籍'),
        升学进度: z.object({
          下一关卡: z.string().prefault(''),
          目标: z.string().prefault(''),
          预测达成率: clamp0_1.prefault(0),
        }).prefault({}),
        社会考试进度: z.object({
          在备考: z.array(z.string()).prefault([]),
          已通过: z.array(z.string()).prefault([]),
        }).prefault({}),
        学习势头: z.coerce.number().transform(function(v) { return _.clamp(v, -5, 5); }).prefault(0),
        _各科最近分: z.record(z.string(), z.coerce.number()).prefault({}),
        学业声望标签: z.string().prefault(''),
        _累计: z.object({
          考试总场次: z.coerce.number().prefault(0),
          通过率: clamp0_1.prefault(0),
          历史最高排名: z.coerce.number().prefault(0),
          最高单科分: z.coerce.number().prefault(0),
        }).prefault({}),
        _可跳级: z.coerce.number().prefault(0),
        _保送资格: z.coerce.number().prefault(0),
      }).prefault({}),

      $归档: z.record(z.string(), z.any()).prefault({}),
    }).prefault({}).describe('V3大改·考试/学业系统·默认休眠事件驱动'),

    // ══════════════════════════════════════════════════════════
    // 体征系统（V3大改 · 主角.体征）
    // ══════════════════════════════════════════════════════════
    体征: z.object({
      身高: z.coerce.number().prefault(0).describe('cm·引擎按体质机械增长'),
      体重: z.coerce.number().prefault(0).describe('kg·AI叙事驱动'),
      _BMI: z.coerce.number().prefault(0).describe('脚本自动折算·只读'),
      体型标签: z.enum(['过瘦', '偏瘦', '正常', '偏壮', '偏胖', '肥胖', '']).prefault(''),
      发育阶段: z.enum(['婴幼儿', '儿童', '青春期前', '青春期', '成熟', '衰老']).prefault('成熟'),
      _成年身高: z.coerce.number().prefault(0).describe('开局定·基础(性别)+体质修正+随机'),
      _发育进度: clamp0_100.prefault(100),
      健康体重区间: z.object({
        下限: z.coerce.number().prefault(0),
        上限: z.coerce.number().prefault(0),
      }).prefault({}),
      体型效果: z.array(z.object({
        通道: z.string().prefault(''),
        op: z.enum(['加', '乘']).prefault('加'),
        强度: z.coerce.number().prefault(0),
      })).prefault([]).describe('修饰通道·不覆写颜值本值'),
    }).prefault({}).describe('V3大改·体征系统·身高引擎/体重AI/BMI脚本'),

    // ══════════════════════════════════════════════════════════
    // 职业系统（V3大改 · 支持多职业/主副兼职/派遣）
    // ══════════════════════════════════════════════════════════
    职业: z.object({
      _职级体系库: z.record(
        z.string().describe('体系ID'),
        z.object({
          领域: z.string().prefault(''),
          晋升模式: z.enum(['考核', '资历', '军功', '举荐', '世袭', '选举', '自雇']).prefault('考核'),
          职级阶梯: z.array(z.object({
            级序: z.coerce.number().prefault(0),
            职级名: z.string().prefault(''),
            品阶: z.string().prefault(''),
            权力值: clamp0_100.prefault(0),
            晋升门槛: z.string().prefault(''),
          })).prefault([]),
          关联属性: z.array(z.string()).prefault([]),
          关联技能: z.array(z.string()).prefault([]),
        })
      ).prefault({}),

      任职: z.array(z.object({
        体系ID: z.string().prefault(''),
        当前级序: z.coerce.number().prefault(0),
        职位名: z.string().prefault(''),
        雇主或势力: z.string().prefault('').describe('组织实体键'),
        性质: z.enum(['主业', '副业', '兼职', '派遣', '自雇', '实习', '义务']).prefault('主业'),
        工时档: z.enum(['全职', '兼职', '零工', '']).prefault(''),
        在职状态: z.enum(['在职', '停职', '休假', '离职']).prefault('在职'),
        报酬: z.string().prefault(''),
        入职周期: z.coerce.number().prefault(0),
        绩效: z.coerce.number().transform(function(v) { return _.clamp(v, -5, 5); }).prefault(0),
      })).prefault([]).describe('多职业并存·主业唯一其余不限'),

      职业履历: z.record(
        z.string().describe('履历ID'),
        z.object({
          体系ID: z.string().prefault(''),
          职位名: z.string().prefault(''),
          雇主或势力: z.string().prefault(''),
          入职周期: z.coerce.number().prefault(0),
          离职周期: z.coerce.number().prefault(0),
          离任方式: z.enum(['升迁', '平调', '降职', '裁员', '辞职', '罢免', '战死', '退休', '']).prefault(''),
        })
      ).prefault({}),
    }).prefault({}).describe('V3大改·职业系统·默认休眠仅任免/考核事件时AI参与'),

    // ─── 子嗣（V3大改 · 复用NPC结构 + 活育成 + 惰性继承预案）───
    子嗣: z.record(
      z.string().describe('子嗣键名'),
      z.object({
        称呼: z.string().prefault(''),
        性别: z.string().prefault(''),
        年龄: z.coerce.number().prefault(0),
        人生阶段: z.enum(['婴幼儿', '学龄前', '青少年', '青年', '成年', '中年', '老年']).prefault('婴幼儿'),
        存活状态: z.enum(['在世', '已故']).prefault('在世'),
        好感度: clampNeg100_100.prefault(60),
        关系深度: clamp0_100.prefault(20),
        性格: z.string().prefault('').describe('MBTI'),
        性格补充: z.string().prefault(''),

        // 复用主角schema的属性/技能/特质（活字段·可育成）
        属性: z.object({
          体质: clamp0_100.prefault(0),
          智慧: clamp0_100.prefault(0),
          魅力: clamp0_100.prefault(0),
          心理: clamp0_100.prefault(0),
        }).prefault({}),
        技能: z.record(z.string(), z.object({
          熟练度: clamp0_100.prefault(0),
          等级: z.coerce.number().transform(function(v) { return _.clamp(v, 0, 10); }).prefault(0),
          类别: z.string().prefault('通用'),
        })).prefault({}),
        特质: z.record(z.string(), z.object({
          类别: z.enum(['天赋', '性格', '后天', '身体', '压力']).prefault('天赋'),
          来源: z.string().prefault('遗传'),
        })).prefault({}),

        // 亲子信息
        亲子: z.object({
          来源: z.enum(['血亲', '养子', '继子', '过继', '义子']).prefault('血亲'),
          其他双亲: z.string().prefault(''),
          资质: z.object({
            成长上限修正: z.record(z.string(), z.coerce.number()).prefault({}),
            天赋种子: z.array(z.string()).prefault([]),
          }).prefault({}),
          入族周期: z.coerce.number().prefault(0),
        }).prefault({}),

        // 养育（核心闭环·决定接班面板）
        养育: z.object({
          教育投入: clamp0_100.prefault(0),
          陪伴度: clamp0_100.prefault(0),
          管教风格: z.string().prefault(''),
          言传身教: z.array(z.string()).prefault([]),
        }).prefault({}),

        // 继承预案（惰性·临继承才快照）
        继承预案: z.object({
          继承顺位: z.coerce.number().prefault(0),
          指定继承人: z.coerce.number().prefault(0),
          继承意愿: z.enum(['极高', '稳定', '一般', '下滑', '危险', '']).prefault('').describe('泛化：极高=死忠/至亲 / 稳定=忠诚/信任 / 一般=中立 / 下滑=动摇/隔阂 / 危险=离心/准备背叛'),
        }).prefault({}),

        // 子嗣自有人生记忆
        子嗣工作记忆: z.array(z.object({
          记忆id: z.string().prefault(''),
          摘要: z.string().prefault(''),
          周期: z.coerce.number().prefault(0),
          重要度: z.enum(['普通', '重要', '命运']).prefault('普通'),
          对象: z.string().prefault(''),
        })).prefault([]),
        子嗣长期归档: z.array(z.object({
          记忆id: z.string().prefault(''),
          摘要: z.string().prefault(''),
          重要度: z.enum(['普通', '重要', '命运']).prefault('普通'),
          对象: z.string().prefault(''),
          永久: z.coerce.number().prefault(0),
        })).prefault([]).describe('decay-immune·继承包人生回忆摘要取自此'),

        上次互动周期: z.coerce.number().prefault(0),
        是否在场: z.coerce.number().prefault(0),
        关联地点: z.string().prefault(''),
        备注: z.string().prefault(''),
      })
    ).prefault({}),
  }).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 约束状态（V3大改：单对象→record多重约束叠加）
  // ══════════════════════════════════════════════════════════
  约束状态: z.record(
    z.string().describe('约束类型键'),
    z.object({
      类型: z.enum(['无', '上学', '服刑', '宵禁', '监护', '隔离', '软禁', '流放', '通缉', '债务管制', '戒严', '禁足', '学徒契约', '兵役']).prefault('无'),
      强度: z.enum(['轻', '中', '重']).prefault('轻'),
      到期周期: z.coerce.number().prefault(-1),
      描述: z.string().prefault(''),
    })
  ).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 家庭（V3大改：婚姻→数组）
  // ══════════════════════════════════════════════════════════
  家庭: z.object({
    父亲状态: z.string().prefault('健在'),
    母亲状态: z.string().prefault('健在'),
    婚姻: z.array(z.object({
      配偶: z.string().prefault(''),
      状态: z.enum(['现任', '离异', '丧偶', '事实婚', '']).prefault(''),
      缔结周期: z.coerce.number().prefault(0),
      终止周期: z.coerce.number().prefault(0),
    })).prefault([]),
    婚姻状态: z.string().prefault('未婚'),
    配偶姓名: z.string().prefault(''),
    子女数量: z.coerce.number().prefault(0),
    子女名单: z.record(z.string(), z.coerce.number()).prefault({}),
  }).prefault({}),

  // ══════════════════════════════════════════════════════════
  // NPC（V3大改：MBTI替OCEAN · 能力档 · 所属组织 · 向背 · 秘密重构）
  // ══════════════════════════════════════════════════════════
  NPC: z.record(
    z.string().describe('NPC键名'),
    z.object({
      称呼: z.string().prefault(''),
      关系标签: z.string().prefault('陌生人'),
      标签: z.array(z.string()).prefault([]),
      性别: z.string().prefault(''),
      年龄: z.coerce.number().prefault(0),
      基准录入周期: z.coerce.number().prefault(0),
      关系大类: z.enum(['亲属', '朋友', '恋人', '宠物', '师长', '同侪', '上下级', '敌对', '合作', '陌生']).prefault('陌生'),
      好感度: clampNeg100_100.prefault(0),
      信任度: clamp0_100.prefault(0),
      基线: clampNeg100_100.prefault(0),
      关系深度: clamp0_100.prefault(0),
      重要等级: z.enum(['路人', '次要', '重要', '核心']).prefault('路人'),
      召回权重: clamp0_100.prefault(50),
      人生阶段: z.enum(['婴幼儿', '学龄前', '青少年', '青年', '成年', '中年', '老年']).prefault('成年'),
      身份: z.string().prefault(''),
      印象标签: z.array(z.string()).prefault([]),
      本轮同步行动: z.string().prefault(''),
      上次互动周期: z.coerce.number().prefault(0),
      是否在场: z.coerce.number().prefault(0),
      关联地点: z.string().prefault(''),

      // V3大改：MBTI 替代 OCEAN（性格轴保留兼容降优先级）
      性格: z.string().prefault('').describe('MBTI如ENTJ'),
      性格补充: z.string().prefault('').describe('MBTI兜不住的细节'),
      性格轴: z.object({
        外向: clamp0_100.prefault(50),
        亲和: clamp0_100.prefault(50),
        尽责: clamp0_100.prefault(50),
        情绪稳定: clamp0_100.prefault(50),
        开放: clamp0_100.prefault(50),
      }).prefault({}),
      性格类型: z.string().prefault(''),
      外貌: z.string().prefault(''),
      背景: z.string().prefault(''),
      备注: z.string().prefault(''),

      // V3大改：向背（惰性·仅忠诚相关NPC才写）
      向背: z.enum(['极高', '稳定', '一般', '下滑', '危险', '']).prefault('').describe('泛化忠诚档位：极高=死忠/至亲 / 稳定=忠诚/专一 / 一般=中立/公事公办 / 下滑=动摇/冷淡 / 危险=离心/准备背叛'),

      // V3大改：能力档（惰性·仅重要/核心NPC按需补）
      能力档: z.object({
        属性简表: z.record(z.string(), z.coerce.number()).prefault({}).describe('如{武力:95,体质:90}'),
        技能: z.array(z.object({
          名: z.string().prefault(''),
          熟练度: clamp0_100.prefault(0),
        })).prefault([]),
        装备: z.array(z.string()).prefault([]),
      }).prefault({}).describe('惰性·仅同行/调度/对抗时提醒AI补'),

      // V3大改：所属组织
      所属组织: z.array(BelongsToOrg).prefault([]).describe('惰性·仅涉政治/职场/阵营时更新'),

      // V3大改：秘密索引重构
      秘密索引: z.record(
        z.string().describe('条目标识'),
        SecretEntry
      ).prefault({}),

      存活状态: z.enum(['在世', '已故']).prefault('在世'),
      死亡周期: z.coerce.number().prefault(-1),
      个人目标: z.array(z.string()).prefault([]),
      当前困境: z.array(z.string()).prefault([]),
      行动倾向: z.enum(['进取', '保守', '投机', '回避']).prefault('保守'),
      近期计划摘要: z.string().prefault(''),
      记忆: z.array(MemoryEntry).prefault([]),
    })
  ).prefault({}),

  已故NPC归档: z.record(z.string(), z.object({
    称呼: z.string().prefault(''),
    关系标签: z.string().prefault(''),
    死亡周期: z.coerce.number().prefault(0),
    关键记忆指针: z.string().prefault(''),
  })).prefault({}),

  关系网: z.record(z.string(), z.object({
    A键: z.string().prefault(''),
    B键: z.string().prefault(''),
    关系标签: z.string().prefault(''),
    关系值: clampNeg100_100.prefault(0),
    上次更新周期: z.coerce.number().prefault(0),
  })).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 组织实体（V3大改：泛化经营实体→组织实体）
  // ══════════════════════════════════════════════════════════
  组织实体: z.record(
    z.string().describe('组织键'),
    z.object({
      类型: z.string().prefault('').describe('公司/店铺/政权/官府/军队/帮派/政党/宗门/部落/庄园/商号/思想运动…'),
      行业: z.string().prefault(''),
      状态: z.enum(['筹备', '营业', '扩张', '跨国', '上市', '亏损', '停业', '已售', '解体', '']).prefault(''),
      占股: clamp0_100.prefault(0),
      经营范围: z.array(z.string()).prefault([]).describe('通用业务标签:合法非法同一字段'),
      风险: clamp0_100.prefault(0).describe('通用风险性0-100·达临界触发危机事件'),
      币种: z.string().prefault(''),
      投入本金: z.coerce.number().prefault(0),
      估值: z.coerce.number().prefault(0),
      本期营收: z.coerce.number().prefault(0),
      本期成本: z.coerce.number().prefault(0),
      本期净利: z.coerce.number().prefault(0),
      累计盈亏: z.coerce.number().prefault(0),
      分支机构: z.array(z.string()).prefault([]),
      用工: z.object({
        员工数: z.coerce.number().prefault(0),
        岗位: z.record(z.string(), z.object({
          人数: z.coerce.number().prefault(0),
          月薪: z.coerce.number().prefault(0),
          技能等级: z.enum(['初级', '熟练', '资深']).prefault('初级'),
        })).prefault({}),
        人力成本_期: z.coerce.number().prefault(0),
        产能系数: z.coerce.number().prefault(1),
        士气: clamp0_100.prefault(70),
        关键员工: z.array(z.string()).prefault([]),
      }).prefault({}),

      // V3大改新增：治理（仅政治·军事实体激活）
      治理: z.object({
        掌控度: clamp0_100.prefault(0),
        合法性: clamp0_100.prefault(0),
        民心: clamp0_100.prefault(50),
        凝聚力: clamp0_100.prefault(50),
        追随者规模: z.coerce.number().prefault(0),
        控制区: z.array(z.string()).prefault([]),
        关联职级体系ID: z.string().prefault(''),
      }).prefault({}),

      // V3大改新增：军事（仅军事实体激活）
      军事: z.object({
        兵力: z.coerce.number().prefault(0),
        战力: z.string().prefault(''),
        装备等级: z.string().prefault(''),
        驻地: z.string().prefault(''),
        士气: clamp0_100.prefault(50),
      }).prefault({}),

      // V3大改新增：信念（组织级）
      信念: z.object({
        官方体系: z.string().prefault(''),
        强制度: clamp0_100.prefault(0),
        异端容忍: clamp0_100.prefault(50),
        思潮派系: z.string().prefault(''),
      }).prefault({}),

      // V3大改新增：进展树
      进展树: z.record(
        z.string().describe('领域:制度/科技/信仰/文化/学派'),
        z.record(z.string().describe('节点名'), z.object({
          前置: z.array(z.string()).prefault([]),
          进度: clamp0_100.prefault(0),
          投入: z.string().prefault(''),
          解锁效果: z.string().prefault(''),
        }))
      ).prefault({}),

      // V3大改新增：派系登记
      派系登记: z.record(
        z.string().describe('派系键'),
        z.object({
          领袖: z.string().prefault('').describe('NPC键'),
          主张: z.string().prefault(''),
          势力值: clamp0_100.prefault(0),
          对领导立场: clampNeg100_100.prefault(0),
        })
      ).prefault({}),
    })
  ).prefault({}).describe('V3大改·泛化经营实体→组织实体·惰性激活'),

  // ══════════════════════════════════════════════════════════
  // 组织关系网（V3大改：组织↔组织外交边集）
  // ══════════════════════════════════════════════════════════
  组织关系网: z.record(
    z.string().describe('边ID'),
    z.object({
      A组织: z.string().prefault(''),
      B组织: z.string().prefault(''),
      关系: z.enum(['同盟', '附庸', '敌对', '竞争', '交战', '中立', '']).prefault(''),
      关系值: clampNeg100_100.prefault(0),
      条约: z.string().prefault(''),
    })
  ).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 地图（V3大改：递归节点树 + 探索 + 产出三层 + 战役）
  // ══════════════════════════════════════════════════════════
  地图: z.object({
    地点: z.record(
      z.string().describe('地点键'),
      z.object({
        名称: z.string().prefault(''),
        类别: z.string().prefault(''),
        所属区域: z.string().prefault(''),
        父节点: z.string().prefault('').describe('空=顶层'),
        相对方位: z.string().prefault(''),
        坐标: z.string().prefault(''),
        地形: z.string().prefault(''),
        大小: z.enum(['微小', '狭小', '中等', '宏大', '']).prefault(''),
        结构: z.string().prefault(''),
        相邻: z.array(z.string()).prefault([]),
        状态: z.string().prefault('').describe('封闭/机关/围城/繁荣等'),
        控制方: z.string().prefault('').describe('组织实体键'),
        社交开放度: z.enum(['高', '中', '低']).prefault('中'),
        危险度: z.enum(['高', '中', '低']).prefault('低'),
        可达性: z.enum(['自由通行', '需陪同', '受限', '封闭']).prefault('自由通行'),
        探索度: clamp0_100.prefault(100),
        意象标签: z.array(z.string()).prefault([]),
        情绪色彩: z.string().prefault(''),
        是否已解锁: z.coerce.number().prefault(1),
        备注: z.string().prefault(''),
        // 产出三层（惰性披露）
        产业氛围: z.array(z.string()).prefault([]).describe('L1个人叙事'),
        可获取物产: z.array(z.object({
          物品名: z.string().prefault(''),
          获取方式: z.string().prefault('').describe('采摘/采集/捕猎/开采/垂钓/购买/制作'),
          稀有度: z.enum(['常见', '少见', '稀有', '稀世', '']).prefault(''),
          季节: z.string().prefault(''),
          关联技能: z.string().prefault(''),
        })).prefault([]).describe('L2 DND探索'),
        战略资源: z.array(z.object({
          资源大类: z.string().prefault(''),
          储量档: z.enum(['匮乏', '一般', '丰富', '富集', '']).prefault(''),
          开采度: clamp0_100.prefault(0),
          产能: z.string().prefault(''),
        })).prefault([]).describe('L3战略'),
        // 战略层字段
        控制度: clamp0_100.prefault(0),
        情报度: clamp0_100.prefault(0),
        人口规模: z.string().prefault(''),
        据点设施: z.array(z.string()).prefault([]),
      })
    ).prefault({}),

    战役: z.record(
      z.string().describe('战役ID'),
      z.object({
        交战方: z.array(z.string()).prefault([]),
        争夺区域: z.array(z.string()).prefault([]),
        态势: z.string().prefault(''),
        起周期: z.coerce.number().prefault(0),
      })
    ).prefault({}),

    区域物价: z.record(
      z.string().describe('区域ID'),
      z.record(z.string().describe('品类'), z.object({
        基准价: z.coerce.number().prefault(0),
        供需: clampNeg100_100.prefault(0),
      }))
    ).prefault({}).describe('V3大改·贸易/市场联动'),
  }).prefault({}),

  // ─── 主角位置与轨迹（V3大改）───
  主角位置: z.string().prefault('').describe('当前节点键'),
  主角轨迹: z.array(z.object({
    节点: z.string().prefault(''),
    周期: z.coerce.number().prefault(0),
  })).prefault([]),

  // ══════════════════════════════════════════════════════════
  // 行动卡（V3大改：扩展指令类型/关联字段）
  // ══════════════════════════════════════════════════════════
  行动卡库: z.record(
    z.string().describe('卡键'),
    z.object({
      名称: z.string().prefault(''),
      类别: z.string().prefault(''),
      行动点消耗: z.coerce.number().transform(function(v) { return _.clamp(Math.floor(v), 0, 20); }).prefault(1),
      占用槽位: z.coerce.number().transform(function(v) { return _.clamp(Math.floor(v), 1, 5); }).prefault(1),
      适用粒度: z.array(z.enum(['年', '季', '月', '周', '日'])).prefault([]),
      关联属性: z.string().prefault(''),
      关联技能: z.string().prefault(''),
      关联爱好: z.string().prefault(''),
      关联地点: z.string().prefault(''),
      关联NPC: z.string().prefault(''),
      检定模板: z.string().prefault(''),
      收益标签: z.string().prefault(''),
      风险标签: z.string().prefault(''),
      可达性要求: z.enum(['自由通行', '需陪同', '受限', '封闭']).prefault('自由通行'),
      解锁条件: z.string().prefault(''),
      描述: z.string().prefault(''),
      是否可RP: z.coerce.number().prefault(0),
      // V3大改新增
      指令类型: z.enum(['个人', '人事', '经营', '财务投资', '军事', '治理', '外交', '调查', '']).prefault(''),
      关联实体: z.string().prefault('').describe('组织实体ID'),
      关联物品: z.array(z.string()).prefault([]),
      使用技能: z.array(z.string()).prefault([]),
    })
  ).prefault({}),

  行动卡片池: z.object({
    年: z.record(z.string(), z.object({ 名称: z.string().prefault(''), 类别: z.string().prefault('日常'), 消耗行动点: z.coerce.number().prefault(1), 描述: z.string().prefault(''), 适用年龄段: z.array(z.string()).prefault([]), 适用身份: z.array(z.string()).prefault([]) })).prefault({}),
    季: z.record(z.string(), z.object({ 名称: z.string().prefault(''), 类别: z.string().prefault('日常'), 消耗行动点: z.coerce.number().prefault(1), 描述: z.string().prefault(''), 适用年龄段: z.array(z.string()).prefault([]), 适用身份: z.array(z.string()).prefault([]) })).prefault({}),
    月: z.record(z.string(), z.object({ 名称: z.string().prefault(''), 类别: z.string().prefault('日常'), 消耗行动点: z.coerce.number().prefault(1), 描述: z.string().prefault(''), 适用年龄段: z.array(z.string()).prefault([]), 适用身份: z.array(z.string()).prefault([]) })).prefault({}),
    周: z.record(z.string(), z.object({ 名称: z.string().prefault(''), 类别: z.string().prefault('日常'), 消耗行动点: z.coerce.number().prefault(1), 描述: z.string().prefault(''), 适用年龄段: z.array(z.string()).prefault([]), 适用身份: z.array(z.string()).prefault([]) })).prefault({}),
    日: z.record(z.string(), z.object({ 名称: z.string().prefault(''), 类别: z.string().prefault('日常'), 消耗行动点: z.coerce.number().prefault(1), 描述: z.string().prefault(''), 适用年龄段: z.array(z.string()).prefault([]), 适用身份: z.array(z.string()).prefault([]) })).prefault({}),
  }).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 日程（V3大改：扩展指挥台字段）
  // ══════════════════════════════════════════════════════════
  日程: z.record(
    z.string().describe('时间槽'),
    z.object({
      行动安排: z.array(z.object({
        行动: z.string().prefault(''),
        地点: z.string().prefault(''),
        同行NPC: z.array(z.string()).prefault([]).describe('V3大改：单→多'),
        行动点消耗: z.coerce.number().transform(function(v) { return _.clamp(Math.floor(v), 0, 20); }).prefault(1),
        时间粒度: z.enum(['年', '季', '月', '周', '日']).prefault('月'),
        // V3大改新增
        指令类型: z.enum(['个人', '人事', '经营', '财务投资', '军事', '治理', '外交', '调查', '']).prefault(''),
        关联实体: z.string().prefault(''),
        关联资产: z.string().prefault(''),
        调度对象: z.array(z.string()).prefault([]),
        目标: z.string().prefault(''),
        使用物品: z.array(z.string()).prefault([]),
        使用技能: z.array(z.string()).prefault([]),
        指令参数: z.record(z.string(), z.any()).prefault({}),
      })).prefault([]),
      行动: z.string().prefault(''),
      地点: z.string().prefault(''),
      同行NPC: z.string().prefault(''),
    })
  ).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 待结算事件（扩展加点种子白名单）
  // ══════════════════════════════════════════════════════════
  待结算事件: z.array(z.object({
    事件ID: z.string().prefault(''),
    标题: z.string().prefault(''),
    level: z.enum(['琐碎', '普通', '重要', '命运']).prefault('普通'),
    tag: z.string().prefault(''),
    摘要: z.string().prefault(''),
    选项: z.record(z.string(), z.string()).prefault({}),
    加点种子: z.string().prefault(''),
    可RP: z.coerce.number().prefault(0),
    已结算: z.coerce.number().prefault(0),
    玩家选择: z.string().prefault(''),
    check_profile: z.object({
      check_id: z.string().prefault(''),
      检定类型: z.string().prefault(''),
      难度等级: z.enum(['简单', '普通', '困难', '极难', '命运']).prefault('普通'),
      基础成功率: clamp0_1.prefault(0.6),
      关联属性: z.string().prefault(''),
      关联技能: z.string().prefault(''),
      关联物品: z.array(z.string()).prefault([]),
      关联NPC: z.array(z.string()).prefault([]),
      环境标签: z.array(z.string()).prefault([]),
      风险标签: z.array(z.string()).prefault([]),
      收益标签: z.array(z.string()).prefault([]),
      可见成功率: clamp0_1.prefault(0),
      final_probability: clamp0_1.prefault(0),
      dice_roll: clamp0_100.prefault(0),
      outcome_band: z.enum(['大失败', '失败', '部分成功', '成功', '大成功', '']).prefault(''),
      effect_multiplier: z.coerce.number().prefault(1),
      negative_multiplier: z.coerce.number().prefault(0),
      difficulty_snapshot: z.string().prefault('普通'),
    }).prefault({}),
    consequence: z.object({
      短期: z.string().prefault(''),
      长期: z.string().prefault(''),
      永久: z.string().prefault(''),
    }).prefault({}),
    因果链: z.array(z.object({
      chain_id: z.string().prefault(''),
      when: z.object({
        选项: z.array(z.string()).prefault([]),
        结果: z.array(z.string()).prefault([]),
        概率: clamp0_1.prefault(1),
      }).prefault({}),
      timing: z.object({
        mode: z.enum(['immediate', 'cycles', 'time']).prefault('immediate'),
        value: z.coerce.number().prefault(0),
        unit: z.enum(['年', '季', '月', '周', '日']).prefault('月'),
      }).prefault({}),
      seed: z.record(z.string(), z.any()).prefault({}),
    })).prefault([]),
  })).prefault([]),
  事件队列指针: posInt.prefault(0),

  // ══════════════════════════════════════════════════════════
  // 记忆系统（保持不变）
  // ══════════════════════════════════════════════════════════
  记忆库: z.record(z.string(), ProtagMemoryEntry).prefault({}),
  工作记忆: z.record(z.string(), ProtagMemoryEntry).prefault({}),
  长期归档: z.record(z.string(), ArchiveMemoryEntry).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 仲裁器 / 事件库注册表（保持不变）
  // ══════════════════════════════════════════════════════════
  仲裁器: z.object({
    冷却表: z.record(z.string(), z.object({
      上次注入周期: z.coerce.number().prefault(0),
      冷却窗口: z.coerce.number().prefault(3),
    })).prefault({}),
    延后队列: z.array(z.string()).prefault([]),
    last_tick_id: z.string().prefault(''),
    本轮种子包: z.object({
      tick_id: z.string().prefault(''),
      主种子id: z.string().prefault(''),
      副种子ids: z.array(z.string()).prefault([]),
    }).prefault({}),
  }).prefault({}),

  事件库注册表: z.record(z.string(), z.object({
    pack_id: z.string().prefault(''),
    pack_version: posInt.prefault(1),
    启用: z.coerce.number().prefault(1),
    priority: clamp0_100.prefault(50),
    来源lorebook: z.string().prefault(''),
    索引条目uid: z.string().prefault(''),
    event_format_version: posInt.prefault(1),
    author: z.string().prefault(''),
  })).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 全局（V3大改：继承包重构）
  // ══════════════════════════════════════════════════════════
  全局: z.object({
    继承包: z.record(
      z.string().describe('子嗣角色ID'),
      z.object({
        角色ID: z.string().prefault(''),
        血缘: z.string().prefault(''),
        前代角色ID: z.string().prefault(''),
        属性基线: z.object({
          体质: z.coerce.number().prefault(10),
          智慧: z.coerce.number().prefault(10),
          魅力: z.coerce.number().prefault(10),
          心理: z.coerce.number().prefault(10),
        }).prefault({}),
        技能继承: z.record(z.string(), z.coerce.number()).prefault({}),
        继承特质: z.array(z.string()).prefault([]),
        人生回忆摘要: z.array(z.string()).prefault([]),
        继承天赋: z.string().prefault(''),
        继承物品: z.array(z.string()).prefault([]),
        家族记忆摘要: z.string().prefault(''),
        遗产: z.object({
          现金: z.coerce.number().prefault(0),
          资产: z.array(z.string()).prefault([]),
          债务: z.coerce.number().prefault(0),
        }).prefault({}),
        继承物品详情: z.array(z.string()).prefault([]),
        可能遗传缺陷: z.array(z.string()).prefault([]),
        出生地: z.string().prefault(''),
      })
    ).prefault({}),
    家族树: z.record(
      z.string().describe('角色ID'),
      z.object({
        角色ID: z.string().prefault(''),
        姓名: z.string().prefault(''),
        性别: z.string().prefault(''),
        出生年份: z.string().prefault(''),
        死亡年份: z.string().prefault(''),
        出生地: z.string().prefault(''),
        存活年数: z.coerce.number().prefault(0),
        总评等级: z.string().prefault(''),
        一句话总评: z.string().prefault(''),
        状态: z.enum(['在世', '已故']).prefault('在世'),
        死亡周期: z.coerce.number().prefault(-1),
        子女: z.array(z.string()).prefault([]),
        配偶: z.array(z.string()).prefault([]).describe('V3大改：单→多'),
        关键成就: z.array(z.string()).prefault([]),
        传家宝: z.array(z.string()).prefault([]),
      })
    ).prefault({}),
  }).prefault({}),

  // ══════════════════════════════════════════════════════════
  // 货币系统（保持大体不变，经营实体字段保留兼容但新增走组织实体）
  // ══════════════════════════════════════════════════════════
  货币系统: z.object({
    启用: z.boolean().prefault(true),
    币种定义: z.record(z.string(), z.object({
      名称: z.string().prefault(''),
      类型: z.enum(['法币', '实物', '虚拟', '票券']).prefault('法币'),
      量词: z.string().prefault(''),
      单位: z.string().prefault('元'),
      符号: z.string().prefault(''),
      描述: z.string().prefault(''),
      时代适用: z.object({ 起始年份: z.coerce.number().prefault(1900), 终止年份: z.coerce.number().prefault(2200) }).prefault({}),
      地域适用: z.array(z.string()).prefault([]),
      对基准汇率: z.coerce.number().transform(function(v) { return Math.max(0.0001, v); }).prefault(1.0),
    })).prefault({}),
    基准币种: z.string().prefault('RMB'),
    换汇登记: z.array(z.string()).prefault([]),
    AI财富映射表: z.object({
      基准单位: z.string().prefault('RMB'),
      财富等级阈值: z.object({
        寒门上限: z.coerce.number().prefault(0).describe('泛化：寒门=赤贫线'),
        温饱上限: z.coerce.number().prefault(0).describe('泛化：温饱=贫寒线'),
        小资上限: z.coerce.number().prefault(0).describe('泛化：小资=小康线'),
        富庶上限: z.coerce.number().prefault(0).describe('泛化：富庶=富裕线'),
      }).prefault({}),
    }).prefault({}),
    经济依附: z.object({
      状态: z.string().prefault('独立'),
      对象: z.string().prefault(''),
      每期模式: z.string().prefault(''),
      备注: z.string().prefault(''),
    }).prefault({}),
    账户: z.object({
      持有: z.record(z.string(), CurrencyAmount).prefault({}),
      储蓄: z.record(z.string(), CurrencyAmount).prefault({}),
      本期收入: z.object({ 总额本位币: z.coerce.number().prefault(0), 明细: z.record(z.string(), CurrencyAmount).prefault({}) }).prefault({}),
      本期支出: z.object({ 总额本位币: z.coerce.number().prefault(0), 明细: z.record(z.string(), CurrencyAmount).prefault({}) }).prefault({}),
      负债: z.record(z.string(), z.object({
        本金: CurrencyAmount.prefault({}),
        币种: z.string().prefault(''),
        利率: clamp0_1.prefault(0),
      })).prefault({}),
      被动收入来源: z.record(z.string(), z.object({
        类型: z.string().prefault(''),
        金额: CurrencyAmount.prefault({}),
        币种: z.string().prefault(''),
      })).prefault({}),
      本期储蓄建议: z.object({
        净沉淀: z.coerce.number().prefault(0),
        建议储蓄主面额: z.coerce.number().prefault(0),
        基准币种: z.string().prefault(''),
        缺口: z.coerce.number().prefault(0),
        来源: z.string().prefault('engine'),
      }).prefault({}),
      持仓: z.record(z.string(), z.object({
        类型: z.enum(['股票', '基金', '债券', '房产', '加密', '大宗', '其它']).prefault('股票'),
        数量: z.coerce.number().prefault(0),
        成本价: z.object({ 币种: z.string().prefault(''), 单价: z.coerce.number().prefault(0) }).prefault({}),
        现价: z.object({ 币种: z.string().prefault(''), 单价: z.coerce.number().prefault(0) }).prefault({}),
        风险等级: z.enum(['低', '中', '高', '极高']).prefault('中'),
        浮动损益: z.coerce.number().prefault(0),
        币种: z.string().prefault(''),
        建仓时间: z.string().prefault(''),
        备注: z.string().prefault(''),
      })).prefault({}),
      经营实体: z.record(z.string(), z.any()).prefault({}).describe('兼容保留·新增走顶层组织实体'),
    }).prefault({}),
    市场状态: z.object({
      激活: z.boolean().prefault(false),
      大盘景气: z.enum(['萧条', '低迷', '平稳', '繁荣', '泡沫']).prefault('平稳'),
      通胀率: z.coerce.number().prefault(0),
      基准利率: z.coerce.number().prefault(0),
      行业景气: z.record(z.string(), z.coerce.number()).prefault({}),
      时代风波: z.string().prefault(''),
      区域物价: z.record(z.string(), z.record(z.string(), z.object({
        基准价: z.coerce.number().prefault(0),
        供需: clampNeg100_100.prefault(0),
      }))).prefault({}).describe('V3大改·贸易联动'),
    }).prefault({}),
  }).prefault({}),

});

$( function() { registerMvuSchema(Schema); });
