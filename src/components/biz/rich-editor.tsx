// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceNotice} from '@/lib/interface-text';
import {useEffect,useRef,useState} from 'react';
import {PRINT_FONTS,sanitizeRichHtml} from '@/lib/print-document';
export function RichEditor({html,onChange,label}:{html:string;onChange:(html:string)=>void;label:string}){
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

 const ref=useRef<HTMLDivElement>(null),range=useRef<Range|null>(null);
 const [rows,setRows]=useState(3),[cols,setCols]=useState(3),[message,setMessage]=useState('');
 useEffect(()=>{if(ref.current&&sanitizeRichHtml(ref.current.innerHTML)!==html)ref.current.innerHTML=sanitizeRichHtml(html);},[html]);
 const remember=()=>{const s=window.getSelection();if(s?.rangeCount&&ref.current?.contains(s.anchorNode))range.current=s.getRangeAt(0).cloneRange();};
 const restore=()=>{ref.current?.focus();const s=window.getSelection();if(range.current&&ref.current?.contains(range.current.commonAncestorContainer)){s?.removeAllRanges();s?.addRange(range.current);}};
 const emit=()=>{if(ref.current)onChange(sanitizeRichHtml(ref.current.innerHTML));remember();};
 const command=(name:string,value?:string)=>{restore();document.execCommand(name,false,value);emit();};
 const tableAction=(action:string)=>{
  restore();const node=window.getSelection()?.anchorNode,el=node?.nodeType===1?node as Element:node?.parentElement;
  const cell=el?.closest('td,th') as HTMLTableCellElement|null,table=cell?.closest('table');
  if(!table||!cell){setMessage('先点击表格中的单元格，再进行行列操作。');return;}
  const row=cell.parentElement as HTMLTableRowElement;
  if(action==='remove')table.remove();
  if(action==='row'){const tr=document.createElement('tr');for(let i=0;i<row.cells.length;i++)tr.appendChild(document.createElement('td')).textContent=uiText("内容","Content");row.after(tr);}
  if(action==='column')for(const r of Array.from(table.rows)){const td=document.createElement(r.parentElement?.tagName==='THEAD'?'th':'td');td.textContent=uiText("内容","Content");r.insertBefore(td,r.cells[cell.cellIndex+1]??null);}
  if(action==='delete-row'){row.remove();if(!table.rows.length)table.remove();}
  if(action==='delete-column'){const index=cell.cellIndex;for(const r of Array.from(table.rows))r.cells[index]?.remove();if(!table.rows[0]?.cells.length)table.remove();}
  setMessage('');emit();
 };
 const buttons=[[uiText("加粗","Bold"),'bold'],[uiText("斜体","Italic"),'italic'],[uiText("下划线","Underline"),'underline'],[uiText("左对齐","Align left"),'justifyLeft'],[uiText("居中","Align centre"),'justifyCenter'],[uiText("右对齐","Align right"),'justifyRight'],[uiText("项目符号","Bullets"),'insertUnorderedList'],[uiText("编号","Numbering"),'insertOrderedList'],[uiText("撤销","Revoke"),'undo'],[uiText("重做","Redo"),'redo'],[uiText("清除格式","Clear formatting"),'removeFormat']];
 return <div className="rich-editor"><div className="rich-toolbar" role="toolbar" aria-label={label+uiText("格式工具"," formatting tools")}>{buttons.map(([name,cmd])=><button type="button" key={cmd} onMouseDown={e=>e.preventDefault()} onClick={()=>command(cmd)}>{name}</button>)}<select aria-label={uiText("段落格式","Paragraph style")} defaultValue="p" onChange={e=>command('formatBlock',e.target.value)}><option value="p">{uiText("正文","Body")}</option><option value="h2">{uiText("标题","Heading")}</option><option value="h3">{uiText("小标题","Subheading")}</option><option value="blockquote">{uiText("引用","Quote")}</option></select><select aria-label={uiText("选中文字字体","Selected text font")} onChange={e=>command('fontName',e.target.value)}>{PRINT_FONTS.map(f=><option key={f} value={f.split(',')[0].replaceAll('"','')}>{f.split(',')[0].replaceAll('"','')}</option>)}</select><select aria-label={uiText("选中文字字号","Selected text size")} defaultValue="3" onChange={e=>command('fontSize',e.target.value)}>{[1,2,3,4,5,6,7].map((v,i)=><option key={v} value={v}>{[10,13,16,18,24,32,48][i]} px</option>)}</select><label>{uiText("字色","Text colour")}<input type="color" aria-label={uiText("选中文字颜色","Selected text colour")} onChange={e=>command('foreColor',e.target.value)}/></label><label>{uiText("底色","Background")}<input type="color" aria-label={uiText("选中文字背景色","Selected text background")} defaultValue="#ffffcc" onChange={e=>command('hiliteColor',e.target.value)}/></label></div>
 <div className="rich-table-tools"><label>{uiText("行","Rows")}<input type="number" min={1} max={30} value={rows} onChange={e=>setRows(Math.max(1,Math.min(30,Number(e.target.value)||1)))}/></label><label>{uiText("列","Columns")}<input type="number" min={1} max={12} value={cols} onChange={e=>setCols(Math.max(1,Math.min(12,Number(e.target.value)||1)))}/></label><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertHTML','<table><tbody>'+Array.from({length:rows},()=>'<tr>'+Array.from({length:cols},()=>uiText("<td>内容</td>","<td>Content</td>")).join('')+'</tr>').join('')+'</tbody></table><p><br></p>')}>{uiText("插入表格","Insert table")}</button>{[[uiText("增行","Add row"),'row'],[uiText("增列","Add column"),'column'],[uiText("删行","Delete row"),'delete-row'],[uiText("删列","Delete column"),'delete-column'],[uiText("删除表格","Delete table"),'remove']].map(([name,action])=><button key={action} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>tableAction(action)}>{name}</button>)}</div>
 <div ref={ref} contentEditable suppressContentEditableWarning className="rich-content" role="textbox" aria-multiline="true" aria-label={label} onMouseUp={remember} onKeyUp={remember} onBlur={remember} onInput={emit} onDrop={e=>e.preventDefault()} onPaste={e=>{e.preventDefault();command('insertHTML',sanitizeRichHtml(e.clipboardData.getData('text/html')||e.clipboardData.getData('text/plain').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\n','<br>')));}}/><small role="status">{interfaceNotice(message,uiLanguage)}</small></div>;
}
