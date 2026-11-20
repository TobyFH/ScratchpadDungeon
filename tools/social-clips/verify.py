"""Decode final files and validate delivery dimensions/codecs/audio/durations."""
from pathlib import Path
import subprocess,json
root=Path(__file__).resolve().parents[2]; out=root/'test-results/social-clips'; result={}
for name in ['jackpot','gamble','dungeon']:
 p=out/'final'/(name+'.mp4')
 meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))
 video=next(s for s in meta['streams'] if s['codec_type']=='video');audio=next(s for s in meta['streams'] if s['codec_type']=='audio')
 assert (video['width'],video['height'])==(1080,1920)
 assert video['codec_name']=='h264' and video['pix_fmt']=='yuv420p'
 assert video['r_frame_rate']=='30/1'
 assert audio['codec_name']=='aac'
 duration=float(meta['format']['duration']);assert 10<=duration<=20
 subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
 levels=subprocess.run(['ffmpeg','-hide_banner','-i',str(p),'-af','volumedetect','-vn','-f','null','-'],capture_output=True,text=True,check=True).stderr
 result[name]={'duration':duration,'dimensions':[1080,1920],'video':'H.264','audio':'AAC','decode':'pass','levels':[line.strip() for line in levels.splitlines() if 'volume:' in line]}
 # Explicit timestamps avoid the fps filter sampling at interval midpoints.
 frames=[]
 for i,t in enumerate([0,duration/2,max(0,duration-.15)]):
  frame=out/(name+f'-review-{i}.jpg');frames.append(frame)
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(p),'-frames:v','1','-vf','scale=270:480',str(frame)],check=True)
 subprocess.run(['ffmpeg','-v','error','-y',*[arg for f in frames for arg in ['-i',str(f)]],'-filter_complex','hstack=inputs=3','-frames:v','1',str(out/(name+'-delivery-review.jpg'))],check=True)

(out/'verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
