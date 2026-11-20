"""Reproducible vertical edits. FFmpeg only; original synthesized audio has no third-party assets."""
from pathlib import Path
import json,subprocess,math,wave,struct,random,textwrap,sys
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'test-results/social-clips'; SRC=OUT/'source'; FINAL=OUT/'final'; FINAL.mkdir(exist_ok=True)
FONT=ROOT/'ui/assets/fonts/Caveat.ttf'; TITLE=ROOT/'ui/assets/fonts/CabinSketch-Bold.ttf'
# source in/out, crop x/y/w/h, caption. Genuine recorded outcomes, reframed only.
EDITS={
 'jackpot':[(2.3,3.6,(1010,125,610,610),'YOUR ATTACK IS A SLOT MACHINE'),(4.3,5.4,(650,165,620,720),'THREE MATCHING MARKS...'),(5.4,7.2,(650,165,620,720),'CRITICAL!'),(7.4,8.5,(1220,120,560,700),'THE PAYOFF.'),(8.5,9.5,(990,125,740,700),'BUILD YOUR OWN REELS.')],
 'gamble':[(1.9,3.4,(990,140,650,650),'3 HP. ONE ROLL.'),(4.3,5.6,(650,165,620,720),'PLEASE LAND THE HEAL.'),(5.6,6.9,(650,165,620,720),'THREE HEALS. A CRITICAL.'),(9.0,10.6,(650,165,620,720),'NOW IT IS THEIR TURN.'),(12.0,13.6,(990,120,650,730),'STILL STANDING.')],
 'dungeon':[(2.5,3.5,(210,130,700,800),'WHAT IS UNDER THE PENCIL?'),(4.0,5.3,(210,130,700,800),'LIGHT UP THE DARK.'),(5.5,7.4,(610,125,700,820),'ROLL FOR YOUR LOOT.'),(8.7,10.5,(610,125,700,820),'POCKET THE GOLD.'),(12.0,13.3,(210,130,700,800),'EVERY ROOM IS A GAMBLE.')]
}
def run(cmd):subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=None)
def audio(name,duration):
 rate=48000; rng=random.Random(71); samples=[0.0]*int(duration*rate)
 def tone(at,length,freq,amp,noise=False):
  start=int(at*rate)
  for j in range(int(length*rate)):
   k=start+j
   if k>=len(samples):break
   t=j/rate; env=math.exp(-t*9/max(.2,length))*min(1,t/.003)
   samples[k]+=amp*env*((rng.random()*2-1) if noise else math.sin(2*math.pi*(freq*t-30*t*t)))
 # Original low-key plucked pulse: no imported music or rights assumptions.
 for n in range(int(duration/.38)):
  at=n*.38; tone(at,.25,[110,146.83,164.81,130.81][(n//4)%4],.11);tone(at,.035,1600,.045,True)
 for at in ({"jackpot":[.3,.6,.9,1.2,1.5,2.1,2.4,2.7,3,3.4,3.8,4.2],"gamble":[.3,.6,.9,1.2,2.5,3,3.5,4,7.8,8.1,8.5,8.9,9.3],"dungeon":[4.2,4.5,4.9,5.2,5.6,5.9,6.3,6.7] }[name]):tone(at,.04,1900,.12,True)
 for at in ({"jackpot":[6.2,8.2],"gamble":[6.2,10.6,12.3],"dungeon":[1.6,7.3,9.2]}[name]):
  tone(at,.5,72,.35);tone(at,.12,200,.2,True)
  for f in [523.25,659.25,783.99]:tone(at,.7,f,.1)
 path=OUT/(name+'-mix.wav')
 with wave.open(str(path),'wb') as w:
  w.setparams((1,2,rate,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',int(math.tanh(v)*24000)) for v in samples))
 return path
manifest=json.loads((OUT/"edit-manifest.json").read_text()) if (OUT/"edit-manifest.json").exists() else {}
for name,entries in EDITS.items():
 if len(sys.argv)>1 and name!=sys.argv[1]:continue
 parts=[];time=0; timeline=[]
 for i,(a,b,(x,y,w,h),caption) in enumerate(entries):
  # Extend payoff moments slightly; compress no-action gaps with cuts.
  duration=(b-a)*(1.8 if i==len(entries)-1 else 1.65)
  text=OUT/f'{name}-{i}.txt';text.write_text(textwrap.fill(caption,25))
  piece=OUT/f'{name}-{i}.mp4';parts.append(piece)
  # Full-width crop of a UI region, never the whole 16:9 screen. Gentle drift
  # and a short impact jolt are applied inside the paper frame.
  filt=f"trim=start={a}:end={b},setpts=(PTS-STARTPTS)*{duration/(b-a)},crop={w}:{h}:{x}:{y},scale=1000:1160:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0xf3e4c5,fps=30,zoompan=z='1+0.018*on/120':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30,drawbox=x=44:y=370:w=992:h=1200:color=0x67503b:t=2,drawtext=fontfile={TITLE}:textfile={text}:fontsize=61:fontcolor=0x40352b:x=(w-tw)/2:y=190:box=1:boxcolor=0xf3e4c5@0.9:boxborderw=14,drawtext=fontfile={FONT}:text='SCRATCHPAD DUNGEON':fontsize=43:fontcolor=0x40352b:x=(w-tw)/2:y=1640,fps=30,format=yuv420p"
  run(['ffmpeg','-y','-v','error','-i',str(SRC/(name+'.webm')),'-vf',filt,'-an','-t',str(duration),'-c:v','libx264','-preset','fast','-crf','19',str(piece)])
  timeline.append({'start':time,'duration':duration,'source':[a,b],'crop':[x,y,w,h],'caption':caption});time+=duration
 listing=OUT/(name+'-concat.txt');listing.write_text(''.join("file '"+str(p)+"'\n" for p in parts))
 track=audio(name,time)
 target=FINAL/(name+'.mp4')
 run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-i',str(track),'-c:v','copy','-c:a','aac','-b:a','192k','-af','loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:d=0.04,afade=t=out:st='+str(time-.18)+':d=0.18','-shortest','-movflags','+faststart',str(target)])
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(target)]));manifest[name]={'timeline':timeline,'probe':info};print(name,time,flush=True)
 (OUT/'edit-manifest.json').write_text(json.dumps(manifest,indent=2))
