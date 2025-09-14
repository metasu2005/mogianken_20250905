import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";

/** ====== 基本パラメータ ====== */
const STEPS = 16; // 16分音符×16 = 1小節
const TRACKS = [
  { name: "Kick",  url: "/samples/kick.wav",  vol: -3  },
  { name: "Snare", url: "/samples/snare.wav", vol: -6  },
  { name: "Hat",   url: "/samples/hh.wav",    vol: -10 },
];

export default function App() {
  /** ====== Reactの状態 ====== */
  const [started, setStarted] = useState(false); // ユーザー操作でAudio解禁したか
  const [bpm, setBpm] = useState(110);
  // grid[trackIndex][stepIndex] = true/false
  const [grid, setGrid] = useState(TRACKS.map(() => Array(STEPS).fill(false)));
  const [pos, setPos] = useState(-1); // 走査中のステップ（UIの再生ヘッド表示用）

  /** ====== Tone.jsオブジェクトはrefに置く（再レンダで破棄されないように） ====== */
  const playersRef = useRef(null);
  const gridRef = useRef(grid); // 再生中に最新のパターンを参照するため
  useEffect(() => { gridRef.current = grid; }, [grid]);

  /** BPMを常にTone.Transportへ反映 */
  useEffect(() => { Tone.Transport.bpm.value = bpm; }, [bpm]);

  /** ====== 1) Audio解禁 & 2) サンプル読み込み & 3) シーケンサーのスケジューリング ====== */
  const initAudio = async () => {
    // ブラウザは「ユーザー操作後」でないとオーディオを開始できない
    await Tone.start();

    // サンプルをまとめて読み込む
    const players = new Tone.Players(
      Object.fromEntries(TRACKS.map(t => [t.name, t.url])),
      () => console.log("Samples loaded")
    ).toDestination();
    // ボリュームを設定
    TRACKS.forEach(t => players.player(t.name).volume.value = t.vol);
    playersRef.current = players;

    // 16分音符ごとにコールバック
    let step = -1;
    Tone.Transport.scheduleRepeat((time) => {
      step = (step + 1) % STEPS;
      setPos(step); // 再生ヘッド表示を更新（UI用）

      // そのステップがONのトラックだけ再生
      const cur = gridRef.current;
      for (let ti = 0; ti < TRACKS.length; ti++) {
        if (cur[ti][step]) {
          playersRef.current.player(TRACKS[ti].name).start(time);
        }
      }
    }, "16n");

    setStarted(true);
  };

  /** ====== 再生 / 停止 ====== */
  const handlePlay = () => {
    // わずかに先行して開始してポップ音を防ぐ
    Tone.Transport.start("+0.05");
  };
  const handleStop = () => {
    Tone.Transport.stop();
    setPos(-1);
  };

  /** ====== マス目のON/OFF切り替え ====== */
  const toggleCell = (ti, si) => {
    setGrid(prev => {
      const copy = prev.map(row => [...row]);
      copy[ti][si] = !copy[ti][si];
      return copy;
    });
  };

  /** ====== WAV書き出し（オフラインレンダリング） ====== */
  const exportWav = async () => {
    // 今のBPMで「1小節」を秒に換算： 4拍 × (60 / BPM)
    const secondsForOneBar = 4 * (60 / bpm);

    const rendered = await Tone.Offline(({ transport }) => {
      // Offline用にPlayersを作り直し（オンラインのplayersRefは使わない）
      const offPlayers = new Tone.Players(
        Object.fromEntries(TRACKS.map(t => [t.name, t.url]))
      ).toDestination();

      // ボリューム
      TRACKS.forEach(t => offPlayers.player(t.name).volume.value = t.vol);

      // BPM設定
      Tone.Transport.bpm.value = bpm;

      // 同じく16分音符ごとにスケジュール
      let step = -1;
      Tone.Transport.scheduleRepeat((time) => {
        step = (step + 1) % STEPS;
        for (let ti = 0; ti < TRACKS.length; ti++) {
          if (gridRef.current[ti][step]) {
            offPlayers.player(TRACKS[ti].name).start(time);
          }
        }
      }, "16n");

      transport.start();
    }, secondsForOneBar);

    // AudioBuffer -> WAVバイナリにしてダウンロード
    const wav = audioBufferToWav(rendered);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pattern.wav";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 860 }}>
      <h1 style={{ marginBottom: 8 }}>Web DAW (16-step MVP)</h1>
      {!started && (
        <button onClick={initAudio} style={{ padding: "8px 14px", marginRight: 8 }}>
          Audio Start（初回だけ押す）
        </button>
      )}
      <button onClick={handlePlay} disabled={!started} style={{ padding: "8px 14px", marginRight: 8 }}>
        ▶ Play
      </button>
      <button onClick={handleStop} disabled={!started} style={{ padding: "8px 14px", marginRight: 8 }}>
        ■ Stop
      </button>
      <label style={{ marginLeft: 8 }}>
        BPM{" "}
        <input
          type="number"
          value={bpm}
          onChange={(e) => setBpm(Math.max(40, Math.min(240, Number(e.target.value) || 120)))}
          style={{ width: 72 }}
        />
      </label>
      <button onClick={exportWav} disabled={!started} style={{ padding: "8px 14px", marginLeft: 12 }}>
        ⤓ Export WAV（1小節）
      </button>

      {/* グリッド */}
      <div style={{ marginTop: 18 }}>
        {TRACKS.map((t, ti) => (
          <div key={t.name} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <div style={{ width: 80 }}>{t.name}</div>
            {Array.from({ length: STEPS }).map((_, si) => {
              const on = grid[ti][si];
              const isHead = pos === si;
              return (
                <div
                  key={si}
                  onClick={() => toggleCell(ti, si)}
                  title={`${t.name} step ${si + 1}`}
                  style={{
                    width: 26, height: 26, marginRight: 4,
                    border: isHead ? "2px solid #111" : "1px solid #888",
                    boxSizing: "border-box",
                    background: on ? (isHead ? "#bde0fe" : "#a8dadc") : (isHead ? "#eee" : "transparent"),
                    cursor: "pointer",
                    borderRadius: 4,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** ====== AudioBuffer -> WAV(ArrayBuffer) 変換（PCM16） ======
 * ・ステレオ/モノ両対応
 * ・44byteのWAVヘッダを付けて、little-endianでPCM16を書き出す
 */
function audioBufferToWav(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2; // 16bit
  const dataSize = numFrames * numCh * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;

  // ヘッダ書き込み用ヘルパ
  const writeStr = (s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i)); };
  const write16 = (v) => { view.setUint16(offset, v, true); offset += 2; };
  const write32 = (v) => { view.setUint32(offset, v, true); offset += 4; };

  // RIFFヘッダ
  writeStr("RIFF");
  write32(36 + dataSize);
  writeStr("WAVE");

  // fmt チャンク
  writeStr("fmt ");
  write32(16);        // PCMヘッダ長
  write16(1);         // PCM
  write16(numCh);
  write32(sampleRate);
  write32(sampleRate * numCh * bytesPerSample);
  write16(numCh * bytesPerSample);
  write16(16);

  // data チャンク
  writeStr("data");
  write32(dataSize);

  // インターリーブしてPCM16で書き込み
  const channels = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(audioBuffer.getChannelData(ch));
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let sample = channels[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return buffer;
}
