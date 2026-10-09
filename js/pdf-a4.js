/** Génération locale PDF A4, énoncé et corrigé, sans serveur. */
import {binaryOctets, numberToIPv4, ipv4ToNumber} from './ipv4.js';
const PW=595.28,PH=841.89;
const cp=s=>[...String(s)].map(c=>{const n=c.charCodeAt(0);return n===0x2019?146:n===0x2013?150:n===0x2026?133:n<256?n:63}).map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
const nb=n=>Number(n.toFixed(2));
function build(base,corrected){
 let c=[],font=(s,x,y,z=10,b=false)=>c.push(`BT /${b?'B':'R'} ${z} Tf 0.12 0.18 0.27 rg 1 0 0 1 ${nb(x)} ${nb(PH-y)} Tm <${cp(s)}> Tj ET`);
 const line=(x,y,X,Y,w=.5)=>c.push(`0.70 0.75 0.80 RG ${w} w ${nb(x)} ${nb(PH-y)} m ${nb(X)} ${nb(PH-Y)} l S`);
 const rect=(x,y,w,h)=>c.push(`0.70 0.75 0.80 RG .6 w ${nb(x)} ${nb(PH-y-h)} ${nb(w)} ${nb(h)} re S`);
 const left=27,right=568,width=right-left,lab=130,bx=left+lab,bw=(width-lab)/32;
 rect(17,17,561,807);font("Fiche d'adressage IPv4",28,44,17,true);font('Note : ........ /10',471,44,10,true);
 font('Nom :',28,88,10,true);line(77,92,270,92);font('Prénom :',292,88,10,true);line(355,92,564,92);
 font('Classe :',28,120,10,true);line(89,124,225,124);font('Date :',292,120,10,true);line(341,124,433,124);
 font('Adresse IPv4 :',28,161,11,true);font(`${base.inputAddress}/${base.prefix}`,156,161,18,true);
 font('Compléter le tableau en binaire ci-dessous',30,197,10,true);font('/5',551,197,10,true);
 const ys=[212,234,256,278,308,338,368,398,428,458];rect(left,ys[0],width,ys.at(-1)-ys[0]);line(bx,ys[0],bx,ys.at(-1),1);
 for(let k=1;k<ys.length-1;k++)line(left,ys[k],right,ys[k]);
 for(let k=1;k<32;k++)line(bx+k*bw,ys[1],bx+k*bw,ys.at(-1),k%8===0?1.2:.3);
 for(let k=1;k<4;k++)line(bx+k*8*bw,ys[0],bx+k*8*bw,ys[1],1.2);
 font('OCTETS',34,227,8,true);
 for(let k=0;k<4;k++)font(`Octet ${k+1}`,bx+(k*8+2)*bw,227,7,true);
 font('Puissances de 2',34,250,8,true);font('Poids décimaux',34,271,8,true);
 for(let k=0;k<32;k++){let x=bx+(k+.5)*bw;let pow=7-k%8;let wt=String(2**pow);font(String(pow),x-2,250,6);font(wt,x-wt.length*1.8,271,6,true)}
 const network=base.address,bcast=base.broadcast||base.address,first=numberToIPv4(base.network+(base.prefix===31?0:1)),last=numberToIPv4(base.network+(base.prefix===31?1:base.blockSize-2));
 const vals=[base.inputAddress,base.mask,network,first,last,bcast];
 const labels=["Adresse de l'hôte","Masque en binaire","Adresse réseau","Première adresse","Dernière adresse","Broadcast"];
 for(let row=0;row<6;row++){font(labels[row],34,298+30*row,8);
 if(corrected){let bits=binaryOctets(vals[row]).join('');for(let j=0;j<32;j++)if(bits[j]==='1'||(row>=2&&j>=30))font(bits[j],bx+(j+.5)*bw-2.6,298+30*row,8,true)}
 }
 if(corrected)line(bx+base.prefix*bw,ys[3],bx+base.prefix*bw,ys.at(-1),1.4);
 font('Compléter le tableau en décimal ci-dessous',30,483,10,true);font('/5',551,483,10,true);
 const dy=497,dh=51;rect(left,dy,width,5*dh);line(bx,dy,bx,dy+dh*5,1);
 const names=['Masque de sous-réseau','Adresse réseau','Première adresse','Dernière adresse','Broadcast'];
 const answers=[base.mask,network,first,last,bcast];
 for(let k=0;k<5;k++){if(k)line(left,dy+k*dh,right,dy+k*dh);font(names[k],35,dy+31+k*dh,9);if(corrected)font(answers[k],bx+15,dy+32+k*dh,12,true)}
 rect(left,772,width,48);font("Nombre d'hôtes utilisables pour le réseau initial",37,788,10,true);
 font('2',43,809,12,true);font('(32 - CIDR)',52,800,6,true);font('- 2 =',112,809,12,true);
 if(corrected)font(`${base.usableHosts.toLocaleString('fr-FR')} hôtes utilisables`,177,809,11,true);
 const content=c.join('\n')+'\n';
 const objects=[];const add=s=>(objects.push(s),objects.length);
 const r=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const b=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const enc=new TextEncoder();const stream=enc.encode(content);
 const streamObj=add(`<< /Length ${stream.length} >>\nstream\n${content}endstream`);
 const pages=add('');const page=add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /R ${r} 0 R /B ${b} 0 R >> >> /Contents ${streamObj} 0 R >>`);
 objects[pages-1]=`<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`;
 const root=add(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
 let parts=['%PDF-1.4\n'], offsets=[0],bytes=enc.encode(parts[0]).length;
 for(let i=0;i<objects.length;i++){offsets.push(bytes);let s=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;parts.push(s);bytes+=enc.encode(s).length}
 let xref=bytes;parts.push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${offsets.length} /Root ${root} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
 return new Blob(parts,{type:'application/pdf'});
}
export function downloadAddressingA4(base,corrected=false){
 const file=build(base,corrected);const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=`IPcalc_IPv4_${base.inputAddress.replaceAll('.','-')}_${base.prefix}_${corrected?'corrige':'enonce'}.pdf`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
