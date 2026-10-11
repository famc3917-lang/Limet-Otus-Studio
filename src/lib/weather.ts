// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
export type WeatherKind = 'sun'|'cloud'|'rain'|'snow'|'fog'|'storm';
export interface WeatherDay { date:string; code:number; min:number; max:number; rain:number|null; wind?:number|null; gust?:number|null; direction?:number|null; precipitation?:number|null; uv?:number|null; sunrise?:string; sunset?:string; pm25?:number|null; visibility?:number|null }
export interface WeatherPlace { name:string; latitude:number; longitude:number; timezone:string }
export function weatherKind(code:number):WeatherKind { if(code>=95)return 'storm'; if([71,73,75,77,85,86].includes(code))return 'snow'; if(code>=51)return 'rain'; if([45,48].includes(code))return 'fog'; return code<=1?'sun':'cloud'; }
export const weatherLabels:Record<WeatherKind,string>={sun:'晴',cloud:'多云',rain:'雨',snow:'雪',fog:'雾',storm:'雷雨'};
const descriptions:Record<number,string>={0:'晴朗',1:'大部晴朗',2:'局部多云',3:'阴天',45:'雾',48:'雾凇',51:'小毛毛雨',53:'中毛毛雨',55:'大毛毛雨',56:'轻冻毛毛雨',57:'强冻毛毛雨',61:'小雨',63:'中雨',65:'大雨',66:'轻冻雨',67:'强冻雨',71:'小雪',73:'中雪',75:'大雪',77:'雪粒',80:'小阵雨',81:'中阵雨',82:'强阵雨',85:'小阵雪',86:'大阵雪',95:'雷雨',96:'雷雨伴冰雹',99:'强雷雨伴冰雹'};
const descriptionsEn:Record<number,string>={"0":"Clear","1":"Mostly clear","2":"Partly cloudy","3":"Overcast","45":"Fog","48":"Rime fog","51":"Light drizzle","53":"Moderate drizzle","55":"Dense drizzle","56":"Light freezing drizzle","57":"Dense freezing drizzle","61":"Light rain","63":"Moderate rain","65":"Heavy rain","66":"Light freezing rain","67":"Heavy freezing rain","71":"Light snow","73":"Moderate snow","75":"Heavy snow","77":"Snow grains","80":"Light showers","81":"Moderate showers","82":"Heavy showers","85":"Light snow showers","86":"Heavy snow showers","95":"Thunderstorm","96":"Thunderstorm with hail","99":"Severe thunderstorm with hail"};
export const weatherDescription=(code:number,language:string='zh')=>language==='en'?descriptionsEn[code]??'Unknown weather':descriptions[code]??'未知天气';
export const windDirection=(degrees?:number|null,language:string='zh')=>degrees==null?(language==='en'?'Unavailable':'暂无'):language==='en'?['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8]:['北','东北','东','东南','南','西南','西','西北'][Math.round(degrees/45)%8]+'风';
/** Open-Meteo compatible endpoints. The server supplies them from the weather provider set in the command panel. */
export interface WeatherEndpoints { forecast:string; air:string; geocoding:string; key?:string }
export const OPEN_METEO:WeatherEndpoints={forecast:'https://api.open-meteo.com/v1/forecast',air:'https://air-quality-api.open-meteo.com/v1/air-quality',geocoding:'https://geocoding-api.open-meteo.com/v1/search'};
/** Commercial Open-Meteo: the same API on hosts prefixed with "customer-", authenticated with the apikey parameter. */
export const OPEN_METEO_CUSTOMER:WeatherEndpoints={forecast:'https://customer-api.open-meteo.com/v1/forecast',air:'https://customer-air-quality-api.open-meteo.com/v1/air-quality',geocoding:'https://customer-geocoding-api.open-meteo.com/v1/search'};
const endpoint=(base:string,query:URLSearchParams,key?:string)=>{if(key)query.set('apikey',key);return base+(base.includes('?')?'&':'?')+query;};
export async function requestJson(url:string,signal:AbortSignal,fetcher:typeof fetch=fetch) { const r=await fetcher(url,{signal}); if(!r.ok)throw new Error('天气服务暂不可用'); return r.json(); }
type Series=Record<string,Array<number|null>|string[]>;
const numeric=(s:Series,key:string,i:number):number|null=>{const v=s[key]?.[i];return typeof v==='number'&&Number.isFinite(v)?v:null;};
export function parseForecast(raw:{daily?:Series;hourly?:Series}):WeatherDay[] {
 const d=raw.daily;if(!d||!Array.isArray(d.time))throw new Error('天气数据格式不完整');
 return d.time.flatMap((date,i)=>{
  const code=numeric(d,'weather_code',i),min=numeric(d,'temperature_2m_min',i),max=numeric(d,'temperature_2m_max',i);
  if(typeof date!=='string'||code==null||min==null||max==null)return [];
  const visibility=(raw.hourly?.time??[]).flatMap((t,j)=>String(t).startsWith(date)&&numeric(raw.hourly!,'visibility',j)!=null?[numeric(raw.hourly!,'visibility',j)!]:[]);
  return [{date,code,min,max,rain:numeric(d,'precipitation_probability_max',i),wind:numeric(d,'wind_speed_10m_max',i),gust:numeric(d,'wind_gusts_10m_max',i),direction:numeric(d,'wind_direction_10m_dominant',i),precipitation:numeric(d,'precipitation_sum',i),uv:numeric(d,'uv_index_max',i),sunrise:String(d.sunrise?.[i]??''),sunset:String(d.sunset?.[i]??''),visibility:visibility.length?Math.min(...visibility):null}];
 });
}
export function mergeAirQuality(days:WeatherDay[],raw:{hourly?:Series}):WeatherDay[] {return days.map(day=>{const values=(raw.hourly?.time??[]).flatMap((t,i)=>String(t).startsWith(day.date)&&numeric(raw.hourly!,'pm2_5',i)!=null?[numeric(raw.hourly!,'pm2_5',i)!]:[]);return {...day,pm25:values.length?Math.max(...values):null};});}
export async function fetchWeather(place:WeatherPlace,signal:AbortSignal,api:WeatherEndpoints=OPEN_METEO,fetcher:typeof fetch=fetch):Promise<WeatherDay[]> {
 const location={latitude:String(place.latitude),longitude:String(place.longitude),timezone:place.timezone||'auto'};
 const q=new URLSearchParams({...location,daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset',hourly:'visibility',wind_speed_unit:'ms',forecast_days:'16',past_days:'7'});
 const air=new URLSearchParams({...location,hourly:'pm2_5',forecast_days:'7'});
 const [forecast,aq]=await Promise.allSettled([requestJson(endpoint(api.forecast,q,api.key),signal,fetcher),requestJson(endpoint(api.air,air,api.key),signal,fetcher)]);
 if(forecast.status==='rejected')throw forecast.reason;
 const days=parseForecast(forecast.value);return aq.status==='fulfilled'?mergeAirQuality(days,aq.value):days;
}
export interface GeoResult extends WeatherPlace { id?:number; admin1?:string; admin2?:string; country?:string; country_code?:string; population?:number; feature_code?:string }
export function normalizeCities(results:GeoResult[],query:string):WeatherPlace[] {
 const seen=new Set<string>(),rank=(p:GeoResult)=>(p.name.toLowerCase()===query.trim().toLowerCase()?1e10:0)+(['PPLC','PPLA'].includes(p.feature_code??'')?1e9:0)+(p.population??0);
 return [...results].filter(p=>p.name&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)).sort((a,b)=>rank(b)-rank(a)).flatMap(p=>{
 const key=p.latitude.toFixed(3)+','+p.longitude.toFixed(3);if(seen.has(key))return [];seen.add(key);
 return [{name:[...new Set([p.name,p.admin1,p.admin2,p.country].filter(Boolean))].join(' · '),latitude:p.latitude,longitude:p.longitude,timezone:p.timezone||'auto'}];
 });
}
const cityAliases:Record<string,string>={南京:'Nanjing',北京:'Beijing',上海:'Shanghai',广州:'Guangzhou',深圳:'Shenzhen',杭州:'Hangzhou',苏州:'Suzhou',成都:'Chengdu',重庆:'Chongqing',武汉:'Wuhan',西安:"Xi'an",天津:'Tianjin'};
export async function searchCities(query:string,signal:AbortSignal,language:string='zh',api:WeatherEndpoints=OPEN_METEO,fetcher:typeof fetch=fetch) {
 const names=[query,...(cityAliases[query]?[cityAliases[query]]:[])];
 const raw=await Promise.allSettled(names.map(name=>requestJson(endpoint(api.geocoding,new URLSearchParams({name,count:'20',language:language==='en'?'en':'zh',format:'json'}),api.key),signal,fetcher)));
 if(raw.every(r=>r.status==='rejected'))throw new Error('城市搜索暂不可用');
 return normalizeCities(raw.flatMap(r=>r.status==='fulfilled'?r.value.results??[]:[]),query).slice(0,10);
}
const adviceEn:Readonly<Record<string,string>>={
  "预报有雨，请准备相机防水罩，提前确认室内备选场地，照顾客户与同行人员的安全。": "Rain is forecast. Pack a camera rain cover, confirm an indoor alternative and consider everyone’s safety.",
  "雷雨或冰雹天气请避免空旷处及高处拍摄，必要时调整档期。": "Avoid exposed or elevated locations during thunderstorms or hail. Reschedule if necessary.",
  "风速较大，灯架与三脚架请带好配重，避免使用无法固定的大型柔光附件。": "Strong wind is forecast. Secure light stands and tripods with weights, and avoid unsecured large modifiers.",
  "天气较热，尽量避开正午，准备饮用水与休息时间，并留意模特的身体状态。": "Hot weather is forecast. Avoid midday, bring drinking water, allow breaks and check on the model’s wellbeing.",
  "气温偏低，请准备保暖衣物与备用电池，缩短户外连续拍摄时间。": "Cold weather is forecast. Bring warm clothing and spare batteries, and keep outdoor sessions short.",
  "能见度偏低，请避开道路与临水危险位置，并预留交通时间。": "Visibility is low. Avoid hazardous roadside or waterside locations and allow extra travel time.",
  "PM2.5 预报偏高，建议减少长时间户外拍摄，考虑室内方案。": "Elevated PM2.5 is forecast. Limit extended outdoor sessions and consider an indoor alternative.",
  "紫外线较强，请准备遮阳与防晒用品，优先选择阴影或较柔和的早晚光线。": "UV levels are high. Bring shade and sun protection; favor shaded locations or softer morning and evening light.",
  "天气条件较平稳，出发前再核对短临预报、器材与客户到场安排。": "Conditions appear settled. Recheck the near-term forecast, equipment and client arrival arrangements before departure."
};
export function shootingAdvice(day:WeatherDay,language:string='zh'):string[] {
 const tips:string[]=[];
 if(['rain','storm'].includes(weatherKind(day.code))||(day.rain??0)>=50)tips.push('预报有雨，请准备相机防水罩，提前确认室内备选场地，照顾客户与同行人员的安全。');
 if(weatherKind(day.code)==='storm')tips.push('雷雨或冰雹天气请避免空旷处及高处拍摄，必要时调整档期。');
 if((day.wind??0)>=8||(day.gust??0)>=12)tips.push('风速较大，灯架与三脚架请带好配重，避免使用无法固定的大型柔光附件。');
 if(day.max>=30)tips.push('天气较热，尽量避开正午，准备饮用水与休息时间，并留意模特的身体状态。');
 if(day.min<=0)tips.push('气温偏低，请准备保暖衣物与备用电池，缩短户外连续拍摄时间。');
 if(weatherKind(day.code)==='fog'||(day.visibility!=null&&day.visibility<1000))tips.push('能见度偏低，请避开道路与临水危险位置，并预留交通时间。');
 if((day.pm25??0)>=75)tips.push('PM2.5 预报偏高，建议减少长时间户外拍摄，考虑室内方案。');
 if((day.uv??0)>=6)tips.push('紫外线较强，请准备遮阳与防晒用品，优先选择阴影或较柔和的早晚光线。');
 if(!tips.length)tips.push('天气条件较平稳，出发前再核对短临预报、器材与客户到场安排。');
 return language==='en'?tips.map(t=>adviceEn[t]??t):tips;
}
