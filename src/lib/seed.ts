// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type {AppData,CustomerType,Equipment,EquipmentCategory,ExtraItem,PackageTier,ShootStyle} from './types';
import {localizeSettings} from './settings';

/** Default business data for a new studio. IDs are identical in every language so later merges never duplicate items. */
type Language='zh'|'en';
type Text=readonly [zh:string,en:string];
const pick=(text:Text,language:Language)=>language==='en'?text[1]:text[0];

const EQUIPMENT:{id:string;code:string;name:string;brand:string;category:EquipmentCategory;specs:Text;card?:boolean}[]=[
 {id:'eq-cam-001',code:'Camera 001A',name:'Sony α7C II',brand:'Sony',category:'相机机身',specs:['全画幅 · 3300 万像素 · 4K60p · 机身防抖','Full frame · 33 MP · 4K60p · in-body stabilisation']},
 {id:'eq-cam-002',code:'Camera 002A',name:'Nikon Z8',brand:'Nikon',category:'相机机身',specs:['全画幅 · 4571 万像素 · 8K60p','Full frame · 45.7 MP · 8K60p']},
 {id:'eq-cam-003',code:'Camera 003A',name:'Nikon Z9',brand:'Nikon',category:'相机机身',specs:['全画幅 · 4571 万像素 · 8K60p · 一体式竖拍','Full frame · 45.7 MP · 8K60p · integrated grip']},
 {id:'eq-cam-004',code:'Camera 004A',name:'Canon EOS R1',brand:'Canon',category:'相机机身',specs:['全画幅 · 2420 万像素 · 旗舰机身','Full frame · 24.2 MP · flagship body']},
 {id:'eq-lens-001',code:'Lens 001A',name:'ZEISS Otus 28mm f/1.4',brand:'ZEISS',category:'镜头',specs:['全画幅 · 广角定焦 · 手动对焦','Full frame · wide prime · manual focus']},
 {id:'eq-lens-002',code:'Lens 002A',name:'ZEISS Otus 55mm f/1.4',brand:'ZEISS',category:'镜头',specs:['全画幅 · 标准定焦 · 手动对焦','Full frame · standard prime · manual focus']},
 {id:'eq-lens-003',code:'Lens 003A',name:'ZEISS Otus 85mm f/1.4',brand:'ZEISS',category:'镜头',specs:['全画幅 · 人像定焦 · 手动对焦','Full frame · portrait prime · manual focus']},
 {id:'eq-lens-004',code:'Lens 004A',name:'ZEISS Otus 100mm f/1.4',brand:'ZEISS',category:'镜头',specs:['全画幅 · 中长焦定焦 · 手动对焦','Full frame · short telephoto prime · manual focus']},
 {id:'eq-light-001',code:'Light 001A',name:'Profoto B10X Plus',brand:'Profoto',category:'灯光',specs:['外拍闪光灯 · 500Ws · 持续光','Location flash · 500 Ws · continuous light']},
 {id:'eq-light-002',code:'Light 001B',name:'Profoto B10X Plus',brand:'Profoto',category:'灯光',specs:['外拍闪光灯 · 500Ws · 持续光','Location flash · 500 Ws · continuous light']},
 {id:'eq-lacc-001',code:'LightAcc 001A',name:'Profoto OCF Softbox Octa 2′',brand:'Profoto',category:'灯光附件',specs:['八角柔光箱 · 60cm','Octagonal softbox · 60 cm']},
 {id:'eq-lacc-002',code:'LightAcc 002A',name:'Profoto Connect Pro',brand:'Profoto',category:'灯光附件',specs:['无线引闪器','Wireless trigger']},
 {id:'eq-tripod-001',code:'Tripod 001A',name:'Gitzo Systematic Series 3',brand:'Gitzo',category:'脚架',specs:['碳纤维三脚架','Carbon-fibre tripod']},
 {id:'eq-tripod-002',code:'Tripod 002A',name:'Manfrotto Master Stand',brand:'Manfrotto',category:'脚架',specs:['灯架','Light stand']},
 {id:'eq-acc-001',code:'Acc 001A',name:'Sony NP-FZ100',brand:'Sony',category:'配件',specs:['原厂电池','Original battery']},
 {id:'eq-card-001',code:'Card 001A',name:'Sony CFexpress Type A TOUGH 160GB',brand:'Sony',category:'存储',specs:['CFexpress Type A 存储卡','CFexpress Type A memory card'],card:true},
 {id:'eq-card-002',code:'Card 002A',name:'Nikon CFexpress Type B 660GB',brand:'Nikon',category:'存储',specs:['CFexpress Type B 存储卡','CFexpress Type B memory card'],card:true},
 {id:'eq-card-003',code:'Card 003A',name:'Sony SF-G TOUGH SDXC 128GB',brand:'Sony',category:'存储',specs:['SD UHS-II 存储卡','SD UHS-II memory card'],card:true},
 {id:'eq-nd-001',code:'ND 001A',name:'ZEISS ND8 82mm',brand:'ZEISS',category:'ND滤镜',specs:['减 3 档 · 口径 82mm','3 stops · 82 mm']},
 {id:'eq-nd-002',code:'ND 002A',name:'ZEISS ND64 82mm',brand:'ZEISS',category:'ND滤镜',specs:['减 6 档 · 口径 82mm','6 stops · 82 mm']},
];

