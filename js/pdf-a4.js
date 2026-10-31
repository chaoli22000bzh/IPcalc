/** Génération locale PDF A4, énoncé et corrigé, sans serveur. */
import {binaryOctets, numberToIPv4} from './ipv4.js';
const PW=595.28,PH=841.89;
const cp=s=>[...String(s)].map(c=>{const n=c.charCodeAt(0);return n===0x2019?146:n===0x2013?150:n===0x2026?133:n<256?n:63}).map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
const nb=n=>Number(n.toFixed(2));
function build(base,corrected,fillable=false){
 let c=[],font=(s,x,y,z=10,b=false,white=false)=>c.push(`BT /${b?'B':'R'} ${z} Tf ${white?'1 1 1':'0.08 0.19 0.31'} rg 1 0 0 1 ${nb(x)} ${nb(PH-y)} Tm <${cp(s)}> Tj ET`);
 const line=(x,y,X,Y,w=.5,strong=false)=>c.push(`${strong?'0.12 0.29 0.44':'0.66 0.74 0.82'} RG ${w} w ${nb(x)} ${nb(PH-y)} m ${nb(X)} ${nb(PH-Y)} l S`);
 const fill=(x,y,w,h,gray=.975)=>c.push(`${gray} g ${nb(x)} ${nb(PH-y-h)} ${nb(w)} ${nb(h)} re f`);
 const tint=(x,y,w,h,t='0.965 0.977 0.986')=>c.push(`${t} rg ${nb(x)} ${nb(PH-y-h)} ${nb(w)} ${nb(h)} re f`);
 const circle=(x,y,r)=>{const k=r*.55228475,Y=PH-y;c.push(`0.13 0.32 0.49 rg ${nb(x+r)} ${nb(Y)} m ${nb(x+r)} ${nb(Y+k)} ${nb(x+k)} ${nb(Y+r)} ${nb(x)} ${nb(Y+r)} c ${nb(x-k)} ${nb(Y+r)} ${nb(x-r)} ${nb(Y+k)} ${nb(x-r)} ${nb(Y)} c ${nb(x-r)} ${nb(Y-k)} ${nb(x-k)} ${nb(Y-r)} ${nb(x)} ${nb(Y-r)} c ${nb(x+k)} ${nb(Y-r)} ${nb(x+r)} ${nb(Y-k)} ${nb(x+r)} ${nb(Y)} c f`);};
 const roundRect=(x,y,w,h,r=6)=>{const X=nb(x),Y=nb(PH-y-h),W=nb(w),H=nb(h),R=nb(r),K=nb(r*.55228475);
   c.push(`0.70 0.75 0.80 RG .65 w ${X+R} ${Y} m ${X+W-R} ${Y} l ${X+W-R+K} ${Y} ${X+W} ${Y+R-K} ${X+W} ${Y+R} c ${X+W} ${Y+H-R} l ${X+W} ${Y+H-R+K} ${X+W-R+K} ${Y+H} ${X+W-R} ${Y+H} c ${X+R} ${Y+H} l ${X+R-K} ${Y+H} ${X} ${Y+H-R+K} ${X} ${Y+H-R} c ${X} ${Y+R} l ${X} ${Y+R-K} ${X+R-K} ${Y} ${X+R} ${Y} c S`);
 };
 const rect=(x,y,w,h)=>roundRect(x,y,w,h,6);
 const section=(number,y,title)=>{tint(67,y-17,432,29);circle(43,y-2,16);font(String(number),38,y+4,18,true,true);font(title,75,y+4,10.2,true);roundRect(506,y-16,60,29,5);font('____ / 5',513,y+3,10,true);};
 const left=27,right=568,width=right-left,lab=130,bx=left+lab,bw=(width-lab)/32;
 // En-tête et fiche d'identité inspirés du tableau pédagogique d'origine.
 tint(27,26,541,37);roundRect(27,26,541,37,8);
 font("Fiche d'adressage IPv4",37,51,18,true);font('Note : ........ /10',466,50,9.4,true);
 roundRect(27,72,541,61,8);
 font('Nom :',37,93,9.5,true);line(77,97,280,97);
 font('Prénom :',304,93,9.5,true);line(358,97,557,97);
 font('Classe :',37,120,9.5,true);line(89,124,280,124);
 font('Date :',304,120,9.5,true);line(343,124,430,124);if(fillable){font('/',363,120,11,true);font('/',393,120,11,true);font('20',401,120,10,true);}
 tint(27,145,541,41);roundRect(27,145,541,41,8);
 font('Adresse IPv4 :',123,171,11,true);if(!fillable)font(`${base.inputAddress}/${base.prefix}`,227,171,17,true);else font('/',413,171,17,true);
 section(1,217,'Compléter le tableau en binaire ci-dessous');
 const ys=[245,264,283,302,325,348,371,394,417,440];
 tint(left,ys[0],width,ys[3]-ys[0]);
 tint(left,ys[3],lab,ys.at(-1)-ys[3], '0.977 0.983 0.990');
 // Zone de Pépette : seulement les deux derniers bits des quatre dernières lignes.
 for(let row=2;row<6;row++)fill(bx+30*bw,ys[3+row],2*bw,ys[4+row]-ys[3+row],.967);
 rect(left,ys[0],width,ys.at(-1)-ys[0]);line(bx,ys[0],bx,ys.at(-1),.85);
 for(let k=1;k<ys.length-1;k++)line(left,ys[k],right,ys[k],.45);
 for(let k=1;k<32;k++)line(bx+k*bw,ys[1],bx+k*bw,ys.at(-1),.32);
 // Bordures d'octets appuyées uniquement dans les trois premières lignes.
 for(let k=1;k<4;k++)line(bx+k*8*bw,ys[0],bx+k*8*bw,ys[3],1.4,true);
 font('OCTETS',34,259,8,true);
 for(let k=0;k<4;k++)font(`${k+1}${k===0?'er':'e'} octet`,bx+(k*8+2)*bw,259,7,true);
 font('Puissances de 2',34,278,7.6,true);font('Poids décimaux',34,296,7.6,true);
 for(let k=0;k<32;k++){const x=bx+(k+.5)*bw,pow=7-k%8,wt=String(2**pow);font(String(pow),x-2,278,6);font(wt,x-wt.length*1.8,296,6,true)}
 const network=base.address,bcast=base.broadcast||base.address,first=numberToIPv4(base.network+(base.prefix===31?0:1)),last=numberToIPv4(base.network+(base.prefix===31?1:base.blockSize-2));
 const vals=[base.inputAddress,base.mask,network,first,last,bcast];
 const labels=["Adresse de l'hôte","CIDR","Adresse réseau","Première adresse","Dernière adresse","Broadcast"];
 for(let row=0;row<6;row++){font(labels[row],34,318+23*row,8);
 if(corrected){let bits=binaryOctets(vals[row]).join('');for(let j=0;j<32;j++)if(bits[j]==='1'||(row>=2&&j>=30))font(bits[j],bx+(j+.5)*bw-2.6,318+23*row,8,true)}
 }
 if(corrected)line(bx+base.prefix*bw,ys[4],bx+base.prefix*bw,ys.at(-1),1.6,true);
 section(2,473,'Compléter le tableau en décimal ci-dessous');
 const dy=497,dh=49;tint(left,dy,lab,5*dh,'0.977 0.983 0.990');rect(left,dy,width,5*dh);line(bx,dy,bx,dy+dh*5,.85);
 const names=['Masque de sous-réseau','Adresse réseau','Première adresse','Dernière adresse','Broadcast'];
 const answers=[base.mask,network,first,last,bcast];
 for(let k=0;k<5;k++){if(k)line(left,dy+k*dh,right,dy+k*dh);font(names[k],35,dy+31+k*dh,9);if(corrected)font(answers[k],bx+15,dy+32+k*dh,12,true)}
 tint(left,757,width,49);roundRect(left,757,width,49,8);
 font("Nombre d'hôtes utilisables pour le réseau initial",37,776,10,true);
 font('2',42,798,15,true);font('(32 - CIDR)',53,787,6.5,true);font('- 2 =',91,798,12,true);
 if(corrected)font(`${base.usableHosts.toLocaleString('fr-FR')} hôtes utilisables`,147,798,11,true);
 const content=c.join('\n')+'\n';
 const objects=[];const add=s=>(objects.push(s),objects.length);
 const r=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const b=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const enc=new TextEncoder();const stream=enc.encode(content);
 const streamObj=add(`<< /Length ${stream.length} >>\nstream\n${content}endstream`);
 const pages=add('');
 const fields=[];
 if(fillable&&!corrected){
   // PDF AcroForm standard : champs sans script, independants de toute connexion.
   for(const [name,x,y,w,h] of [
     ['Nom',78,79,201,21],['Prenom',359,79,197,21],
     ['Classe',90,106,189,21],['Jour',344,106,17,21],['Mois',374,106,17,21],['AnneeDeuxChiffres',419,106,17,21],
     ['AdresseIPv4',226,151,180,29],['CIDR',429,151,62,29],
     ...Array.from({length:6},(_,row)=>Array.from({length:32},(_,i)=>[`Bit${row+1}_${String(i+1).padStart(2,'0')}`,bx+i*bw+0.3,303+row*23,bw-0.6,21])).flat(),
     ...Array.from({length:5},(_,i)=>[`Decimal${i+1}`,bx+8,499+i*49,width-lab-16,45]),
     ['HotesUtilisables',147,782,275,22]
   ]){
     const rect=[nb(x),nb(PH-y-h),nb(x+w),nb(PH-y)].join(' ');
     const value=name==='AdresseIPv4'?base.inputAddress:name==='CIDR'?String(base.prefix):'';
     const size=name.startsWith('Bit')?8:name==='AdresseIPv4'||name==='CIDR'?14:10;
     const field=add(`<< /Type /Annot /Subtype /Widget /FT /Tx /T (${name}) /V (${value}) /Rect [${rect}] /F 4 /Ff 0${name.startsWith('Bit')?' /MaxLen 1':(['Jour','Mois','AnneeDeuxChiffres'].includes(name)?' /MaxLen 2':'')} /Q ${name.startsWith('Bit')||['Jour','Mois','AnneeDeuxChiffres'].includes(name)?1:0} /DA (/Helv ${size} Tf 0 g) /MK << /BC [0.45 0.56 0.65] /BG [1 1 1] >> /BS << /W 0.5 /S /S >> /P PAGE_REF >>`);
     fields.push(field);
   }
 }
 const page=add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /R ${r} 0 R /B ${b} 0 R >> >> /Contents ${streamObj} 0 R${fields.length?' /Annots ['+fields.map(id=>id+' 0 R').join(' ')+']':''} >>`);
 for(const id of fields)objects[id-1]=objects[id-1].replace('PAGE_REF',page+' 0 R');
 objects[pages-1]=`<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`;
 const acro=fields.length?add(`<< /Fields [${fields.map(id=>id+' 0 R').join(' ')}] /DR << /Font << /Helv ${r} 0 R >> >> /DA (/Helv 10 Tf 0 g) /NeedAppearances true >>`):null;
 const root=add(`<< /Type /Catalog /Pages ${pages} 0 R${acro?' /AcroForm '+acro+' 0 R':''} >>`);
 let parts=['%PDF-1.4\n'], offsets=[0],bytes=enc.encode(parts[0]).length;
 for(let i=0;i<objects.length;i++){offsets.push(bytes);let s=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;parts.push(s);bytes+=enc.encode(s).length}
 let xref=bytes;parts.push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${offsets.length} /Root ${root} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
 return new Blob(parts,{type:'application/pdf'});
}
export function downloadAddressingA4(base,corrected=false){
 const file=build(base,corrected);const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=`IPcalc_IPv4_${base.inputAddress.replaceAll('.','-')}_${base.prefix}_${corrected?'corrige':'enonce'}.pdf`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

/** Sujet interactif : identite, adresse IPv4 et CIDR. */
export function downloadAddressingA4FillableIdentity(base){
 const file=build(base,false,true);
 const url=URL.createObjectURL(file),a=document.createElement('a');
 a.href=url;
 a.download=`IPcalc_IPv4_${base.inputAddress.replaceAll('.','-')}_${base.prefix}_sujet-remplissable.pdf`;
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
