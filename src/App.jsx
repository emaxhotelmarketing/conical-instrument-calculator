
import React, { useState, useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const noteFrequencies = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];

function frequencyToNoteName(freq) {
  const A4 = 440;
  const semitone = 12 * Math.log2(freq / A4);
  const noteIndex = Math.round(semitone) + 57;
  const octave = Math.floor(noteIndex / 12);
  const noteName = noteFrequencies[noteIndex % 12];
  return `${noteName}${octave}`;
}

function playTone(freq) {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(freq, context.currentTime);
  oscillator.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 1.5);
}

export default function ConicalInstrumentCalculator() {
  const [length, setLength] = useState(600);
  const [baseDiameter, setBaseDiameter] = useState(20);
  const [tipDiameter, setTipDiameter] = useState(5);
  const [toneHoles, setToneHoles] = useState(6);
  const [wallThickness, setWallThickness] = useState(1);
  const [toneHolePositions, setToneHolePositions] = useState([]);
  const exportRef = useRef();

  const saveDesign = () => {
    const design = {
      length,
      baseDiameter,
      tipDiameter,
      wallThickness,
      toneHoles,
    };
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: "application/json" });
    downloadBlob(blob, `conical_instrument.json`);
  };

  const loadDesign = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setLength(data.length);
        setBaseDiameter(data.baseDiameter);
        setTipDiameter(data.tipDiameter);
        setWallThickness(data.wallThickness);
        setToneHoles(data.toneHoles);
      } catch (err) {
        alert("Failed to load design.");
      }
    };
    reader.readAsText(file);
  };

  const exportToSTL = () => {
    const exporter = new STLExporter();
    if (!exportRef.current) return;
    const result = exporter.parse(exportRef.current.current);
    const blob = new Blob([result], { type: 'text/plain' });
    downloadBlob(blob, 'conical_instrument.stl');
  };

  useEffect(() => {
    const positions = [];
    const toneSpacing = length / (toneHoles + 1);
    const speedOfSound = 343000; // mm/s
    const frequencyBase = 440; // Hz

    for (let i = 1; i <= toneHoles; i++) {
      const x = toneSpacing * i;
      const boreDiameter = tipDiameter + ((baseDiameter - tipDiameter) * x) / length;

      const distanceFromTip = x;
      const waveLength = (4 * distanceFromTip);
      const freq = speedOfSound / waveLength;
      const note = frequencyToNoteName(freq);
      const noteFreq = 440 * Math.pow(2, (noteFrequencies.indexOf(note.replace(/\d/, '')) + (parseInt(note.replace(/\D/, '')) - 4) * 12 - 9) / 12);
      const tuningAccuracy = (100 * Math.abs(freq - noteFreq) / noteFreq).toFixed(2);

      const holeSize = Math.max(1, ((freq / frequencyBase) * boreDiameter * 0.3).toFixed(2));

      positions.push({
        x,
        diameter: boreDiameter,
        holeSize: parseFloat(holeSize),
        frequency: freq.toFixed(2),
        note,
        tuningAccuracy: tuningAccuracy
      });
    }
    setToneHolePositions(positions);
  }, [length, baseDiameter, tipDiameter, toneHoles]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Conical Wind Instrument Calculator</h1>

      <Card>
        <CardContent className="space-y-4 p-4">
          {[
            ["Instrument Length", length, setLength, 200, 1000, 10],
            ["Base Diameter", baseDiameter, setBaseDiameter, 10, 50, 1],
            ["Tip Diameter", tipDiameter, setTipDiameter, 1, 20, 1],
            ["Tone Holes", toneHoles, setToneHoles, 1, 30, 1],
            ["Wall Thickness", wallThickness, setWallThickness, 0.5, 5, 0.1],
          ].map(([label, val, setter, min, max, step], idx) => (
            <div key={idx} className="space-y-1">
              <label>{label}: {val}</label>
              <Slider min={min} max={max} step={step} value={[val]} onValueChange={([v]) => setter(v)} />
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={val}
                onChange={(e) => setter(parseFloat(e.target.value) || 0)}
                className="border px-2 py-1 rounded w-full"
              />
            </div>
          ))}
          <div className="space-x-2">
            <button onClick={saveDesign} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save Design</button>
            <label className="inline-block cursor-pointer bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700">
              Load Design
              <input type="file" accept="application/json" onChange={loadDesign} className="hidden" />
            </label>
            <button onClick={exportToSTL} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Export STL</button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold">Tone Hole Positions</h2>
        <ul className="list-disc ml-6">
          {toneHolePositions.map((hole, idx) => (
            <li key={idx}>
              Position: {hole.x.toFixed(1)} mm, Bore Diameter: {hole.diameter.toFixed(2)} mm, Hole Size: {hole.holeSize.toFixed(2)} mm, Frequency: {hole.frequency} Hz, Note: {hole.note}, Tuning Accuracy: {hole.tuningAccuracy}%
              <button
                className="ml-2 text-blue-600 underline text-sm"
                onClick={() => playTone(hole.frequency)}
              >
                Play
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
