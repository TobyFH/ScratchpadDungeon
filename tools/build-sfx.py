#!/usr/bin/env python3
"""Rebuild the checked-in Living Sketchbook mixes. Requires ffmpeg, not at runtime.

Recipes, provenance and mix targets live in audio/manifest.json. Source files are
never modified. No random processing, downloads, plugins or paid services.
"""
from array import array
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import wave

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "audio/manifest.json"


def recipe_hash(bank, recipe):
    payload = {key: recipe.get(key) for key in ["seconds", "targetRmsDb", "peakLimit", "layers", "tone"]}
    payload["sources"] = {layer["source"]: bank["sources"][layer["source"]]["sha256"] for layer in recipe["layers"]}

    def canonical(value):
        if isinstance(value, dict):
            return {key: canonical(value[key]) for key in sorted(value)}
        if isinstance(value, list):
            return [canonical(item) for item in value]
        if isinstance(value, (float, int)) and not isinstance(value, bool):
            return format(value, ".9f")
        return value

    return hashlib.sha256(json.dumps(canonical(payload), ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def main():
    if not shutil.which("ffmpeg"):
        raise RuntimeError("Install ffmpeg to rebuild SFX. Normal UI builds use the checked-in WAV files.")
    bank = json.loads(MANIFEST.read_text())
    sample_rate = bank["sampleRate"]
    decoded = {}

    def decode(source_id):
        if source_id in decoded:
            return decoded[source_id]
        source = bank["sources"][source_id]
        path = ROOT / source["path"]
        if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
            raise RuntimeError(f"Source changed: {source_id}. Review provenance before updating its hash.")
        raw = subprocess.check_output([
            "ffmpeg", "-nostdin", "-v", "error", "-i", str(path),
            "-ac", "1", "-ar", str(sample_rate), "-f", "f32le", "pipe:1",
        ])
        samples = array("f")
        samples.frombytes(raw)
        if sys.byteorder != "little":
            samples.byteswap()
        peak = max(map(abs, samples), default=0)
        if peak < .00001:
            raise RuntimeError(f"Silent source: {source_id}")
        threshold = max(.00005, peak * .005)
        active = [i for i, value in enumerate(samples) if abs(value) > threshold]
        start = max(0, active[0] - int(.002 * sample_rate))
        end = min(len(samples), active[-1] + int(.01 * sample_rate))
        samples = array("f", (value / peak for value in samples[start:end]))
        decoded[source_id] = samples
        return samples

    for asset_id, recipe in bank["assets"].items():
        mix = [0.] * round(recipe["seconds"] * sample_rate)
        for layer in recipe["layers"]:
            source = decode(layer["source"])
            start = round(layer.get("start", 0) * sample_rate)
            end = min(len(source), start + round(layer.get("length", len(source) / sample_rate) * sample_rate))
            clip = source[start:end]
            if len(clip) < 2:
                raise RuntimeError(f"Empty layer in {asset_id}: {layer['source']}")
            if layer.get("reverse"):
                clip = clip[::-1]
            rate = layer.get("rate", 1)
            frames = max(2, int(len(clip) / rate))
            offset = round(layer.get("delay", 0) * sample_rate)
            alpha = 1 - math.exp(-2 * math.pi * layer["lowpass"] / sample_rate) if layer.get("lowpass") else 1
            filtered = 0.
            for i in range(min(frames, len(mix) - offset)):
                position = min(len(clip) - 1, i * rate)
                k = int(position)
                value = clip[k] + (clip[min(k + 1, len(clip) - 1)] - clip[k]) * (position - k)
                filtered += alpha * (value - filtered)
                envelope = min(1, i / max(1, sample_rate * .002), (frames - i - 1) / max(1, sample_rate * .012))
                mix[offset + i] += filtered * layer.get("gain", 1) * max(0, envelope)
        # Small original sine thumps reinforce paper impacts without replacing
        # the sourced material. Their contribution is explicit in each recipe.
        tone = recipe.get("tone")
        if tone:
            frames = round(tone["seconds"] * sample_rate)
            offset = round(tone.get("delay", 0) * sample_rate)
            phase = 0.
            for i in range(min(frames, len(mix) - offset)):
                t = i / sample_rate
                phase += 2 * math.pi * tone["hz"] * (1 - .3 * i / frames) / sample_rate
                envelope = min(1, t / .004) * math.exp(-t / (tone["seconds"] / 5))
                mix[offset + i] += math.sin(phase) * tone["gain"] * envelope
        mean = sum(mix) / len(mix)
        mix = [value - mean for value in mix]
        peak = max(map(abs, mix))
        active = [value for value in mix if abs(value) > peak * .02]
        rms = math.sqrt(sum(value * value for value in active) / max(1, len(active)))
        if rms < .00001:
            raise RuntimeError(f"Silent render: {asset_id}")
        gain = min(10 ** (recipe["targetRmsDb"] / 20) / rms, recipe["peakLimit"] / peak)
        pcm = array("h")
        for i, value in enumerate(mix):
            fade = min(1, i / max(1, sample_rate * .002), (len(mix) - i - 1) / max(1, sample_rate * .006))
            pcm.append(round(max(-.99, min(.99, value * gain * max(0, fade))) * 32767))
        if sys.byteorder != "little":
            pcm.byteswap()
        path = ROOT / recipe["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm.tobytes())
        recipe["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        recipe["frames"] = len(mix)
        recipe["recipeHash"] = recipe_hash(bank, recipe)
    MANIFEST.write_text(json.dumps(bank, indent=2) + "\n")
    print(f"Rendered {len(bank['assets'])} deterministic, mono {sample_rate}-Hz SFX; original sources unchanged.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, KeyError, ValueError, TypeError, FileNotFoundError, subprocess.CalledProcessError) as error:
        print(f"SFX build failed: {error}", file=sys.stderr)
        sys.exit(1)
