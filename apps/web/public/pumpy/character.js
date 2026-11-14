/* Pumpy web character. App geometry, acting keyframes and interpolation copied from
 * FitFolio/mobile/packages/pumpy-chat/src/components/character/PumpyCharacter.{shapes,acting}.ts.
 * SVG rendering adapts PumpyCharacter.tsx; no static app-icon substitute.
 */
(() => {
'use strict';
"use strict";
const REST_CHARACTER_ACT = {
    dumbbell: 0,
    hourglass: 0,
    heart: 0,
    rocket: 0,
    x: 0,
    y: 0,
    rotation: 0,
    yaw: 0,
    pitch: 0,
    scaleX: 1,
    scaleY: 1,
    gazeX: 0,
    gazeY: 0,
    leftWink: 0,
    rightWink: 0,
    leftEyeSmile: 0,
    rightEyeSmile: 0,
    eyeScaleX: 1,
    leftEyeScaleY: 1,
    rightEyeScaleY: 1,
    eyeSpacing: 1,
    eyeTilt: 0,
};
// A entrada de foco termina nesta mesma pose, mantida enquanto há digitação.
const FOCUSED_CHARACTER_ACT = {
    ...REST_CHARACTER_ACT,
    x: -0.022,
    y: -0.022,
    rotation: -0.08,
    yaw: -0.18,
    pitch: -0.05,
    gazeX: -0.04,
    gazeY: 0.05,
    scaleY: 1.03,
    eyeScaleX: 1.2,
    leftEyeScaleY: 0.78,
    rightEyeScaleY: 0.9,
    eyeTilt: -0.06,
};
const AI_CHARACTER_SEQUENCE_DURATIONS = {
    notice: 1160,
    focus: 960,
    acknowledge: 700,
    hop: 960,
    wink: 900,
    proud: 1120,
    heart: 1240,
    milestone: 1760,
    "glance-left": 1580,
    "glance-right": 1580,
    spin: 1800,
    flip: 1880,
};
// Cada quadro descreve uma pose completa: propriedades omitidas voltam ao
// repouso. Assim o olhar, a silhueta e o corpo compartilham a mesma intenção.
const SEQUENCE_KEYFRAMES = {
    "glance-left": [
        { at: 0, pose: {} },
        // Os olhos encontram o alvo antes de o corpo acompanhar o olhar.
        { at: 160, pose: {
                gazeX: -0.055, gazeY: -0.012, eyeScaleX: 1.1,
                leftEyeScaleY: 0.88, rightEyeScaleY: 1.05,
            } },
        { at: 400, pose: {
                yaw: -0.62, x: -0.016, rotation: -0.055, gazeX: -0.035,
                gazeY: -0.014, eyeScaleX: 1.12, leftEyeScaleY: 0.84, rightEyeScaleY: 1.04,
            } },
        { at: 810, pose: {
                yaw: -0.58, pitch: -0.08, x: -0.013, rotation: -0.04,
                gazeX: -0.044, gazeY: -0.025, eyeScaleX: 1.16,
                leftEyeScaleY: 0.9, rightEyeScaleY: 1.1,
            } },
        { at: 1000, pose: {
                yaw: -0.46, x: -0.01, gazeX: 0.022, gazeY: 0.005,
                eyeScaleX: 1.1, leftEyeScaleY: 0.92, rightEyeScaleY: 0.96,
            } },
        { at: 1270, pose: { yaw: 0.07, rotation: 0.025, gazeX: 0.009 } },
        { at: 1580, pose: {} },
    ],
    "glance-right": [
        { at: 0, pose: {} },
        { at: 160, pose: {
                gazeX: 0.055, gazeY: -0.012, eyeScaleX: 1.1,
                leftEyeScaleY: 1.05, rightEyeScaleY: 0.88,
            } },
        { at: 400, pose: {
                yaw: 0.62, x: 0.016, rotation: 0.055, gazeX: 0.035,
                gazeY: -0.014, eyeScaleX: 1.12, leftEyeScaleY: 1.04, rightEyeScaleY: 0.84,
            } },
        { at: 810, pose: {
                yaw: 0.58, pitch: -0.08, x: 0.013, rotation: 0.04,
                gazeX: 0.044, gazeY: -0.025, eyeScaleX: 1.16,
                leftEyeScaleY: 1.1, rightEyeScaleY: 0.9,
            } },
        { at: 1000, pose: {
                yaw: 0.46, x: 0.01, gazeX: -0.022, gazeY: 0.005,
                eyeScaleX: 1.1, leftEyeScaleY: 0.96, rightEyeScaleY: 0.92,
            } },
        { at: 1270, pose: { yaw: -0.07, rotation: -0.025, gazeX: -0.009 } },
        { at: 1580, pose: {} },
    ],
    spin: [
        { at: 0, pose: {} },
        { at: 200, pose: {
                yaw: -0.3, x: -0.024, y: 0.018, rotation: -0.065,
                scaleX: 1.07, scaleY: 0.9, gazeX: -0.045,
                leftEyeScaleY: 0.76, rightEyeScaleY: 0.88,
            } },
        { at: 400, pose: {
                yaw: Math.PI * 0.36, y: -0.046, rotation: 0.035,
                scaleX: 0.98, scaleY: 1.05, gazeX: 0.035, eyeScaleX: 1.22,
            } },
        { at: 690, pose: {
                yaw: Math.PI, y: -0.063, scaleX: 1.025, scaleY: 0.99,
            } },
        { at: 980, pose: {
                yaw: Math.PI * 1.7, y: -0.04, rotation: 0.035,
                scaleX: 0.99, scaleY: 1.025, gazeX: -0.025,
            } },
        { at: 1220, pose: {
                yaw: Math.PI * 2 + 0.13, y: 0.015, rotation: 0.07,
                scaleX: 1.07, scaleY: 0.92, gazeX: 0.014, eyeScaleX: 1.2,
                leftEyeScaleY: 0.84, rightEyeScaleY: 0.84,
            } },
        { at: 1450, pose: {
                yaw: Math.PI * 2, y: -0.018, rotation: -0.035,
                rightWink: 1, eyeScaleX: 1.16,
            } },
        // Conservar a volta completa impede que a última interpolação a desfaça.
        { at: 1800, pose: { yaw: Math.PI * 2 } },
    ],
    flip: [
        { at: 0, pose: {} },
        { at: 210, pose: {
                pitch: -0.24, y: 0.026, scaleX: 1.1, scaleY: 0.84,
                gazeY: 0.03, leftEyeScaleY: 0.62, rightEyeScaleY: 0.62,
            } },
        { at: 410, pose: {
                pitch: Math.PI * 0.35, y: -0.068, scaleX: 0.94, scaleY: 1.09,
                gazeY: -0.035, eyeScaleX: 1.3,
            } },
        { at: 710, pose: { pitch: Math.PI, y: -0.1, rotation: 0.04 } },
        { at: 1020, pose: {
                pitch: Math.PI * 1.7, y: -0.055, scaleX: 0.98, scaleY: 1.04,
                gazeY: 0.018,
            } },
        { at: 1260, pose: {
                pitch: Math.PI * 2 + 0.12, y: 0.026, scaleX: 1.12, scaleY: 0.84,
                leftEyeScaleY: 0.57, rightEyeScaleY: 0.57,
            } },
        { at: 1480, pose: {
                pitch: Math.PI * 2 - 0.035, y: -0.027, scaleX: 0.98, scaleY: 1.035,
                eyeScaleX: 1.2, gazeY: -0.012,
            } },
        { at: 1660, pose: {
                pitch: Math.PI * 2, y: 0.006, scaleX: 1.02, scaleY: 0.98,
            } },
        { at: 1880, pose: { pitch: Math.PI * 2 } },
    ],
    notice: [
        { at: 0, pose: {} },
        { at: 170, pose: {
                x: -0.022, rotation: -0.09, gazeX: -0.046, gazeY: -0.008,
                eyeScaleX: 0.95, leftEyeScaleY: 0.83, rightEyeScaleY: 0.83, eyeTilt: -0.05,
            } },
        // Uma pausa legível antes de perceber algo; a volta é muito mais rápida.
        { at: 370, pose: {
                x: -0.026, rotation: -0.11, gazeX: -0.05, gazeY: -0.012,
                eyeScaleX: 0.95, leftEyeScaleY: 0.8, rightEyeScaleY: 0.8, eyeTilt: -0.05,
            } },
        { at: 470, pose: {
                x: 0.022, y: -0.055, rotation: 0.1, scaleX: 0.97, scaleY: 1.06,
                gazeX: 0.005, gazeY: -0.018, eyeScaleX: 1.95,
                leftEyeScaleY: 0.89, rightEyeScaleY: 0.89, eyeSpacing: 1.03,
            } },
        { at: 660, pose: {
                x: 0.012, y: -0.035, rotation: 0.06, scaleX: 1.02, scaleY: 1.02,
                gazeY: -0.008, eyeScaleX: 1.88,
                leftEyeScaleY: 0.87, rightEyeScaleY: 0.87, eyeSpacing: 1.03,
            } },
        { at: 870, pose: {
                y: 0.012, scaleX: 1.04, scaleY: 0.95,
                eyeScaleX: 1.12, leftEyeScaleY: 0.92, rightEyeScaleY: 0.92,
            } },
        { at: 1160, pose: {} },
    ],
    focus: [
        { at: 0, pose: {} },
        { at: 180, pose: {
                x: -0.018, y: -0.018, rotation: -0.07, gazeX: -0.038, gazeY: 0.04,
                yaw: -0.09, pitch: -0.025,
                scaleY: 1.03, eyeScaleX: 1.08, leftEyeScaleY: 0.86, rightEyeScaleY: 0.86,
            } },
        { at: 370, pose: {
                x: -0.025, y: -0.027, rotation: -0.1, gazeX: -0.043, gazeY: 0.05,
                yaw: -0.2, pitch: -0.06,
                scaleY: 1.04, eyeScaleX: 1.2, leftEyeScaleY: 0.78,
                rightEyeScaleY: 0.9, eyeTilt: -0.06,
            } },
        { at: 570, pose: FOCUSED_CHARACTER_ACT },
        { at: 960, pose: FOCUSED_CHARACTER_ACT },
    ],
    acknowledge: [
        { at: 0, pose: {} },
        { at: 110, pose: {
                y: -0.018, scaleY: 1.04, gazeY: -0.014, eyeScaleX: 1.15,
            } },
        { at: 245, pose: {
                y: 0.025, rotation: -0.035, scaleX: 1.07, scaleY: 0.88,
                gazeY: 0.032, leftEyeScaleY: 0.68, rightEyeScaleY: 0.68,
            } },
        { at: 370, pose: {
                y: -0.033, rotation: 0.035, scaleX: 0.97, scaleY: 1.05,
                gazeY: -0.017, eyeScaleX: 1.17, leftEyeScaleY: 0.91, rightEyeScaleY: 0.91,
            } },
        { at: 500, pose: { y: 0.009, scaleX: 1.03, scaleY: 0.97 } },
        { at: 700, pose: {} },
    ],
    hop: [
        { at: 0, pose: {} },
        { at: 160, pose: {
                y: 0.02, scaleX: 1.1, scaleY: 0.86, gazeY: 0.022,
                leftEyeScaleY: 0.65, rightEyeScaleY: 0.65,
            } },
        { at: 275, pose: {
                x: -0.009, y: -0.075, rotation: -0.06, scaleX: 0.94, scaleY: 1.09,
                gazeY: -0.026, eyeScaleX: 1.45, leftEyeScaleY: 0.91, rightEyeScaleY: 0.91,
            } },
        { at: 405, pose: {
                x: 0.008, y: -0.1, rotation: 0.13, scaleX: 1.04, scaleY: 0.97,
                gazeY: -0.012, eyeScaleX: 1.4, leftEyeScaleY: 0.9, rightEyeScaleY: 0.9,
            } },
        { at: 550, pose: {
                x: 0.012, y: -0.03, rotation: 0.07, scaleX: 0.97, scaleY: 1.04,
                gazeY: 0.024,
            } },
        { at: 640, pose: {
                y: 0.022, rotation: -0.035, scaleX: 1.1, scaleY: 0.86,
                leftEyeScaleY: 0.56, rightEyeScaleY: 0.56,
            } },
        { at: 770, pose: { y: -0.028, scaleX: 0.98, scaleY: 1.03 } },
        { at: 960, pose: {} },
    ],
    wink: [
        { at: 0, pose: {} },
        { at: 170, pose: {
                x: -0.018, y: 0.006, rotation: -0.09, scaleX: 1.04, scaleY: 0.95,
                gazeX: -0.015, eyeScaleX: 1.08,
            } },
        { at: 330, pose: {
                x: 0.027, y: -0.04, rotation: 0.16, scaleX: 1.02, scaleY: 1.03,
                gazeX: 0.018, rightWink: 1, eyeScaleX: 1.2,
                leftEyeScaleY: 0.9, eyeTilt: 0.07,
            } },
        { at: 485, pose: {
                x: 0.025, y: -0.03, rotation: 0.14,
                gazeX: 0.016, rightWink: 1, eyeScaleX: 1.18,
                leftEyeScaleY: 0.9, eyeTilt: 0.06,
            } },
        { at: 645, pose: { x: -0.007, y: 0.01, rotation: -0.035, scaleY: 0.97 } },
        { at: 900, pose: {} },
    ],
    proud: [
        { at: 0, pose: {} },
        { at: 170, pose: {
                y: 0.019, rotation: -0.05, scaleX: 1.07, scaleY: 0.91,
                gazeY: 0.022, leftEyeScaleY: 0.8, rightEyeScaleY: 0.8,
            } },
        { at: 355, pose: {
                x: -0.015, y: -0.057, rotation: -0.12, scaleX: 1.07, scaleY: 1.05,
                gazeX: 0.015, gazeY: -0.03, eyeScaleX: 1.23,
                leftEyeScaleY: 0.74, rightEyeScaleY: 0.74, eyeTilt: -0.055,
            } },
        { at: 680, pose: {
                x: -0.015, y: -0.047, rotation: -0.1, scaleX: 1.06, scaleY: 1.04,
                gazeX: 0.015, gazeY: -0.025, eyeScaleX: 1.23,
                leftEyeScaleY: 0.74, rightEyeScaleY: 0.74, eyeTilt: -0.04,
            } },
        { at: 890, pose: { y: 0.012, rotation: 0.035, scaleX: 1.03, scaleY: 0.96 } },
        { at: 1120, pose: {} },
    ],
    heart: [
        { at: 0, pose: {} },
        { at: 180, pose: {
                y: 0.018, scaleX: 1.09, scaleY: 0.88,
                leftEyeScaleY: 0.6, rightEyeScaleY: 0.6,
            } },
        { at: 420, pose: {
                heart: 1, x: -0.012, y: -0.071, rotation: -0.1, scaleX: 1.03, scaleY: 1.03,
                eyeScaleX: 1.38, leftEyeScaleY: 0.88, rightEyeScaleY: 0.88,
            } },
        { at: 630, pose: {
                heart: 1, x: 0.014, y: -0.049, rotation: 0.1, scaleX: 1.09, scaleY: 1.02,
                eyeScaleX: 1.25, leftEyeScaleY: 0.8, rightEyeScaleY: 0.8,
            } },
        { at: 800, pose: {
                heart: 1, y: -0.045, rotation: 0.025, scaleX: 1.01, scaleY: 1.01,
                eyeScaleX: 1.22, leftEyeScaleY: 0.8, rightEyeScaleY: 0.8,
            } },
        { at: 1020, pose: { y: 0.017, scaleX: 1.06, scaleY: 0.92 } },
        { at: 1240, pose: {} },
    ],
    milestone: [
        { at: 0, pose: {} },
        // Preparação, salto com coração, aterrissagem e uma pose de "conseguimos".
        { at: 190, pose: {
                y: 0.022, rotation: -0.04, scaleX: 1.1, scaleY: 0.84, gazeY: 0.025,
                leftEyeScaleY: 0.58, rightEyeScaleY: 0.58,
            } },
        { at: 335, pose: {
                heart: 0.7, x: -0.016, y: -0.072, rotation: -0.12,
                scaleX: 0.95, scaleY: 1.09, gazeY: -0.03,
                eyeScaleX: 1.65, leftEyeScaleY: 0.91, rightEyeScaleY: 0.91,
            } },
        { at: 480, pose: {
                heart: 1, x: 0.009, y: -0.1, rotation: 0.15, scaleX: 1.06,
                gazeY: -0.015, eyeScaleX: 1.48, leftEyeScaleY: 0.88, rightEyeScaleY: 0.88,
            } },
        { at: 660, pose: {
                heart: 1, x: 0.015, y: -0.075, rotation: 0.1, scaleX: 1.09, scaleY: 1.02,
                eyeScaleX: 1.36, leftEyeScaleY: 0.8, rightEyeScaleY: 0.8,
            } },
        { at: 830, pose: {
                y: 0.023, rotation: -0.055, scaleX: 1.1, scaleY: 0.85, gazeY: 0.015,
                leftEyeScaleY: 0.55, rightEyeScaleY: 0.55,
            } },
        { at: 1050, pose: {
                x: -0.02, y: -0.054, rotation: -0.14, scaleX: 1.07, scaleY: 1.05,
                gazeY: -0.025, gazeX: 0.018, eyeScaleX: 1.28,
                leftEyeScaleY: 0.8, rightEyeScaleY: 0.8, eyeTilt: -0.055,
            } },
        { at: 1160, pose: {
                x: -0.018, y: -0.049, rotation: -0.12, scaleX: 1.06, scaleY: 1.04,
                gazeY: -0.02, gazeX: 0.018, rightWink: 1,
                eyeScaleX: 1.28, leftEyeScaleY: 0.85, eyeTilt: -0.04,
            } },
        { at: 1320, pose: {
                x: -0.016, y: -0.043, rotation: -0.1, scaleX: 1.05, scaleY: 1.03,
                gazeY: -0.016, gazeX: 0.015, rightWink: 1,
                eyeScaleX: 1.23, leftEyeScaleY: 0.85, eyeTilt: -0.04,
            } },
        { at: 1510, pose: { y: 0.012, rotation: 0.04, scaleX: 1.04, scaleY: 0.95 } },
        { at: 1760, pose: {} },
    ],
};
const ACT_KEYS = Object.keys(REST_CHARACTER_ACT);
/**
 * Tempo local em ms; posição e olhar são frações do canvas; rotation, yaw e
 * pitch são radianos. Voltas completas terminam em 2π, equivalente ao repouso.
 * A intensidade reduz a atuação, mantendo a forma escolhida reconhecível.
 * Não há repetição implícita: o último quadro mantém a pose de saída da cena.
 */
function getAICharacterSequence(sequence, elapsed, intensity = 1) {
    "worklet";
    const act = { ...REST_CHARACTER_ACT };
    const amount = Math.min(1, Math.max(0, intensity));
    if (amount === 0 || elapsed <= 0) {
        return act;
    }
    const frames = SEQUENCE_KEYFRAMES[sequence];
    elapsed = Math.min(elapsed, AI_CHARACTER_SEQUENCE_DURATIONS[sequence]);
    for (let index = 1; index < frames.length; index += 1) {
        const next = frames[index];
        if (elapsed > next.at)
            continue;
        const previous = frames[index - 1];
        const progress = (elapsed - previous.at) / (next.at - previous.at);
        const eased = progress * progress * (3 - 2 * progress);
        for (let keyIndex = 0; keyIndex < ACT_KEYS.length; keyIndex += 1) {
            const key = ACT_KEYS[keyIndex];
            const rest = REST_CHARACTER_ACT[key];
            const from = previous.pose[key] ?? rest;
            const to = next.pose[key] ?? rest;
            const value = from + (to - from) * eased;
            const isShape = key === "dumbbell" || key === "hourglass" || key === "heart" || key === "rocket";
            act[key] = rest + (value - rest) * (isShape ? 1 : amount);
        }
        return act;
    }
    return act;
}

const APP_CONTOURS = {"kettlebell":{"start":[0.5,0.335],"curves":[[[0.5525,0.335],[0.6009375,0.34343750000000006],[0.6440625,0.35867187500000003]],[[0.6871875000000001,0.37390625],[0.725,0.3959375],[0.75625,0.423125]],[[0.7875,0.4503125],[0.8121875000000001,0.48265625],[0.8290625,0.518515625]],[[0.8459375,0.5543750000000001],[0.855,0.59375],[0.855,0.635]],[[0.855,0.6675],[0.851375,0.697375],[0.844421875,0.724671875]],[[0.83746875,0.75196875],[0.8271875,0.7766875],[0.813875,0.798875]],[[0.8005625000000001,0.8210625],[0.78421875,0.84071875],[0.7651406249999999,0.857890625]],[[0.7460625,0.8750625],[0.72425,0.88975],[0.7,0.902]],[[0.6912499999999999,0.9065000000000001],[0.6799999999999999,0.909875],[0.666640625,0.91240625]],[[0.65328125,0.9149375],[0.6378125,0.916625],[0.620625,0.9177500000000001]],[[0.6034375,0.9188750000000001],[0.58453125,0.9194375000000001],[0.5642968749999999,0.9197187500000001]],[[0.5440624999999999,0.92],[0.5225,0.92],[0.5,0.92]],[[0.4775,0.92],[0.4559375,0.92],[0.43570312499999997,0.9197187500000001]],[[0.41546874999999994,0.9194375000000001],[0.39656249999999993,0.9188750000000001],[0.37937499999999996,0.9177500000000001]],[[0.3621875,0.916625],[0.34671874999999996,0.9149375],[0.33335937499999996,0.91240625]],[[0.31999999999999995,0.909875],[0.30874999999999997,0.9065000000000001],[0.3,0.902]],[[0.27575,0.88975],[0.2539375,0.8750625],[0.23485937499999998,0.857890625]],[[0.21578124999999998,0.84071875],[0.1994375,0.8210625],[0.18612499999999998,0.798875]],[[0.17281249999999998,0.7766875],[0.16253125,0.75196875],[0.155578125,0.724671875]],[[0.148625,0.697375],[0.145,0.6675],[0.145,0.635]],[[0.145,0.59375],[0.1540625,0.5543750000000001],[0.17093749999999996,0.518515625]],[[0.18781249999999997,0.48265625],[0.21249999999999997,0.4503125],[0.24375,0.423125]],[[0.275,0.3959375],[0.31281250000000005,0.37390625],[0.3559375,0.35867187500000003]],[[0.3990625,0.34343750000000006],[0.4475,0.335],[0.5,0.335]]]},"invertedKettlebell":{"start":[0.5,0.35],"curves":[[[0.5225,0.35],[0.5440625,0.35],[0.564296875,0.3502812499999999]],[[0.5845312500000001,0.3505624999999999],[0.6034375000000001,0.3511249999999999],[0.620625,0.35224999999999995]],[[0.6378125,0.353375],[0.65328125,0.35506250000000006],[0.6666406250000001,0.35759375000000004]],[[0.68,0.36012500000000003],[0.69125,0.36349999999999993],[0.7,0.368]],[[0.7242500000000001,0.38025],[0.7460625000000001,0.39493750000000005],[0.765140625,0.412109375]],[[0.78421875,0.42928125000000006],[0.8005625000000001,0.4489375],[0.813875,0.471125]],[[0.8271875,0.49331250000000004],[0.83746875,0.51803125],[0.844421875,0.545328125]],[[0.851375,0.572625],[0.855,0.6025],[0.855,0.635]],[[0.855,0.67625],[0.8459375,0.715625],[0.8290625,0.751484375]],[[0.8121875000000001,0.78734375],[0.7875000000000001,0.8196875],[0.75625,0.846875]],[[0.725,0.8740625],[0.6871875,0.89609375],[0.6440625,0.911328125]],[[0.6009375,0.9265625],[0.5525,0.935],[0.5,0.935]],[[0.4475,0.935],[0.3990625,0.9265625],[0.3559375,0.911328125]],[[0.31281249999999994,0.89609375],[0.275,0.8740625],[0.24375000000000002,0.846875]],[[0.21250000000000002,0.8196875],[0.18781249999999994,0.78734375],[0.17093749999999996,0.751484375]],[[0.1540625,0.715625],[0.14500000000000002,0.67625],[0.14500000000000002,0.635]],[[0.14500000000000002,0.6025],[0.148625,0.572625],[0.155578125,0.545328125]],[[0.16253125000000002,0.51803125],[0.17281250000000004,0.49331250000000004],[0.18612499999999998,0.471125]],[[0.19943749999999993,0.4489375],[0.21578125000000004,0.42928125000000006],[0.2348593750000001,0.412109375]],[[0.25393750000000004,0.39493750000000005],[0.27575000000000005,0.38025],[0.30000000000000004,0.368]],[[0.3087500000000001,0.36349999999999993],[0.32000000000000006,0.36012500000000003],[0.333359375,0.35759375000000004]],[[0.34671874999999996,0.35506250000000006],[0.3621875,0.353375],[0.379375,0.35224999999999995]],[[0.39656250000000004,0.3511249999999999],[0.41546875000000005,0.3505624999999999],[0.4357031250000001,0.3502812499999999]],[[0.4559375000000001,0.35],[0.47750000000000004,0.35],[0.5,0.35]]]},"heart":{"start":[0.5,0.425],"curves":[[[0.52,0.425],[0.545,0.377],[0.58,0.355]],[[0.61,0.336],[0.65,0.33],[0.685,0.33]],[[0.727,0.33],[0.76,0.344],[0.785,0.365]],[[0.815,0.39],[0.843,0.413],[0.85,0.44]],[[0.857,0.467],[0.862,0.49],[0.86,0.52]],[[0.858,0.553],[0.844,0.586],[0.825,0.615]],[[0.805,0.645],[0.788,0.67],[0.765,0.695]],[[0.742,0.72],[0.715,0.746],[0.69,0.77]],[[0.663,0.796],[0.631,0.825],[0.605,0.85]],[[0.585,0.869],[0.572,0.882],[0.555,0.895]],[[0.542,0.905],[0.532,0.914],[0.52,0.92]],[[0.513,0.923],[0.507,0.925],[0.5,0.925]],[[0.493,0.925],[0.487,0.923],[0.48,0.92]],[[0.46799999999999997,0.914],[0.45799999999999996,0.905],[0.44499999999999995,0.895]],[[0.42800000000000005,0.882],[0.41500000000000004,0.869],[0.395,0.85]],[[0.369,0.825],[0.33699999999999997,0.796],[0.31000000000000005,0.77]],[[0.28500000000000003,0.746],[0.258,0.72],[0.235,0.695]],[[0.21199999999999997,0.67],[0.19499999999999995,0.645],[0.17500000000000004,0.615]],[[0.15600000000000003,0.586],[0.14200000000000002,0.553],[0.14,0.52]],[[0.138,0.49],[0.14300000000000002,0.467],[0.15000000000000002,0.44]],[[0.15700000000000003,0.413],[0.18500000000000005,0.39],[0.21499999999999997,0.365]],[[0.24,0.344],[0.273,0.33],[0.31499999999999995,0.33]],[[0.35,0.33],[0.39,0.336],[0.42000000000000004,0.355]],[[0.45499999999999996,0.377],[0.48,0.425],[0.5,0.425]]]},"dumbbell":{"start":[0.5,0.52],"curves":[[[0.55,0.52],[0.6,0.52],[0.625,0.52]],[[0.642,0.52],[0.65,0.512],[0.65,0.495]],[[0.65,0.465],[0.65,0.42],[0.65,0.39]],[[0.65,0.367],[0.662,0.355],[0.685,0.355]],[[0.72,0.355],[0.77,0.355],[0.8,0.355]],[[0.835,0.355],[0.855,0.375],[0.855,0.41]],[[0.855,0.52],[0.855,0.685],[0.855,0.795]],[[0.855,0.83],[0.835,0.85],[0.8,0.85]],[[0.765,0.85],[0.72,0.85],[0.685,0.85]],[[0.662,0.85],[0.65,0.838],[0.65,0.815]],[[0.65,0.79],[0.65,0.76],[0.65,0.735]],[[0.65,0.715],[0.61,0.72],[0.5,0.72]],[[0.39,0.72],[0.35,0.715],[0.35,0.735]],[[0.35,0.76],[0.35,0.79],[0.35,0.815]],[[0.35,0.838],[0.33799999999999997,0.85],[0.31499999999999995,0.85]],[[0.28,0.85],[0.235,0.85],[0.19999999999999996,0.85]],[[0.16500000000000004,0.85],[0.14500000000000002,0.83],[0.14500000000000002,0.795]],[[0.14500000000000002,0.685],[0.14500000000000002,0.52],[0.14500000000000002,0.41]],[[0.14500000000000002,0.375],[0.16500000000000004,0.355],[0.19999999999999996,0.355]],[[0.22999999999999998,0.355],[0.28,0.355],[0.31499999999999995,0.355]],[[0.33799999999999997,0.355],[0.35,0.367],[0.35,0.39]],[[0.35,0.42],[0.35,0.465],[0.35,0.495]],[[0.35,0.512],[0.358,0.52],[0.375,0.52]],[[0.4,0.52],[0.44999999999999996,0.52],[0.5,0.52]]]},"hourglass":{"start":[0.5,0.335],"curves":[[[0.57,0.335],[0.63,0.335],[0.68,0.335]],[[0.76,0.335],[0.795,0.35],[0.795,0.385]],[[0.795,0.41],[0.805,0.425],[0.785,0.445]],[[0.765,0.465],[0.72,0.485],[0.69,0.51]],[[0.66,0.535],[0.64,0.565],[0.63,0.585]],[[0.623,0.598],[0.62,0.607],[0.62,0.62]],[[0.62,0.634],[0.626,0.648],[0.635,0.66]],[[0.655,0.688],[0.675,0.71],[0.705,0.735]],[[0.74,0.762],[0.785,0.785],[0.795,0.81]],[[0.807,0.838],[0.807,0.862],[0.785,0.875]],[[0.76,0.902],[0.715,0.915],[0.665,0.915]],[[0.615,0.915],[0.56,0.915],[0.5,0.915]],[[0.43999999999999995,0.915],[0.385,0.915],[0.33499999999999996,0.915]],[[0.28500000000000003,0.915],[0.24,0.902],[0.21499999999999997,0.875]],[[0.19299999999999995,0.862],[0.19299999999999995,0.838],[0.20499999999999996,0.81]],[[0.21499999999999997,0.785],[0.26,0.762],[0.29500000000000004,0.735]],[[0.32499999999999996,0.71],[0.345,0.688],[0.365,0.66]],[[0.374,0.648],[0.38,0.634],[0.38,0.62]],[[0.38,0.607],[0.377,0.598],[0.37,0.585]],[[0.36,0.565],[0.33999999999999997,0.535],[0.31000000000000005,0.51]],[[0.28,0.485],[0.235,0.465],[0.21499999999999997,0.445]],[[0.19499999999999995,0.425],[0.20499999999999996,0.41],[0.20499999999999996,0.385]],[[0.20499999999999996,0.35],[0.24,0.335],[0.31999999999999995,0.335]],[[0.37,0.335],[0.43000000000000005,0.335],[0.5,0.335]]]},"rocket":{"start":[0.5,0.17],"curves":[[[0.517,0.17],[0.535,0.193],[0.55,0.215]],[[0.575,0.25],[0.6,0.272],[0.615,0.3]],[[0.635,0.338],[0.655,0.375],[0.665,0.415]],[[0.675,0.455],[0.682,0.495],[0.685,0.535]],[[0.688,0.569],[0.686,0.6],[0.69,0.625]],[[0.697,0.65],[0.745,0.673],[0.77,0.7]],[[0.803,0.736],[0.835,0.795],[0.84,0.83]],[[0.843,0.85],[0.849,0.869],[0.835,0.865]],[[0.811,0.862],[0.785,0.86],[0.76,0.85]],[[0.733,0.84],[0.702,0.8],[0.68,0.79]],[[0.669,0.838],[0.66,0.868],[0.635,0.875]],[[0.607,0.885],[0.545,0.885],[0.5,0.885]],[[0.45499999999999996,0.885],[0.393,0.885],[0.365,0.875]],[[0.33999999999999997,0.868],[0.33099999999999996,0.838],[0.31999999999999995,0.79]],[[0.29800000000000004,0.8],[0.267,0.84],[0.24,0.85]],[[0.21499999999999997,0.86],[0.18899999999999995,0.862],[0.16500000000000004,0.865]],[[0.15100000000000002,0.869],[0.15700000000000003,0.85],[0.16000000000000003,0.83]],[[0.16500000000000004,0.795],[0.19699999999999995,0.736],[0.22999999999999998,0.7]],[[0.255,0.673],[0.30300000000000005,0.65],[0.31000000000000005,0.625]],[[0.31399999999999995,0.6],[0.31200000000000006,0.569],[0.31499999999999995,0.535]],[[0.31799999999999995,0.495],[0.32499999999999996,0.455],[0.33499999999999996,0.415]],[[0.345,0.375],[0.365,0.338],[0.385,0.3]],[[0.4,0.272],[0.42500000000000004,0.25],[0.44999999999999996,0.215]],[[0.46499999999999997,0.193],[0.483,0.17],[0.5,0.17]]]}};

// The same attention, breathing, expression and blink controller as the app.
const GOALS = [
    { id: "front", x: 0, y: 0 },
    { id: "up", x: 0, y: -1 },
    { id: "down", x: 0, y: 1 },
    { id: "up-left", x: -0.8, y: -0.85 },
    { id: "up-right", x: 0.8, y: -0.85 },
    { id: "down-left", x: -0.8, y: 0.85 },
    { id: "down-right", x: 0.8, y: 0.85 },
    { id: "left", x: -1, y: 0 },
    { id: "right", x: 1, y: 0 },
];
const EXPRESSIONS = ["open", "smile", "surprised", "soft", "skeptical"];
function eyeExpression(pose) {
    "worklet";
    return {
        eyeScaleX: pose.eyeScaleX,
        leftEyeScaleY: pose.leftEyeScaleY,
        rightEyeScaleY: pose.rightEyeScaleY,
        eyeSpacing: pose.eyeSpacing,
        eyeTilt: pose.eyeTilt,
        leftEyeSmile: pose.leftEyeSmile,
        rightEyeSmile: pose.rightEyeSmile,
    };
}
function sample(record) {
    "worklet";
    // Advance only at an attention/blink boundary. The frame rate never chooses
    // a new expression, and a seed can reproduce an entire performance for QA.
    record.seed = (record.seed * 16807) % 2147483647;
    return (record.seed - 1) / 2147483646;
}
function clamp(value, limit = 1) {
    "worklet";
    return Math.min(limit, Math.max(-limit, value));
}
function ease(value) {
    "worklet";
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
}
function chooseExpression(record) {
    "worklet";
    const start = Math.floor(sample(record) * EXPRESSIONS.length);
    let kind = EXPRESSIONS[start];
    if (kind === record.expressionKind)
        kind = EXPRESSIONS[(start + 1) % EXPRESSIONS.length];
    const side = sample(record) > 0.5 ? 1 : -1;
    const amount = sample(record);
    const focused = record.mode === "curious";
    record.expressionKind = kind;
    record.expressionFrom = eyeExpression(record.pose);
    record.expressionElapsed = 0;
    record.expressionDuration = 190 + sample(record) * 190;
    record.expressionNext = 720 + sample(record) * (focused ? 790 : 620);
    const expression = {
        eyeScaleX: 1.04 + amount * 0.12,
        leftEyeScaleY: 1.02 + side * 0.035,
        rightEyeScaleY: 1.02 - side * 0.035,
        eyeSpacing: 0.96 + amount * 0.045,
        eyeTilt: side * 0.025,
        leftEyeSmile: 0,
        rightEyeSmile: 0,
    };
    if (kind === "smile") {
        expression.eyeScaleX = 1.19 + amount * 0.18;
        expression.leftEyeScaleY = 0.92 + amount * 0.13;
        expression.rightEyeScaleY = 1.02 - amount * 0.12;
        expression.leftEyeSmile = 0.81 + amount * 0.19;
        expression.rightEyeSmile = 0.96 - amount * 0.12;
        expression.eyeTilt = side * 0.065;
    }
    else if (kind === "surprised") {
        expression.eyeScaleX = focused ? 1.23 : 1.39 + amount * 0.17;
        expression.leftEyeScaleY = 1.19 + amount * 0.12;
        expression.rightEyeScaleY = 1.24 - amount * 0.05;
        expression.eyeSpacing = 1.04;
    }
    else if (kind === "skeptical") {
        expression.eyeScaleX = 1.18 + amount * 0.11;
        expression.leftEyeScaleY = side < 0 ? 0.47 : 1.08;
        expression.rightEyeScaleY = side > 0 ? 0.47 : 1.08;
        expression.eyeTilt = side * 0.13;
        expression.leftEyeSmile = side < 0 ? 0.17 : 0;
        expression.rightEyeSmile = side > 0 ? 0.17 : 0;
    }
    else if (kind === "soft") {
        expression.eyeScaleX = 1.12 + amount * 0.09;
        expression.leftEyeScaleY = 0.79 + amount * 0.08;
        expression.rightEyeScaleY = 0.84 - amount * 0.06;
        expression.leftEyeSmile = 0.3 + amount * 0.13;
        expression.rightEyeSmile = 0.43 - amount * 0.13;
    }
    record.expressionTarget = expression;
}
function beginGoal(record, id, point, kind) {
    "worklet";
    const x = clamp(point.x);
    const y = clamp(point.y);
    const follow = Math.max(0, Math.min(1, point.bodyFollow ?? 0.85));
    const eyesOnly = kind === "eyes" || follow === 0;
    record.beforePreviousGoalId = record.previousGoalId;
    record.previousGoalId = record.goalId;
    record.goalId = id;
    record.goalKind = kind;
    record.goalElapsed = 0;
    const durationScale = record.preset === "showcase" ? 1 : record.preset === "chat" ? 1.2 : 1.3;
    record.goalDuration = (1100 + sample(record) * 1250) * durationScale;
    if (kind === "profile")
        record.goalDuration += 350;
    record.bodyDelay = 170 + sample(record) * 210;
    record.bodyDuration = 410 + sample(record) * 310;
    record.eyeDuration = 85 + sample(record) * 65;
    record.eyeElapsed = 0;
    record.eyeFromX = record.pose.gazeX;
    record.eyeFromY = record.pose.gazeY;
    record.eyeToX = x * (0.052 + sample(record) * 0.01);
    record.eyeToY = y * (0.062 + sample(record) * 0.011);
    record.correctionAt = 320 + sample(record) * 230;
    record.correctionCount = 0;
    record.profileRedirected = false;
    record.goalsWithoutVertical = Math.abs(y) > 0.5 ? 0 : record.goalsWithoutVertical + 1;
    record.goalsWithoutEyes = eyesOnly ? 0 : record.goalsWithoutEyes + 1;
    record.goalsWithoutProfile = kind === "profile" ? 0 : record.goalsWithoutProfile + 1;
    // Carry the actual body posture into the next goal. An eye-only glance can
    // inspect above/below while Pumpy keeps the same turned or tilted body.
    record.from = { ...record.pose };
    const yaw = kind === "profile" ? x * (0.79 + sample(record) * 0.1) : x * 0.65 * follow;
    const pitch = -y * 0.22 * follow; // Positive pitch raises the face in the renderer.
    const squint = kind === "profile" ? 0.06 : y > 0.5 ? 0.07 : -0.035;
    record.target = {
        ...REST_CHARACTER_ACT,
        yaw: eyesOnly ? record.pose.yaw : yaw,
        pitch: eyesOnly ? record.pose.pitch : pitch,
        rotation: eyesOnly ? record.pose.rotation : x * 0.045 - y * 0.015,
        x: eyesOnly ? record.pose.x : x * 0.014 * follow,
        y: eyesOnly ? clamp(record.pose.y, 0.012) : -0.006 - Math.abs(y) * 0.006,
        gazeX: record.eyeToX,
        gazeY: record.eyeToY,
        eyeScaleX: 1.04 + sample(record) * 0.13,
        leftEyeScaleY: 1 - squint + x * 0.055,
        rightEyeScaleY: 1 - squint - x * 0.055,
        eyeSpacing: 1 - Math.abs(x) * 0.045,
        eyeTilt: x * 0.035,
    };
    if (record.expressionElapsed >= record.expressionDuration || record.elapsed === 0)
        chooseExpression(record);
}
function chooseGoal(record) {
    "worklet";
    // A random starting index plus exclusion gives variety without unbounded
    // retry loops on the UI thread or the same left/right itinerary each mount.
    const start = Math.floor(sample(record) * GOALS.length);
    const focused = record.mode === "curious";
    const needsVertical = record.goalsWithoutVertical >= 2;
    const needsProfile = !focused && !needsVertical && record.goalsWithoutProfile >= 5;
    let selected;
    for (let pass = 0; pass < 2 && !selected; pass += 1) {
        for (let offset = 0; offset < GOALS.length; offset += 1) {
            const candidate = GOALS[(start + offset) % GOALS.length];
            if (candidate.id === record.goalId || candidate.id === record.previousGoalId)
                continue;
            if (focused && candidate.y < 0.5)
                continue;
            // If both side targets were just used, defer the profile instead of
            // repeating one. Context and the two-target memory take precedence.
            if (pass === 0 && needsVertical && Math.abs(candidate.y) < 0.5)
                continue;
            if (pass === 0 && needsProfile && Math.abs(candidate.x) < 1)
                continue;
            selected = candidate;
            break;
        }
    }
    if (!selected)
        return;
    const side = Math.abs(selected.x) === 1;
    const profile = !focused && side && (needsProfile || sample(record) > 0.35);
    const eyesOnly = focused || (!profile && (record.goalsWithoutEyes >= 2 || sample(record) < 0.42));
    beginGoal(record, selected.id, selected, profile ? "profile" : eyesOnly ? "eyes" : "look");
}
function createCharacterAttention(seed = 1) {
    "worklet";
    const safeSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 1;
    const record = {
        seed: safeSeed % 2147483646 + 1,
        mode: "", preset: "expressive", elapsed: 0,
        goalId: "front", previousGoalId: "front", beforePreviousGoalId: "front",
        goalKind: "look", goalElapsed: 0, goalDuration: 0,
        goalsWithoutVertical: 0, goalsWithoutEyes: 0, goalsWithoutProfile: 0,
        from: { ...REST_CHARACTER_ACT }, target: { ...REST_CHARACTER_ACT }, pose: { ...REST_CHARACTER_ACT },
        bodyDelay: 0, bodyDuration: 1, eyeElapsed: 0, eyeDuration: 1,
        eyeFromX: 0, eyeFromY: 0, eyeToX: 0, eyeToY: 0,
        correctionAt: 0, correctionCount: 0, profileRedirected: false,
        expressionKind: "open",
        expressionFrom: eyeExpression(REST_CHARACTER_ACT), expressionTarget: eyeExpression(REST_CHARACTER_ACT),
        expressionElapsed: 0, expressionDuration: 1, expressionNext: 0,
        blinkWait: 0, blinkElapsed: -1, blinkDuration: 200, doubleBlinkPending: false,
        breathPeriod: 0, breathPhase: 0,
    };
    record.blinkWait = 950 + sample(record) * 2450;
    record.breathPeriod = 3100 + sample(record) * 1450;
    record.breathPhase = sample(record) * Math.PI * 2;
    chooseGoal(record);
    return record;
}
/** Call for each real selection/tap event, even when its coordinates repeat. */
function directCharacterAttention(current, target) {
    "worklet";
    const record = { ...current };
    beginGoal(record, "context", target, "context");
    return record;
}
function stepCharacterAttention(current, deltaMs, mode, preset = "expressive") {
    "worklet";
    const record = { ...current };
    const delta = Math.max(0, Math.min(80, deltaMs));
    record.preset = preset;
    record.elapsed += delta;
    const normalizedMode = mode === "attentive" || mode === "success" ? "idle" : mode;
    if (record.mode !== normalizedMode) {
        const entering = record.mode !== "";
        record.mode = normalizedMode;
        if (mode === "thinking") {
            beginGoal(record, "context", { x: sample(record) > 0.5 ? 0.55 : -0.55, y: -0.95 }, "look");
        }
        else if (entering || mode === "curious") {
            chooseGoal(record);
        }
    }
    record.goalElapsed += delta;
    record.eyeElapsed += delta;
    record.expressionElapsed += delta;
    if (record.goalElapsed >= record.goalDuration)
        chooseGoal(record);
    if (record.expressionElapsed >= record.expressionNext)
        chooseExpression(record);
    if (record.goalElapsed >= record.correctionAt) {
        record.eyeFromX = record.pose.gazeX;
        record.eyeFromY = record.pose.gazeY;
        record.eyeElapsed = 0;
        record.eyeDuration = 65 + sample(record) * 65;
        if (record.goalKind === "profile" && !record.profileRedirected
            && record.goalElapsed >= record.bodyDelay + record.bodyDuration) {
            // Keep the silhouette turned and look back toward the viewer, or look
            // above/below the shoulder. This is deliberately an eyes-only action.
            const sign = record.target.yaw < 0 ? -1 : 1;
            record.eyeToX = -sign * (0.02 + sample(record) * 0.025);
            record.eyeToY = (sample(record) > 0.5 ? 1 : -1) * (0.037 + sample(record) * 0.026);
            record.profileRedirected = true;
        }
        else {
            record.eyeToX = clamp(record.target.gazeX + (sample(record) - 0.5) * 0.027, 0.063);
            record.eyeToY = clamp(record.target.gazeY + (sample(record) - 0.5) * 0.03, 0.072);
        }
        record.correctionCount += 1;
        record.correctionAt += 310 + sample(record) * 310;
    }
    let blink = 0;
    if (record.blinkElapsed < 0) {
        record.blinkWait -= delta;
        if (record.blinkWait <= 0) {
            record.blinkElapsed = 0;
            record.blinkDuration = 170 + sample(record) * 65;
        }
    }
    else {
        record.blinkElapsed += delta;
        const progress = record.blinkElapsed / record.blinkDuration;
        blink = progress < 0.32 ? ease(progress / 0.32) : 1 - ease((progress - 0.32) / 0.68);
        if (progress >= 1) {
            record.blinkElapsed = -1;
            if (record.doubleBlinkPending) {
                record.doubleBlinkPending = false;
                record.blinkWait = 2000 + sample(record) * 4200;
            }
            else if (sample(record) < 0.21) {
                record.doubleBlinkPending = true;
                record.blinkWait = 85 + sample(record) * 100;
            }
            else {
                record.blinkWait = 2000 + sample(record) * 4200;
            }
        }
    }
    const body = ease((record.goalElapsed - record.bodyDelay) / record.bodyDuration);
    const expression = ease(record.expressionElapsed / record.expressionDuration);
    const eyes = ease(record.eyeElapsed / record.eyeDuration);
    const from = record.from;
    const target = record.target;
    const eyeFrom = record.expressionFrom;
    const eyeTarget = record.expressionTarget;
    const breath = Math.sin(record.elapsed / record.breathPeriod * Math.PI * 2 + record.breathPhase);
    // Tiny continuous adjustments connect the quick saccades and expressions.
    // Their independent periods never restart when a goal or a UI cue changes.
    const eyeDriftX = Math.sin(record.elapsed / 293 + record.breathPhase) * 0.002;
    const eyeDriftY = Math.sin(record.elapsed / 367 + record.breathPhase * 0.7) * 0.0027;
    const aperture = Math.sin(record.elapsed / 241 + record.breathPhase) * 0.025;
    record.pose = {
        ...REST_CHARACTER_ACT,
        yaw: from.yaw + (target.yaw - from.yaw) * body,
        pitch: from.pitch + (target.pitch - from.pitch) * body,
        rotation: from.rotation + (target.rotation - from.rotation) * body,
        x: from.x + (target.x - from.x) * body,
        y: from.y + (target.y - from.y) * body,
        scaleX: 1 - breath * 0.004,
        scaleY: 1 + breath * 0.007,
        gazeX: clamp(record.eyeFromX + (record.eyeToX - record.eyeFromX) * eyes + eyeDriftX, 0.065),
        gazeY: clamp(record.eyeFromY + (record.eyeToY - record.eyeFromY) * eyes + eyeDriftY, 0.075),
        eyeScaleX: eyeFrom.eyeScaleX + (eyeTarget.eyeScaleX - eyeFrom.eyeScaleX) * expression + aperture * 0.5,
        leftEyeScaleY: eyeFrom.leftEyeScaleY + (eyeTarget.leftEyeScaleY - eyeFrom.leftEyeScaleY) * expression + aperture,
        rightEyeScaleY: eyeFrom.rightEyeScaleY + (eyeTarget.rightEyeScaleY - eyeFrom.rightEyeScaleY) * expression - aperture * 0.7,
        eyeSpacing: eyeFrom.eyeSpacing + (eyeTarget.eyeSpacing - eyeFrom.eyeSpacing) * expression,
        eyeTilt: eyeFrom.eyeTilt + (eyeTarget.eyeTilt - eyeFrom.eyeTilt) * expression,
        leftEyeSmile: eyeFrom.leftEyeSmile + (eyeTarget.leftEyeSmile - eyeFrom.leftEyeSmile) * expression,
        rightEyeSmile: eyeFrom.rightEyeSmile + (eyeTarget.rightEyeSmile - eyeFrom.rightEyeSmile) * expression,
        leftWink: blink,
        rightWink: blink,
    };
    return record;
}
const NS = 'http://www.w3.org/2000/svg';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const actors = new Set();
let serial = 0;

function contourPath(contour) {
  const point = ([x, y]) => `${(x * 1000).toFixed(3)} ${(y * 1000).toFixed(3)}`;
  return `M${point(contour.start)} ${contour.curves.map((curve) => 'C' + curve.map(point).join(' ')).join(' ')} Z`;
}
function blendContour(from, to, amount) {
  const blend = (a, b) => [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
  return { start: blend(from.start, to.start), curves: from.curves.map((curve, i) => curve.map((point, j) => blend(point, to.curves[i][j]))) };
}
// Match the body's 24 cubic segments so the scroll morph never swaps silhouettes.
const DOT_CONTOUR = (() => {
  const count = APP_CONTOURS.kettlebell.curves.length;
  const radius = .3, step = Math.PI * 2 / count, control = 4 / 3 * Math.tan(step / 4);
  const point = (a) => [.5 + radius * Math.cos(a), .635 + radius * Math.sin(a)];
  return { start: point(-Math.PI / 2), curves: Array.from({length: count}, (_, i) => {
    const a = -Math.PI / 2 + i * step, b = a + step, from = point(a), to = point(b);
    return [[from[0] - radius * control * Math.sin(a), from[1] + radius * control * Math.cos(a)],
      [to[0] + radius * control * Math.sin(b), to[1] - radius * control * Math.cos(b)], to];
  }) };
})();
function bodyPath(act, inversion) {
  let contour = inversion > .0001 ? blendContour(APP_CONTOURS.kettlebell, APP_CONTOURS.invertedKettlebell, inversion) : APP_CONTOURS.kettlebell;
  let weight = Math.max(0, 1 - act.dumbbell - act.hourglass - act.heart - act.rocket);
  for (const key of ['dumbbell', 'hourglass', 'heart', 'rocket']) {
    if (act[key] <= 0) continue;
    const total = weight + act[key];
    contour = weight <= 0 ? APP_CONTOURS[key] : blendContour(contour, APP_CONTOURS[key], act[key] / total);
    weight = total;
  }
  return contourPath(act.dot > 0 ? blendContour(contour, DOT_CONTOUR, act.dot) : contour);
}
function eyePath(cx, cy, width, height, smile) {
  const amount = Math.min(1, Math.max(0, smile));
  const hw = width / 2 * (1 + amount * .5), hh = height / 2;
  const side = hh * amount * .32, top = -hh * (1 - amount * .42), bottom = hh * (1 - amount * 1.12);
  const upper = -hh * (.552 - amount * .26), lower = hh * (.552 - amount * .06);
  return `M${cx - hw} ${cy + side} C${cx - hw} ${cy + upper} ${cx - hw * .552} ${cy + top} ${cx} ${cy + top} C${cx + hw * .552} ${cy + top} ${cx + hw} ${cy + upper} ${cx + hw} ${cy + side} C${cx + hw} ${cy + lower} ${cx + hw * .552} ${cy + bottom} ${cx} ${cy + bottom} C${cx - hw * .552} ${cy + bottom} ${cx - hw} ${cy + lower} ${cx - hw} ${cy + side} Z`;
}
function createCharacter(host) {
  const id = `pumpy-actor-${++serial}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = `<defs>
    <clipPath id="${id}-clip"><path data-body/></clipPath>
  </defs><g data-actor>
    <g data-handle fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path data-handle-path stroke="var(--pumpy-body)" stroke-width="90"/>
    </g>
    <g data-volume>
      <path data-body fill="var(--pumpy-body)"/>
      <g clip-path="url(#${id}-clip)">
        <g data-face fill="var(--pumpy-eyes)">
          <g data-left><path data-left-eye/></g>
          <g data-right><path data-right-eye/></g>
        </g>
      </g>
    </g>
  </g>`;
  svg.querySelectorAll('[data-handle-path]').forEach((path) => path.setAttribute('d', 'M360 395 L321 288 C299 226 330 190 398 190 L602 190 C670 190 701 226 679 288 L640 395'));
  host.appendChild(svg);
  const actor = {
    host, svg, attention: createCharacterAttention(20261022 + serial * 327), visible: true,
    elapsed: 0, sequence: 'notice', sequenceElapsed: 0, gestureAt: 6500 + serial * 1700,
    currentAct: { ...REST_CHARACTER_ACT }, sequenceOrigin: { ...REST_CHARACTER_ACT },
    gestureIndex: 0,
    body: [...svg.querySelectorAll('[data-body]')],
    group: svg.querySelector('[data-actor]'), volume: svg.querySelector('[data-volume]'),
    handle: svg.querySelector('[data-handle]'), face: svg.querySelector('[data-face]'),
    left: svg.querySelector('[data-left]'), right: svg.querySelector('[data-right]'),
    leftEyes: [...svg.querySelectorAll('[data-left-eye]')], rightEyes: [...svg.querySelectorAll('[data-right-eye]')],
  };
  if (host.matches('button')) host.addEventListener('click', () => {
    actor.sequenceOrigin = { ...actor.currentAct };
    actor.sequence = ['wink', 'hop', 'heart', 'spin'][actor.gestureIndex++ % 4];
    actor.sequenceElapsed = 0;
  });
  host.addEventListener('pointerenter', () => {
    actor.attention = directCharacterAttention(actor.attention, {x: 0, y: -.25, bodyFollow: .5});
  });
  host.addEventListener('pumpy:celebrate', () => {
    actor.celebrationStarted = performance.now();
  });
  host.addEventListener('pumpy:read-pose', (event) => {
    event.detail.pose = { ...actor.currentAct };
  });
  // A live hero can become the same fixed scroll actor after mounting.
  host.addEventListener('pumpy:scroll-pose', (event) => {
    draw(actor, { ...REST_CHARACTER_ACT, ...event.detail });
  });
  actors.add(actor);
  visibility.observe(host);
  draw(actor, REST_CHARACTER_ACT);
}
function draw(actor, act) {
  actor.lastRequestedAct = act;
  if (actor.celebrationStarted !== undefined && !act.surface) {
    const elapsed = performance.now() - actor.celebrationStarted;
    const amount = reduceMotion.matches ? 1 : Math.min(1, elapsed / 350, Math.max(0, (2400 - elapsed) / 450));
    act = blendAct(act, { ...REST_CHARACTER_ACT, heart: 1, leftEyeSmile: 1, rightEyeSmile: 1 }, amount);
  }
  if (act.surface) {
    // The same central body becomes the reply surface, with pixel-accurate corners.
    const { width: w, height: h, radius: r, tail: tailRadius } = act.surface;
    const surfaceKey = `${w}:${h}:${r}:${tailRadius}`;
    if (actor.surfaceKey === surfaceKey) return;
    actor.surfaceKey = surfaceKey;
    const tail = Math.min(tailRadius, w / 2, h / 2);
    const d = `M${r} 0 H${w-r} A${r} ${r} 0 0 1 ${w} ${r} V${h-r} A${r} ${r} 0 0 1 ${w-r} ${h} H${tail} A${tail} ${tail} 0 0 1 0 ${h-tail} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`;
    actor.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    actor.group.removeAttribute('transform');
    actor.volume.removeAttribute('transform');
    actor.handle.setAttribute('opacity', '0');
    actor.face.setAttribute('opacity', '0');
    actor.body.forEach((path) => path.setAttribute('d', d));
    return;
  }
  actor.surfaceKey = null;
  actor.svg.setAttribute('viewBox', '0 0 1000 1000');
  const cosYaw = Math.cos(act.yaw), cosPitch = Math.cos(act.pitch);
  const sinYaw = Math.sin(act.yaw), sinPitch = Math.sin(act.pitch);
  const inversion = (1 - cosPitch) / 2;
  const morph = act.dumbbell + act.hourglass + act.heart + act.rocket;
  const d = bodyPath(act, inversion);
  actor.body.forEach((path) => path.setAttribute('d', d));
  actor.group.setAttribute('transform', `translate(${act.x * 1000} ${act.y * 1000}) translate(500 500) rotate(${act.rotation * 180 / Math.PI}) scale(${Math.min(1.13, act.scaleX)} ${Math.min(1.13, act.scaleY)}) translate(-500 -500)`);
  actor.volume.setAttribute('transform', `translate(0 ${-105 * (1 - cosPitch)}) translate(500 635) scale(${.88 + .12 * Math.abs(cosYaw)} ${.94 + .06 * Math.abs(cosPitch)}) translate(-500 -635)`);
  actor.handle.setAttribute('opacity', String(Math.max(0, 1 - morph) ** 2 * (1 - (act.dot || 0))));
  actor.handle.setAttribute('transform', `translate(${sinYaw * 18} ${70 * morph + 230 * (1 - cosPitch)}) translate(500 300) scale(${(1 - morph * .42) * (.12 + .88 * Math.abs(cosYaw))} ${(1 - morph * .6) * cosPitch}) translate(-500 -300)`);
  const visibilityAmount = Math.max(0, Math.min(1, cosYaw * cosPitch / .35));
  actor.face.setAttribute('opacity', String(visibilityAmount * visibilityAmount * (3 - 2 * visibilityAmount) * (1 - (act.dot || 0))));
  actor.face.setAttribute('transform', `translate(${sinYaw * 240} ${1000 * (act.hourglass * .1 - act.rocket * .025 - act.heart * .015 - .015 * (cosPitch - 1) - sinPitch * .24)}) translate(500 620) scale(${(1 - act.dumbbell * .36 - act.hourglass * .3 - act.rocket * .22) * cosYaw} ${(1 - act.dumbbell * .48 - act.hourglass * .48 - act.rocket * .24) * cosPitch}) translate(-500 -620)`);
  for (const [side, center, wink, smile, eyeY] of [['left', 385, act.leftWink, act.leftEyeSmile, act.leftEyeScaleY], ['right', 615, act.rightWink, act.rightEyeSmile, act.rightEyeScaleY]]) {
    const width = Math.max(.5, 88 * act.eyeScaleX);
    const height = Math.max(.5, 200 * eyeY * Math.max(.06, 1 - wink * .94));
    const spacing = (side === 'left' ? -115 : 115) * (act.eyeSpacing - 1);
    actor[side].setAttribute('transform', `translate(${spacing + act.gazeX * 1000} ${act.gazeY * 1000}) rotate(${(.12 + act.eyeTilt) * 180 / Math.PI} ${center} 620)`);
    actor[`${side}Eyes`].forEach((path) => path.setAttribute('d', eyePath(center, 620, width, height, smile)));

  }
}
const visibility = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    for (const actor of actors) if (actor.host === entry.target) actor.visible = entry.isIntersecting;
  });
}, {rootMargin: '80px'});
function mountCharacters() {
  for (const actor of actors) if (!actor.host.isConnected) {
    visibility.unobserve(actor.host);
    actors.delete(actor);
  }
  document.querySelectorAll('img[src$="/pumpy.svg"]').forEach((image) => {
    const host = document.createElement('span');
    host.className = `${image.className} pumpy-live`;
    host.style.setProperty('--pumpy-size', `${image.getAttribute('width') || 28}px`);
    if (image.alt) { host.setAttribute('role', 'img'); host.setAttribute('aria-label', image.alt); }
    else host.setAttribute('aria-hidden', 'true');
    image.replaceWith(host);
  });
  document.querySelectorAll('.pumpy-live:not([data-mounted])').forEach((host) => {
    host.dataset.mounted = 'true';
    createCharacter(host);
  });
}
mountCharacters();
new MutationObserver((records) => {
  // Text reveals and moving chart nodes do not change the character inventory.
  // Check added/removed element subtrees so dynamic mounts and cleanup still work.
  const selector = 'img[src$="/pumpy.svg"], .pumpy-live';
  const changed = records.some((record) => {
    for (const nodes of [record.addedNodes, record.removedNodes]) {
      for (const node of nodes) {
        if (node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector))) return true;
      }
    }
    return false;
  });
  if (changed) mountCharacters();
}).observe(document.body, {childList: true, subtree: true});
let previous = 0;
function blendAct(from, to, amount) {
  const weight = Math.min(1, Math.max(0, amount));
  const eased = weight * weight * (3 - 2 * weight);
  const result = { ...to };
  for (const key of ACT_KEYS) {
    const raw = to[key] - from[key];
    const difference = key === 'yaw' || key === 'pitch' ? Math.atan2(Math.sin(raw), Math.cos(raw)) : raw;
    result[key] = from[key] + difference * eased;
  }
  return result;
}
function frame(time) {
  const delta = Math.max(0, Math.min(previous ? time - previous : 16.67, 40));
  previous = time;
  if (!document.hidden) for (const actor of actors) {
    if (actor.celebrationStarted !== undefined) {
      if (time - actor.celebrationStarted >= 2400) delete actor.celebrationStarted;
      draw(actor, actor.lastRequestedAct || actor.currentAct);
      if (actor.celebrationStarted !== undefined) continue;
    }
    if (!actor.visible || actor.host.hasAttribute('data-scroll-actor') || actor.host.hasAttribute('data-scroll-suspended')) continue;
    if (reduceMotion.matches) {
      if (!actor.reduced) draw(actor, REST_CHARACTER_ACT);
      actor.reduced = true;
      continue;
    }
    actor.reduced = false;
    actor.elapsed += delta;
    actor.attention = stepCharacterAttention(actor.attention, delta, 'idle', 'showcase');
    let act = actor.attention.pose;
    if (!actor.sequence && actor.elapsed >= actor.gestureAt) {
      const gestures = ['glance-left', 'wink', 'hop', 'glance-right', 'proud', 'spin', 'heart'];
      actor.sequenceOrigin = { ...actor.currentAct };
      actor.sequence = gestures[actor.gestureIndex++ % gestures.length];
      actor.sequenceElapsed = 0;
    }
    if (actor.sequence) {
      actor.sequenceElapsed += delta;
      const duration = AI_CHARACTER_SEQUENCE_DURATIONS[actor.sequence];
      const local = actor.sequenceElapsed;
      const scene = getAICharacterSequence(actor.sequence, local);
      act = local < 150 ? blendAct(actor.sequenceOrigin, scene, local / 150)
        : local > duration - 190 ? blendAct(scene, act, (local - duration + 190) / 190) : scene;
      const eyes = actor.attention.pose;
      act.gazeX = act.gazeX * .55 + eyes.gazeX * .45;
      act.gazeY = act.gazeY * .55 + eyes.gazeY * .45;
      act.leftWink = Math.max(act.leftWink, eyes.leftWink);
      act.rightWink = Math.max(act.rightWink, eyes.rightWink);
      act.leftEyeSmile = Math.max(act.leftEyeSmile, eyes.leftEyeSmile);
      act.rightEyeSmile = Math.max(act.rightEyeSmile, eyes.rightEyeSmile);
      act.eyeScaleX *= .75 + eyes.eyeScaleX * .25;
      if (local >= duration) {
        actor.sequence = null;
        actor.gestureAt = actor.elapsed + 4300 + (actor.gestureIndex % 4) * 1300;
      }
    }
    const next = { ...act };
    for (const key of ACT_KEYS) {
      const shape = ['dumbbell', 'hourglass', 'heart', 'rocket'].includes(key);
      const follow = 1 - Math.exp(-(shape ? 22 : 52) * delta / 1000);
      const raw = act[key] - actor.currentAct[key];
      const difference = key === 'yaw' || key === 'pitch' ? Math.atan2(Math.sin(raw), Math.cos(raw)) : raw;
      next[key] = Math.abs(difference) < .0001 ? act[key] : actor.currentAct[key] + difference * follow;
    }
    const total = next.dumbbell + next.hourglass + next.heart + next.rocket;
    if (total > 1) for (const key of ['dumbbell', 'hourglass', 'heart', 'rocket']) next[key] /= total;
    actor.currentAct = next;
    draw(actor, next);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
