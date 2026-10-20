#!/usr/bin/env python3
"""Deterministic CC0 placeholder audio. Standard library only; no recorded samples."""
import json, math, random, struct, wave, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SR=11025
CUES={
 'ui-confirm':(.09,520,760,'tone'), 'ui-back':(.10,420,240,'tone'),
 'spin-start':(.22,100,250,'noise'), 'reel-tick':(.035,550,400,'noise'),
 'reel-lock':(.12,330,180,'tone'), 'critical':(.65,440,880,'chord'),
 'damage':(.18,150,45,'noise'), 'heal':(.40,390,780,'chord'),
 'block':(.16,200,360,'tone'), 'coin':(.13,1100,1450,'tone'),
 'level-up':(.75,330,990,'chord'), 'death':(.65,240,65,'tone'),
 'page-turn':(.32,200,90,'noise'), 'reveal':(.11,700,300,'noise'),
 'encounter':(.65,100,180,'chord'), 'victory':(1.4,440,880,'chord'),
}
def write(name,seconds,fn):
 samples=[]
 for i in range(round(SR*seconds)):
  t=i/SR;samples.append(struct.pack('<h',round(max(-1,min(1,fn(t,seconds)))*32767)))
 p=ROOT/'assets/audio'/name;p.parent.mkdir(parents=True,exist_ok=True)
 with wave.open(str(p),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(b''.join(samples))
 return p
manifest=json.loads((ROOT/'data/assets.json').read_text());existing={a['id']:a for a in manifest['assets']}
def record(p,id,type,usage,**opts):
 rel=str(p.relative_to(ROOT));entry=dict(id=id,path=rel,originalPath=rel,type=type,usage=usage,replacementStatus='placeholder',licence='CC0-1.0',licenceFile='assets/LICENCES.md',renderMode='file',sha256=hashlib.sha256(p.read_bytes()).hexdigest(),**opts)
 if id not in existing:manifest['assets'].append(entry)
 elif existing[id]['replacementStatus']=='placeholder':existing[id].update(entry)
for n,(seconds,start,end,kind) in CUES.items():
 rng=random.Random(n)
 def sound(t,d,start=start,end=end,kind=kind,rng=rng):
  f=start+(end-start)*t/d;phase=2*math.pi*(start*t+(end-start)*t*t/(2*d));env=min(1,t/.008)*max(0,1-t/d)**1.8
  v=math.sin(phase)
  if kind=='noise':v=v*.35+(rng.random()*2-1)*.45
  if kind=='chord':v=(v+math.sin(phase*1.25)*.5+math.sin(phase*1.5)*.3)/1.8
  return v*env*.22
 p=write(n+'.wav',seconds,sound);record(p,'sfx.'+n,'sound',['Game feedback',n],volume=.65,priority=2 if n in ('critical','death','victory','level-up') else 1,cooldownMs=25 if n=='reel-tick' else 55)
for scene,notes in [('field',[110,130.8128,146.8324,130.8128]),('battle',[110,116.5409,130.8128,123.4708])]:
 def score(t,d,notes=notes):
  # Four faded chords, period exactly 16 s, with quiet eight-note pulses.
  chord=int(t//4)%4;u=t%4;envelope=math.sin(math.pi*u/4)**2;f=notes[chord]
  pad=sum(math.sin(2*math.pi*f*r*t)*a for r,a in [(1,.6),(1.5,.24),(2,.16)])/3
  beat=t%.5;pluck=math.sin(2*math.pi*f*4*t)*math.exp(-beat*18)*.025
  return pad*envelope*.16+pluck
 p=write('music-'+scene+'.wav',16,score);record(p,'music.'+scene,'music',['Ambient '+scene+' loop'],volume=.32,loop=True,loopStart=0,loopEnd=16)
(ROOT/'data/assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Generated',len(CUES),'SFX and two seamless temporary music loops.')
