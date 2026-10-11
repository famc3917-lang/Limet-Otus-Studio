// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
export const CLI_MODULES=['设置','分润','订单','工单','目录','经营','系统','天气'] as const;
export const CLI_HELP:Record<string,string[]>={
 '通用':['帮助 [模块]','引入 模块','退出','模块','清屏','确认 Y','取消','AI 需求'],
 '设置':['查看','设定 模式 个人|团队','设定 独立审片 开|关','设定 保留月数 1至120','设定 清理宽限月数 1至24','设定 自动清理 开|关','设定 起算 交付|拍摄|创建','设定 提权分钟 1至120','设定 延期审批提权 开|关'],
 '分润':['查看 订单编号','预留 订单编号 金额 百分比','成员 订单编号 账户编号 固定金额 百分比','移除成员 订单编号 账户编号','等比压缩 订单编号 开|关','计算 订单编号','导入规则 订单编号'],
 '订单':['查看 [关键词]','创建 客户 姓名 类型 类型编号 拍摄 日期时间 性别 男|女|非二元 成年 成年|未成年 [套餐 套餐编号] [地点 地点] [摄影师 姓名] [署名 账户编号] [渠道 渠道]','修改 订单编号 拍摄|地点|摄影师|署名|渠道 值','交付 订单编号'], '工单':['查看 前期|后期 [订单编号]','设定 前期|后期 工单编号 待开始|进行中|已完成'], '目录':['查看 全部|客户类型|套餐|设备|风格|增项'], '经营':['概览','流水 [订单编号]','账户'], '系统':['状态','账户'],
 '天气':['查看','密钥 密钥文本','地址 预报|空气|城市 网址','恢复默认'],
};
export const CLI_HELP_EN:Record<string,string[]>={
 '通用':['Help [module]','Import module','Exit','Modules','Clear','Confirm Y','Cancel','AI request'],
 '设置':['View','Set Mode Personal|Team','Set IndependentReview On|Off','Set RetentionMonths 1..120','Set GraceMonths 1..24','Set AutoDelete On|Off','Set StartAt Delivery|Shoot|Created','Set ElevationMinutes 1..120','Set ElevationApproval On|Off'],
 '分润':['View order','Reserve order amount percent','Member order account fixedAmount percent','RemoveMember order account','Normalize order On|Off','Calculate order','ImportRule order'],
 '订单':['View [keyword]','Create Client name Type typeId Shoot dateTime Gender Male|Female|Nonbinary Age Adult|Minor [Package packageId] [Location place] [Photographer name] [Signature accountId] [Channel channel]','Update order Shoot|Location|Photographer|Signature|Channel value','Deliver order'], '工单':['View Pre|Post [order]','Set Pre|Post taskId Pending|InProgress|Completed'], '目录':['View All|ClientTypes|Packages|Equipment|Styles|Extras'], '经营':['Overview','Entries [order]','Accounts'], '系统':['Status','Accounts'],
 '天气':['View','Key key','Endpoint Forecast|AirQuality|Geocoding url','Reset'],
};
const modules:Record<string,string>={General:'通用',Settings:'设置',Shares:'分润',Orders:'订单',System:'系统',Weather:'天气',Workflow:'工单',Catalog:'目录',Operations:'经营'};
const commands:Record<string,string>={Key:'密钥',Endpoint:'地址',Reset:'恢复默认',Help:'帮助',Import:'引入',Exit:'退出',Modules:'模块',Clear:'清屏',Confirm:'确认',Cancel:'取消',View:'查看',Set:'设定',Reserve:'预留',Member:'成员',RemoveMember:'移除成员',Normalize:'等比压缩',Calculate:'计算',ImportRule:'导入规则',Status:'状态',Accounts:'账户',Create:'创建',Update:'修改',Deliver:'交付',Overview:'概览',Entries:'流水'};
const fields:Record<string,string>={Mode:'模式',IndependentReview:'独立审片',RetentionMonths:'保留月数',GraceMonths:'清理宽限月数',AutoDelete:'自动清理',StartAt:'起算',ElevationMinutes:'提权分钟',ElevationApproval:'延期审批提权'};
const toggles:Record<string,string>={On:'开',Off:'关'};
const orderFields:Record<string,string>={Client:'客户',Type:'类型',Shoot:'拍摄',Gender:'性别',Age:'成年',Package:'套餐',Location:'地点',Photographer:'摄影师',Signature:'署名',Channel:'渠道'};
const orderValues:Record<string,Record<string,string>>={'性别':{Male:'男',Female:'女',Nonbinary:'非二元'},'成年':{Adult:'成年',Minor:'未成年'}};
const workflowWords:Record<string,string>={Pre:'前期',Post:'后期',Pending:'待开始',InProgress:'进行中',Completed:'已完成'};
const catalogWords:Record<string,string>={All:'全部',ClientTypes:'客户类型',Packages:'套餐',Equipment:'设备',Styles:'风格',Extras:'增项'};
const mapped=(values:Record<string,string>,value:string)=>Object.hasOwn(values,value)?values[value]:value;
export function cliModule(value:string){return mapped(modules,value);}
export function cliModuleLabel(value:string,language:string){return language==='en'?Object.entries(modules).find(([,canonical])=>canonical===value)?.[0]??value:value;}
export function cliHelp(language:string){return language==='en'?CLI_HELP_EN:CLI_HELP;}
export function cliTokens(line:string){if(line.length>2000)throw Error('命令过长');const tokens:string[]=[],pattern=/"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s"']+)/g;let end=0;for(const m of line.matchAll(pattern)){if(line.slice(end,m.index).trim())throw Error('引号未闭合');tokens.push(m[1]??m[2]??m[3]);end=m.index!+m[0].length;}if(line.slice(end).trim())throw Error('引号未闭合');return tokens;}
/** Translate reserved positions only. Queries, identifiers, amounts and script bodies remain literal. */
export function cliCanonicalTokens(line:string,module:string){
 const tokens=cliTokens(line),verb=mapped(commands,tokens[0]);
 tokens[0]=verb;
 if(verb==='引入'||verb==='帮助'){if(tokens[1])tokens[1]=cliModule(tokens[1]);}
 else if(cliModule(module)==='订单'&&verb==='创建'){for(let i=1;i<tokens.length;i+=2){tokens[i]=mapped(orderFields,tokens[i]);if(orderValues[tokens[i]]&&tokens[i+1]!==undefined)tokens[i+1]=mapped(orderValues[tokens[i]],tokens[i+1]);}}
 else if(cliModule(module)==='订单'&&verb==='修改')tokens[2]=mapped(orderFields,tokens[2]);
 else if(cliModule(module)==='工单'){if(tokens[1])tokens[1]=mapped(workflowWords,tokens[1]);if(verb==='设定'&&tokens[3])tokens[3]=mapped(workflowWords,tokens[3]);}
 else if(cliModule(module)==='目录'&&verb==='查看'&&tokens[1])tokens[1]=mapped(catalogWords,tokens[1]);
 else if(cliModule(module)==='天气'&&verb==='地址'&&tokens[1])tokens[1]=mapped({Forecast:'预报',AirQuality:'空气',Geocoding:'城市'},tokens[1]);
 else if(cliModule(module)==='设置'&&verb==='设定'){
  tokens[1]=mapped(fields,tokens[1]);
  const values=tokens[1]==='模式'?{Personal:'个人',Team:'团队'}:tokens[1]==='起算'?{Delivery:'交付',Shoot:'拍摄',Created:'创建'}:['独立审片','自动清理','延期审批提权'].includes(tokens[1])?toggles:{};
  tokens[2]=mapped(values as Record<string,string>,tokens[2]);
 }else if(cliModule(module)==='分润'&&verb==='等比压缩')tokens[2]=mapped(toggles,tokens[2]);
 return tokens;
}
export function cliSuggestions(input:string,module:string,language='zh'){
 if(input.startsWith('    '))return [];
 const help=cliHelp(language),prefix=input.trimStart(),word=prefix.split(/\s/)[0];
 const rows=[...CLI_MODULES.map(m=>(language==='en'?'Import ':'引入 ')+cliModuleLabel(m,language)),...help['通用'],...(help[cliModule(module)]??[])];
 return [...new Set(rows)].filter(row=>!word||row.startsWith(word)).slice(0,7);
}
export function cliMessage(message:string,language:string){
 if(language!=='en')return message;
 const messages:Record<string,string>={
  '命令面板仅供超级管理员登录会话使用':'The command panel requires a Super Administrator session.',
  '参数数量不符，请使用帮助查看固定语法':'Incorrect argument count. Use Help to check the syntax.',
  '参数须为整数':'The argument must be an integer.',
  '百分比须为0至100，最多两位小数':'Percent must be between 0 and 100, with at most two decimal places.',
  '开关参数只能是开或关':'Use On or Off for this setting.', '订单不存在':'Order not found.',
  '模式只能是个人或团队':'Mode must be Personal or Team.', '未知设置字段':'Unknown setting.',
  '起算只能是交付、拍摄或创建':'StartAt must be Delivery, Shoot or Created.',
  '本单已有分成快照，历史规则不改写':'This order already has a share snapshot. Historical rules cannot be overwritten.',
  '账户编号不存在':'Account not found.', 'AI需求最多4000字':'AI requests are limited to 4,000 characters.',
  '请先配置软件内的模型':'Configure a model in Studio first.',
  '草稿请核对后提交；所有写入仍需确认 Y':'Review the draft before submitting it. All writes require Confirm Y.',
  '已取消':'Cancelled.', '执行确认须输入大写 Y':'Confirmation requires an uppercase Y.',
  '方案已过期，请重新提交':'The proposal has expired. Submit it again.',
  '业务规则已变化，请重新预览':'The rules have changed. Preview the proposal again.',
  '计算命令须单独执行':'Submit Calculate as a separate command.', '操作已执行':'Operation completed.',
  '请输入命令':'Enter a command.', '一次最多50条命令':'A command group may contain at most 50 commands.',
  '模块不存在':'Module not found.', '已退出模块':'Returned to General.', '帮助最多一个模块参数':'Help accepts at most one module argument.',
  '订单查询最多一个关键词':'Order queries accept at most one keyword.',
  '命令不属于当前模块或语法不符，请输入帮助':'Unknown command in this module or invalid syntax. Enter Help.',
  '原生解释器只向已注册的软件维护插件开放，当前没有匹配处理器；不会转交系统终端':'No registered maintenance plugin handles this native block. It will not be sent to a system shell.',
  '订单修改字段无效':'Unsupported order field.', '命令字段重复或不支持':'A field is duplicated or unsupported.',
  '创建命令需要成对字段和值':'Create requires field/value pairs.', '工单类型无效':'Use Pre or Post.', '工单状态无效':'Use Pending, InProgress or Completed.',
  '目录类型无效':'Unknown catalog category.', '业务记录已变化，请重新预览':'Business records have changed. Preview the proposal again.',
  '命令过长':'The command is too long.', '引号未闭合':'Unclosed quotation mark.',
 };
 if(message.startsWith('已引入 '))return 'Imported '+cliModuleLabel(message.slice(4),'en')+'.';
 const range=message.match(/^参数须为(\d+)至(\d+)$/);if(range)return `The argument must be between ${range[1]} and ${range[2]}.`;
 return mapped(messages,message);
}