const CUSTOMER_TYPES:{id:string;name:Text;prefix:CustomerType['prefix']}[]=[
 {id:'ct-coser',name:['Coser','Cosplay'],prefix:'C'},
 {id:'ct-jk',name:['JK','JK'],prefix:'J'},
 {id:'ct-lolita',name:['洛丽塔','Lolita'],prefix:'L'},
 {id:'ct-2d',name:['二次元','ACGN'],prefix:'C'},
 {id:'ct-outdoor',name:['外景人像','Outdoor portrait'],prefix:'N'},
 {id:'ct-portrait',name:['人像','Portrait'],prefix:'N'},
 {id:'ct-wedding',name:['婚礼','Wedding'],prefix:'N'},
 {id:'ct-art',name:['艺术写真','Fine-art portrait'],prefix:'N'},
];
const PACKAGE_TIERS:{id:string;name:Text;description:Text;price:number;returnCount?:number;returnDays?:number}[]=[
 {id:'pt-basic',name:['基础档','Basic'],description:['单人单场景 · 精修 9 张','One person · one scene · 9 retouched images'],price:399,returnCount:9,returnDays:7},
 {id:'pt-standard',name:['标准档','Standard'],description:['单人双场景 · 精修 15 张','One person · two scenes · 15 retouched images'],price:699,returnCount:15,returnDays:7},
 {id:'pt-premium',name:['高级档','Premium'],description:['多场景 · 精修 25 张 · 含短视频','Multiple scenes · 25 retouched images · short video'],price:999,returnCount:25,returnDays:10},
 {id:'pt-custom',name:['定制档','Custom'],description:['内容与张数另行约定','Content and image count agreed separately'],price:0},
];
const EXTRA_ITEMS:{id:string;name:Text;price:number;note?:Text;advanceDays?:number;unitName?:Text}[]=[
 {id:'ex-express',name:['加急出图','Express delivery'],price:100,advanceDays:2,note:['48 小时内交付','Delivered within 48 hours']},
 {id:'ex-album',name:['电子相册','Digital album'],price:50},
 {id:'ex-scene',name:['加拍一个场景','Additional scene'],price:200},
 {id:'ex-video',name:['花絮短片','Behind-the-scenes video'],price:150},
 {id:'ex-raw',name:['RAW 原片','RAW files'],price:2,unitName:['张','image'],note:['按需提供，按张计价','Supplied on request, priced per image']},
];
const SHOOT_STYLES:{id:string;name:Text}[]=[
 {id:'ss-bright',name:['亮调','Bright']},{id:'ss-dark',name:['暗调','Low key']},{id:'ss-blue',name:['蓝调','Cool tone']},
 {id:'ss-warm',name:['暖调','Warm tone']},{id:'ss-film',name:['胶片感','Film look']},{id:'ss-natural',name:['自然光','Natural light']},
];

