/** Fiche pédagogique FLSM A3 paysage : aucun accès réseau ni dépendance externe. */
import { binaryOctets, numberToIPv4, subnetAt, summaryIndices } from './ipv4.js';

const W=1190.55,H=841.89,round=n=>Number(n.toFixed(2));
const hex=s=>[...String(s)].map(ch=>{
  const n=ch.charCodeAt(0);
  return (n===8217?146:n===8211?150:n===8230?133:n<=255?n:63).toString(16).padStart(2,'0');
}).join('').toUpperCase();

function pdfDocument(commands) {
  const enc=new TextEncoder(),content=commands.join('\n')+'\n';
  const stream=enc.encode(content),objects=[];
  const add=x=>(objects.push(x),objects.length);
  const regular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const streamId=add('<< /Length '+stream.length+' >>\nstream\n'+content+'endstream');
  const pages=add('');
  const page=add('<< /Type /Page /Parent '+pages+' 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /R '+regular+' 0 R /B '+bold+' 0 R >> >> /Contents '+streamId+' 0 R >>');
  objects[pages-1]='<< /Type /Pages /Kids ['+page+' 0 R] /Count 1 >>';
  const root=add('<< /Type /Catalog /Pages '+pages+' 0 R >>');
  const parts=['%PDF-1.4\n'],offsets=[0];let size=enc.encode(parts[0]).length;
  for(let i=0;i<objects.length;i++){offsets.push(size);const chunk=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';parts.push(chunk);size+=enc.encode(chunk).length}
  parts.push('xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root '+root+' 0 R >>\nstartxref\n'+size+'\n%%EOF\n');
  return new Blob(parts,{type:'application/pdf'});
}
function draw() {
  const c=[];
  const text=(value,x,y,size=10,bold=false,white=false)=>{
    c.push('BT /'+(bold?'B':'R')+' '+size+' Tf '+(white?'1 1 1':'0.08 0.19 0.31')+' rg 1 0 0 1 '+round(x)+' '+round(H-y)+' Tm <'+hex(value)+'> Tj ET');
  };
  const line=(x,y,X,Y,weight=.45,strong=false)=>c.push((strong?'0.11 0.29 0.45':'0.67 0.74 0.81')+' RG '+weight+' w '+round(x)+' '+round(H-y)+' m '+round(X)+' '+round(H-Y)+' l S');
  const fill=(x,y,w,h,shade='0.971 0.980 0.990')=>c.push(shade+' rg '+round(x)+' '+round(H-y-h)+' '+round(w)+' '+round(h)+' re f');
  const box=(x,y,w,h,r=7)=>{
    const k=.55228475*r,yy=H-y-h;
    c.push('0.60 0.70 0.79 RG .75 w '+round(x+r)+' '+round(yy)+' m '+round(x+w-r)+' '+round(yy)+' l '+round(x+w-r+k)+' '+round(yy)+' '+round(x+w)+' '+round(yy+r-k)+' '+round(x+w)+' '+round(yy+r)+' c '+round(x+w)+' '+round(yy+h-r)+' l '+round(x+w)+' '+round(yy+h-r+k)+' '+round(x+w-r+k)+' '+round(yy+h)+' '+round(x+w-r)+' '+round(yy+h)+' c '+round(x+r)+' '+round(yy+h)+' l '+round(x+r-k)+' '+round(yy+h)+' '+round(x)+' '+round(yy+h-r+k)+' '+round(x)+' '+round(yy+h-r)+' c '+round(x)+' '+round(yy+r)+' l '+round(x)+' '+round(yy+r-k)+' '+round(x+r-k)+' '+round(yy)+' '+round(x+r)+' '+round(yy)+' c S');
  };
  const circle=(x,y,r)=>{
    const k=.55228475*r,cy=H-y;c.push('0.12 0.32 0.49 rg '+round(x+r)+' '+round(cy)+' m '+round(x+r)+' '+round(cy+k)+' '+round(x+k)+' '+round(cy+r)+' '+round(x)+' '+round(cy+r)+' c '+round(x-k)+' '+round(cy+r)+' '+round(x-r)+' '+round(cy+k)+' '+round(x-r)+' '+round(cy)+' c '+round(x-r)+' '+round(cy-k)+' '+round(x-k)+' '+round(cy-r)+' '+round(x)+' '+round(cy-r)+' c '+round(x+k)+' '+round(cy-r)+' '+round(x+r)+' '+round(cy-k)+' '+round(x+r)+' '+round(cy)+' c f');
  };
  const section=(x,y,width,n,title,score)=>{
    fill(x+40,y-19,width-114,29);
    circle(x+17,y-5,16);text(n,x+12,y+1,17,true,true);
    text(title,x+47,y+1,11,true);
    box(x+width-67,y-19,65,29,5);text(score,x+width-61,y,10,true);
  };
  function digitsGrid(x,y,labelWidth,width,labels,addresses,prefix,corrected,opts={}) {
    const xbit=x+labelWidth,bitW=(width-labelWidth)/32,header=19,rowH=opts.rowH??20;
    fill(x,y,width,header*3);
    fill(x,y+header*3,labelWidth,rowH*labels.length,'0.980 0.986 0.993');
    if(opts.pepette)for(let row=2;row<labels.length;row++)fill(xbit+30*bitW,y+3*header+row*rowH,2*bitW,rowH,'0.975 0.975 0.975');
    box(x,y,width,header*3+labels.length*rowH,4);
    line(xbit,y,xbit,y+header*3+labels.length*rowH,.9);
    for(let i=1;i<3;i++)line(x,y+i*header,x+width,y+i*header);
    for(let r=1;r<labels.length;r++)line(x,y+3*header+r*rowH,x+width,y+3*header+r*rowH);
    line(x,y+3*header,x+width,y+3*header);
    for(let j=1;j<32;j++)line(xbit+j*bitW,y+header,xbit+j*bitW,y+header*3+labels.length*rowH,.27);
    for(let j=1;j<4;j++)line(xbit+j*8*bitW,y,xbit+j*8*bitW,y+3*header,1.4,true);
    text('Octets',x+7,y+13,7.5,true);
    text('Puissances de 2',x+7,y+header+13,7.3,true);
    text('Poids décimaux',x+7,y+2*header+13,7.3,true);
    for(let oct=0;oct<4;oct++)text('Octet '+(oct+1),xbit+(oct*8+2)*bitW,y+13,7,true);
    for(let j=0;j<32;j++){
      const cx=xbit+j*bitW+bitW/2,pow=7-j%8,wt=String(2**pow);
      text(String(pow),cx-2,y+header+13,6.2);
      text(wt,cx-wt.length*1.8,y+2*header+13,6.0,true);
    }
    labels.forEach((label,i)=>{
      const baseline=y+3*header+i*rowH+rowH/2+3;
      text(label,x+7,baseline,opts.font??8);
      if(corrected&&addresses[i]){
        const bits=binaryOctets(addresses[i]).join('');
        for(let j=0;j<32;j++)if(bits[j]==='1'||(opts.pepette&&i>=2&&j>=30))text(bits[j],xbit+(j+.5)*bitW-2.6,baseline,8,true);
      }
    });
    if(corrected&&Number.isInteger(prefix)&&prefix>=0&&prefix<=31)line(xbit+prefix*bitW,y+3*header+rowH,xbit+prefix*bitW,y+3*header+labels.length*rowH,1.25,true);
  }
  return {c,text,line,fill,box,circle,section,digitsGrid};
}

function buildA3(base,plan,corrected){
  if(!plan||plan.base.prefix!==base.prefix||plan.base.address!==base.address)throw new Error('Découpage FLSM manquant ou incohérent.');
  if(plan.prefix===31||base.prefix===31)throw new Error('Les fiches scolaires nécessitent des sous-réseaux IPv4 avec broadcast (préfixe inférieur à /31).');
  const {c,text,line,fill,box,section,digitsGrid}=draw();
  const xL=24,wL=481,xR=517,wR=649;
  fill(24,21,1142,39);box(24,21,1142,39,9);
  text("Fiche d'adressage IPv4 & Sous-réseaux FLSM",38,48,19,true);
  text('Note : ........ /20',1049,46,10,true);
  box(24,69,1142,49,7);
  text('Nom :',36,89,9.5,true);line(74,93,341,93);
  text('Prénom :',365,89,9.5,true);line(420,93,696,93);
  text('Classe :',725,89,9.5,true);line(776,93,917,93);
  text('Date :',940,89,9.5,true);line(977,93,1147,93);
  fill(24,128,1142,43);box(24,128,1142,43,8);
  text('Adresse IPv4 :',39,154,11,true);text(base.inputAddress+'/'+base.prefix,152,154,15.5,true);
  text('Découpage demandé :',550,154,10.5,true);
  const count=plan.concernedCount;
  text(count.toLocaleString('fr-FR')+' sous-réseaux ('+Math.min(count,6)+' affichés)',702,154,11,true);
  section(xL,197,wL,'A','Analyse du réseau initial','____ /10');
  const initialFirst=numberToIPv4(base.network+1),initialLast=numberToIPv4(base.network+base.blockSize-2);
  digitsGrid(xL,222,114,wL,['Adresse de l’hôte','CIDR','Adresse réseau','Première adresse','Dernière adresse','Broadcast'],[base.inputAddress,base.mask,base.address,initialFirst,initialLast,base.broadcast],base.prefix,corrected,{rowH:24,pepette:true,font:8});
  text('Compléter le tableau en décimal ci-dessous',xL+6,449,10,true);
  const dy=460,dh=40,lab=164;
  fill(xL,dy,lab,dh*5,'0.979 0.986 0.993');box(xL,dy,wL,dh*5,5);line(xL+lab,dy,xL+lab,dy+dh*5,.9);
  const fields=['Masque décimal','Adresse réseau','Première adresse','Dernière adresse','Broadcast'];
  const values=[base.mask,base.address,initialFirst,initialLast,base.broadcast];
  for(let i=0;i<5;i++){if(i)line(xL,dy+i*dh,xL+wL,dy+i*dh);text(fields[i],xL+8,dy+i*dh+24,9);if(corrected)text(values[i],xL+lab+12,dy+i*dh+25,11.4,true)}
  section(xR,197,wR,'B','Découpage en sous-réseaux FLSM','____ /9');
  text('Préfixe initial :',xR+8,224,9,true);if(corrected)text('/'+base.prefix,xR+95,224,9.5,true);
  text('Bits empruntés :',xR+176,224,9,true);if(corrected)text(String(plan.prefix-base.prefix),xR+283,224,9.5,true);
  text('Préfixe de sous-réseau :',xR+348,224,9,true);if(corrected)text('/'+plan.prefix,xR+500,224,9.5,true);
  const ids=summaryIndices(count);
  const firstY=237,blockH=73,labels=['Réseau bin.','Réseau déc.','Broadcast bin.','Broadcast déc.'];
  const rowHeight=12.3,head=17,subLab=105,bitX=xR+subLab,bitW=(wR-subLab)/32;
  ids.forEach((index,slot)=>{
    const sn=subnetAt(plan,index),y=firstY+slot*blockH;
    fill(xR,y,wR,head,'0.965 0.978 0.989');box(xR,y,wR,head+rowHeight*4,4);
    text('Sous-réseau',xR+7,y+12,8,true);
    box(xR+74,y+2,29,13,3);
    text(String(index),xR+81-(String(index).length-1)*2.2,y+12,8,true);
    text('Réseau',xR+118,y+12,8,true);
    if(corrected)text(sn.address+'/'+sn.prefix,xR+163,y+12,8.2,true);
    text('Broadcast',xR+380,y+12,8,true);
    if(corrected)text(sn.broadcast||'-',xR+443,y+12,8.2,true);
    fill(xR,y+head,subLab,rowHeight*4,'0.977 0.984 0.992');
    line(xR+subLab,y+head,xR+subLab,y+head+4*rowHeight,.9);
    for(let j=1;j<4;j++)line(xR,y+head+j*rowHeight,xR+wR,y+head+j*rowHeight,.35);
    for(let j=1;j<32;j++)line(bitX+j*bitW,y+head,bitX+j*bitW,y+head+4*rowHeight,.23);
    if(corrected&&plan.prefix>base.prefix){
      const bx1=bitX+base.prefix*bitW,bx2=bitX+plan.prefix*bitW;
      // Le marquage des bits empruntés reste discret ; ne pas masquer la grille.
      line(bx1,y+head,bx1,y+head+4*rowHeight,1.0,true);
      line(bx2,y+head,bx2,y+head+4*rowHeight,1.0,true);
    }
    const addresses=[sn.address,sn.address,sn.broadcast,sn.broadcast];
    labels.forEach((lab,i)=>{
      const yy=y+head+i*rowHeight+9;
      text(lab,xR+6,yy,7);
      if(corrected){
        if(i%2===0){
          const bits=binaryOctets(addresses[i]).join('');
          for(let j=0;j<32;j++)if(bits[j]==='1')text('1',bitX+(j+.5)*bitW-2.2,yy,6.7,true);
        }else{
          const octets=addresses[i].split('.');
          for(let j=0;j<4;j++)text(octets[j],bitX+(j*8+2)*bitW,yy,8.3,true);
        }
      }
    });
  });
  if(count>6)text('Sous-réseaux affichés : 0, 1, 2 et les trois derniers (numérotation depuis 0).',xR+4,692,8.2);
  const yC=714;
  section(xR,yC,wR,'C','Hôtes utilisables par sous-réseau','____ /1');
  fill(xL,687,wL,101);box(xL,687,wL,101,8);
  text("Nombre d'hôtes utilisables pour le réseau initial",xL+12,710,10,true);
  text('2',xL+15,747,16,true);text('(32 - CIDR)',xL+28,735,6.9,true);text('- 2 =',xL+68,747,12,true);
  if(corrected)text(base.usableHosts.toLocaleString('fr-FR'),xL+122,747,13,true);
  fill(xR,739,wR,49);box(xR,739,wR,49,8);
  text('2',xR+12,770,16,true);text('(32 - préfixe sous-réseau)',xR+25,757,7,true);
  text('- 2 =',xR+173,770,12,true);
  if(corrected)text(plan.usableHosts.toLocaleString('fr-FR')+' hôtes utilisables',xR+226,770,12,true);
  return pdfDocument(c);
}
export function downloadFlsmA3(base,plan,corrected=false){
  const file=buildA3(base,plan,corrected),url=URL.createObjectURL(file),a=document.createElement('a');
  a.href=url;
  a.download='IPcalc_FLSM_'+base.inputAddress.replaceAll('.','-')+'_'+base.prefix+'_'+plan.concernedCount+'SR_'+(corrected?'corrige':'enonce')+'.pdf';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
