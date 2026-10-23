// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
/** Photometric values of a light in the equipment register, optionally filled from the built-in library. */
import {useStudioText} from '@/lib/i18n';
import {HEAD_KINDS,LIGHT_LIBRARY,estimateGN,headKindOf,presetById,type LightSpec} from '@/lib/lighting';
import {Field,TextInput} from './ui';
import {StudioSelect} from './select';

const num=(v:string)=>{const n=Number(v);return v.trim()===''||!Number.isFinite(n)?undefined:n;};

export function LightFields({value,onChange}:{value?:LightSpec;onChange:(v:LightSpec)=>void}){
 const t=useStudioText();const s:LightSpec=value??{kind:'strobe'};const preset=presetById(s.preset);
 const set=(patch:Partial<LightSpec>)=>onChange({...s,...patch,preset:'preset' in patch?patch.preset:undefined});
 const input=(key:keyof LightSpec,label:string,unit:string,hint?:string)=><Field label={label} hint={hint}><div className="unit-input"><TextInput inputMode="decimal" value={s[key]===undefined?'':String(s[key])} onChange={e=>set({[key]:num(e.target.value)} as Partial<LightSpec>)}/><span>{unit}</span></div></Field>;
 return <div className="light-fields sm:col-span-2 lg:col-span-3">
  <div className="light-fields-head">
   <Field label={t('从灯库带入','Fill from the library')}><StudioSelect value={s.preset??''} onChange={e=>{const p=presetById(e.target.value);if(!p)return set({preset:undefined});const {id,brand:_b,model:_m,source:_s,verified:_v,note:_n,...spec}=p;onChange({...spec,preset:id});}}>
    <option value="">{t('手动填写','Enter by hand')}</option>{LIGHT_LIBRARY.map(p=><option key={p.id} value={p.id}>{p.brand} {p.model}{p.verified?'':t('（待核对）',' (to verify)')}</option>)}</StudioSelect></Field>
   <div className="segmented" role="tablist" aria-label={t('灯光类型','Light type')}>{(['strobe','led'] as const).map(k=><button key={k} type="button" role="tab" aria-selected={s.kind===k} className={s.kind===k?'on':''} onClick={()=>set({kind:k})}>{k==='strobe'?t('闪光灯','Flash'):t('常亮灯','Continuous')}</button>)}</div>
  </div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label={t('灯具外形','Body style')} hint={t('灯光测试按此绘制灯头','The lighting lab draws this body')}><StudioSelect value={headKindOf(s)} onChange={e=>{const h=HEAD_KINDS.find(x=>x.id===e.target.value);if(h)set({head:h.id,kind:h.led?'led':'strobe'});}}>{HEAD_KINDS.map(h=><option key={h.id} value={h.id}>{t(h.zh,h.en)}</option>)}</StudioSelect></Field></div>
  {preset&&<p className="light-source">{t('数据来源：','Source: ')}{preset.source}{preset.note?' · '+preset.note:''}</p>}
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   {s.kind==='strobe'?<>
    {input('ws',t('能量','Energy'),'Ws')}
    {input('gn',t('闪光指数 GN','Guide number'),'m',s.gn===undefined&&s.ws?t(`未填时按 ${estimateGN(s.ws)} 估算（ISO 100，标准罩）`,`Estimated as ${estimateGN(s.ws)} when blank (ISO 100, standard reflector)`):t('ISO 100、米、标准罩','ISO 100, metres, standard reflector'))}
   </>:<>
    {input('watts',t('功率','Power'),'W')}
    {input('lux1m',t('1 米照度','Illuminance at 1 m'),'lux',t('配标准罩','With the standard reflector'))}
   </>}
   {input('cct',t('色温','Colour temperature'),'K')}
   {input('beam',t('光束角','Beam angle'),'°')}
   {input('cri',t('显色指数 CRI','CRI'),'')}
   {input('tlci',t('TLCI','TLCI'),'')}
   {s.kind==='led'&&<>{input('cctMin',t('最低色温（双色温）','Lowest CCT (bi-colour)'),'K')}{input('cctMax',t('最高色温（双色温）','Highest CCT (bi-colour)'),'K')}</>}
  </div>
 </div>;
}