export function buildSeedData(language:Language='zh'):AppData{
 const equipments:Equipment[]=EQUIPMENT.map(e=>({id:e.id,code:e.code,name:e.name,brand:e.brand,category:e.category,stockInDate:'2026-01-01',specs:pick(e.specs,language),...(e.card?{isSdCard:true}:{}),builtin:true}));
 const customerTypes:CustomerType[]=CUSTOMER_TYPES.map(c=>({id:c.id,name:pick(c.name,language),prefix:c.prefix,builtin:true}));
 const packageTiers:PackageTier[]=PACKAGE_TIERS.map(t=>({id:t.id,name:pick(t.name,language),description:pick(t.description,language),price:t.price,...(t.returnCount!==undefined?{returnCount:t.returnCount}:{}),...(t.returnDays!==undefined?{returnDays:t.returnDays}:{}),builtin:true}));
 const extraItems:ExtraItem[]=EXTRA_ITEMS.map(x=>({id:x.id,name:pick(x.name,language),price:x.price,...(x.advanceDays?{advanceDays:x.advanceDays}:{}),...(x.unitName?{perUnit:true,unitName:pick(x.unitName,language)}:{}),...(x.note?{note:pick(x.note,language)}:{}),builtin:true}));
 const shootStyles:ShootStyle[]=SHOOT_STYLES.map(s=>({id:s.id,name:pick(s.name,language),builtin:true}));
 return {version:1,orders:[],preOrders:[],postOrders:[],equipments,customerTypes,packageTiers,shootStyles,extraItems,logs:[]};
}

/**
 * Shows built-in defaults that the studio has not edited in the interface language.
 * A field is translated only while it still equals the Chinese or English default, so edited text is never touched.
 */
const SEEDS={zh:buildSeedData('zh'),en:buildSeedData('en')};
const LOCALIZED_FIELDS=['name','description','specs','note','unitName'] as const;
type Collection='equipments'|'customerTypes'|'packageTiers'|'extraItems'|'shootStyles';
const COLLECTIONS:Collection[]=['equipments','customerTypes','packageTiers','extraItems','shootStyles'];
export function localizeDefaults(data:AppData,language:Language):AppData{
 const target=SEEDS[language],other=SEEDS[language==='en'?'zh':'en'];
 const next={...data} as AppData;
 for(const key of COLLECTIONS){
  const mine=new Map((target[key] as {id:string}[]).map(item=>[item.id,item as Record<string,unknown>]));
  const theirs=new Map((other[key] as {id:string}[]).map(item=>[item.id,item as Record<string,unknown>]));
  (next as unknown as Record<Collection,unknown[]>)[key]=((data[key]??[]) as {id:string;builtin?:boolean}[]).map(item=>{
   const a=mine.get(item.id),b=theirs.get(item.id);if(!item.builtin||!a||!b)return item;
   const row=item as unknown as Record<string,unknown>;let changed:Record<string,unknown>|null=null;
   for(const field of LOCALIZED_FIELDS){const value=row[field];if(value===undefined||value===a[field])continue;if(value===b[field]){changed??={...row};changed[field]=a[field];}}
   return (changed??item) as typeof item;
  });
 }
 next.settings=localizeSettings(data.settings,language);
 // Placeholders written when an order is archived.
 if(language==='en')next.orders=(data.orders??[]).map(o=>!o.anonymizedAt?o:{...o,customerName:o.customerName==='已清理'?'Cleared':o.customerName,customerTypeName:o.customerTypeName==='已清理'?'Cleared':o.customerTypeName,...(o.refund?.ruleText==='退款记录'?{refund:{...o.refund,ruleText:'Refund record'}}:{})});
 return next;
}
